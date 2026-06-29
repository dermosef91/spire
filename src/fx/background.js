// Animated cosmic backdrop: a parallax starfield with drifting nebula motes and
// occasional shooting stars, rendered on a single full-screen canvas behind the
// UI. Cheap (a few hundred particles), DPR-aware, and honours reduced-motion.

export function mountBackground() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let stars = [], motes = [], shooting = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const count = Math.round((W * H) / 9000); // density
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        z: Math.random() * 0.8 + 0.2,          // parallax depth / brightness
        tw: Math.random() * Math.PI * 2,        // twinkle phase
        tws: Math.random() * 1.5 + 0.4,         // twinkle speed
        hue: Math.random() < 0.5 ? 45 : (Math.random() < 0.5 ? 280 : 175),
      });
    }
    // Glowing nebula motes (large soft gradients drifting slowly)
    const palette = [
      [224, 69, 123],  // magenta
      [52, 209, 191],  // teal
      [154, 123, 209], // violet
      [255, 206, 92],  // gold
    ];
    motes = [];
    const moteCount = Math.max(4, Math.round((W * H) / 220000));
    for (let i = 0; i < moteCount; i++) {
      motes.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 240 + 160,
        dx: (Math.random() - 0.5) * 0.08, dy: (Math.random() - 0.5) * 0.08,
        c: palette[i % palette.length], a: Math.random() * 0.08 + 0.05,
      });
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(48, now - last) / 1000;
    last = now;
    ctx.clearRect(0, 0, W, H);

    // Nebula motes
    for (const m of motes) {
      m.x += m.dx; m.y += m.dy;
      if (m.x < -m.r) m.x = W + m.r; if (m.x > W + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = H + m.r; if (m.y > H + m.r) m.y = -m.r;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      g.addColorStop(0, `rgba(${m.c[0]},${m.c[1]},${m.c[2]},${m.a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }

    // Stars
    for (const s of stars) {
      s.tw += s.tws * dt;
      const tw = 0.6 + 0.4 * Math.sin(s.tw);
      const a = s.z * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.hue === 45
        ? `rgba(255,228,160,${a})`
        : s.hue === 175 ? `rgba(170,240,225,${a})` : `rgba(210,190,255,${a})`;
      ctx.fill();
      if (!reduce) { s.y += s.z * 2 * dt; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; } }
    }

    // Occasional shooting star
    if (!reduce && Math.random() < 0.004 && shooting.length < 2) {
      shooting.push({ x: Math.random() * W * 0.6, y: Math.random() * H * 0.4, vx: 380 + Math.random() * 220, vy: 160 + Math.random() * 120, life: 1 });
    }
    for (let i = shooting.length - 1; i >= 0; i--) {
      const sh = shooting[i];
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt * 1.2;
      if (sh.life <= 0 || sh.x > W || sh.y > H) { shooting.splice(i, 1); continue; }
      const tailX = sh.x - sh.vx * 0.06, tailY = sh.y - sh.vy * 0.06;
      const g = ctx.createLinearGradient(tailX, tailY, sh.x, sh.y);
      g.addColorStop(0, 'rgba(255,228,160,0)');
      g.addColorStop(1, `rgba(255,240,200,${Math.min(1, sh.life)})`);
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(tailX, tailY); ctx.lineTo(sh.x, sh.y); ctx.stroke();
    }

    raf = requestAnimationFrame(frame);
  }

  let raf = null;
  resize();
  window.addEventListener('resize', debounce(resize, 200));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  raf = requestAnimationFrame(frame);
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

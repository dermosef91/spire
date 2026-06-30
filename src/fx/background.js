// Animated backdrop for the "Incandescent" theme: a deep-black field of
// white/amber stars, slow smoky orange nebula, a glowing horizontal audio
// waveform across the midline, and the occasional ember streak. DPR-aware and
// honours reduced-motion. Rendered on one full-screen canvas behind the UI.

const ORANGE = [255, 122, 26];
const AMBER = [255, 170, 60];

export function mountBackground() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let stars = [], motes = [], embers = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const count = Math.round((W * H) / 8000);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.4 + 0.3, z: Math.random() * 0.8 + 0.2,
        tw: Math.random() * Math.PI * 2, tws: Math.random() * 1.4 + 0.4,
        warm: Math.random() < 0.4,
      });
    }
    motes = [];
    const moteCount = Math.max(3, Math.round((W * H) / 260000));
    for (let i = 0; i < moteCount; i++) {
      motes.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 280 + 180,
        dx: (Math.random() - 0.5) * 0.07, dy: (Math.random() - 0.5) * 0.07,
        c: i % 3 === 0 ? AMBER : ORANGE, a: Math.random() * 0.06 + 0.04,
      });
    }
  }

  let last = performance.now();
  let t = 0;
  function frame(now) {
    const dt = Math.min(48, now - last) / 1000; last = now; t += dt;
    ctx.clearRect(0, 0, W, H);

    // smoky nebula
    for (const m of motes) {
      m.x += m.dx; m.y += m.dy;
      if (m.x < -m.r) m.x = W + m.r; if (m.x > W + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = H + m.r; if (m.y > H + m.r) m.y = -m.r;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      g.addColorStop(0, `rgba(${m.c[0]},${m.c[1]},${m.c[2]},${m.a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }

    // stars
    for (const s of stars) {
      s.tw += s.tws * dt;
      const a = s.z * (0.55 + 0.45 * Math.sin(s.tw));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.warm ? `rgba(255,176,80,${a})` : `rgba(245,240,230,${a})`;
      ctx.fill();
      if (!reduce) { s.y += s.z * 1.4 * dt; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; } }
    }

    // ember streaks rising
    if (!reduce && Math.random() < 0.02 && embers.length < 24) {
      embers.push({ x: Math.random() * W, y: H + 6, vy: -(20 + Math.random() * 45), vx: (Math.random() - 0.5) * 12, life: 1, r: Math.random() * 1.6 + 0.6 });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt * 0.35;
      if (e.life <= 0 || e.y < -6) { embers.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${120 + Math.random() * 60 | 0},40,${Math.min(0.9, e.life)})`;
      ctx.shadowColor = 'rgba(255,120,30,0.8)'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
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

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

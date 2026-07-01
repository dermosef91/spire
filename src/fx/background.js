// Animated backdrop for the "Incandescent" theme: a deep-black field of
// white/amber stars, slow smoky nebula, drifting embers — now act-themed,
// parallaxed to the pointer, and reactive to combat (colored pulses on big
// hits / deaths, brighter nebula while fighting). DPR-aware and honours
// reduced-motion. Rendered on one full-screen canvas behind the UI.
//
// mountBackground() returns a controller (also reachable via background()):
//   setAct(act)          — shift the palette to match the current act
//   setCombat(on)        — raise/lower ambient intensity for fights
//   pulse(kind, power)   — a brief colored flash: 'damage' | 'heavy' | 'gold' | 'heal'

// Palette per act: [nebula A, nebula B] colors + warm-star tint + ember hue.
const ACT_PALETTES = {
  1: { a: [40, 170, 150], b: [70, 200, 170], star: [140, 230, 210], ember: [90, 220, 190] },   // Sunken Market — teal
  2: { a: [255, 122, 26], b: [255, 170, 60], star: [255, 176, 80], ember: [255, 140, 40] },     // Brass Archive — amber (default)
  3: { a: [150, 110, 220], b: [110, 130, 240], star: [200, 182, 255], ember: [170, 150, 255] }, // Static Crown — violet
  title: { a: [255, 122, 26], b: [255, 170, 60], star: [255, 176, 80], ember: [255, 140, 40] },
};

const PULSE_COLORS = {
  damage: [255, 60, 40],
  heavy: [255, 180, 70],
  gold: [255, 206, 92],
  heal: [120, 230, 160],
};

let _controller = null;
export function background() { return _controller; }

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpRGB(from, to, t) { return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]; }

export function mountBackground() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let stars = [], motes = [], embers = [];

  // Live palette (eased toward `target`) so act transitions crossfade.
  let cur = { a: [...ACT_PALETTES.title.a], b: [...ACT_PALETTES.title.b], star: [...ACT_PALETTES.title.star], ember: [...ACT_PALETTES.title.ember] };
  let target = ACT_PALETTES.title;

  // Combat intensity (0..1) brightens the nebula and quickens embers.
  let intensity = 0, intensityTarget = 0;

  // Pointer parallax (normalized -0.5..0.5, eased).
  let pxT = 0, pyT = 0, px = 0, py = 0;

  // Reactive flash.
  let flashA = 0; let flashColor = [255, 122, 26];

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
        useB: i % 3 === 0, a: Math.random() * 0.06 + 0.04,
        depth: Math.random() * 0.6 + 0.3,
      });
    }
  }

  let last = performance.now();
  let t = 0;
  function frame(now) {
    const dt = Math.min(48, now - last) / 1000; last = now; t += dt;

    // Ease palette, intensity, parallax, flash toward their targets.
    const k = Math.min(1, dt * 1.6);
    cur.a = lerpRGB(cur.a, target.a, k);
    cur.b = lerpRGB(cur.b, target.b, k);
    cur.star = lerpRGB(cur.star, target.star, k);
    cur.ember = lerpRGB(cur.ember, target.ember, k);
    intensity = lerp(intensity, intensityTarget, Math.min(1, dt * 2));
    px = lerp(px, pxT, Math.min(1, dt * 3));
    py = lerp(py, pyT, Math.min(1, dt * 3));
    if (flashA > 0) flashA = Math.max(0, flashA - dt * 1.6);

    ctx.clearRect(0, 0, W, H);

    const nebBoost = 1 + intensity * 0.7;

    // smoky nebula (parallaxed by depth)
    for (const m of motes) {
      m.x += m.dx; m.y += m.dy;
      if (m.x < -m.r) m.x = W + m.r; if (m.x > W + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = H + m.r; if (m.y > H + m.r) m.y = -m.r;
      const ox = px * m.depth * 60, oy = py * m.depth * 40;
      const c = m.useB ? cur.b : cur.a;
      const g = ctx.createRadialGradient(m.x + ox, m.y + oy, 0, m.x + ox, m.y + oy, m.r);
      g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${m.a * nebBoost})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(m.x + ox - m.r, m.y + oy - m.r, m.r * 2, m.r * 2);
    }

    // stars (near stars parallax more)
    for (const s of stars) {
      s.tw += s.tws * dt;
      const a = s.z * (0.55 + 0.45 * Math.sin(s.tw));
      const ox = px * s.z * 34, oy = py * s.z * 22;
      ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.warm ? `rgba(${cur.star[0] | 0},${cur.star[1] | 0},${cur.star[2] | 0},${a})` : `rgba(245,240,230,${a})`;
      ctx.fill();
      if (!reduce) { s.y += s.z * 1.4 * dt; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; } }
    }

    // ember streaks rising (a touch more frequent mid-combat)
    const emberChance = 0.02 + intensity * 0.03;
    if (!reduce && Math.random() < emberChance && embers.length < 30) {
      embers.push({ x: Math.random() * W, y: H + 6, vy: -(20 + Math.random() * 45), vx: (Math.random() - 0.5) * 12, life: 1, r: Math.random() * 1.6 + 0.6 });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt * 0.35;
      if (e.life <= 0 || e.y < -6) { embers.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cur.ember[0] | 0},${cur.ember[1] | 0},${cur.ember[2] | 0},${Math.min(0.9, e.life)})`;
      ctx.shadowColor = `rgba(${cur.ember[0] | 0},${cur.ember[1] | 0},${cur.ember[2] | 0},0.8)`; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    }

    // reactive flash — an edge vignette in the pulse color
    if (flashA > 0.001) {
      const [fr, fg, fb] = flashColor;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(${fr},${fg},${fb},${Math.min(0.35, flashA)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    raf = requestAnimationFrame(frame);
  }

  let raf = null;
  resize();
  window.addEventListener('resize', debounce(resize, 200));
  if (!reduce) {
    window.addEventListener('pointermove', (e) => {
      pxT = (e.clientX / window.innerWidth) - 0.5;
      pyT = (e.clientY / window.innerHeight) - 0.5;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  raf = requestAnimationFrame(frame);

  _controller = {
    setAct(act) { target = ACT_PALETTES[act] || ACT_PALETTES.title; },
    setCombat(on) { intensityTarget = on ? 1 : 0; },
    pulse(kind = 'damage', power = 1) {
      if (reduce) return;
      flashColor = PULSE_COLORS[kind] || PULSE_COLORS.damage;
      flashA = Math.min(0.5, Math.max(flashA, 0.22 * power));
    },
  };
  return _controller;
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

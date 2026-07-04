// Combat visual effects: floating numbers, hit flashes, shakes, lunges, slashes
// and screen shake. These operate on a persistent overlay layer plus the
// (persistent) combatant elements, so they survive in-place board updates.

const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ensureFxLayer(scene) {
  let layer = scene.querySelector('.fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    scene.appendChild(layer);
  }
  return layer;
}

// Spawn a floating number/text at the given element's center.
export function floatText(layer, targetEl, text, kind = 'damage', opts = {}) {
  if (!layer || !targetEl) return;
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const x = tr.left - lr.left + tr.width / 2 + (Math.random() * 36 - 18);
  const y = tr.top - lr.top + tr.height * 0.32;
  const n = document.createElement('div');
  n.className = `float-num float-${kind}`;
  n.textContent = text;
  n.style.left = x + 'px';
  n.style.top = y + 'px';
  if (opts.size) n.style.fontSize = opts.size + 'px';
  layer.appendChild(n);
  setTimeout(() => n.remove(), 1100);
}

// Like floatText, but the payload is markup (e.g. an inline SVG icon + a
// number) rather than plain text.
export function floatHTML(layer, targetEl, html, kind = 'damage') {
  if (!layer || !targetEl) return;
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const x = tr.left - lr.left + tr.width / 2 + (Math.random() * 36 - 18);
  const y = tr.top - lr.top + tr.height * 0.32;
  const n = document.createElement('div');
  n.className = `float-num float-${kind}`;
  n.innerHTML = html;
  n.style.left = x + 'px';
  n.style.top = y + 'px';
  layer.appendChild(n);
  setTimeout(() => n.remove(), 1100);
}

export function hitFlash(el, kind = 'damage') {
  if (!el) return;
  const cls = kind === 'block' ? 'flash-block' : kind === 'heal' ? 'flash-heal' : 'flash-hit';
  el.classList.remove(cls);
  void el.offsetWidth; // restart animation
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 420);
}

export function shake(el, big = false) {
  if (!el || reduce()) return;
  const cls = big ? 'shake-big' : 'shake';
  el.classList.remove('shake', 'shake-big');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), big ? 520 : 360);
}

// Lunge an attacker toward its target. dir: 'right' (player→enemy) or 'left'.
// A `charged` lunge winds up and strikes harder — reserved for strong attacks
// (3+ QTE marks) that have charged up.
export function lunge(el, dir = 'right', charged = false) {
  if (!el || reduce()) return;
  const base = dir === 'right' ? 'lunge-right' : 'lunge-left';
  el.classList.remove('lunge-right', 'lunge-left', 'lunge-charged');
  void el.offsetWidth;
  el.classList.add(base);
  if (charged) el.classList.add('lunge-charged');
  setTimeout(() => el.classList.remove('lunge-right', 'lunge-left', 'lunge-charged'), charged ? 560 : 360);
}

// Charge-up flourish for strong attacks (3+ QTE marks). Energy motes converge
// into the attacker and a bright core ignites, so the ensuing strike lands as
// the release of stored power. `level` (3–5) burns brighter the cleaner the
// player's QTE timing. Purely cosmetic; respects reduced motion.
export function chargeUp(layer, combatantEl, level = 3) {
  if (!layer || !combatantEl || reduce()) return;
  const max = level >= 5;
  const lr = layer.getBoundingClientRect();
  const tr = combatantEl.getBoundingClientRect();
  const cx = tr.left - lr.left + tr.width / 2;
  const cy = tr.top - lr.top + tr.height * 0.46;
  const color = max ? '#ffe6a0' : '#ffb050';

  // Converging energy motes drawn from a ring that collapses onto the core.
  const count = Math.min(8 + level * 3, 22);
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 46 + Math.random() * 62;
    const p = document.createElement('div');
    p.className = 'charge-mote';
    p.style.left = (cx + Math.cos(ang) * dist) + 'px';
    p.style.top = (cy + Math.sin(ang) * dist) + 'px';
    p.style.color = color;
    p.style.setProperty('--dx', (-Math.cos(ang) * dist) + 'px');
    p.style.setProperty('--dy', (-Math.sin(ang) * dist) + 'px');
    p.style.animationDelay = (Math.random() * 0.12) + 's';
    layer.appendChild(p);
    setTimeout(() => p.remove(), 720);
  }

  // Bright core igniting over the attacker (screen-blended, no .stage anim).
  const core = document.createElement('div');
  core.className = max ? 'charge-core charge-core-max' : 'charge-core';
  core.style.left = cx + 'px';
  core.style.top = cy + 'px';
  layer.appendChild(core);
  setTimeout(() => core.remove(), 720);
}

export function slash(layer, targetEl) {
  singleFrameAnim(layer, targetEl, 'slash', { rotate: -30 });
}

export function ring(layer, targetEl, color) {
  if (!layer || !targetEl || reduce()) return;
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const r = document.createElement('div');
  r.className = 'ring-fx';
  r.style.left = (tr.left - lr.left + tr.width / 2) + 'px';
  r.style.top = (tr.top - lr.top + tr.height / 2) + 'px';
  if (color) r.style.borderColor = color;
  layer.appendChild(r);
  setTimeout(() => r.remove(), 560);
}

export function screenShake(container, big = false) {
  if (!container || reduce()) return;
  const cls = big ? 'scene-shake-big' : 'scene-shake';
  container.classList.remove('scene-shake', 'scene-shake-big');
  void container.offsetWidth;
  container.classList.add(cls);
  setTimeout(() => container.classList.remove(cls), big ? 480 : 300);
}

// Burst of small particles from an element (used on death / big hits).
export function burst(layer, targetEl, color = '#ffce5c', n = 14) {
  if (!layer || !targetEl || reduce()) return;
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const cx = tr.left - lr.left + tr.width / 2;
  const cy = tr.top - lr.top + tr.height / 2;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 40 + Math.random() * 70;
    p.style.left = cx + 'px'; p.style.top = cy + 'px';
    p.style.background = color;
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    layer.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

// Particle-based white/slightly blueish shine effect around character.
export function shine(layer, targetEl, n = 24) {
  if (!layer || !targetEl || reduce()) return;
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const cx = tr.left - lr.left + tr.width / 2;
  const cy = tr.top - lr.top + tr.height / 2;
  
  const colors = ['#ffffff', '#f2f9ff', '#d9efff', '#bfe3ff', '#e6f7ff', '#cbefff'];
  
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'shine-particle';
    
    // Spawn distributed within/around target bounds
    const rx = (Math.random() - 0.5) * tr.width * 0.95;
    const ry = (Math.random() - 0.5) * tr.height * 0.95;
    
    p.style.left = (cx + rx) + 'px';
    p.style.top = (cy + ry) + 'px';
    
    // Drift upwards and slightly horizontally
    const dy = -(40 + Math.random() * 80);
    const dx = (Math.random() - 0.5) * 50;
    
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--dy', dy + 'px');
    
    // Random sizes between 3px and 9px
    const size = 3 + Math.random() * 6;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.background = color;
    p.style.boxShadow = `0 0 10px ${color}, 0 0 4px #ffffff`;
    
    // Staggered launch delays for smooth flow
    const delay = Math.random() * 400;
    p.style.animationDelay = delay + 'ms';
    
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

// Spawns and plays a spritesheet animation (6 columns, 4 rows, 24 frames).
export function spriteAnim(layer, targetEl, name, opts = {}) {
  if (!layer || !targetEl || reduce()) return Promise.resolve();
  
  const frameWidth = 256;
  const frameHeight = 256;
  const cols = 6;
  const rows = 4;
  const totalFrames = opts.frames || 24;
  const fps = opts.fps || 35;
  
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  
  const el = document.createElement('div');
  el.className = `sprite-vfx sprite-vfx-${name}`;
  
  const cx = tr.left - lr.left + tr.width / 2;
  const cy = tr.top - lr.top + tr.height / 2;
  
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.width = frameWidth + 'px';
  el.style.height = frameHeight + 'px';
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.backgroundImage = `url('assets/animation sprites/${name}.png')`;
  el.style.backgroundSize = `${frameWidth * cols}px ${frameHeight * rows}px`;
  el.style.mixBlendMode = opts.blend || 'screen';
  
  layer.appendChild(el);
  
  return new Promise((resolve) => {
    let frame = 0;
    const interval = 1000 / fps;
    let lastTime = performance.now();
    
    function tick(now) {
      if (frame >= totalFrames) {
        el.remove();
        resolve();
        return;
      }
      
      const elapsed = now - lastTime;
      if (elapsed >= interval) {
        lastTime = now - (elapsed % interval);
        
        const col = frame % cols;
        const row = Math.floor(frame / cols);
        
        el.style.backgroundPosition = `-${col * frameWidth}px -${row * frameHeight}px`;
        
        frame++;
      }
      requestAnimationFrame(tick);
    }
    
    el.style.backgroundPosition = '0px 0px';
    requestAnimationFrame(tick);
  });
}

// Spawns and plays a single frame visual effect (e.g. 1536x1024 stretched cover, fading/scaling).
export function singleFrameAnim(layer, targetEl, name, opts = {}) {
  if (!layer || !targetEl || reduce()) return Promise.resolve();
  
  let scale = opts.scale || 1.15;
  let filter = opts.filter || 'none';
  let width = opts.width || 300;
  let height = opts.height || 200;
  const duration = opts.duration || 450;
  
  if (name === 'zap') {
    filter = 'brightness(2.5) saturate(1.5)';
    scale = opts.scale || 1.45;
    width = 320;
    height = 240;
  } else if (name === 'splash') {
    filter = 'brightness(2.8) saturate(1.4)';
    scale = opts.scale || 1.5;
    width = 340;
    height = 260;
  } else if (name === 'skyfall-hammer') {
    scale = opts.scale || 1.35;
    width = 340;
    height = 260;
  }
  
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  
  const el = document.createElement('div');
  el.className = `single-frame-vfx vfx-${name}`;
  
  const cx = tr.left - lr.left + tr.width / 2;
  const cy = tr.top - lr.top + tr.height / 2;
  
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  el.style.transform = 'translate(-50%, -50%) scale(0.6)';
  el.style.backgroundImage = `url('assets/animation sprites/${name}.png')`;
  el.style.backgroundSize = 'contain';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.mixBlendMode = opts.blend || 'screen';
  el.style.filter = filter;
  el.style.opacity = '0';
  el.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.8, 0.3, 1), opacity ${duration}ms ease-out`;
  
  layer.appendChild(el);
  
  // Trigger animation next frame
  requestAnimationFrame(() => {
    el.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${opts.rotate || (Math.random() * 20 - 10)}deg)`;
    el.style.opacity = '1';
    
    // Start fading out halfway through
    setTimeout(() => {
      el.style.opacity = '0';
    }, duration * 0.5);
  });
  
  return new Promise((resolve) => {
    setTimeout(() => {
      el.remove();
      resolve();
    }, duration);
  });
}


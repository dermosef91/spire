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
export function floatText(layer, targetEl, text, kind = 'damage') {
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
export function lunge(el, dir = 'right') {
  if (!el || reduce()) return;
  const cls = dir === 'right' ? 'lunge-right' : 'lunge-left';
  el.classList.remove('lunge-right', 'lunge-left');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 360);
}

export function slash(layer, targetEl) {
  if (!layer || !targetEl || reduce()) return;
  const lr = layer.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'slash-fx';
  s.style.left = (tr.left - lr.left + tr.width / 2) + 'px';
  s.style.top = (tr.top - lr.top + tr.height / 2) + 'px';
  layer.appendChild(s);
  setTimeout(() => s.remove(), 420);
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


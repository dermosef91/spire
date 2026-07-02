// Rhythm QTE overlay (Expedition-33-style timed hits). Attacks present 1-3
// directional marks — arrow keys on desktop, swipes on touch — graded
// perfect / good / miss against a note that closes on a target ring. Enemy
// attacks can be parried with a single well-timed press of any direction.
// The overlay is fully self-contained: it owns its DOM, its input listeners
// and its timing, and resolves a promise with the outcome. It never touches
// combat state and never consumes the seeded run RNG.
import { el, wait } from '../core/util.js';
import { audio } from '../audio.js';

// ---- tuning ----------------------------------------------------------------
const NOTE_TRAVEL_MS = 800;    // note spawn → target ring
const REDUCED_BEAT_MS = 420;   // per-beat pip cadence in the reduced-motion variant
const NOTE_GAP_MS = 380;       // breather between marks
const LEAD_IN_MS = 520;        // beat before the first note
const RESULT_MS = 700;         // final banner hold
const PERFECT_MS = 110;        // ± window (generous for touch latency)
const GOOD_MS = 260;           // ± window; outside = miss
const PARRY_WINDOW_MS = 150;   // ± single binary parry window
const SWIPE_MIN_PX = 30;       // below this a pointer gesture counts as a tap
export const MULT_PERFECT = 1.25;
export const MULT_GOOD = 1.0;
export const MULT_MISS = 0.5;

const DIRS = ['left', 'up', 'down', 'right'];
const GLYPH = { left: '◀', up: '▲', down: '▼', right: '▶', tap: '✦' };
const KEY_DIR = { ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right' };

export const rhythmReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- overlay + input plumbing ----------------------------------------------
function buildQTE(kind, isTouch) {
  const layer = el('div', { class: `qte-layer qte-${kind}` });
  const stage = el('div', { class: 'qte-stage' });
  stage.appendChild(el('div', { class: 'qte-target' }));
  const arrow = el('div', { class: 'qte-arrow' });
  stage.appendChild(arrow);
  const beats = el('div', { class: 'qte-beats' });
  for (let i = 0; i < 3; i++) beats.appendChild(el('span', { class: 'qte-beat' }));
  stage.appendChild(beats);
  layer.appendChild(stage);
  const hintText = kind === 'parry'
    ? (isTouch ? 'Tap in time to parry!' : 'Press any key in time to parry!')
    : (isTouch ? 'Swipe with the beat!' : 'Arrow keys with the beat!');
  layer.appendChild(el('div', { class: 'qte-hint', text: hintText }));
  document.body.appendChild(layer);

  let handler = null; // per-mark input sink: fn(dir) where dir ∈ DIRS | 'tap'
  const onKey = (e) => {
    const dir = KEY_DIR[e.key] || (e.key === ' ' || e.key === 'Enter' ? 'tap' : null);
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    if (handler) handler(dir);
  };
  let pStart = null;
  const onPDown = (e) => { pStart = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.preventDefault(); };
  const onPUp = (e) => {
    if (!pStart || e.pointerId !== pStart.id) return;
    const dx = e.clientX - pStart.x, dy = e.clientY - pStart.y;
    pStart = null;
    let dir = 'tap';
    if (Math.hypot(dx, dy) >= SWIPE_MIN_PX) {
      dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    if (handler) handler(dir);
  };
  document.addEventListener('keydown', onKey, true);
  layer.addEventListener('pointerdown', onPDown);
  layer.addEventListener('pointerup', onPUp);
  layer.addEventListener('pointercancel', () => { pStart = null; });

  return {
    layer, stage, arrow, beats,
    setHandler: (fn) => { handler = fn; },
    destroy: () => { document.removeEventListener('keydown', onKey, true); layer.remove(); },
  };
}

// ---- one mark ---------------------------------------------------------------
// Resolves 'perfect' | 'good' | 'miss'. `dir` null = any input counts (parry).
function playMark(ui, dir, { perfectMs = PERFECT_MS, goodMs = GOOD_MS } = {}) {
  return new Promise((resolve) => {
    const reduced = rhythmReduced();
    const travel = reduced ? REDUCED_BEAT_MS * 3 : NOTE_TRAVEL_MS;
    const start = performance.now();
    const target = start + travel;
    const timers = [];

    ui.arrow.textContent = GLYPH[dir || 'tap'];

    let note = null;
    if (reduced) {
      const pips = ui.beats.querySelectorAll('.qte-beat');
      pips.forEach((p) => p.classList.remove('lit'));
      pips.forEach((p, i) => timers.push(setTimeout(() => p.classList.add('lit'), REDUCED_BEAT_MS * (i + 1))));
    } else {
      note = el('div', { class: 'qte-note' });
      ui.stage.appendChild(note);
      // Linear shrink that passes through the target ring (scale 1) exactly at
      // `travel`, then keeps closing through the good window before timeout.
      const startScale = 2.6;
      const endScale = startScale + (1 - startScale) * ((travel + goodMs) / travel);
      note.style.transform = `scale(${startScale})`;
      void note.offsetWidth;
      note.style.transition = `transform ${travel + goodMs}ms linear`;
      note.style.transform = `scale(${endScale})`;
    }

    let done = false;
    const finish = (grade) => {
      if (done) return;
      done = true;
      ui.setHandler(null);
      timers.forEach(clearTimeout);
      if (note) note.remove();
      ui.arrow.textContent = '';
      ui.stage.classList.remove('hit-perfect', 'hit-good', 'hit-miss');
      void ui.stage.offsetWidth;
      ui.stage.classList.add(`hit-${grade}`);
      const pop = el('div', { class: `qte-pop qte-pop-${grade}`, text: grade === 'perfect' ? 'PERFECT!' : grade === 'good' ? 'GOOD' : 'MISS' });
      ui.stage.appendChild(pop);
      setTimeout(() => pop.remove(), 650);
      audio.play(grade === 'perfect' ? 'skill' : grade === 'good' ? 'hit' : 'error');
      resolve(grade);
    };

    timers.push(setTimeout(() => finish('miss'), travel + goodMs));
    ui.setHandler((input) => {
      if (dir && input === 'tap') return; // stray tap on a directional mark: ignore
      const dt = performance.now() - target;
      if (dt < -goodMs) { finish('miss'); return; } // spamming way early
      if (dir && input !== dir) { finish('miss'); return; }
      finish(Math.abs(dt) <= perfectMs ? 'perfect' : Math.abs(dt) <= goodMs ? 'good' : 'miss');
    });
  });
}

function showResult(layer, text, kind) {
  const banner = el('div', { class: `qte-result qte-result-${kind}`, text });
  layer.appendChild(banner);
  return wait(RESULT_MS);
}

// ---- public entry points ------------------------------------------------------
export async function runAttackQTE({ marks = 1, isTouch = false } = {}) {
  const ui = buildQTE('attack', isTouch);
  try {
    await wait(LEAD_IN_MS);
    const grades = [];
    for (let i = 0; i < marks; i++) {
      grades.push(await playMark(ui, DIRS[Math.floor(Math.random() * DIRS.length)]));
      if (i < marks - 1) await wait(NOTE_GAP_MS);
    }
    const grade = grades.every((g) => g === 'perfect') ? 'perfect'
      : grades.includes('miss') ? 'miss' : 'good';
    const mult = grade === 'perfect' ? MULT_PERFECT : grade === 'miss' ? MULT_MISS : MULT_GOOD;
    if (grade === 'perfect') audio.play('reward');
    await showResult(ui.layer, grade === 'perfect' ? `PERFECT! ×${MULT_PERFECT}` : grade === 'miss' ? `MISS ×${MULT_MISS}` : 'GOOD', grade);
    return { grade, mult };
  } finally {
    ui.destroy();
  }
}

export async function runParryQTE({ isTouch = false } = {}) {
  const ui = buildQTE('parry', isTouch);
  try {
    await wait(LEAD_IN_MS * 0.6);
    const grade = await playMark(ui, null, { perfectMs: PARRY_WINDOW_MS, goodMs: PARRY_WINDOW_MS });
    const success = grade !== 'miss';
    if (success) audio.play('skill');
    await showResult(ui.layer, success ? 'PARRIED!' : 'TOO SLOW', success ? 'perfect' : 'miss');
    return { success };
  } finally {
    ui.destroy();
  }
}

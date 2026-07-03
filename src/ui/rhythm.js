// Rhythm QTE overlay (Expedition-33-style timed hits), drawn as a horizontal
// timeline: diamond-framed direction marks sit on an ornamented track and a
// playhead cursor sweeps across it once — hit each mark's input as the cursor
// crosses it. Arrow keys on desktop, swipes on touch. Standard attacks show a
// single mark; multi-mark patterns are reserved for finisher cards via the
// `qteMarks` blueprint field. Enemy attacks can be parried with one well-timed
// press of anything.
// The overlay is fully self-contained: it owns its DOM, its input listeners
// and its timing, and resolves a promise with the outcome. It never touches
// combat state and never consumes the seeded run RNG.
import { el, wait } from '../core/util.js';
import { audio } from '../audio.js';

// ---- tuning ----------------------------------------------------------------
const SWEEP_BASE_MS = 900;     // cursor sweep floor (n=1 → ~1.55s total)
const SWEEP_PER_MARK_MS = 650; // added sweep time per mark
const PARRY_SWEEP_MS = 950;    // faster single-mark defensive sweep
const LEAD_IN_MS = 420;        // beat between panel appearing and the sweep
const RESULT_MS = 700;         // final banner hold
const PERFECT_MS = 110;        // ± window (generous for touch latency)
const GOOD_MS = 260;           // ± window; outside = miss
const PARRY_WINDOW_MS = 150;   // ± single binary parry window
const SWIPE_MIN_PX = 30;       // below this a pointer gesture counts as a tap
const REDUCED_STEPS_MS = 420;  // reduced motion: per-brightness-step cadence
export const MULT_PERFECT = 1.25;
export const MULT_GOOD = 1.0;
export const MULT_MISS = 0.5;

const DIRS = ['left', 'up', 'down', 'right'];
const GLYPH = { left: '◀', up: '▲', down: '▼', right: '▶', tap: '✦' };
const KEY_DIR = {
  ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right',
  w: 'up', a: 'left', s: 'down', d: 'right',
  W: 'up', A: 'left', S: 'down', D: 'right',
};

export const rhythmReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- overlay + input plumbing ----------------------------------------------
function buildQTE(kind, isTouch, marks) {
  const layer = el('div', { class: `qte-layer qte-${kind}` });
  const panel = el('div', { class: 'qte-panel' });
  const lineText = kind === 'parry'
    ? (isTouch ? 'Parry! Tap as the cursor strikes the mark.' : 'Parry! Press as the cursor strikes the mark.')
    : (isTouch ? 'Swipe each mark in time — timing decides your damage.' : 'Hit each mark in time — timing decides your damage.');
  panel.appendChild(el('div', { class: 'qte-line', text: lineText }));

  const track = el('div', { class: 'qte-track' });
  const markEls = [];
  for (let i = 0; i < marks.length; i++) {
    const m = el('div', {
      class: 'qte-mark',
      style: { left: `${((i + 1) / (marks.length + 1)) * 100}%` },
    }, [el('span', { class: 'qte-mark-glyph', text: GLYPH[marks[i] || 'tap'] })]);
    track.appendChild(m);
    markEls.push(m);
  }
  const cursor = el('div', { class: 'qte-cursor' });
  track.appendChild(cursor);
  panel.appendChild(track);
  layer.appendChild(panel);
  document.body.appendChild(layer);

  let handler = null; // input sink: fn(dir) where dir ∈ DIRS | 'tap'
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
    layer, panel, track, cursor, markEls,
    setHandler: (fn) => { handler = fn; },
    destroy: () => { document.removeEventListener('keydown', onKey, true); layer.remove(); },
  };
}

// ---- one sweep over all marks -------------------------------------------------
// Resolves an array of 'perfect' | 'good' | 'miss', one per mark. `dirs[i]`
// null = any input counts (parry).
function playSweep(ui, dirs, { sweepMs, perfectMs = PERFECT_MS, goodMs = GOOD_MS } = {}) {
  return new Promise((resolve) => {
    const reduced = rhythmReduced();
    const n = dirs.length;
    const start = performance.now();
    // Mark i's target time = its fractional position along the sweep.
    const targets = dirs.map((_, i) => start + sweepMs * ((i + 1) / (n + 1)));
    const grades = new Array(n).fill(null);
    const timers = [];
    let next = 0; // earliest unresolved mark

    if (reduced) {
      // No sweeping cursor: each mark brightens through 3 discrete steps and
      // the input lands on full brightness.
      for (let i = 0; i < n; i++) {
        for (let s = 1; s <= 3; s++) {
          timers.push(setTimeout(() => {
            if (grades[i] === null) ui.markEls[i].dataset.step = String(s);
          }, (targets[i] - start) - REDUCED_STEPS_MS * (3 - s)));
        }
      }
    } else {
      // One linear left→right pass; transform is set from JS so the sweep
      // duration constant lives in this file only.
      ui.cursor.style.transform = 'translateX(0)';
      void ui.cursor.offsetWidth;
      ui.cursor.style.transition = `transform ${sweepMs}ms linear`;
      ui.cursor.style.transform = `translateX(${ui.track.clientWidth}px)`;
    }

    const settle = (i, grade) => {
      grades[i] = grade;
      const m = ui.markEls[i];
      m.classList.add(`qte-hit-${grade}`);
      audio.play(grade === 'perfect' ? 'skill' : grade === 'good' ? 'hit' : 'error');
      while (next < n && grades[next] !== null) next++;
      if (next >= n) {
        ui.setHandler(null);
        timers.forEach(clearTimeout);
        // Let the last flash read before resolving.
        setTimeout(() => resolve(grades), 260);
      }
    };

    // Auto-miss any mark the cursor passes unanswered.
    for (let i = 0; i < n; i++) {
      timers.push(setTimeout(() => { if (grades[i] === null) settle(i, 'miss'); }, (targets[i] - start) + goodMs));
    }

    ui.setHandler((input) => {
      const i = next;
      if (i >= n || grades[i] !== null) return;
      const dir = dirs[i];
      if (dir && input === 'tap') return; // stray tap on a directional mark: ignore
      const dt = performance.now() - targets[i];
      if (dt < -goodMs) { settle(i, 'miss'); return; } // spamming way early
      if (dir && input !== dir) { settle(i, 'miss'); return; }
      settle(i, Math.abs(dt) <= perfectMs ? 'perfect' : Math.abs(dt) <= goodMs ? 'good' : 'miss');
    });
  });
}

function showResult(panel, text, kind) {
  panel.appendChild(el('div', { class: `qte-result qte-result-${kind}`, text: `‹ ${text} ›` }));
  return wait(RESULT_MS);
}

// ---- public entry points ------------------------------------------------------
export async function runAttackQTE({ marks = 1, isTouch = false } = {}) {
  const dirs = [];
  for (let i = 0; i < marks; i++) dirs.push(DIRS[Math.floor(Math.random() * DIRS.length)]);
  const ui = buildQTE('attack', isTouch, dirs);
  try {
    await wait(LEAD_IN_MS);
    const sweepMs = SWEEP_BASE_MS + marks * SWEEP_PER_MARK_MS;
    const grades = await playSweep(ui, dirs, { sweepMs });
    const grade = grades.every((g) => g === 'perfect') ? 'perfect'
      : grades.includes('miss') ? 'miss' : 'good';
    const mult = grade === 'perfect' ? MULT_PERFECT : grade === 'miss' ? MULT_MISS : MULT_GOOD;
    if (grade === 'perfect') audio.play('reward');
    await showResult(ui.panel, grade === 'perfect' ? `PERFECT! ×${MULT_PERFECT}` : grade === 'miss' ? `MISS ×${MULT_MISS}` : 'GOOD', grade);
    return { grade, mult };
  } finally {
    ui.destroy();
  }
}

export async function runParryQTE({ isTouch = false } = {}) {
  const ui = buildQTE('parry', isTouch, [null]);
  try {
    await wait(LEAD_IN_MS * 0.6);
    const [grade] = await playSweep(ui, [null], { sweepMs: PARRY_SWEEP_MS, perfectMs: PARRY_WINDOW_MS, goodMs: PARRY_WINDOW_MS });
    const success = grade !== 'miss';
    if (success) audio.play('skill');
    return { success };
  } finally {
    ui.destroy();
  }
}

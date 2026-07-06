// Rhythm QTE overlay (Expedition-33-style timed hits). Attacks present 1-3
// directional marks — arrow keys or WASD on desktop, swipes on touch — graded
// perfect / good / miss against a note that closes on a target ring. Enemy
// attacks can be parried with a single well-timed press of any direction.
// The overlay is fully self-contained: it owns its DOM, its input listeners
// and its timing, and resolves a promise with the outcome. It never touches
// combat state and never consumes the seeded run RNG.
import { el, wait } from '../core/util.js';
import { audio } from '../audio.js';
import { UI } from './icons.js';

// ---- tuning ----------------------------------------------------------------
const NOTE_TRAVEL_MS = 800;    // note spawn → target ring
const REDUCED_BEAT_MS = 420;   // per-beat pip cadence in the reduced-motion variant
const NOTE_GAP_MS = 380;       // breather between marks
const LEAD_IN_MS = 520;        // beat before the first note
const RESULT_MS = 700;         // final banner hold
const PERFECT_MS = 65;         // ± window (strict for rhythmic precision)
const GOOD_MS = 260;           // ± window; outside = miss
const PARRY_WINDOW_MS = 150;   // ± single binary parry window
const SWIPE_MIN_PX = 30;       // below this a pointer gesture counts as a tap
const CLICK_DIR_MIN_PX = 26;   // stationary clicks this far off ring-center count as a direction
export const MULT_PERFECT = 1.25;
export const MULT_GOOD = 1.0;
export const MULT_MISS = 0.5;

const DIRS = ['left', 'up', 'down', 'right'];
const DIR_WORD = { left: 'LEFT', up: 'UP', down: 'DOWN', right: 'RIGHT' };
const KEY_DIR = {
  ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right',
  w: 'up', a: 'left', s: 'down', d: 'right',
  W: 'up', A: 'left', S: 'down', D: 'right'
};

export const rhythmReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- overlay + input plumbing ----------------------------------------------
// `directional` = this run of marks includes directional swipes (bigger
// attacks' multi-step parries), not just a single any-direction tap/press.
function buildQTE(kind, isTouch, directional = false) {
  const layer = el('div', { class: `qte-layer qte-${kind}` });
  // Stage + labels live in a shared wrapper so the whole overlay (ring and
  // its label stack together) can be nudged sideways per kind — attacks
  // toward the enemy side, parries toward the player side — without
  // shifting the full-viewport dimming scrim itself.
  const content = el('div', { class: 'qte-content' });
  const stage = el('div', { class: 'qte-stage' });
  stage.appendChild(el('div', { class: 'qte-rings', html: UI.qteRings }));
  stage.appendChild(el('div', { class: 'qte-target' }));
  const dir = el('div', { class: 'qte-dir', html: UI.qteChevrons });
  dir.style.visibility = 'hidden';
  stage.appendChild(dir);
  const beats = el('div', { class: 'qte-beats' });
  for (let i = 0; i < 3; i++) beats.appendChild(el('span', { class: 'qte-beat' }));
  stage.appendChild(beats);
  content.appendChild(stage);
  // "SWIPE UP" / "TO STRIKE" label stack (direction word set per mark).
  const verb = kind === 'parry'
    ? (isTouch ? (directional ? 'SWIPE' : 'TAP') : 'PRESS')
    : (isTouch ? 'SWIPE' : 'PRESS');
  const labelMain = el('div', { class: 'qte-label-main' });
  const labelSub = el('div', { class: 'qte-label-sub', text: kind === 'parry' ? 'TO PARRY' : 'TO STRIKE' });
  content.appendChild(el('div', { class: 'qte-labels' }, [labelMain, labelSub]));
  layer.appendChild(content);
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
    } else {
      // Stationary click/tap: mouse players can click on the chevron's side of
      // the ring instead of reaching for the keyboard — the direction is read
      // from where the click lands relative to the target ring's center.
      // Clicks near the center stay a plain 'tap' (ignored on directional
      // marks, still a valid parry press).
      const r = stage.getBoundingClientRect();
      const cx = e.clientX - (r.left + r.width / 2), cy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(cx, cy) >= CLICK_DIR_MIN_PX) {
        dir = Math.abs(cx) >= Math.abs(cy) ? (cx > 0 ? 'right' : 'left') : (cy > 0 ? 'down' : 'up');
      }
    }
    if (handler) handler(dir);
  };
  document.addEventListener('keydown', onKey, true);
  layer.addEventListener('pointerdown', onPDown);
  layer.addEventListener('pointerup', onPUp);
  layer.addEventListener('pointercancel', () => { pStart = null; });

  return {
    layer, stage, dir, beats, verb, labelMain,
    setHandler: (fn) => { handler = fn; },
    destroy: () => { document.removeEventListener('keydown', onKey, true); layer.remove(); },
  };
}

// ---- one mark ---------------------------------------------------------------
// Resolves 'perfect' | 'good' | 'miss'. `dir` null = any input counts (parry).
function playMark(ui, dir, { perfectMs = PERFECT_MS, goodMs = GOOD_MS, isTutorial = false } = {}) {
  return new Promise((resolve) => {
    const reduced = rhythmReduced();
    const travel = reduced ? REDUCED_BEAT_MS * 3 : NOTE_TRAVEL_MS;
    const start = performance.now();
    const target = start + travel;
    const timers = [];
    let isPaused = false;

    if (dir) {
      ui.dir.dataset.dir = dir;
      ui.dir.classList.add('show');
      ui.dir.style.visibility = 'visible';
      ui.labelMain.textContent = `${ui.verb} ${DIR_WORD[dir]}`;
    } else {
      // Parry: no direction — the amber target ring is the cue.
      ui.dir.classList.remove('show');
      ui.dir.style.visibility = 'hidden';
      ui.labelMain.textContent = ui.verb;
    }

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
      ui.dir.classList.remove('show');
      ui.dir.style.visibility = 'hidden';
      ui.stage.classList.remove('hit-perfect', 'hit-good', 'hit-miss');
      void ui.stage.offsetWidth;
      ui.stage.classList.add(`hit-${grade}`);
      const pop = el('div', { class: `qte-pop qte-pop-${grade}`, text: grade === 'perfect' ? 'PERFECT!' : grade === 'good' ? 'GOOD' : 'MISS' });
      ui.stage.appendChild(pop);
      setTimeout(() => pop.remove(), 650);
      if (grade !== 'good') audio.play(grade === 'perfect' ? 'skill' : 'error');
      resolve(grade);
    };

    if (isTutorial) {
      const pauseTimer = setTimeout(() => {
        if (done) return;
        isPaused = true;
        if (note) {
          const computed = window.getComputedStyle(note).transform;
          note.style.transition = 'none';
          note.style.transform = computed;
        }
        timers.forEach(clearTimeout);
        if (window.__ase && window.__ase.tutorial) {
          window.__ase.tutorial.onQTEPaused(dir);
        }
      }, 500);
      timers.push(pauseTimer);
    } else {
      timers.push(setTimeout(() => finish('miss'), travel + goodMs));
    }

    ui.setHandler((input) => {
      if (dir && input === 'tap') return; // stray tap on a directional mark: ignore
      if (isPaused) {
        if (dir && input !== dir) return;
        isPaused = false;
        if (window.__ase && window.__ase.tutorial) {
          window.__ase.tutorial.onQTEActionExecuted();
        }
        finish('perfect');
        return;
      }
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
export async function runAttackQTE({ marks = 1, isTouch = false, isTutorial = false } = {}) {
  const ui = buildQTE('attack', isTouch);
  try {
    await wait(LEAD_IN_MS);
    const grades = [];
    for (let i = 0; i < marks; i++) {
      const targetDir = (isTutorial && i === 0) ? 'right' : DIRS[Math.floor(Math.random() * DIRS.length)];
      grades.push(await playMark(ui, targetDir, { isTutorial: isTutorial && i === 0 }));
      if (i < marks - 1) await wait(NOTE_GAP_MS);
    }
    const grade = grades.every((g) => g === 'perfect') ? 'perfect'
      : grades.includes('miss') ? 'miss' : 'good';
    const mult = grade === 'perfect' ? MULT_PERFECT : grade === 'miss' ? MULT_MISS : MULT_GOOD;
    if (grade === 'perfect') audio.play('reward');
    // Resolve immediately on the graded hit so the caller can fire the
    // strike's SFX/VFX right away — the grade banner is purely cosmetic and
    // must not hold up the actual attack. Clear the dimming scrim/stage so
    // the strike isn't hidden behind them, and let the banner play out and
    // tear down the overlay in the background.
    ui.layer.classList.add('qte-clear');
    showResult(ui.layer, grade === 'perfect' ? `PERFECT! ×${MULT_PERFECT}` : grade === 'miss' ? `MISS ×${MULT_MISS}` : 'GOOD', grade)
      .then(() => ui.destroy());
    return { grade, mult };
  } catch (err) {
    ui.destroy();
    throw err;
  }
}

// `marks` scales the block QTE with the size of the incoming attack: a plain
// single hit is still one any-direction tap, but a bigger/multi-hit strike
// demands a short sequence of timed directional swipes — one shot per blow,
// any miss in the sequence breaks the parry. Capped at 3 like the attack QTE.
export async function runParryQTE({ isTouch = false, isTutorial = false, marks = 1 } = {}) {
  const clampedMarks = Math.max(1, Math.min(3, marks));
  const directional = clampedMarks > 1;
  const ui = buildQTE('parry', isTouch, directional);
  try {
    await wait(LEAD_IN_MS * 0.6);
    const grades = [];
    for (let i = 0; i < clampedMarks; i++) {
      const targetDir = directional ? DIRS[Math.floor(Math.random() * DIRS.length)] : null;
      grades.push(await playMark(ui, targetDir, {
        perfectMs: PARRY_WINDOW_MS,
        goodMs: PARRY_WINDOW_MS,
        isTutorial: isTutorial && i === 0,
      }));
      if (i < clampedMarks - 1) await wait(NOTE_GAP_MS);
    }
    const success = !grades.includes('miss');
    if (success) audio.play('skill');
    return { success };
  } finally {
    ui.destroy();
  }
}

window.__runAttackQTE = runAttackQTE;
window.__runParryQTE = runParryQTE;

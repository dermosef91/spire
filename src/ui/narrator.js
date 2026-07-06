// The griot narrator — the Spire's own voice, surfaced as a single styled
// caption at key run beats (see src/data/narrator-lines.js for the prose). It
// is STRICTLY COSMETIC: it never reads or mutates combat/run logic, it only
// shows text. One instance lives on the Game as `game.narrator`.
//
// Gating (per line, from LINES[id].gate):
//   'meta'   — once ever, persisted via a meta flag (line.metaKey). The marquee
//              first-play beats live here so they land inside the first run.
//   'run'    — once per run, tracked in an in-memory Set cleared by resetRun()
//              from startRun(). Re-firing after a mid-run reload is tolerated.
//   'always' — fires every time (endpoint screens, which each render once).
// A caller may pass opts.gate to override (e.g. 'always' for preview/testing).
//
// Rendering: a body-level fixed host holds at most ONE caption at a time; extra
// beats queue FIFO (capped, oldest dropped) and play one after another. Honors
// prefers-reduced-motion (opacity-only, no transforms) like fx.js / game.js.

import { el } from '../core/util.js';
import { saveMeta } from '../core/save.js';
import { LINES } from '../data/narrator-lines.js';

const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const QUEUE_CAP = 3;      // burst guard: never let more than this back up
const IN_MS = 180;        // rise-in (skipped under reduced motion)
const OUT_MS = 600;       // fade-out
const HOLD_MS = 4200;     // reading room for a full griot line
const HOLD_MS_REDUCED = 3500;

export class Narrator {
  constructor(game) {
    this.game = game;
    this.seenRun = new Set();   // 'run'-gated ids fired this run
    this.queue = [];            // [{ text }]
    this.showing = false;
    this.host = null;           // lazily created fixed overlay
    this._timer = null;
  }

  // Clear per-run state (called from startRun so RUN beats reset between runs).
  resetRun() {
    this.seenRun.clear();
    this.queue.length = 0;
  }

  // Look up a beat, apply gating, enqueue its line. Unknown ids are ignored.
  say(id, opts = {}) {
    const line = LINES[id];
    if (!line) return;
    const gate = opts.gate || line.gate || 'run';
    if (gate === 'meta') {
      const key = line.metaKey || `narr_${id}`;
      if (this.game.meta[key]) return;
      this.game.meta[key] = true;
      saveMeta(this.game.meta);
    } else if (gate === 'run') {
      if (this.seenRun.has(id)) return;
      this.seenRun.add(id);
    }
    // 'always' falls through with no gate check.
    this.enqueue(line.text);
  }

  enqueue(text) {
    this.queue.push({ text });
    if (this.queue.length > QUEUE_CAP) this.queue.shift(); // drop oldest on a burst
    if (!this.showing) this.pump();
  }

  ensureHost() {
    if (this.host && document.body.contains(this.host)) return this.host;
    this.host = el('div', { class: 'narrator-host' });
    document.body.appendChild(this.host);
    return this.host;
  }

  pump() {
    const next = this.queue.shift();
    if (!next) { this.showing = false; return; }
    this.showing = true;
    const host = this.ensureHost();
    const cap = el('div', { class: 'narrator-caption', text: next.text });
    host.appendChild(cap);

    const reduced = reduce();
    const hold = reduced ? HOLD_MS_REDUCED : HOLD_MS;

    // Hold, then fade out and advance to the next queued line.
    this._timer = setTimeout(() => {
      cap.classList.add('narrator-out');
      const done = () => {
        cap.remove();
        this.pump();
      };
      if (reduced) setTimeout(done, 120);
      else setTimeout(done, OUT_MS);
    }, hold + (reduced ? 0 : IN_MS));
  }
}

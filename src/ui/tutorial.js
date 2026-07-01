// First-play combat tutorial: a lightweight, self-contained coach-mark overlay
// that spotlights real, live combat UI and walks a new player through reading
// enemy intent, spending Àṣẹ, playing a card and ending the turn.
//
// It is deliberately decoupled from the combat engine: it observes public
// state on the `combat` instance (energy, hand, turn, over) by wrapping the
// bound `onUpdate` callback, and reads the DOM by selector each step so it
// keeps working as the view re-renders combatants in place. Purely cosmetic —
// it never mutates game state.
import { el } from '../core/util.js';
import { button } from './components.js';
import { audio } from '../audio.js';

const STEPS = [
  {
    title: 'The Climb Begins',
    body: 'Welcome, champion. Battles in the Spire are won with cards. Let me show you how to fight.',
    target: null,
  },
  {
    title: 'Read the Intent',
    body: 'Each foe telegraphs its next move above its head. A blade means it will strike you — the number is how hard. Plan around what is coming.',
    target: '.combatant.enemy',
    pad: 8,
  },
  {
    title: 'Your Àṣẹ',
    body: 'Àṣẹ is your energy for the turn. Every card costs Àṣẹ to play, and it refills at the start of each of your turns.',
    target: '.combat-controls .energy',
    pad: 12,
  },
  {
    title: 'Your Hand',
    body: 'These are the cards you drew. Attacks deal damage; skills grant Block and other boons. Block soaks up incoming damage before it touches your health.',
    target: '.hand',
    pad: 6,
  },
  {
    title: 'Strike!',
    body: 'Play a card by dragging it onto a foe — or simply tapping it. Try playing an attack now.',
    target: '.hand',
    pad: 6,
    await: 'play',
    hint: 'Drag or tap a card to play it',
  },
  {
    title: 'End Your Turn',
    body: 'When you have spent the Àṣẹ you want, end your turn and let your foe act. Go ahead.',
    target: '.end-turn',
    pad: 10,
    await: 'endturn',
    hint: 'Press End Turn',
  },
  {
    title: 'Àṣẹ Be With You',
    body: 'Defeat every foe to earn gold, cards and relics, then climb toward the Obsidian Spire. The rest is yours to discover.',
    target: null,
  },
];

export class CombatTutorial {
  constructor(game, combat, onDone) {
    this.game = game;
    this.combat = combat;
    this.onDone = onDone || (() => {});
    this.i = 0;
    this.layer = null;
    this._await = null;
    this._done = false;
    this._reposition = () => this.position();
  }

  start() {
    if (this.combat.over) { this.finish(); return; }

    this.layer = el('div', { class: 'tut-layer' });
    this.catcher = el('div', { class: 'tut-catch' });
    this.spot = el('div', { class: 'tut-spot' });
    this.card = el('div', { class: 'tut-card' });
    this.layer.appendChild(this.catcher);
    this.layer.appendChild(this.spot);
    this.layer.appendChild(this.card);
    document.body.appendChild(this.layer);

    // Observe combat progress by chaining the view's bound update callback.
    this._origUpdate = this.combat.onUpdate;
    this.combat.onUpdate = () => {
      this._origUpdate();
      this.onCombatUpdate();
    };

    window.addEventListener('resize', this._reposition, { passive: true });
    this.render();
  }

  render() {
    const step = STEPS[this.i];
    const interactive = !!step.await;

    // Informational steps freeze the board so the player reads; action steps
    // leave the game fully interactive so the highlighted move can be made.
    this.catcher.style.display = interactive ? 'none' : 'block';
    this.spot.classList.toggle('interactive', interactive);

    // Build the coach card.
    this.card.innerHTML = '';
    this.card.appendChild(el('div', { class: 'tut-step', text: `${this.i + 1} / ${STEPS.length}` }));
    this.card.appendChild(el('h4', { text: step.title }));
    this.card.appendChild(el('p', { text: step.body }));

    const actions = el('div', { class: 'tut-actions' });
    if (interactive) {
      actions.appendChild(el('div', { class: 'tut-hint', text: step.hint || 'Try it' }));
    } else {
      const last = this.i === STEPS.length - 1;
      actions.appendChild(button(last ? 'Begin' : 'Next', () => this.next(), 'primary'));
    }
    actions.appendChild(el('button', { class: 'tut-skip', text: 'Skip tutorial', on: { click: () => this.finish() } }));
    this.card.appendChild(actions);

    // Snapshot baseline state for action steps.
    if (interactive) {
      this._await = {
        type: step.await,
        energy: this.combat.energy,
        hand: this.combat.hand.length,
        turn: this.combat.turn,
      };
    } else {
      this._await = null;
    }

    requestAnimationFrame(() => this.position());
  }

  position() {
    if (this._done) return;
    const step = STEPS[this.i];
    const vw = window.innerWidth, vh = window.innerHeight;
    const target = step.target ? document.querySelector(step.target) : null;
    const r = target ? target.getBoundingClientRect() : null;

    if (r && r.width > 0 && r.height > 0) {
      const pad = step.pad != null ? step.pad : 10;
      const x = r.left - pad, y = r.top - pad;
      const w = r.width + pad * 2, h = r.height + pad * 2;
      this.spot.style.display = 'block';
      this.spot.style.left = x + 'px';
      this.spot.style.top = y + 'px';
      this.spot.style.width = w + 'px';
      this.spot.style.height = h + 'px';
      this.placeCard(x, y, w, h, vw, vh);
    } else {
      // Centered step: hide the cut-out, dim the whole screen via the spot.
      this.spot.style.display = 'block';
      this.spot.style.left = (vw / 2) + 'px';
      this.spot.style.top = (vh / 2) + 'px';
      this.spot.style.width = '0px';
      this.spot.style.height = '0px';
      const cr = this.card.getBoundingClientRect();
      this.card.style.left = Math.round((vw - cr.width) / 2) + 'px';
      this.card.style.top = Math.round((vh - cr.height) / 2) + 'px';
    }
  }

  placeCard(x, y, w, h, vw, vh) {
    const cr = this.card.getBoundingClientRect();
    const margin = 12, gap = 16;
    const targetMidY = y + h / 2;
    // Place below when the highlight sits in the top half, otherwise above.
    let top = targetMidY < vh * 0.5 ? y + h + gap : y - cr.height - gap;
    top = Math.max(margin, Math.min(vh - cr.height - margin, top));
    // Center horizontally on the target, clamped to the viewport.
    let left = x + w / 2 - cr.width / 2;
    left = Math.max(margin, Math.min(vw - cr.width - margin, left));
    this.card.style.left = Math.round(left) + 'px';
    this.card.style.top = Math.round(top) + 'px';
  }

  onCombatUpdate() {
    if (this._done) return;
    if (this.combat.over) { this.finish(); return; }
    const a = this._await;
    if (a) {
      let advance = false;
      if (a.type === 'play') advance = this.combat.energy < a.energy || this.combat.hand.length < a.hand;
      else if (a.type === 'endturn') advance = this.combat.turn > a.turn;
      if (advance) { this._await = null; this.next(); return; }
    }
    // Board re-rendered in place; keep the spotlight glued to the target.
    this.position();
  }

  next() {
    if (this._done) return;
    audio.play('select');
    if (this.i >= STEPS.length - 1) { this.finish(); return; }
    this.i += 1;
    this.render();
  }

  finish() {
    if (this._done) return;
    this._done = true;
    window.removeEventListener('resize', this._reposition);
    if (this.combat.onUpdate && this._origUpdate) this.combat.onUpdate = this._origUpdate;
    if (this.layer) {
      this.layer.classList.add('tut-out');
      const layer = this.layer;
      setTimeout(() => { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 240);
      this.layer = null;
    }
    this.onDone();
  }
}

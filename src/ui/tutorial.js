// First-play combat tutorial: a single coaching banner that reacts to what the
// player does. It never touches game logic — it reads live combat state
// (energy, hand, turn, over) by chaining the view's `onUpdate` callback and
// advances when the player actually plays a card or ends their turn.
import { el } from '../core/util.js';
import { button } from './components.js';
import { audio } from '../audio.js';

const STEPS = [
  {
    text: 'Cards win battles. Each costs Àṣẹ — your energy, refilled every turn. Above each foe, its intent shows what it will do next.',
    button: 'Got it',
  },
  {
    text: 'Your turn. Play a card by dragging it onto a foe — or simply tapping it.',
    await: 'play',
  },
  {
    text: 'Well struck. Now end your turn and let your foe act.',
    await: 'endturn',
  },
  {
    text: 'That is the loop. Defeat every foe for rewards, then climb toward the Spire. Àṣẹ be with you.',
    button: 'Begin',
  },
];

export class CombatTutorial {
  constructor(game, combat, onDone) {
    this.game = game;
    this.combat = combat;
    this.onDone = onDone || (() => {});
    this.i = 0;
    this.done = false;
  }

  start() {
    if (this.combat.over) { this.finish(); return; }
    this.banner = el('div', { class: 'tut-banner' });
    document.body.appendChild(this.banner);

    // Observe combat progress by chaining the view's bound update callback.
    this._origUpdate = this.combat.onUpdate;
    this.combat.onUpdate = () => { this._origUpdate(); this.onUpdate(); };

    this.render();
  }

  render() {
    const step = STEPS[this.i];
    this.banner.innerHTML = '';
    this.banner.appendChild(el('p', { class: 'tut-text', text: step.text }));

    const row = el('div', { class: 'tut-row' });
    if (step.await) {
      row.appendChild(el('span', { class: 'tut-hint', text: step.await === 'play' ? 'Play a card ↓' : 'End your turn →' }));
      // Snapshot state so we can tell when the player acts.
      this.snap = { energy: this.combat.energy, hand: this.combat.hand.length, turn: this.combat.turn };
    } else {
      this.snap = null;
      row.appendChild(button(step.button, () => this.next(), 'primary'));
    }
    row.appendChild(el('button', { class: 'tut-skip', text: 'Skip', on: { click: () => this.finish() } }));
    this.banner.appendChild(row);
  }

  onUpdate() {
    if (this.done) return;
    if (this.combat.over) { this.finish(); return; }
    const s = this.snap;
    if (!s) return;
    const step = STEPS[this.i];
    const acted = step.await === 'play'
      ? (this.combat.energy < s.energy || this.combat.hand.length < s.hand)
      : (this.combat.turn > s.turn);
    if (acted) this.next();
  }

  next() {
    if (this.done) return;
    audio.play('select');
    if (this.i >= STEPS.length - 1) { this.finish(); return; }
    this.i += 1;
    this.render();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    if (this._origUpdate) this.combat.onUpdate = this._origUpdate;
    if (this.banner) { this.banner.remove(); this.banner = null; }
    this.onDone();
  }
}

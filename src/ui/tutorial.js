// First-play combat tutorial: a single coaching banner that reacts to what the
// player does, plus a lightweight outline (`.tut-highlight`) on whatever it is
// currently talking about. It never touches game logic — it reads live combat
// state (energy, hand, turn, over) by chaining the view's `onUpdate` callback
// and advances when the player actually plays the right kind of card or ends
// their turn. `game.js` pins the very first monster fight to a guaranteed
// attack-opener (Husk Drone) so the "the foe is about to strike" step is
// always true — see `startMonster()`.
import { el } from '../core/util.js';
import { button } from './components.js';
import { audio } from '../audio.js';

const isBlockCard = (c) => c.type === 'skill' && (c.block || 0) > 0;
const isAttackCard = (c) => c.type === 'attack';

export class CombatTutorial {
  constructor(game, combat, onDone) {
    this.game = game;
    this.combat = combat;
    this.onDone = onDone || (() => {});
    this.i = 0;
    this.done = false;
    this.targetUid = null;

    const rhythm = this.game.rhythmOn();
    const isTouch = this.game.isTouch();

    if (rhythm) {
      this.steps = [
        {
          text: 'Cards win battles. Each costs Àṣẹ — your energy, refilled every turn.',
          button: 'Next',
          highlight: () => ['.hand .card', '.combat-controls .energy-orb'],
        },
        {
          text: 'Above each foe, its intent shows what it will do next.',
          button: 'Next',
          highlight: () => ['.combatant.enemy .intent'],
          align: 'left', // keep the banner off the intent pill on small screens
        },
        {
          text: 'The foe is about to strike. Play a Block skill to shield yourself.',
          await: 'block',
          hint: 'Play the highlighted card',
        },
        {
          text: 'Well shielded. Now play an Attack card.',
          await: 'attack',
          hint: 'Play the highlighted card',
        },
        {
          text: `TIME YOUR STRIKE! ${isTouch ? 'Swipe right' : 'Press the Right Arrow key (or D)'} when the ring matches the circle to strike harder!`,
          await: 'qte_action',
          hint: isTouch ? 'Swipe Right ➔' : 'Press Right Arrow ➔',
        },
        {
          text: `Well struck. Now end your turn. When the foe attacks, time your ${isTouch ? 'tap' : 'press'} to PARRY and preserve your block!`,
          await: 'endturn',
          hint: 'End your turn →',
          highlight: () => ['.end-turn'],
        },
        {
          text: 'That is the loop. Defeat every foe for rewards, then climb toward the Spire. Àṣẹ be with you.',
          button: 'Begin',
        },
      ];
    } else {
      this.steps = [
        {
          text: 'Cards win battles. Each costs Àṣẹ — your energy, refilled every turn.',
          button: 'Next',
          highlight: () => ['.hand .card', '.combat-controls .energy-orb'],
        },
        {
          text: 'Above each foe, its intent shows what it will do next.',
          button: 'Next',
          highlight: () => ['.combatant.enemy .intent'],
          align: 'left',
        },
        {
          text: 'The foe is about to strike. Play a Block skill to shield yourself.',
          await: 'block',
          hint: 'Play the highlighted card',
        },
        {
          text: 'Well shielded. Now hit back — play an Attack card.',
          await: 'attack',
          hint: 'Play the highlighted card',
        },
        {
          text: 'Well struck. Now end your turn and let your foe act.',
          await: 'endturn',
          hint: 'End your turn →',
          highlight: () => ['.end-turn'],
        },
        {
          text: 'That is the loop. Defeat every foe for rewards, then climb toward the Spire. Àṣẹ be with you.',
          button: 'Begin',
        },
      ];
    }
  }

  start() {
    if (this.combat.over) { this.finish(); return; }
    this.game.tutorial = this;
    this.banner = el('div', { class: 'tut-banner' });
    document.body.appendChild(this.banner);

    // Observe combat progress by chaining the view's bound update callback.
    this._origUpdate = this.combat.onUpdate;
    this.combat.onUpdate = () => { this._origUpdate(); this.onUpdate(); };

    this.render();
  }

  render() {
    const step = this.steps[this.i];
    this.banner.classList.toggle('tut-left', step.align === 'left');
    this.banner.innerHTML = '';
    this.banner.appendChild(el('p', { class: 'tut-text', text: step.text }));

    const row = el('div', { class: 'tut-row' });
    if (step.await) {
      row.appendChild(el('span', { class: 'tut-hint', text: step.hint }));
    } else {
      row.appendChild(button(step.button, () => this.next(), 'primary'));
    }
    row.appendChild(el('button', { class: 'tut-skip', text: 'Skip', on: { click: () => this.finish() } }));
    this.banner.appendChild(row);

    // Snapshot what we're waiting for, and which card (if any) to point at.
    this.targetUid = null;
    if (step.await === 'block' || step.await === 'attack') {
      const match = this.combat.hand.find(step.await === 'block' ? isBlockCard : isAttackCard);
      this.targetUid = match ? match.uid : null;
      this.snap = { kind: step.await, matched: !!match, handLen: this.combat.hand.length };
    } else if (step.await === 'endturn') {
      this.snap = { kind: 'endturn', turn: this.combat.turn };
    } else {
      this.snap = null;
    }

    this.applyHighlight();
  }

  applyHighlight() {
    document.querySelectorAll('.tut-highlight').forEach((el2) => el2.classList.remove('tut-highlight'));
    const step = this.steps[this.i];
    const selectors = step.highlight ? step.highlight() : [];
    if (this.targetUid) selectors.push(`.hand .card[data-uid="${this.targetUid}"]`);
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el2) => el2.classList.add('tut-highlight'));
    }
  }

  onUpdate() {
    if (this.done) return;
    if (this.combat.over) { this.finish(); return; }
    this.applyHighlight();
    const s = this.snap;
    if (!s) return;
    let advanced = false;
    if (s.kind === 'block' || s.kind === 'attack') {
      if (s.matched) advanced = !this.combat.hand.some((c) => c.uid === this.targetUid);
      else advanced = this.combat.hand.length < s.handLen; // no matching card was in hand — don't block progress
    } else if (s.kind === 'endturn') {
      advanced = this.combat.turn > s.turn;
    }
    if (advanced) this.next();
  }

  onQTEPaused(dir) {
    if (!dir) return; // ignore parry pause in the tutorial banner step machine
    const qteStepIdx = this.steps.findIndex((s) => s.await === 'qte_action');
    if (qteStepIdx !== -1) {
      this.i = qteStepIdx;
      this.render();
    }
  }

  onQTEActionExecuted() {
    const qteStepIdx = this.steps.findIndex((s) => s.await === 'qte_action');
    if (qteStepIdx !== -1 && this.i === qteStepIdx) {
      this.i = qteStepIdx + 1;
      this.render();
    }
  }

  next() {
    if (this.done) return;
    audio.play('select');
    if (this.i >= this.steps.length - 1) { this.finish(); return; }
    this.i += 1;
    this.render();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.game.tutorial = null;
    if (this._origUpdate) this.combat.onUpdate = this._origUpdate;
    document.querySelectorAll('.tut-highlight').forEach((el2) => el2.classList.remove('tut-highlight'));
    if (this.banner) { this.banner.remove(); this.banner = null; }
    this.onDone();
  }
}

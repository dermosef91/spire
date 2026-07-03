// First-play combat tutorial: a single coaching banner that reacts to what the
// player does, plus a lightweight outline (`.tut-highlight`) on whatever it is
// currently talking about. It never touches game logic — it reads live combat
// state (energy, hand, turn, over) by chaining the view's `onUpdate` callback
// and advances when the player actually plays the right kind of card or ends
// their turn. `game.js` pins the very first monster fight to a guaranteed
// attack-opener (Husk Drone) so the "the foe is about to strike" step is
// always true — see `startMonster()`.
//
// When Rhythm QTEs are enabled (the default), the tutorial includes extra steps
// that teach the attack QTE and parry mechanics. Rhythm is suppressed for the
// first three steps (hand/intent/block) and then unsuppressed so the player
// experiences the QTEs with coaching guidance. If Rhythm is off, the tutorial
// uses the classic 6-step flow with no QTE steps.
import { el } from '../core/util.js';
import { button } from './components.js';
import { audio } from '../audio.js';
import { runParryQTE } from './rhythm.js';

const isBlockCard = (c) => c.type === 'skill' && (c.block || 0) > 0;
const isAttackCard = (c) => c.type === 'attack';

// ---- shared opening steps (both flows) ------------------------------------
const BASE_STEPS = [
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
];

// ---- rhythm-on flow: teaches attack QTE then parry ------------------------
const RHYTHM_STEPS = [
  {
    text: 'Attack cards trigger a Rhythm Strike — press or swipe the shown direction when the ring closes for bonus damage. Play an Attack to try it.',
    await: 'attack',
    hint: 'Play the highlighted card',
    onEnter(tut) { tut.view.rhythmSuppressed = false; },
  },
  {
    text: 'Well struck! Timing is everything — PERFECT earns \u00d71.25 damage, a MISS halves it. You can toggle Rhythm on or off from the title screen.',
    button: 'Next',
  },
  {
    text: 'Now end your turn. When the foe strikes while you have Block, you will get a Parry prompt — time it to keep your shield.',
    await: 'endturn',
    hint: 'End your turn \u2192',
    highlight: () => ['.end-turn'],
    onEnter(tut) {
      tut.combat.parryPrompt = () => runParryQTE({ isTouch: tut.game.isTouch() });
    },
  },
  {
    text: 'A successful Parry lets your Block absorb the hit. Miss it and the strike bypasses your shield — straight to HP.',
    button: 'Next',
  },
];

// ---- classic flow (rhythm off): original attack + end turn ----------------
const CLASSIC_STEPS = [
  {
    text: 'Well shielded. Now hit back — play an Attack card.',
    await: 'attack',
    hint: 'Play the highlighted card',
  },
  {
    text: 'Well struck. Now end your turn and let your foe act.',
    await: 'endturn',
    hint: 'End your turn \u2192',
    highlight: () => ['.end-turn'],
  },
];

// ---- shared closing step --------------------------------------------------
const FINAL_STEP = {
  text: 'That is the loop. Defeat every foe for rewards, then climb toward the Spire. \u00c0\u1e63\u1eb9 be with you.',
  button: 'Begin',
};

export class CombatTutorial {
  constructor(game, combat, onDone, view) {
    this.game = game;
    this.combat = combat;
    this.onDone = onDone || (() => {});
    this.view = view || null;
    this.i = 0;
    this.done = false;
    this.targetUid = null;
    // Build the step list: rhythm-aware when QTEs are on, classic otherwise.
    const middle = (view && game.rhythmOn()) ? RHYTHM_STEPS : CLASSIC_STEPS;
    this.steps = [...BASE_STEPS, ...middle, FINAL_STEP];
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
    const step = this.steps[this.i];
    // Per-step side effects (e.g. unsuppressing rhythm for QTE steps).
    if (step.onEnter) step.onEnter(this);

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
    if (this._origUpdate) this.combat.onUpdate = this._origUpdate;
    document.querySelectorAll('.tut-highlight').forEach((el2) => el2.classList.remove('tut-highlight'));
    if (this.banner) { this.banner.remove(); this.banner = null; }
    // Ensure rhythm is fully enabled for the rest of this fight if the player
    // skipped before the QTE teaching steps ran their onEnter hooks.
    if (this.view && this.game.rhythmOn()) {
      this.view.rhythmSuppressed = false;
      if (!this.combat.parryPrompt) {
        this.combat.parryPrompt = () => runParryQTE({ isTouch: this.game.isTouch() });
      }
    }
    this.onDone();
  }
}

// Combat entry/exit: starting a fight (monster/elite/boss), mounting the combat
// view + first-play tutorial, and handling the aftermath (HP write-back, relic
// hooks, rewards).
//
// Mixed onto Game.prototype (see game.js). The combat view is constructed with
// `this` (the Game) so it can call back into tooltip/isTouch; `view.onEnd` wires
// the beginCombat → afterCombat → showRewards chain.

import { el } from '../core/util.js';
import { saveMeta } from '../core/save.js';
import { RELICS } from '../data/relics.js';
import { Combat } from '../combat/combat.js';
import { CombatView } from '../ui/combatView.js';
import { CombatTutorial } from '../ui/tutorial.js';
import { background } from '../fx/background.js';
import { audio } from '../audio.js';

export const CombatScene = {
  startMonster() {
    this.run._actMonster = (this.run._actMonster || 0) + 1;
    const tier = this.run._actMonster <= 2 ? 'weak' : 'normal';
    // Pin the very first monster fight to a guaranteed attack-opener so the
    // tutorial's "the foe is about to strike" step is always true.
    const isTutorialFight = !this.meta.tutorialDone && this.run._actMonster === 1;
    const encounter = isTutorialFight ? ['husk_drone'] : this.pickEncounter(tier);
    this.beginCombat(encounter, 'monster');
  },
  startElite() { this.beginCombat(this.pickEncounter('elite'), 'elite'); },
  startBoss() { this.beginCombat(this.pickEncounter('boss'), 'boss'); },

  beginCombat(enemyIds, kind) {
    audio.setCombat(true, kind === 'boss');
    const bg = background(); if (bg) bg.setCombat(true);
    const combat = new Combat(this.run, enemyIds, { kind });
    const view = new CombatView(this, combat);
    view.onEnd = (c) => this.afterCombat(c, kind);
    const holder = el('div', { class: 'combat-holder' });
    this.setScene(holder, 'combat');
    view.mount(holder);
    // First-ever combat: run the interactive tutorial once the opening draw settles.
    if (!this.meta.tutorialDone && kind === 'monster') {
      const finishTutorial = () => { this.meta.tutorialDone = true; saveMeta(this.meta); };
      setTimeout(() => {
        if (combat.over) { finishTutorial(); return; }
        new CombatTutorial(this, combat, finishTutorial).start();
      }, 1700); // after the Battle Start popup + deferred opening draw settle
    }
  },

  afterCombat(combat, kind) {
    audio.setCombat(false);
    const bg = background(); if (bg) bg.setCombat(false);
    // Write HP back
    this.run.hp = Math.max(0, combat.player.hp);
    if (!combat.victory) { this.gameOver(false); return; }
    audio.play('reward');
    // combat-end relic hooks
    for (const rid of this.run.relics) {
      const r = RELICS[rid];
      if (r && r.combatEnd) r.combatEnd(this.run);
    }
    this.showRewards(kind);
  },
};

// Combat entry/exit: starting a fight (monster/elite/boss), mounting the combat
// view + first-play tutorial, and handling the aftermath (HP write-back, relic
// hooks, rewards).
//
// Mixed onto Game.prototype (see game.js). The combat view is constructed with
// `this` (the Game) so it can call back into tooltip/isTouch; `view.onEnd` wires
// the beginCombat → afterCombat → showRewards chain.

import { el } from '../core/util.js';
import { saveMeta, saveRun } from '../core/save.js';
import { RELICS } from '../data/relics.js';
import { ENEMIES } from '../data/enemies.js';
import { Combat } from '../combat/combat.js';
import { CombatView } from '../ui/combatView.js';
import { CombatTutorial, MultiEnemyTutorial } from '../ui/tutorial.js';
import { background } from '../fx/background.js';
import { audio } from '../audio.js';

export const CombatScene = {
  startMonster() {
    this.run._actMonster = (this.run._actMonster || 0) + 1;
    // Fights escalate within an act: the first two draw from the `weak` pool,
    // the 5th onward from `hard` (where the act defines one — pickEncounter
    // falls back to `normal`), so the act keeps pace with a growing deck.
    const n = this.run._actMonster;
    const tier = n <= 2 ? 'weak' : (n >= 5 ? 'hard' : 'normal');
    // Pin the very first monster fight to a guaranteed attack-opener so the
    // tutorial's "the foe is about to strike" step is always true.
    const isTutorialFight = !this.meta.tutorialDone && this.run._actMonster === 1;
    const encounter = isTutorialFight ? ['husk_drone'] : this.pickEncounter(tier);
    // Reactive map (#18): a "hardened" act toughens its monster fights.
    const mods = (!isTutorialFight && this.run.actFlags && this.run.actFlags.hardened)
      ? { enemyHpMult: 1.2 } : {};
    this.beginCombat(encounter, 'monster', mods);
  },
  startElite() {
    // Nemesis rematch (#19): the first elite of the run becomes the buffed
    // "Rendered <name>" fight. Hardened acts (#18) toughen elites too.
    const nemId = this.nemesisForThisFight();
    if (nemId) { this.beginCombat([nemId], 'elite', { nemesisId: nemId }); return; }
    const mods = (this.run.actFlags && this.run.actFlags.hardened) ? { enemyHpMult: 1.2 } : {};
    this.beginCombat(this.pickEncounter('elite'), 'elite', mods);
  },
  startBoss() {
    // Reactive map (#18): mercy earlier in the act shields you at the wall.
    const mods = (this.run.actFlags && this.run.actFlags.blessed) ? { playerStartBlock: 12 } : {};
    this.beginCombat(this.pickEncounter('boss'), 'boss', mods);
  },

  // Returns the enemy id to promote into this run's one nemesis rematch, or
  // null. Consumes the once-per-run guard (persisted, so a mid-run reload can't
  // re-trigger it) and ignores a stale/removed enemy id from an old save.
  nemesisForThisFight() {
    const run = this.run;
    const nem = this.meta.lastNemesis;
    if (!nem || run.nemesisDone || !ENEMIES[nem.id]) return null;
    run.nemesisDone = true;
    saveRun(run);
    return nem.id;
  },

  beginCombat(enemyIds, kind, mods = {}) {
    audio.setCombat(true, kind === 'boss');
    const bg = background(); if (bg) bg.setCombat(true);
    const combat = new Combat(this.run, enemyIds, { kind, mods });
    window.__combat = combat; // console debugging, like window.__ase
    const view = new CombatView(this, combat);
    this.combatView = view;
    view.onEnd = (c) => this.afterCombat(c, kind);
    const holder = el('div', { class: 'combat-holder' });
    this.setScene(holder, 'combat');
    view.mount(holder);
    // First-ever combat: run the interactive tutorial once the opening draw
    // settles.
    if (!this.meta.tutorialDone && kind === 'monster') {
      const finishTutorial = () => { this.meta.tutorialDone = true; saveMeta(this.meta); };
      setTimeout(() => {
        if (combat.over) { finishTutorial(); return; }
        new CombatTutorial(this, combat, finishTutorial).start();
      }, 1700); // after the Battle Start popup + deferred opening draw settle
    } else if (!this.meta.multiEnemyTutorialDone && combat.enemies.length > 1 && kind === 'monster') {
      const finishMulti = () => { this.meta.multiEnemyTutorialDone = true; saveMeta(this.meta); };
      setTimeout(() => {
        if (combat.over) { finishMulti(); return; }
        new MultiEnemyTutorial(this, combat, finishMulti).start();
      }, 1700);
    }
  },

  afterCombat(combat, kind) {
    this.combatView = null;
    audio.setCombat(false);
    const bg = background(); if (bg) bg.setCombat(false);
    // Write HP back
    this.run.hp = Math.max(0, combat.player.hp);
    if (!combat.victory) {
      this.gameOver(false, { slainBy: combat.lastAttacker, slainById: combat.lastAttackerId });
      return;
    }
    audio.play('reward');
    // Nemesis avenged (#19): a bounty, and the debt is cleared so a subsequent
    // won run doesn't drag the same nemesis forward.
    if (combat.mods && combat.mods.nemesisId) {
      this.run.gold += 40;
      this.meta.lastNemesis = null;
      saveMeta(this.meta);
    }
    // combat-end relic hooks
    for (const rid of this.run.relics) {
      const r = RELICS[rid];
      if (r && r.combatEnd) r.combatEnd(this.run);
    }
    this.showRewards(kind);
  },
};

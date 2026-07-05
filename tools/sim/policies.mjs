// Decision policies for the balance simulator.
//
// These are deliberately simple, readable heuristics — a "reasonable player",
// not a perfect solver. They are the ONE part of the simulator that is not the
// game's own code, because the game leaves these choices to a human. Swap or
// tune them to model different skill levels or archetypes; the numbers the
// simulator reports are only as meaningful as the policy that produced them.
//
// All policies read live card/enemy fields (cost, dmg, block, hits, type,
// rarity, target) straight off the instances the engine builds, so they keep
// working when you add or rebalance content.

import { createCard, upgradeCard } from '../../src/data/cards.js';
import { POTIONS } from '../../src/data/potions.js';
import { nextNodes, nodeAt } from '../../src/map/mapgen.js';
import { estimateCardDamage, estimateBlockFromCard, estimateIncoming } from './harness.mjs';

// ===========================================================================
// PLAYER (in-combat card play)
// ===========================================================================
//
// Priority each decision, re-evaluated after every card:
//   1. Powers          — invest early (cheapest first).
//   2. Block, if the telegraphed hit would break through current Ward.
//   3. Attacks         — secure kills first, then biggest damage.
//   4. Other utility   — draw / channel / debuffs (keeps the engine moving).
//   5. X-cost cards    — dumped last so they don't eat energy other cards want.
// Returning null ends the turn.

export const defaultPlayerPolicy = {
  name: 'greedy-heuristic',

  // Called once at the start of each player turn. Players hoard potions for the
  // hard fights and emergencies, so this only spends them in elite/boss fights
  // (or when death is imminent). Runs against the real POTIONS.use hooks.
  usePotions(combat) {
    const run = combat.run;
    if (!run.potions || !run.potions.length) return;
    const hard = combat.opts && (combat.opts.kind === 'elite' || combat.opts.kind === 'boss');
    const hpFrac = combat.player.hp / combat.player.maxHp;
    const desperate = hpFrac < 0.35;
    if (!hard && !desperate) return;

    // Iterate a snapshot; use() removes from run.potions.
    for (const id of run.potions.slice()) {
      const p = POTIONS[id];
      if (!p) continue;
      let want = false;
      if (id === 'fairy_brew') want = combat.turn <= 1;          // survival insurance up front
      else if (id === 'elixir') want = hpFrac < 0.5;             // heal when hurt
      else if (id === 'fury_brew') want = hard;                  // big AoE nuke for tough fights
      else if (id === 'ward_brew') want = estimateIncoming(combat) - combat.player.block > 10;
      else if (id === 'rage_brew' || id === 'focus_brew') want = combat.turn <= 2; // scaling early
      else if (id === 'blight_brew') want = hard;
      else if (id === 'weak_brew') want = combat.livingEnemies().length >= 2 || hard;
      else if (id === 'swift_brew' || id === 'energy_brew') want = hard && combat.turn <= 2;
      if (!want) continue;
      const target = p.targeted ? pickAttackTarget(combat) : null;
      combat.usePotion(p, target);
      const i = run.potions.indexOf(id);
      if (i >= 0) run.removePotionAt(i);
    }
  },

  chooseCard(combat, playable) {
    const nonX = playable.filter((c) => c.cost !== 'X');
    const xCards = playable.filter((c) => c.cost === 'X');

    // 1. Powers first.
    const powers = nonX.filter((c) => c.type === 'power');
    if (powers.length) {
      powers.sort((a, b) => a.cost - b.cost);
      return { card: powers[0], target: pickAttackTarget(combat) };
    }

    // 2. Defensive need.
    const threat = Math.max(0, estimateIncoming(combat) - combat.player.block);
    if (threat > 0) {
      const blockers = nonX.filter((c) => c.block > 0 && !c.dmg);
      if (blockers.length) {
        blockers.sort((a, b) => estimateBlockFromCard(combat, b) - estimateBlockFromCard(combat, a));
        return { card: blockers[0], target: null };
      }
    }

    // 3. Attacks — prefer a lethal blow, else the hardest hit.
    const attackers = nonX.filter((c) => c.dmg > 0);
    if (attackers.length) {
      let best = null;
      let bestScore = -Infinity;
      for (const card of attackers) {
        const target = card.target === 'enemy' ? pickAttackTarget(combat) : null;
        const dmg = card.target === 'all'
          ? combat.livingEnemies().reduce((s, e) => s + estimateCardDamage(combat, card, e), 0)
          : estimateCardDamage(combat, card, target || combat.livingEnemies()[0]);
        const lethal = target && target.alive && dmg >= (target.hp + target.block) ? 1000 : 0;
        const score = dmg + lethal;
        if (score > bestScore) { bestScore = score; best = { card, target }; }
      }
      if (best) return best;
    }

    // 4. Remaining utility (draw, channel, debuffs, leftover block+draw skills).
    const util = nonX.filter((c) => c.type !== 'attack');
    if (util.length) {
      util.sort((a, b) => a.cost - b.cost);
      return { card: util[0], target: pickAttackTarget(combat) };
    }

    // 5. X-cost dumps.
    if (xCards.length && combat.energy > 0) {
      // Prefer AoE X (whirlwind) when several enemies, else single evoke/X.
      xCards.sort((a, b) => (b.target === 'all' ? 1 : 0) - (a.target === 'all' ? 1 : 0));
      return { card: xCards[0], target: pickAttackTarget(combat) };
    }

    return null; // end turn
  },
};

// Target the lowest-effective-HP living enemy so damage converts to kills
// (fewer enemies alive => less incoming damage).
function pickAttackTarget(combat) {
  const living = combat.livingEnemies();
  if (!living.length) return null;
  return living.reduce((best, e) =>
    (e.hp + e.block) < (best.hp + best.block) ? e : best, living[0]);
}

// ===========================================================================
// PATH (which node to walk to on the act map)
// ===========================================================================
//
// "Simulate different paths" => by default pick a random reachable node each
// step, so running many seeds samples the space of routes. Alternative named
// strategies let you A/B a play-style against the same content.

export function makePathPolicy(strategy = 'random') {
  const scorers = {
    // Pure random walk.
    random: () => Math.random(),
    // Seek fights & elites (more rewards, more risk) — stress test.
    aggressive: (type) => ({ elite: 5, monster: 4, boss: 5, treasure: 3, shop: 2, event: 1, rest: 1 }[type] ?? 1) + Math.random(),
    // Duck fights, prefer rests/shops/events — attrition test.
    cautious: (type) => ({ rest: 5, shop: 4, event: 4, treasure: 3, monster: 2, boss: 5, elite: 1 }[type] ?? 1) + Math.random(),
  };
  const score = scorers[strategy] || scorers.random;
  return {
    name: strategy,
    choose(run, reachable) {
      if (reachable.length === 1) return reachable[0];
      let best = reachable[0];
      let bestScore = -Infinity;
      for (const pos of reachable) {
        const type = pos.boss ? 'boss' : nodeAt(run.map, pos).type;
        const s = score(type);
        if (s > bestScore) { bestScore = s; best = pos; }
      }
      return best;
    },
  };
}

// ===========================================================================
// DECK (card rewards + rest-site smithing)
// ===========================================================================
//
// A crude drafter: value cards by rarity/role, take the best offered card while
// the deck is still lean, get pickier as it grows. Upgrades the highest-value
// un-upgraded card when smithing.

const RARITY_VALUE = { basic: 0, common: 2, uncommon: 4, rare: 7, special: 1 };

export function cardValue(entry) {
  const c = createCard(entry.id);
  let v = RARITY_VALUE[c.rarity] ?? 2;
  if (c.type === 'power') v += 3;
  if (c.dmg) v += (c.dmg * (c.hits || 1)) / 6;
  if (c.block) v += c.block / 6;
  if (entry.upgraded) v += 1.5;
  return v;
}

export const defaultDeckPolicy = {
  name: 'value-drafter',
  // options: array of card instances (from cardRewardOptions). Return the id to
  // add (+ upgraded flag) or null to skip.
  pickCardReward(run, options) {
    if (!options.length) return null;
    const scored = options.map((c) => ({ c, v: cardValue({ id: c.id, upgraded: c.upgraded }) }));
    scored.sort((a, b) => b.v - a.v);
    const best = scored[0];
    // Build a body of cards early, then grow pickier so the deck stays drawable
    // instead of bloating with weak basics.
    const threshold = run.deck.length < 14 ? 2 : run.deck.length < 20 ? 4 : 6;
    if (best.v < threshold) return null;
    return { id: best.c.id, upgraded: best.c.upgraded };
  },
  // Choose a deck index to upgrade when smithing at a fire (or null).
  pickUpgrade(run) {
    let bestI = -1;
    let bestV = -Infinity;
    run.deck.forEach((entry, i) => {
      if (entry.upgraded) return;
      const c = createCard(entry.id);
      if (c.type === 'status' || c.type === 'curse') return;
      const v = cardValue(entry);
      if (v > bestV) { bestV = v; bestI = i; }
    });
    return bestI;
  },
};

// ===========================================================================
// REST (heal vs. smith at an Ancestor Fire)
// ===========================================================================

export const defaultRestPolicy = {
  name: 'upgrade-then-heal',
  // Return 'heal' or 'smith'. A competent player invests early rests in upgrades
  // (permanent power spikes) and only falls back to healing when genuinely low,
  // since upgrades are what let a deck keep pace with rising enemy HP.
  choose(run) {
    const hurt = run.hp / run.maxHp < 0.5;
    const hasUpgradeTarget = run.deck.some((e) => !e.upgraded);
    if (run.canRestHeal() && (hurt || !hasUpgradeTarget)) return 'heal';
    if (hasUpgradeTarget) return 'smith';
    return run.canRestHeal() ? 'heal' : 'smith';
  },
};

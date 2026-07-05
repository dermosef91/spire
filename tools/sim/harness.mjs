// Headless combat harness.
//
// The whole point of this file: run the REAL combat engine (src/combat/combat.js)
// with the REAL cards / enemies / relics / powers, but with no DOM and no browser.
// Because it imports the game's own modules, any balance change you make to the
// data files (new cards, tweaked enemy HP, new relics, reworked powers) is picked
// up automatically the next time you run the simulator — there is nothing to keep
// in sync by hand.
//
// The engine's turn flow (Combat.endTurn -> enemyPhase) is async and paces itself
// with util.wait(ms) -> setTimeout. We neutralise those delays so thousands of
// fights resolve instantly, without touching a line of game code.

import { Combat } from '../../src/combat/combat.js';
import { ENEMIES } from '../../src/data/enemies.js';

// --- Make wait(ms) resolve immediately -------------------------------------
// util.wait returns `new Promise(res => setTimeout(res, ms))`. Replacing the
// global timer with a zero-delay microtask keeps the async ordering intact but
// removes the real-time cost. We do this once, at import time.
const _realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => {
  // Preserve async semantics (don't call fn synchronously) but with ~0 delay.
  return _realSetTimeout(fn, 0);
};

// A hard cap so a pathological stalemate (all-block deck vs all-block enemy)
// can never hang the simulator.
const MAX_TURNS = 300;

// ---------------------------------------------------------------------------
// Damage / threat estimation helpers, shared by the default player policy.
// These mirror the engine's own math (calcAttackDamage) closely enough to make
// sensible decisions; they are heuristics for the bot, not authoritative rules.

export function estimateCardDamage(combat, card, target) {
  if (!card.dmg) return 0;
  const hits = card.hits || 1;
  let per = card.dmg + (combat.player.powers.strength || 0);
  if (combat.player.powers.weak) per = Math.floor(per * 0.75);
  if (target && target.powers.vulnerable) per = Math.floor(per * 1.5);
  return Math.max(0, per) * hits;
}

export function estimateBlockFromCard(combat, card) {
  if (!card.block) return 0;
  let b = card.block + (combat.player.powers.dexterity || 0);
  if (combat.player.powers.frail) b = Math.floor(b * 0.75);
  return Math.max(0, b);
}

// Estimated unblocked damage the player will eat next enemy phase, given the
// enemies' currently telegraphed intents.
export function estimateIncoming(combat) {
  let total = 0;
  for (const e of combat.livingEnemies()) {
    const it = e.intent;
    if (!it || !it.dmg) continue;
    if (it.type !== 'attack' && it.type !== 'attackdebuff') continue;
    const hits = it.hits || 1;
    let per = it.dmg + (e.powers.strength || 0);
    if (e.powers.weak) per = Math.floor(per * 0.75);
    if (combat.player.powers.vulnerable) per = Math.floor(per * 1.5);
    total += Math.max(0, per) * hits;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Run a single combat to completion under the given player policy.
// `run` is a RunState. Mutates run.hp on completion, exactly like game.afterCombat.
// Returns a per-fight stats record.

export async function runCombat(run, enemyIds, kind, policy) {
  const hpBefore = run.hp;
  const enemyMaxHp = enemyIds.reduce((s, id) => {
    const bp = ENEMIES[id];
    return s + (bp ? (bp.hpMin + bp.hpMax) / 2 : 0);
  }, 0);

  const combat = new Combat(run, enemyIds, { kind });
  // onUpdate / onLog / fx all default to no-ops in the engine — nothing to wire.
  combat.start();

  let safety = 0;
  while (!combat.over && combat.turn < MAX_TURNS && safety < MAX_TURNS * 4) {
    safety++;
    // --- optional: spend potions (the policy decides which/when) ---
    if (policy.usePotions) policy.usePotions(combat);
    // --- player's turn: let the policy act until it chooses to stop ---
    playPlayerTurn(combat, policy);
    if (combat.over) break;
    // --- hand off to the engine for end-of-turn + enemy phase + redraw ---
    await combat.endTurn();
    // Terminal-state guard using the engine's OWN win rule (livingEnemies === 0,
    // exactly what onEnemyDeath checks). This catches the one path that clears
    // the board without a death check — Market Thief's "Flee" sets alive=false
    // directly — which otherwise leaves the fight un-won until the turn cap.
    if (!combat.over && combat.livingEnemies().length === 0) combat.win();
  }

  const timedOut = !combat.over;
  // Mirror game.afterCombat: write HP back; a timeout counts as a loss.
  run.hp = Math.max(0, combat.player.hp);
  const victory = combat.victory && !timedOut;

  return {
    kind,
    enemyIds: enemyIds.slice(),
    victory,
    timedOut,
    turns: combat.turn,
    hpBefore,
    hpAfter: run.hp,
    hpLost: Math.max(0, hpBefore - run.hp),
    enemyMaxHp: Math.round(enemyMaxHp),
  };
}

// Drive one player turn: repeatedly ask the policy for a card until it returns
// null (meaning "end my turn"). Every path here consumes energy or a card, so
// the loop is bounded even for draw-heavy hands.
function playPlayerTurn(combat, policy) {
  let guard = 0;
  while (!combat.over && guard++ < 200) {
    const playable = combat.hand.filter((c) => combat.canPlay(c));
    if (!playable.length) break;
    const choice = policy.chooseCard(combat, playable);
    if (!choice || !choice.card) break;
    combat.playCard(choice.card, choice.target || null);
  }
}

// Full-run driver: climb the whole Spire, following the same control flow the
// real game uses in game.js (enterNode -> startMonster/Elite/Boss -> rewards ->
// afterNode -> nextAct). Combat is the real engine (via harness). Map, encounter
// tables, characters, relics, potions and card pools are the real data modules,
// so content/balance changes flow through automatically.
//
// The pieces the real game hands to a human — which card reward to take, which
// node to walk to, heal-or-smith — are delegated to the policies module. The
// pieces that are pure UI (drawing screens) are simply omitted.
//
// Faithful to game.js: encounter selection, weak/normal tiering, reward gold/
// potion/relic rolls, card-reward weighting, rest healing, treasure, act flow.
// Simplified (and clearly marked): shop purchases and random events are modelled
// as no-ops by default — hooks are provided so you can plug richer models in.

import { RunState } from '../../src/core/state.js';
import { RELICS } from '../../src/data/relics.js';
import { POTIONS } from '../../src/data/potions.js';
import { CARDS, createCard, upgradeCard } from '../../src/data/cards.js';
import { COLORLESS_POOL } from '../../src/data/characters.js';
import { ENCOUNTERS } from '../../src/data/encounters.js';
import { generateMap, nextNodes, nodeAt } from '../../src/map/mapgen.js';
import { isCardLocked } from '../../src/core/cardUnlocks.js';
import { runCombat } from './harness.mjs';
import {
  defaultPlayerPolicy, defaultDeckPolicy, defaultRestPolicy, makePathPolicy,
} from './policies.mjs';

const MAX_ACT = 3;

// A fresh player with nothing unlocked yet — the baseline balance-testing
// assumption, matching a new save's meta.unlockedCards (see core/save.js).
const FRESH_META = { unlockedCards: [] };

// --- faithful ports of the two RNG-consuming reward helpers from game.js -----
// Kept in lock-step with game.js so the deck the bot climbs with is drawn from
// the same pools with the same weights the real game uses.

function pickEncounter(run, tier) {
  const table = ENCOUNTERS[run.act];
  const list = table[tier] || table.normal;
  return run.rng.pick(list);
}

// Mirrors CombatScene.startMonster tiering: fights escalate within an act.
function monsterTier(n) {
  return n <= 2 ? 'weak' : (n >= 5 ? 'hard' : 'normal');
}

function cardRewardOptions(run, kind) {
  const pool = run.character.cardPool.filter((id) => !isCardLocked(id, FRESH_META));
  const byRar = { common: [], uncommon: [], rare: [] };
  for (const id of pool) { const r = CARDS[id].rarity; if (byRar[r]) byRar[r].push(id); }
  const weights = (kind === 'boss' || kind === 'elite')
    ? { common: 35, uncommon: 50, rare: 15 }
    : { common: 62, uncommon: 32, rare: 6 };
  const rar = ['common', 'uncommon', 'rare'];
  const opts = [];
  let guard = 0;
  while (opts.length < 3 && guard++ < 50) {
    const r = run.rng.weighted(rar.map((v) => ({ value: v, weight: weights[v] })));
    const arr = byRar[r].length ? byRar[r] : byRar.common;
    if (!arr.length) break;
    const id = run.rng.pick(arr);
    if (!opts.includes(id)) opts.push(id);
  }
  const colorlessPool = COLORLESS_POOL.filter((id) => !isCardLocked(id, FRESH_META));
  if (run.rng.bool(0.12) && opts.length === 3 && colorlessPool.length) opts[2] = run.rng.pick(colorlessPool);
  return opts.map((id) => { const c = createCard(id); if (run.rng.bool(0.10)) upgradeCard(c); return c; });
}

function randomPotion(run) {
  const pool = Object.values(POTIONS);
  const weights = pool.map((p) => ({ value: p.id, weight: p.rarity === 'common' ? 65 : p.rarity === 'uncommon' ? 27 : 8 }));
  return run.rng.weighted(weights);
}

// --- reward resolution, mirroring game.showRewards + afterCombat -------------
function applyCombatEndAndRewards(run, kind, policies) {
  // combat-end relic hooks (e.g. Healing Gourd)
  for (const rid of run.relics) {
    const r = RELICS[rid];
    if (r && r.combatEnd) r.combatEnd(run);
  }
  // gold (auto-taken)
  const goldRange = kind === 'boss' ? [40, 60] : kind === 'elite' ? [25, 35] : [10, 20];
  run.gold += run.rng.int(goldRange[0], goldRange[1]);
  // potion drop
  const potionChance = kind === 'boss' ? 1 : kind === 'elite' ? 0.5 : 0.4;
  if (run.rng.bool(potionChance) && run.potions.length < run.maxPotions) {
    run.addPotion(randomPotion(run));
  }
  // relic for elite/boss (bosses offer a boss-tier relic, mirroring showRewards)
  if (kind === 'boss') {
    const bid = run.pickBossRelicId();
    if (bid) run.addRelic(bid); else run.grantRandomRelic();
  } else if (kind === 'elite') {
    run.grantRandomRelic();
  }
  // card reward
  const options = cardRewardOptions(run, kind);
  const pick = policies.deck.pickCardReward(run, options);
  if (pick) run.addCardById(pick.id, pick.upgraded);
}

// --- non-combat node models --------------------------------------------------
function resolveTreasure(run) {
  // game.showTreasure: 25–45 gold + a random relic.
  run.gold += run.rng.int(25, 45);
  run.grantRandomRelic();
}

function resolveRest(run, policies) {
  const choice = policies.rest.choose(run);
  if (choice === 'heal' && run.canRestHeal()) {
    run.heal(Math.floor(run.maxHp * run.restHealFraction()) + run.restHealBonus());
  } else {
    const i = policies.deck.pickUpgrade(run);
    if (i >= 0) run.deck[i].upgraded = true;
  }
}

// Shops and events are content-heavy and outcome-random in the real game; by
// default we leave the run untouched here and record that we visited, rather
// than fake numbers. Provide policies.event / policies.shop to model them.
function resolveEvent(run, policies) { if (policies.event) policies.event(run); }
function resolveShop(run, policies) { if (policies.shop) policies.shop(run); }

// ---------------------------------------------------------------------------
// Simulate one full climb. Returns a run-summary record.

export async function simulateRun(charId, seed, opts = {}) {
  const policies = {
    player: opts.player || defaultPlayerPolicy,
    path: opts.path || makePathPolicy(opts.pathStrategy || 'random'),
    deck: opts.deck || defaultDeckPolicy,
    rest: opts.rest || defaultRestPolicy,
    event: opts.event || null,
    shop: opts.shop || null,
  };

  const run = new RunState(charId, seed, opts.ascension || 0);
  const visits = { monster: 0, elite: 0, boss: 0, event: 0, shop: 0, rest: 0, treasure: 0 };
  const fights = [];
  const actHpAtEnd = {};
  let death = null; // { act, node, enemyIds }

  actLoop:
  while (run.act <= MAX_ACT) {
    run.position = null;
    // Walk this act's map until the boss is cleared.
    while (true) {
      const reachable = nextNodes(run.map, run.position);
      if (!reachable.length) break;
      const pos = policies.path.choose(run, reachable);
      run.position = pos;
      const type = pos.boss ? 'boss' : nodeAt(run.map, pos).type;
      visits[type] = (visits[type] || 0) + 1;

      if (type === 'monster' || type === 'elite' || type === 'boss') {
        let enemyIds;
        if (type === 'monster') {
          run._actMonster = (run._actMonster || 0) + 1;
          enemyIds = pickEncounter(run, monsterTier(run._actMonster));
        } else {
          enemyIds = pickEncounter(run, type);
        }
        const fight = await runCombat(run, enemyIds, type, policies.player);
        fights.push({ act: run.act, ...fight });
        if (!fight.victory) {
          death = { act: run.act, node: type, enemyIds };
          break actLoop;
        }
        applyCombatEndAndRewards(run, type, policies);
        if (type === 'boss') break; // act cleared
      } else if (type === 'treasure') {
        resolveTreasure(run);
      } else if (type === 'rest') {
        resolveRest(run, policies);
      } else if (type === 'event') {
        resolveEvent(run, policies);
      } else if (type === 'shop') {
        resolveShop(run, policies);
      }
    }

    actHpAtEnd[run.act] = run.hp;
    if (death) break;
    // nextAct (mirrors map.nextAct): full heal between acts, fresh map.
    if (run.act >= MAX_ACT) break; // victory: cleared act 3 boss
    run.act += 1;
    run.heal(run.maxHp);
    run._actMonster = 0;
    run.map = generateMap(run.rng, run.act);
  }

  const victory = !death && run.act >= MAX_ACT;
  return {
    charId, seed,
    victory,
    actReached: run.act,
    death,
    hp: run.hp,
    maxHp: run.maxHp,
    deckSize: run.deck.length,
    relics: run.relics.length,
    gold: run.gold,
    visits,
    fights,
    actHpAtEnd,
  };
}

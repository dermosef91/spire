// The Descent-Vote ("The Spire Offers") — successor to the branching node map.
//
// Instead of navigating a DAG, the climber is presented, after every room,
// with 2-3 *doors*: prose-first thresholds whose room type is only partially
// telegraphed by an omen tier. A hidden per-act "curator" (the Spire itself)
// biases which doors it offers — fattening strong climbers with comfort,
// testing weak ones with fights — while hard pacing clamps keep any act from
// degenerating.
//
// This module is pure and DOM-free (like mapgen.js): every roll draws from the
// passed-in seeded RNG and every bit of mutable state lives on the `director`
// (persisted in the save), so an offer is exactly reproducible across a
// mid-offer save/reload. The scene layer (scenes/doors.js, phase 2) renders it.
//
// PHASE 1: engine + data only, feature-flagged OFF (CLIMB_MODE). Nothing here
// is wired into the live map/run flow yet — the constructor still builds the
// legacy node map. Flipping CLIMB_MODE and adding the scene comes next.

import { DOOR_PROSE, NAMED_DOORS, CURATOR_LINES, omenCategory } from '../data/doors.js';

// Master switch. While false the game runs the legacy branching map unchanged;
// RunState never builds climb state on its own. Tests build it explicitly.
export const CLIMB_MODE = false;

export const FLOORS = 15;            // rooms per act (matches mapgen ROWS)
const BOSS_FLOOR = FLOORS + 1;       // the terminal boss gate
const ELITE_MIN_FLOOR = 5;           // elites gated like the old row>=4 rule
const REST_MIN_FLOOR = 4;            // no campfires in the opening stretch
const TREASURE_BAND = [6, 10];       // treasure only appears mid-act (old row 8)
const TREASURE_DEADLINE = 10;        // force the offer by here if never shown
const SHOP_DEADLINE = 12;            // ditto for the bazaar
const NONCOMBAT_FROM = 11;           // late offers always include an out
const MAX_COMBAT_STREAK = 3;         // 4th straight fight is never forced on you

const COMBAT_TYPES = new Set(['monster', 'elite']);
const isCombat = (t) => COMBAT_TYPES.has(t);

// Base offer weights before the appetite bias. Treasure rides high so that,
// while it's in-band, it actually shows up.
const BASE_WEIGHT = { monster: 45, elite: 18, shop: 12, rest: 12, treasure: 24, event: 11 };

// ------------------------------------------------------------------ director
export function newDirector() {
  return {
    appetite: 50,        // 0-100 hidden hunger; high == "you climb well, rest"
    offeredShop: false,  // has a bazaar been offered this act
    offeredTreasure: false,
    combatStreak: 0,     // consecutive combat rooms actually entered
    lastType: null,      // type of the room last entered
    usedProse: [],       // prose lines spent this act (drawn without replacement)
  };
}

// Fresh climb state for a new act. `rng` is the run RNG (advanced in place).
export function newClimb() {
  return { floor: 0, offer: null, offerFloor: 0, history: [], lamplight: 0, director: newDirector() };
}

// Recompute the Spire's appetite from how the climber is doing. Monotonic in
// HP fraction (fuller == hungrier Spire == more comfort offered), nudged by
// purse size. Call before each generateOffer.
export function directorUpdate(director, run) {
  const hpFrac = run.maxHp > 0 ? Math.max(0, Math.min(1, run.hp / run.maxHp)) : 0;
  const goldTerm = Math.min(20, (run.gold || 0) / 15);
  director.appetite = Math.round(Math.max(0, Math.min(100, hpFrac * 78 + goldTerm)));
  return director.appetite;
}

// The scene calls this when the climber actually enters a room, so pacing
// clamps track rooms *taken*, not merely offered.
export function recordPick(director, type) {
  if (isCombat(type)) director.combatStreak += 1;
  else director.combatStreak = 0;
  director.lastType = type;
  return director;
}

// ------------------------------------------------------------------ prose
function pickProse(rng, pool, director) {
  if (!pool || !pool.length) return '';
  const fresh = pool.filter((p) => !director.usedProse.includes(p));
  const src = fresh.length ? fresh : pool; // once the act exhausts a cell, reuse
  const line = rng.pick(src);
  director.usedProse.push(line);
  return line;
}

function proseFor(rng, act, type, tier, director) {
  if (tier === 'sealed') return pickProse(rng, DOOR_PROSE.sealed[act], director);
  if (tier === 'veiled') {
    const cat = omenCategory(type);
    return pickProse(rng, DOOR_PROSE.veiled[act] && DOOR_PROSE.veiled[act][cat], director);
  }
  return pickProse(rng, DOOR_PROSE.plain[act] && DOOR_PROSE.plain[act][type], director);
}

// Omen tier per door: acts grow more obscured as you climb the Spire.
function rollTier(rng, act, type) {
  const t = act === 1
    ? [{ value: 'plain', weight: 70 }, { value: 'veiled', weight: 30 }]
    : act === 2
      ? [{ value: 'plain', weight: 45 }, { value: 'veiled', weight: 40 }, { value: 'sealed', weight: 15 }]
      : [{ value: 'plain', weight: 30 }, { value: 'veiled', weight: 40 }, { value: 'sealed', weight: 30 }];
  return rng.weighted(t);
}

// ------------------------------------------------------------------ offers
function allowedTypes(act, floor, director) {
  const list = ['monster', 'shop'];
  if (floor >= ELITE_MIN_FLOOR && director.lastType !== 'elite') list.push('elite');
  if (floor >= REST_MIN_FLOOR) list.push('rest');
  if (floor >= TREASURE_BAND[0] && floor <= TREASURE_BAND[1]) list.push('treasure');
  if (floor >= 2) list.push('event');
  return list;
}

function biasedWeights(types, appetite) {
  const f = appetite / 100;
  const combatMult = 1.4 - 0.8 * f;   // hungry Spire (low f) pushes fights
  const comfortMult = 0.6 + 0.8 * f;  // sated Spire (high f) pushes comfort
  return types.map((value) => ({
    value,
    weight: BASE_WEIGHT[value] * (isCombat(value) ? combatMult : comfortMult),
  }));
}

// How many doors this floor offers. Openings and the pre-boss fire are fixed.
function doorCount(rng, floor) {
  if (floor === 1 || floor >= FLOORS) return floor === 1 ? 2 : 1;
  return rng.bool(0.42) ? 3 : 2;
}

// Generate (and cache-ready return) the offer for a given floor. Mutates
// `director` for prose/guarantee bookkeeping; call directorUpdate first so the
// appetite bias reflects current run state.
export function generateOffer(rng, act, floor, director) {
  if (floor >= BOSS_FLOOR) {
    return [{ type: 'boss', tier: 'plain', prose: pickProse(rng, DOOR_PROSE.boss[act], director), hint: null, named: null }];
  }
  if (floor >= FLOORS) {
    // The Ancestor Fire on the summit's threshold — a guaranteed pre-boss rest.
    return [{ type: 'rest', tier: 'plain', prose: proseFor(rng, act, 'rest', 'plain', director), hint: null, named: null }];
  }

  const count = doorCount(rng, floor);

  // Floor 1 is always an all-combat opening (mirrors the old all-monster row 0,
  // and keeps the first-fight tutorial reachable).
  let picks;
  if (floor === 1) {
    picks = new Array(count).fill('monster');
  } else {
    picks = [];
    // draw types without repeating the singleton comforts within one offer
    let pool = allowedTypes(act, floor, director);
    for (let i = 0; i < count; i++) {
      const weights = biasedWeights(pool, director.appetite);
      const type = rng.weighted(weights);
      picks.push(type);
      if (type === 'treasure' || type === 'shop' || type === 'elite') {
        pool = pool.filter((t) => t !== type); // at most one of each per offer
      }
    }
  }

  picks = applyGuarantees(picks, act, floor, director);

  // Bookkeeping: note when a bazaar / treasure opportunity has been shown.
  if (picks.includes('shop')) director.offeredShop = true;
  if (picks.includes('treasure')) director.offeredTreasure = true;

  // One door may become a Named Threshold (a micro-event at the sill).
  const namedIdx = pickNamedIndex(rng, act, floor, picks);

  return picks.map((type, i) => {
    const named = i === namedIdx ? pickNamed(rng, act, type) : null;
    const tier = named ? 'plain' : rollTier(rng, act, type);
    return {
      type,
      tier,
      hint: tier === 'veiled' ? omenCategory(type) : null,
      prose: named ? named.prose : proseFor(rng, act, type, tier, director),
      named: named ? named.id : null,
    };
  });
}

// Enforce the pacing floor: guaranteed shop/treasure opportunities, a non-combat
// out late in the act, and a breakable combat streak. Swaps whole door slots
// rather than adding, so door count is preserved.
function applyGuarantees(picks, act, floor, director) {
  const out = picks.slice();
  const inBand = floor >= TREASURE_BAND[0] && floor <= TREASURE_BAND[1];

  const replaceOneCombat = (withType) => {
    const idx = out.findIndex(isCombat);
    if (idx >= 0) { out[idx] = withType; return true; }
    return false;
  };

  if (floor >= TREASURE_DEADLINE && inBand && !director.offeredTreasure && !out.includes('treasure')) {
    replaceOneCombat('treasure');
  }
  if (floor >= SHOP_DEADLINE && !director.offeredShop && !out.includes('shop')) {
    replaceOneCombat('shop');
  }
  const allCombat = out.every(isCombat);
  const needOut = (floor >= NONCOMBAT_FROM) || (director.combatStreak >= MAX_COMBAT_STREAK);
  if (allCombat && needOut) {
    replaceOneCombat(!director.offeredShop ? 'shop' : (floor >= REST_MIN_FLOOR ? 'rest' : 'event'));
  }
  return out;
}

// ------------------------------------------------------------------ named doors
function pickNamedIndex(rng, act, floor, picks) {
  if (floor < 4 || floor >= FLOORS) return -1;
  const chance = act >= 2 ? 0.14 : 0.09;
  if (!rng.bool(chance)) return -1;
  // Prefer to name a plain-ish room slot; any slot works.
  return rng.int(0, picks.length - 1);
}

function pickNamed(rng, act, type) {
  const pool = NAMED_DOORS.filter((n) => n.acts.includes(act) && (!n.forType || n.forType === type));
  return pool.length ? rng.pick(pool) : null;
}

// ------------------------------------------------------------------ curator voice
export function curatorLine(rng, appetite) {
  const band = appetite >= 66 ? 'high' : appetite <= 33 ? 'low' : 'mid';
  const pool = CURATOR_LINES[band];
  return pool && pool.length ? rng.pick(pool) : '';
}

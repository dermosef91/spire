// Headless logic tests for the deterministic, DOM-free core of the game.
//
// Plain Node, no framework, no dependencies. Run with `npm test` (or
// `node tools/test.js`). Exits non-zero on the first failing assertion group.
//
// These cover the parts of the engine that don't need a browser: seeded RNG,
// run-state serialization, map generation, card instances and the combat core.
// They run in well under a second so logic changes can be verified without a
// full manual browser pass.

import assert from 'node:assert/strict';

import { RNG } from '../src/core/rng.js';
import { RunState } from '../src/core/state.js';
import { generateMap, nextNodes, nodeAt } from '../src/map/mapgen.js';
import {
  FLOORS, newDirector, newClimb, directorUpdate, recordPick,
  generateOffer, curatorLine,
} from '../src/map/climbgen.js';
import { DOOR_PROSE } from '../src/data/doors.js';
import { createCard, upgradeCard, canUpgrade } from '../src/data/cards.js';
import { Combat } from '../src/combat/combat.js';
import { enemyMovePacing, impactProfile, previewCardBlock, previewEnemyAttack } from '../src/combat/presentation.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { ENEMIES } from '../src/data/enemies.js';
import { EVENTS } from '../src/data/events.js';
import { EventScene } from '../src/scenes/event.js';
import { audio } from '../src/audio.js';

// ----------------------------------------------------------------- tiny runner
let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message.split('\n')[0]}`);
  }
}

test('impact profiles reserve apex treatment for marquee plays', () => {
  assert.equal(impactProfile({ hpLost: 6 }).tier, 'standard');
  assert.equal(impactProfile({ hpLost: 16, charge: 4 }).tier, 'heavy');
  const perfectSetup = impactProfile({ hpLost: 10, charge: 5, rhythmGrade: 'perfect', synergy: true });
  assert.equal(perfectSetup.tier, 'apex');
  assert.equal(perfectSetup.label, 'PERFECT');
  assert.ok(perfectSetup.hitStop > 120);
  const finisher = impactProfile({ hpLost: 4, lethal: true });
  assert.equal(finisher.tier, 'apex');
  assert.equal(finisher.label, 'FINISH');
});
// async variant for the combat turn flow (endTurn awaits real timers)
async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message.split('\n')[0]}`);
  }
}

// ----------------------------------------------------------------- RNG
console.log('RNG (core/rng.js)');

test('same seed reproduces the same sequence', () => {
  const a = new RNG(12345);
  const b = new RNG(12345);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('string seeds are hashed deterministically', () => {
  const a = new RNG('spire');
  const b = new RNG('spire');
  assert.equal(a.int(0, 1000), b.int(0, 1000));
});

test('int stays within the inclusive range', () => {
  const r = new RNG(7);
  for (let i = 0; i < 500; i++) {
    const v = r.int(3, 9);
    assert.ok(v >= 3 && v <= 9, `int out of range: ${v}`);
  }
});

test('shuffle returns a new array with the same members', () => {
  const r = new RNG(99);
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = r.shuffle(src);
  assert.notEqual(out, src); // new array reference
  assert.deepEqual([...src].sort(), [...out].sort()); // src untouched, same multiset
});

test('weighted and pick are reproducible across instances', () => {
  const items = [{ value: 'a', weight: 1 }, { value: 'b', weight: 5 }, { value: 'c', weight: 2 }];
  const seqA = Array.from({ length: 50 }, () => new RNG(4).weighted(items));
  // A fresh RNG each time with the same seed must give the same first result.
  assert.ok(seqA.every((v) => v === seqA[0]));
  const a = new RNG(4), b = new RNG(4);
  for (let i = 0; i < 50; i++) assert.equal(a.pick(['x', 'y', 'z']), b.pick(['x', 'y', 'z']));
});

// ----------------------------------------------------------------- RunState
console.log('RunState (core/state.js)');

test('constructs a valid starting run', () => {
  const run = new RunState('amara', 42);
  assert.equal(run.characterId, 'amara');
  assert.equal(run.hp, run.maxHp);
  assert.equal(run.deck.length, 10);
  assert.ok(run.relics.length >= 1, 'starter relic granted');
  assert.ok(run.map && run.map.rows === 15);
});

test('toJSON / fromJSON round-trips run state', () => {
  const run = new RunState('kofi', 42);
  // advance the rng so state differs from the seed
  run.rng.int(0, 1000);
  run.rng.int(0, 1000);
  // the per-act fight counter drives the weak/normal/hard encounter tiers and
  // must survive a save/reload mid-act
  run._actMonster = 4;
  run.foesSlain = 7;
  const clone = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.equal(clone._actMonster, 4, 'per-act fight counter persisted');
  assert.equal(clone.foesSlain, 7, 'foes-slain counter persisted');

  assert.equal(clone.characterId, run.characterId);
  assert.equal(clone.hp, run.hp);
  assert.equal(clone.maxHp, run.maxHp);
  assert.equal(clone.act, run.act);
  assert.deepEqual(clone.deck, run.deck);
  assert.deepEqual(clone.relics, run.relics);
  assert.equal(clone.rng.state, run.rng.state);
  // restored rng continues the *same* sequence as the original
  assert.equal(clone.rng.next(), run.rng.next());
});

test('pathTaken round-trips and defaults empty on legacy saves', () => {
  const run = new RunState('amara', 42);
  run.pathTaken.push({ row: 0, col: 2 }, { row: 1, col: 3 }, 'boss');
  const clone = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.deepEqual(clone.pathTaken, [{ row: 0, col: 2 }, { row: 1, col: 3 }, 'boss'],
    'visited-path memory persisted');
  // a legacy save (no pathTaken key) must still load, with an empty path
  const legacy = JSON.parse(JSON.stringify(run.toJSON()));
  delete legacy.pathTaken;
  assert.deepEqual(RunState.fromJSON(legacy).pathTaken, [], 'legacy save defaults to []');
});

test('map discovery round-trips and defaults empty on legacy saves', () => {
  const run = new RunState('amara', 78);
  run.mapDiscovered.push('0-2', '1-3');
  const clone = RunState.fromJSON(run.toJSON());
  assert.deepEqual(clone.mapDiscovered, ['0-2', '1-3']);
  const legacy = run.toJSON();
  delete legacy.mapDiscovered;
  assert.deepEqual(RunState.fromJSON(legacy).mapDiscovered, []);
});

test('full potion belt: swap sequence (remove then add) works', () => {
  const run = new RunState('amara', 42);
  while (run.potions.length < run.maxPotions) run.addPotion('elixir');
  assert.equal(run.addPotion('rage_brew'), false, 'belt full: add refused');
  run.removePotionAt(0);
  assert.equal(run.addPotion('rage_brew'), true, 'after pouring one out, the new potion fits');
  assert.equal(run.potions.length, run.maxPotions);
  assert.ok(run.potions.includes('rage_brew'));
});

test('ascension modifiers survive a save/reload', () => {
  const run = new RunState('amara', 42, 10);
  assert.equal(run.maxPotions, 2, 'A10 Hoarded Reserves: 2 potion slots');
  const clone = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.equal(clone.ascension, 10, 'ascension level persisted');
  assert.equal(clone.maxPotions, 2, 'A10 potion-slot cap persisted (was reset to 3 on reload)');
});

// ----------------------------------------------------------------- mapgen
console.log('Map generation (map/mapgen.js)');

test('generates a 15-row map with a boss and starts', () => {
  const map = generateMap(new RNG(1), 1);
  assert.equal(map.rows, 15);
  assert.ok(map.cols >= 1, 'has columns');
  assert.ok(map.boss && map.boss.type === 'boss');
  assert.ok(map.starts.length >= 1, 'has start columns');
  assert.ok(map.starts.length <= 3, 'has at most 3 start columns');
});

test('bottom row never contains more than 3 options across many seeds', () => {
  for (let i = 0; i < 100; i++) {
    const map = generateMap(new RNG(i), 1);
    assert.ok(map.starts.length >= 1, 'has at least 1 start column');
    assert.ok(map.starts.length <= 3, 'has at most 3 start columns');
  }
});

test('every non-final node has at least one outgoing edge', () => {
  const map = generateMap(new RNG(2), 1);
  for (let r = 0; r < map.rows - 1; r++) {
    for (let c = 0; c < map.cols; c++) {
      const node = map.grid[r][c];
      if (!node) continue;
      assert.ok(node.next.length >= 1, `orphan node at ${r},${c}`);
    }
  }
});

test('nextNodes/nodeAt agree and the top row leads to the boss', () => {
  const map = generateMap(new RNG(3), 1);
  // from the start (no position) we reach the first-row start columns
  const firstStep = nextNodes(map, null);
  assert.deepEqual(firstStep.map((n) => n.col).sort((a, b) => a - b), [...map.starts]);
  for (const pos of firstStep) assert.ok(nodeAt(map, pos), 'reachable node exists');
  // from any real node on the final row, the only move is the boss
  const lastRow = map.rows - 1;
  const finalCol = map.grid[lastRow].findIndex((n) => n);
  assert.ok(finalCol >= 0, 'final row has a node');
  const top = nextNodes(map, { row: lastRow, col: finalCol });
  assert.deepEqual(top, [{ boss: true }]);
});

test('same seed produces an identical map', () => {
  const a = generateMap(new RNG(1234), 1);
  const b = generateMap(new RNG(1234), 1);
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.starts, b.starts);
});

test('generated maps contain no Unknown Event rooms', () => {
  for (let i = 0; i < 100; i++) {
    const map = generateMap(new RNG(i), 1);
    assert.ok(map.grid.flat().every((node) => !node || node.type !== 'event'));
  }
});

test('legacy event rooms are converted to combats when loading a run', () => {
  const saved = new RunState('amara', 1).toJSON();
  const node = saved.map.grid.flat().find(Boolean);
  node.type = 'event';
  const loaded = RunState.fromJSON(saved);
  assert.equal(loaded.map.grid[node.row][node.col].type, 'monster');
});

// -------------------------------------------------- descent-vote (climbgen)
console.log('Descent-Vote climb (map/climbgen.js)');

// Walk one full act greedily (always take door 0), returning the per-floor
// offers plus the taken-type sequence. `hpFrac` drives the curator appetite.
function walkAct(seed, act, hpFrac = 0.7) {
  const rng = new RNG(seed);
  const dir = newDirector();
  const run = { hp: Math.round(80 * hpFrac), maxHp: 80, gold: 90 };
  const offers = [];
  const taken = [];
  for (let floor = 1; floor <= FLOORS + 1; floor++) {
    directorUpdate(dir, run);
    const offer = generateOffer(rng, act, floor, dir);
    offers.push({ floor, offer });
    const chosen = offer[0];
    if (chosen.type !== 'boss') recordPick(dir, chosen.type);
    taken.push(chosen.type);
  }
  return { offers, taken, dir };
}

test('an act yields 15 room floors + a boss gate, each a valid offer', () => {
  const { offers } = walkAct(7, 1);
  assert.equal(offers.length, FLOORS + 1);
  for (const { floor, offer } of offers) {
    assert.ok(offer.length >= 1 && offer.length <= 3, `floor ${floor} door count`);
    for (const d of offer) {
      assert.ok(typeof d.type === 'string' && d.type.length, 'door has a type');
      assert.ok(['plain', 'veiled', 'sealed'].includes(d.tier), 'door has a valid tier');
      assert.ok(typeof d.prose === 'string' && d.prose.length, `floor ${floor} prose non-empty`);
    }
  }
  assert.equal(offers[FLOORS].offer[0].type, 'boss', 'final offer is the boss gate');
  assert.equal(offers[FLOORS].offer.length, 1, 'boss gate is a single door');
});

test('floor 1 is an all-combat opening and the pre-boss floor is a rest', () => {
  const { offers } = walkAct(11, 2);
  assert.ok(offers[0].offer.every((d) => d.type === 'monster'), 'floor 1 all monster');
  const preBoss = offers[FLOORS - 1].offer; // floor 15
  assert.equal(preBoss.length, 1);
  assert.equal(preBoss[0].type, 'rest', 'summit threshold is the ancestor fire');
});

test('same seed + same choices reproduces the identical offer sequence', () => {
  const a = walkAct(4242, 3);
  const b = walkAct(4242, 3);
  assert.deepEqual(a.offers, b.offers);
  assert.deepEqual(a.taken, b.taken);
});

test('climb state round-trips through save/load', () => {
  const run = new RunState('amara', 555);
  run.beginClimb();
  const rng = run.rng;
  directorUpdate(run.climb.director, run);
  run.climb.offer = generateOffer(rng, 1, 1, run.climb.director);
  run.climb.offerFloor = 1;
  run.climb.floor = 0;
  const loaded = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.deepEqual(loaded.climb, run.climb, 'climb survives serialization');
});

test('legacy saves (no climb) load without a climb and keep their map', () => {
  const saved = new RunState('kofi', 3).toJSON();
  delete saved.climb;
  const loaded = RunState.fromJSON(saved);
  assert.equal(loaded.climb, null);
  assert.ok(loaded.map && loaded.map.rows === 15, 'still on the node map');
});

test('pacing clamps hold across many seeded acts', () => {
  for (let s = 0; s < 120; s++) {
    const act = 1 + (s % 3);
    const { offers, dir } = walkAct(s * 13 + 1, act, 0.3 + (s % 5) * 0.15);
    let combatStreak = 0;
    for (const { floor, offer } of offers) {
      if (floor > FLOORS) continue; // boss gate
      for (const d of offer) {
        if (d.type === 'elite') assert.ok(floor >= 5, `elite before floor 5 (seed ${s}, floor ${floor})`);
        if (d.type === 'treasure') assert.ok(floor >= 6 && floor <= 10, `treasure out of band (seed ${s}, floor ${floor})`);
        if (d.type === 'rest' && floor < FLOORS) assert.ok(floor >= 4, `rest too early (seed ${s}, floor ${floor})`);
      }
      // Late floors always offer a way out of combat.
      if (floor >= 11 && floor < FLOORS) {
        assert.ok(offer.some((d) => d.type !== 'monster' && d.type !== 'elite'),
          `no non-combat door at floor ${floor} (seed ${s})`);
      }
      // The greedy walk takes door 0; a run can never be forced into a 4th
      // straight fight (some non-combat door is always reachable by then).
      const taken0 = offer[0].type;
      if (taken0 === 'monster' || taken0 === 'elite') combatStreak++;
      else combatStreak = 0;
      if (combatStreak >= 4) {
        assert.ok(offer.some((d) => d.type !== 'monster' && d.type !== 'elite'),
          `no escape from a 4-combat streak at floor ${floor} (seed ${s})`);
      }
    }
    assert.ok(dir.offeredShop, `no bazaar offered all act (seed ${s})`);
  }
});

test('the Spire offers comfort to the strong and fights to the weak (appetite)', () => {
  const strong = newDirector();
  const weak = newDirector();
  directorUpdate(strong, { hp: 80, maxHp: 80, gold: 200 });
  directorUpdate(weak, { hp: 8, maxHp: 80, gold: 0 });
  assert.ok(strong.appetite > weak.appetite, 'fuller climber => hungrier Spire');
  assert.ok(strong.appetite >= 66 && weak.appetite <= 33, 'appetite reaches both bands');
  assert.ok(curatorLine(new RNG(1), strong.appetite).length > 0);
  assert.ok(curatorLine(new RNG(1), weak.appetite).length > 0);
});

test('every prose cell the generator can key into is non-empty', () => {
  const types = ['monster', 'elite', 'shop', 'rest', 'treasure', 'event'];
  for (const act of [1, 2, 3]) {
    for (const t of types) {
      assert.ok(DOOR_PROSE.plain[act][t] && DOOR_PROSE.plain[act][t].length,
        `plain[${act}][${t}] empty`);
    }
    for (const cat of ['danger', 'comfort']) {
      assert.ok(DOOR_PROSE.veiled[act][cat] && DOOR_PROSE.veiled[act][cat].length,
        `veiled[${act}][${cat}] empty`);
    }
    assert.ok(DOOR_PROSE.sealed[act] && DOOR_PROSE.sealed[act].length, `sealed[${act}] empty`);
    assert.ok(DOOR_PROSE.boss[act] && DOOR_PROSE.boss[act].length, `boss[${act}] empty`);
  }
});

// ----------------------------------------------------------------- cards
console.log('Cards (data/cards.js)');

test('createCard builds a well-formed instance', () => {
  const c = createCard('slash');
  assert.equal(c.id, 'slash');
  assert.equal(c.type, 'attack');
  assert.ok(typeof c.name === 'string' && c.name.length > 0);
});

test('upgradeCard mutates in place and is idempotent', () => {
  const c = createCard('slash');
  assert.ok(canUpgrade(c));
  upgradeCard(c);
  assert.ok(c.upgraded === true);
  assert.ok(!canUpgrade(c), 'cannot upgrade twice');
  upgradeCard(c); // no-op, must not throw
  assert.ok(c.upgraded === true);
});

test('createCard throws on an unknown id', () => {
  assert.throws(() => createCard('definitely_not_a_card'));
});

// ----------------------------------------------------------------- Events
console.log('Events (scenes/event.js)');

test('gold-changing event choices resolve without throwing', () => {
  audio.muted = true;
  const run = new RunState('amara', 5);
  run.gold = 99;
  const ev = EVENTS.find((e) => e.id === 'bone_scale_merchant');
  const choice = ev.choices.find((ch) => ch.label.startsWith('Weigh your coin'));
  let result = '';

  EventScene.resolveEventChoice.call({
    run,
    resultThenMap(text) { result = text; },
    gameOver() { throw new Error('unexpected death'); },
    // The relic-granting branch routes through the celebration overlay; in a
    // headless test just run the claim callback (as the reduced-motion path does).
    relicAcquired(_id, onClaim) { onClaim(); },
  }, ev, choice);

  assert.equal(run.gold, 54, 'gold cost applied once');
  assert.ok(run.relics.length > 1, 'relic granted');
  assert.match(result, /gold sinks away/i);
});

// ----------------------------------------------------------------- encounters
console.log('Encounter tables (data/encounters.js)');

test('every encounter references only real enemies of the right act', () => {
  for (const [act, table] of Object.entries(ENCOUNTERS)) {
    for (const [tier, list] of Object.entries(table)) {
      assert.ok(list.length > 0, `act ${act} ${tier} pool is non-empty`);
      for (const group of list) {
        for (const id of group) {
          const bp = ENEMIES[id];
          assert.ok(bp, `act ${act} ${tier}: unknown enemy '${id}'`);
          assert.ok(bp.act <= Number(act), `act ${act} ${tier}: '${id}' belongs to a later act`);
        }
      }
    }
  }
});

test('act 1 defines a hard tier for late-act escalation', () => {
  assert.ok(Array.isArray(ENCOUNTERS[1].hard) && ENCOUNTERS[1].hard.length >= 3);
  // acts without a hard pool fall back to normal in pickEncounter
  const table = ENCOUNTERS[2];
  assert.ok((table.hard || table.normal).length > 0);
});

// ----------------------------------------------------------------- Combat
console.log('Combat (combat/combat.js)');

function freshCombat(seed = 123) {
  const run = new RunState('amara', seed);
  const c = new Combat(run, ['husk_drone']);
  c.start();
  return c;
}

test('start() deals a hand and sets up the fight', () => {
  const c = freshCombat();
  assert.ok(c.hand.length > 0, 'hand drawn');
  assert.equal(c.enemies.length, 1);
  assert.ok(c.enemies[0].hp > 0);
  assert.ok(c.energy > 0, 'energy granted for the turn');
  assert.equal(c.over, false);
});

test('playing an attack card damages the enemy and spends energy', () => {
  const c = freshCombat();
  const attack = c.hand.find((card) => card.type === 'attack');
  assert.ok(attack, 'an attack card is in the opening hand');

  const enemy = c.enemies[0];
  // Enemies can start a turn with block, so measure the combined pool (block +
  // hp): an attack must reduce it whether it chips block or lands on health.
  const poolBefore = enemy.hp + enemy.block;
  const energyBefore = c.energy;
  const handBefore = c.hand.length;

  const ok = c.playCard(attack, enemy);
  assert.equal(ok, true, 'playCard succeeded');
  assert.ok(enemy.hp + enemy.block < poolBefore, 'attack reduced enemy block/hp');
  assert.ok(c.energy < energyBefore, 'energy was spent');
  assert.equal(c.hand.length, handBefore - 1, 'card left the hand');
  assert.ok(!c.hand.includes(attack), 'played card no longer in hand');
});

test('canPlay refuses cards once combat is over', () => {
  const c = freshCombat();
  c.over = true;
  const anyCard = c.hand[0];
  assert.equal(c.canPlay(anyCard), false);
});

await testAsync('endTurn advances the turn and redraws a hand', async () => {
  const c = freshCombat();
  const turnBefore = c.turn;
  await c.endTurn();
  assert.ok(c.turn > turnBefore, 'turn counter advanced');
  // after the enemy phase, if the fight continues the player has a fresh hand
  if (!c.over) assert.ok(c.hand.length > 0, 'new hand drawn for the next turn');
});

test('the fight is won when the last enemy flees', () => {
  const run = new RunState('amara', 7);
  const c = new Combat(run, ['market_thief']);
  c.start();
  const thief = c.enemies[0];
  const exits = [];
  c.fx = (type) => exits.push(type);
  thief.bp.moves.flee.run(c, thief);
  assert.equal(thief.alive, false, 'thief left combat');
  assert.equal(thief.fled, true, 'thief marked as fled');
  assert.equal(c.over, true, 'combat ended');
  assert.equal(c.victory, true, 'counted as a victory');
  assert.ok(exits.includes('flee'), 'uses an escape presentation');
  assert.ok(!exits.includes('death'), 'does not use the unwritten/death presentation');
});

test('a missed parry halves block instead of voiding it', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  const hpBefore = c.player.hp;
  c.player.block = 10;
  // Simulate "parry QTE was prompted and missed" the way enemyPhase sets it.
  c._qtePrompted = true;
  c._parried = false;
  c.enemyAttack(enemy, 6);
  // Block 10 -> halved to 5; a 6 hit chews the 5 and lands 1 on health.
  assert.equal(c.player.hp, hpBefore - 1, 'half the block still absorbed the hit');
  assert.equal(c.player.block, 0, 'the halved block was consumed, not restored');
});

test('a successful parry leaves block untouched by the halving rule', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  const hpBefore = c.player.hp;
  c.player.block = 10;
  c._qtePrompted = true;
  c._parried = true;
  c.enemyAttack(enemy, 6);
  assert.equal(c.player.hp, hpBefore, 'full block absorbed the hit');
  assert.equal(c.player.block, 4, 'block consumed normally (10 - 6)');
});

// ----------------------------------------------------------------- Act 1 encounter identities
console.log('Act 1 encounter identities (data/enemies.js)');

test('Counter Stance converts attack hits into Resolve while braced', () => {
  const run = new RunState('amara', 5);
  const c = new Combat(run, ['brass_sentinel']);
  c.start();
  const e = c.enemies[0];
  ENEMIES.brass_sentinel.moves.stance.run(c, e);
  assert.equal(e.powers.counter, 2, 'stance applied');
  c.deal(e, 4, 2); // two player hits into the brace (blocked hits count too)
  assert.equal(e.powers.strength, 4, 'each of the two hits fed 2 Resolve');
});

test('a killing blow into the brace feeds nothing', () => {
  const run = new RunState('amara', 5);
  const c = new Combat(run, ['brass_sentinel']);
  c.start();
  const e = c.enemies[0];
  e.block = 0; e.hp = 3;
  c.applyPower(e, 'counter', 2, e);
  c.deal(e, 10, 1);
  assert.equal(e.alive, false);
  assert.ok(!e.powers.strength, 'no Resolve floated on the corpse');
});

await testAsync('Counter Stance expires when the braced enemy next acts', async () => {
  const run = new RunState('amara', 5);
  const c = new Combat(run, ['brass_sentinel']);
  c.start();
  const e = c.enemies[0];
  c.applyPower(e, 'counter', 2, e);
  await c.endTurn();
  assert.ok(!e.powers.counter, 'the brace dropped as it acted');
});

test('killing the Market Thief refunds stolen gold plus a bounty', () => {
  const run = new RunState('amara', 9);
  const c = new Combat(run, ['market_thief']);
  c.start();
  run.gold = 50;
  const thief = c.enemies[0];
  thief.bp.moves.swipe.run(c, thief); // its 7-damage hit, then an 8-gold steal
  assert.equal(run.gold, 42, 'the swipe stole 8');
  assert.equal(thief._stolen, 8, 'the haul is tracked');
  c.applyDamage(thief, 999, { isAttack: true, source: c.player });
  assert.equal(thief.alive, false);
  assert.equal(run.gold, 42 + 8 + 15, 'stolen gold returned with the 15 bounty');
});

test('a thief that flees keeps the gold — no refund on escape', () => {
  const run = new RunState('amara', 9);
  const c = new Combat(run, ['market_thief']);
  c.start();
  run.gold = 50;
  const thief = c.enemies[0];
  thief.bp.moves.swipe.run(c, thief);
  const after = run.gold;
  c.enemyFlee(thief);
  assert.equal(run.gold, after, 'flee fires no death hook');
});

test('the thief escalates its steals and telegraphs the flee', () => {
  const bp = ENEMIES.market_thief;
  assert.equal(bp.pick({ turn: 1 }), 'swipe');
  assert.equal(bp.pick({ turn: 2 }), 'swipe2');
  assert.equal(bp.pick({ turn: 3 }), 'swipe3');
  assert.equal(bp.pick({ turn: 4 }), 'flee');
  assert.equal(bp.moves.swipe.intent.gold, 8);
  assert.equal(bp.moves.swipe2.intent.gold, 12);
  assert.equal(bp.moves.swipe3.intent.gold, 16);
  assert.equal(bp.moves.flee.intent.type, 'flee', 'the escape has its own intent type');
});

test('a kindled-up Spark Imp telegraphs Burn Out and destroys itself', () => {
  const run = new RunState('amara', 11);
  const c = new Combat(run, ['spark_imp']);
  c.start();
  const imp = c.enemies[0];
  c.applyPower(imp, 'strength', 6, imp);
  c.pickEnemyMove(imp);
  assert.equal(imp.move, 'detonate', '6+ Resolve forces the Burn Out telegraph');
  const hpBefore = c.player.hp;
  imp.bp.moves.detonate.run(c, imp);
  assert.ok(c.player.hp < hpBefore, 'the blast landed');
  assert.equal(imp.alive, false, 'the imp burned out');
  assert.equal(c.over, true, 'last enemy gone ends the fight');
  assert.equal(c.victory, true);
});

test('Tide Priest baptizes the most-afflicted ally clean of debuffs', () => {
  const run = new RunState('amara', 13);
  const c = new Combat(run, ['tide_priest', 'reef_spitter']);
  c.start();
  const [priest, spitter] = c.enemies;
  c.applyPower(spitter, 'poison', 5, c.player);
  c.applyPower(spitter, 'vulnerable', 1, c.player);
  c.pickEnemyMove(priest);
  assert.equal(priest.move, 'baptize', 'cleansing takes priority at 4+ stacks');
  priest.bp.moves.baptize.run(c, priest);
  assert.ok(!spitter.powers.poison && !spitter.powers.vulnerable, 'debuffs washed away');
  // never twice running, so a debuff deck can out-pace the wash
  priest.last = 'baptize';
  c.applyPower(spitter, 'poison', 5, c.player);
  assert.notEqual(ENEMIES.tide_priest.pick(priest, c, c.rng), 'baptize');
});

test('a Husk Drone salvages its fallen sibling (telegraphed Salvage Core)', () => {
  const run = new RunState('amara', 17);
  const c = new Combat(run, ['husk_drone', 'husk_drone']);
  c.start();
  const [a, b] = c.enemies;
  c.applyDamage(a, 999, { isAttack: true, source: c.player });
  assert.equal(a.alive, false);
  assert.equal(b.move, 'scavenge', 'the survivor re-telegraphs Salvage Core');
  const strBefore = b.powers.strength || 0;
  b.bp.moves.scavenge.run(c, b);
  assert.equal((b.powers.strength || 0) - strBefore, 2, 'salvage granted Resolve');
  assert.ok(!b._scavenge, 'one-shot — the flag cleared');
});

test('Static Jackal pounces an open hero, howls at a blocked one, and packs split roles', () => {
  const run = new RunState('amara', 19);
  const c = new Combat(run, ['static_jackal', 'static_jackal']);
  c.start();
  const [j1, j2] = c.enemies;
  c.player.block = 0;
  for (let i = 0; i < 20; i++) assert.notEqual(ENEMIES.static_jackal.pick(j1, c, c.rng), 'howl', 'no howl at an open hero');
  c.player.block = 10;
  j1.last = null; j1.move = 'bite';
  assert.equal(ENEMIES.static_jackal.pick(j1, c, c.rng), 'howl', 'a blocked hero gets Sapped');
  j1.move = 'howl'; // packmate already mid-howl
  j2.last = null;
  for (let i = 0; i < 20; i++) assert.notEqual(ENEMIES.static_jackal.pick(j2, c, c.rng), 'howl', 'the pack never doubles the howl');
});

test('a wounded Reef Spitter shells up instead of spitting', () => {
  const run = new RunState('amara', 23);
  const c = new Combat(run, ['reef_spitter']);
  c.start();
  const e = c.enemies[0];
  e.hp = Math.floor(e.maxHp * 0.3);
  c.pickEnemyMove(e);
  assert.equal(e.move, 'shell');
  e.last = 'shell';
  assert.notEqual(ENEMIES.reef_spitter.pick(e, c, c.rng), 'shell', 'never twice running');
});

test('intent forecast matches hit-counted modifiers and Block without mutating state', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  c.player.block = 5;
  enemy.powers.weak = 1;
  c.player.powers.vulnerable = 1;
  const before = { block: c.player.block, hp: c.player.hp, weak: enemy.powers.weak, vulnerable: c.player.powers.vulnerable };
  const preview = previewEnemyAttack(c, enemy, { type: 'attack', dmg: 10, hits: 2 });
  assert.deepEqual(preview.perHit, [10, 10], 'each one-use modifier affects only the first hit');
  assert.equal(preview.blocked, 5);
  assert.equal(preview.hpLost, 15);
  assert.equal(preview.afterBlock, 0);
  assert.deepEqual({ block: c.player.block, hp: c.player.hp, weak: enemy.powers.weak, vulnerable: c.player.powers.vulnerable }, before, 'forecast is pure');
});

test('printed Block preview includes Grace and Brittle but does not mutate either', () => {
  const c = freshCombat();
  const blockCard = createCard('brace');
  c.player.powers.dexterity = 2;
  c.player.powers.frail = 1;
  assert.equal(previewCardBlock(c, blockCard), 5, '(5 + 2) × 0.75 floors to 5');
  assert.equal(c.player.powers.frail, 1, 'forecast did not consume Brittle');
});

test('enemy action cadence keeps utility brisk and gives heavy attacks a longer tell', () => {
  const utility = enemyMovePacing({ type: 'buffblock', block: 12 });
  const attack = enemyMovePacing({ type: 'attack', dmg: 8 });
  const heavy = enemyMovePacing({ type: 'attackdebuff', dmg: 9, hits: 3 }, { boss: true });
  assert.equal(utility.weight, 'utility');
  assert.equal(attack.weight, 'attack');
  assert.equal(heavy.weight, 'heavy');
  assert.ok(utility.read < attack.read, 'utility moves resolve more briskly than attacks');
  assert.ok(heavy.read > attack.read && heavy.settle > attack.settle, 'heavy attacks keep the strongest anticipation and recovery beats');
});

test('multi-hit damage FX carries immutable per-hit guard snapshots', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  c.player.block = 6;
  const hits = [];
  c.fx = (type, payload) => { if (type === 'damage') hits.push(payload); };
  c.enemyAttack(enemy, 4, 2);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((p) => ({ index: p.hitIndex, count: p.hitCount, before: p.blockBefore, after: p.blockAfter, blocked: p.blocked, hp: p.hpLost, broken: p.guardBroken })), [
    { index: 0, count: 2, before: 6, after: 2, blocked: 4, hp: 0, broken: false },
    { index: 1, count: 2, before: 2, after: 0, blocked: 2, hp: 2, broken: true },
  ]);
});

test('semantic FX reports actual healing, direct HP loss, resistance, and blocked Block gain', () => {
  const c = freshCombat();
  const events = [];
  c.fx = (type, payload) => events.push({ type, payload });
  c.player.hp = c.player.maxHp - 3;
  c.heal(20);
  c.heal(20);
  c.loseHp(c.player, 2);
  c.player.powers.artifact = 1;
  c.applyPower(c.player, 'weak', 2, c.enemies[0]);
  c.player.powers.noBlock = 1;
  c.gainBlock(8);
  assert.deepEqual(events.filter((e) => e.type === 'heal').map((e) => e.payload.amount), [3], 'overheal reports only HP restored and full-HP heal is silent');
  assert.deepEqual(events.filter((e) => e.type === 'healthloss').map((e) => e.payload.amount), [2]);
  assert.equal(events.filter((e) => e.type === 'negated').length, 1, 'Charm resistance is visible');
  assert.ok(events.some((e) => e.type === 'powerfade' && e.payload.key === 'artifact'), 'the last Charm has an explicit expiry beat');
  assert.equal(events.filter((e) => e.type === 'blockprevented').length, 1, 'Sundered rejection is visible');
});

test('power FX reports the actual delta after clamping', () => {
  const c = freshCombat();
  const events = [];
  c.player.powers.weak = 1;
  c.fx = (type, payload) => { if (type === 'power') events.push(payload); };
  c.applyPower(c.player, 'weak', -5, c.player);
  assert.equal(events[0].amount, -1, 'removing one existing stack does not display -5');
  assert.equal(events[0].before, 1);
  assert.equal(events[0].after, 0);
});

test('non-basic enemy intents explain their secondary outcome', () => {
  for (const enemy of Object.values(ENEMIES)) {
    for (const move of Object.values(enemy.moves)) {
      const type = move.intent.type;
      if (type === 'block' || type === 'attack') continue;
      assert.ok(move.intent.detail || move.intent.gold, `${enemy.id} / ${move.name} is missing intent detail`);
    }
  }
});

// ----------------------------------------------------------------- Tempo (rhythm layer → card game)
console.log('Tempo (combat/combat.js)');

test('playing an attack builds 1 Tempo by default (headless / rhythm off)', () => {
  const c = freshCombat();
  const attack = c.hand.find((card) => card.type === 'attack');
  assert.ok(attack, 'an attack card is in the opening hand');
  assert.equal(c.tempo(), 0, 'starts at 0');
  c.playCard(attack, c.enemies[0]);
  assert.equal(c.tempo(), 1, 'a clean strike adds 1 Tempo');
});

test('a Perfect strike adds 2 Tempo, a miss breaks it to 0', () => {
  const c = freshCombat();
  c.registerStrikeGrade('perfect');
  assert.equal(c.tempo(), 2, 'perfect adds 2');
  c.registerStrikeGrade('good');
  assert.equal(c.tempo(), 3, 'good adds 1');
  c.registerStrikeGrade('miss');
  assert.equal(c.tempo(), 0, 'miss breaks Tempo to 0');
});

test('Tempo caps at 10; a graded play stays capped and clears its context', () => {
  const c = freshCombat();
  for (let i = 0; i < 9; i++) c.gainTempo(2);
  assert.equal(c.tempo(), 10, 'capped at 10');
  const attack = c.hand.find((card) => card.type === 'attack');
  c.playCard(attack, c.enemies[0], { rhythmGrade: 'perfect' });
  assert.equal(c._play, null, 'active-play context cleared after the play');
  assert.equal(c.tempo(), 10, 'still capped');
});

test('playCard opts: rhythmMult scales damage; fx payloads echo card/charge/swing', () => {
  const c = freshCombat();
  const attack = c.hand.find((card) => card.type === 'attack');
  const enemy = c.enemies[0];
  enemy.powers.vulnerable = 1;
  const payloads = [];
  c.fx = (type, payload) => { if (type === 'damage' || type === 'attackstart') payloads.push({ type, payload }); };
  const hpBefore = enemy.hp + enemy.block;
  c.playCard(attack, enemy, { rhythmMult: 2, rhythmGrade: 'perfect', charge: 4 });
  const dealt = hpBefore - (enemy.hp + enemy.block);
  assert.equal(dealt, Math.floor(attack.dmg * 2 * 1.5) * (attack.hits || 1), 'rhythm multiplier and setup applied to the swing');
  const start = payloads.find((p) => p.type === 'attackstart');
  assert.equal(start.payload.charge, 4, 'attackstart echoes the charge level');
  const hit = payloads.find((p) => p.type === 'damage');
  assert.equal(hit.payload.swing, true, 'damage marks the player swing');
  assert.equal(hit.payload.rhythmGrade, 'perfect', 'damage echoes the rhythm grade');
  assert.equal(hit.payload.synergy, true, 'damage remembers the setup consumed by the hit');
  assert.equal(hit.payload.card, attack, 'damage echoes the played card');
  assert.equal(hit.payload.charge, 4, 'damage echoes the charge level');
});

test('spendAllTempo returns the pool and zeroes it', () => {
  const c = freshCombat();
  c.gainTempo(4);
  assert.equal(c.spendAllTempo(), 4);
  assert.equal(c.tempo(), 0);
  assert.equal(c.spendAllTempo(), 0, 'spending an empty pool is a harmless 0');
});

test('a successful parry gains 1 Tempo; a missed parry breaks it', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  c.player.block = 20;
  c._qtePrompted = true;
  c._parried = true;
  c.enemyAttack(enemy, 3);
  assert.equal(c.tempo(), 1, 'clean parry adds 1 Tempo');
  c.gainTempo(3);
  c.player.block = 20;
  c._qtePrompted = true;
  c._parried = false;
  c.enemyAttack(enemy, 3);
  assert.equal(c.tempo(), 0, 'missed parry breaks Tempo');
});

test('Flowing Edge scales with Tempo (counting its own strike)', () => {
  const c = freshCombat();
  c.gainTempo(3);
  const enemy = c.enemies[0];
  enemy.block = 0;
  const hpBefore = enemy.hp;
  const card = createCard('flowing_edge');
  c.hand.push(card);
  c.energy = 3;
  c.playCard(card, enemy);
  // 3 Tempo + 1 from this strike = 4 → 2×4 = 8 damage (no base damage).
  assert.equal(hpBefore - enemy.hp, 8, 'damage read the post-strike Tempo');
});

test('Spiral Finish consumes ALL Tempo for bonus damage', () => {
  const c = freshCombat();
  c.gainTempo(4);
  const enemy = c.enemies[0];
  enemy.block = 0;
  enemy.hp = enemy.maxHp = 999; // survive the hit so the math is readable
  const hpBefore = enemy.hp;
  const card = createCard('spiral_finish');
  c.hand.push(card);
  c.energy = 3;
  c.playCard(card, enemy);
  // 4 Tempo + 1 from this strike = 5 consumed → 3×5 = 15 damage (no base damage).
  assert.equal(hpBefore - enemy.hp, 15, 'consumed Tempo converted to damage');
  assert.equal(c.tempo(), 0, 'Tempo pool emptied');
});

test('War-Drum Cadence grants Resolve at 3+ Tempo on turn start', () => {
  const c = freshCombat();
  const card = createCard('war_drum_cadence');
  c.hand.push(card);
  c.energy = 3;
  c.playCard(card, null);
  c.gainTempo(2);
  c.fire('turnStart');
  assert.equal(c.player.powers.strength || 0, 0, 'below threshold: no Resolve');
  c.gainTempo(1);
  c.fire('turnStart');
  assert.equal(c.player.powers.strength, 1, 'at 3 Tempo: +1 Resolve');
});

test('Unbroken Dance converts Tempo gains into Block', () => {
  const c = freshCombat();
  const card = createCard('unbroken_dance');
  c.hand.push(card);
  c.energy = 3;
  c.playCard(card, null);
  const blockBefore = c.player.block;
  c.gainTempo(2);
  assert.equal(c.player.block, blockBefore + 2, '1 Block per Tempo gained');
});

test('Pulse Stone starts combat with 3 Tempo', () => {
  const run = new RunState('amara', 21);
  run.relics.push('pulse_stone');
  const c = new Combat(run, ['husk_drone']);
  c.start();
  assert.equal(c.tempo(), 3);
});

test("Drummer's Bangle fires once on first reaching 5 Tempo", () => {
  const run = new RunState('kofi', 22); // champion-agnostic: works off any attack
  run.relics.push('drummers_bangle');
  const c = new Combat(run, ['husk_drone']);
  c.start();
  const energyBefore = c.energy;
  c.gainTempo(4);
  assert.equal(c.energy, energyBefore, 'below 5: no bonus');
  c.gainTempo(1);
  assert.equal(c.energy, energyBefore + 1, 'reaching 5 grants 1 Àṣẹ');
  c.spendAllTempo();
  c.gainTempo(6);
  assert.equal(c.energy, energyBefore + 1, 'does not fire twice in one combat');
});

// ----------------------------------------------------------------- hit-counted debuffs & Blight spread
console.log('Divergent statuses (hit-counted, Blight spread)');

test('Exposed boosts and is consumed per hit, not per turn', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  c.applyPower(enemy, 'vulnerable', 2, c.player);
  assert.equal(c.deal(enemy, 10), 15, 'first hit +50%');
  assert.equal(enemy.powers.vulnerable, 1, 'one stack consumed');
  assert.equal(c.deal(enemy, 10), 15, 'second hit +50%');
  assert.equal(enemy.powers.vulnerable, undefined, 'stacks consumed');
  assert.equal(c.deal(enemy, 10), 10, 'third hit unmodified');
});

test('a multi-hit attack drains Exposed one stack per hit', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  c.applyPower(enemy, 'vulnerable', 1, c.player);
  // 2 hits of 10: first is 15 (consumes the stack), second is plain 10.
  assert.equal(c.deal(enemy, 10, 2), 25);
});

test('Sapped reduces and is consumed per attack hit made', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  c.applyPower(c.player, 'weak', 1, c.player);
  assert.equal(c.deal(enemy, 10), 7, 'sapped hit -25%');
  assert.equal(c.player.powers.weak, undefined, 'stack consumed by the hit');
  assert.equal(c.deal(enemy, 10), 10, 'next hit unmodified');
});

test('Brittle reduces and is consumed per Block gain', () => {
  const c = freshCombat();
  c.applyPower(c.player, 'frail', 2, c.player);
  c.player.block = 0;
  c.gainBlock(8);
  assert.equal(c.player.block, 6, 'first gain -25%');
  assert.equal(c.player.powers.frail, 1, 'one stack consumed');
  c.gainBlock(8);
  assert.equal(c.player.block, 12, 'second gain -25%');
  c.gainBlock(8);
  assert.equal(c.player.block, 20, 'third gain unmodified');
});

test('Exposed/Sapped/Brittle no longer tick down at turn end', () => {
  const c = freshCombat();
  c.applyPower(c.player, 'vulnerable', 2, c.player);
  c.applyPower(c.player, 'weak', 2, c.player);
  c.applyPower(c.player, 'frail', 2, c.player);
  c.tickTurnDebuffs(c.player);
  assert.equal(c.player.powers.vulnerable, 2);
  assert.equal(c.player.powers.weak, 2);
  assert.equal(c.player.powers.frail, 2);
});

test('a dead foe\'s remaining Blight leaps to a living enemy', () => {
  const run = new RunState('kofi', 31);
  const c = new Combat(run, ['husk_drone', 'husk_drone']);
  c.start();
  const [a, b] = c.enemies;
  c.applyPower(a, 'poison', 5, c.player);
  c.applyDamage(a, 999, { isAttack: false });
  assert.equal(a.alive, false, 'host died');
  assert.equal(b.powers.poison, 5, 'Blight jumped to the survivor');
});

test('Blight Bloom bursts instead of spreading', () => {
  const run = new RunState('kofi', 32);
  const c = new Combat(run, ['husk_drone', 'husk_drone']);
  c.start();
  c.bloodBloom = true;
  const [a, b] = c.enemies;
  b.block = 0;
  const hpBefore = b.hp;
  c.applyPower(a, 'poison', 4, c.player);
  c.applyDamage(a, 999, { isAttack: false });
  assert.equal(b.hp, hpBefore - 4, 'burst damage landed');
  assert.equal(b.powers.poison, undefined, 'no Blight transferred');
});

// ----------------------------------------------------------------- reworked cards
console.log('Reworked cards (divergence pass)');

function playCrafted(c, id, target) {
  const card = createCard(id);
  c.hand.push(card);
  c.energy = 5;
  assert.equal(c.playCard(card, target), true, `${id} played`);
  return card;
}

test('Obsidian Tide grants Block equal to HP damage dealt', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 999;
  enemy.block = 4;
  c.player.block = 0;
  playCrafted(c, 'ironwave', enemy); // 6 dmg: 4 blocked, 2 to HP
  assert.equal(c.player.block, 2);
});

test('Hilt Crack draws 2 at the Tempo threshold, else 1', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  assert.equal(createCard('pommel')._bp.vfx, 'hilt-crack', 'uses its bespoke impact spritesheet');
  enemy.hp = enemy.maxHp = 999;
  // playCrafted pushes then plays (net 0 on hand size), so the draw is the delta.
  let before = c.hand.length;
  playCrafted(c, 'pommel', enemy); // tempo 0 -> 1 in-play: below 4
  assert.equal(c.hand.length, before + 1, 'below threshold: drew 1');
  c.gainTempo(3); // 1 + 3 = 4; the strike itself makes it 5
  before = c.hand.length;
  playCrafted(c, 'pommel', enemy);
  assert.equal(c.hand.length, before + 2, 'at threshold: drew 2');
});

test('Reaping Arc, Falling Star, and Cyclone Dance declare bespoke multi-frame VFX', () => {
  assert.equal(createCard('harvest')._bp.vfx, 'reaping-arc');
  assert.equal(createCard('falling_star')._bp.vfx, 'falling-star');
  assert.equal(createCard('whirlwind')._bp.vfx, 'cyclone-dance');
});

test('Weather the Blow grants Block and Tempo', () => {
  const c = freshCombat();
  c.player.block = 0;
  playCrafted(c, 'shrug', null);
  assert.equal(c.player.block, 6);
  assert.equal(c.tempo(), 1);
});

test('Cyclone Dance consumes ALL Tempo for AoE damage', () => {
  const run = new RunState('amara', 33);
  const c = new Combat(run, ['husk_drone', 'husk_drone']);
  c.start();
  for (const e of c.enemies) { e.hp = e.maxHp = 999; e.block = 0; }
  c.gainTempo(3); // +1 from the strike itself = 4 consumed
  const before = c.enemies.map((e) => e.hp);
  playCrafted(c, 'whirlwind', null);
  for (let i = 0; i < 2; i++) assert.equal(before[i] - c.enemies[i].hp, 2 + 2 * 4, 'each foe took 2 + 2×4');
  assert.equal(c.tempo(), 0, 'Tempo pool emptied');
});

test('Fester pops Blight as immediate damage without reducing it', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 999;
  c.applyPower(enemy, 'poison', 6, c.player);
  const hpBefore = enemy.hp;
  playCrafted(c, 'catalyst', enemy);
  assert.equal(hpBefore - enemy.hp, 6, 'suffered its Blight now');
  assert.equal(enemy.powers.poison, 6, 'Blight not reduced');
});

test('Mirrorcast makes Spirits arrive twice', () => {
  const run = new RunState('zara', 34);
  const c = new Combat(run, ['husk_drone']);
  c.start(); // star_lens channels 1 storm
  const before = c.orbs.length;
  playCrafted(c, 'echo_form', null);
  c.channel('tide', 1);
  assert.equal(c.orbs.length, Math.min(c.orbSlots, before + 2), 'one Channel produced two Spirits');
});

test('Last Resort trades Tempo for Block', () => {
  const c = freshCombat();
  c.gainTempo(4);
  c.player.block = 0;
  playCrafted(c, 'panic_button', null);
  assert.equal(c.player.block, 12);
  assert.equal(c.tempo(), 0, 'rhythm broke');
});

test('Transcendence upgrades the hand only, then draws', () => {
  const c = freshCombat();
  const heldUids = c.hand.map((h) => h.uid);
  playCrafted(c, 'apotheosis', null);
  for (const uid of heldUids) {
    const held = c.hand.find((h) => h.uid === uid);
    assert.ok(held && held.upgraded, 'card held during the play was upgraded');
  }
  assert.ok(c.drawPile.every((d) => !d.upgraded), 'draw pile untouched');
});

test('Sundered (noBlock) blocks Ward for one turn, then expires', () => {
  const c = freshCombat();
  c.player.block = 0; // clear the starter relic's opening Ward so we isolate Sundered
  c.applyPower(c.player, 'noBlock', 1, c.player);
  c.gainBlock(6);
  assert.equal(c.player.block, 0, 'no Ward gained while Sundered');
  c.tickTurnDebuffs(c.player);
  assert.equal(c.player.powers.noBlock, undefined, 'Sundered expired at turn end');
  c.gainBlock(6);
  assert.ok(c.player.block > 0, 'Ward gain works again next turn');
});

test('Snared (entangle) blocks Attacks for one turn, then expires', () => {
  const c = freshCombat();
  const attack = c.hand.find((card) => card.type === 'attack');
  assert.ok(attack, 'an attack card is in the opening hand');
  c.applyPower(c.player, 'entangle', 1, c.player);
  assert.equal(c.canPlay(attack), false, 'attacks unplayable while Snared');
  c.tickTurnDebuffs(c.player);
  assert.equal(c.player.powers.entangle, undefined, 'Snared expired at turn end');
  assert.equal(c.canPlay(attack), true, 'attacks playable again next turn');
});

// ----------------------------------------------------------------- smarter enemies
console.log('Smarter enemies (phase / summon / enrage)');

test('Gilded Warden phases at 40% — a marquee moment that telegraphs the wrath loop', () => {
  const run = new RunState('amara', 29);
  const c = new Combat(run, ['gilded_warden']);
  c.start();
  const e = c.enemies[0];
  assert.ok(e.bp.phase, 'the elite has a real phase now');
  e.hp = Math.floor(e.maxHp * 0.4) - 1;
  c.checkPhase(e);
  assert.equal(e._phased, true);
  assert.ok(e.block >= 10, 'shields-up block on transform');
  // Presentation, not a free stat buff (sim-tuned): the Resolve still costs
  // the wrath turn, which the transform's intent re-pick telegraphs first.
  assert.ok(!e.powers.strength, 'no free Resolve in onEnter');
  assert.equal(e.move, 'wrath', "phase 2 opens with a telegraphed Gild Wrath");
  e.last = 'wrath';
  assert.notEqual(ENEMIES.gilded_warden.pick(e, c, c.rng), 'wrath', 'never twice running');
  c.checkPhase(e);
  assert.equal(e._phased, true, 'the transform is one-shot');
});

test('a boss transforms once when its HP crosses the phase threshold', () => {
  const run = new RunState('amara', 3);
  const c = new Combat(run, ['the_gatekeeper']);
  c.start();
  const boss = c.enemies[0];
  assert.ok(boss.bp.phase, 'gatekeeper has a phase');
  assert.equal(boss._phased, undefined, 'not phased at full HP');
  // Chip it to just above half — still no phase.
  boss.hp = Math.floor(boss.maxHp * 0.5) + 5;
  c.checkPhase(boss);
  assert.ok(!boss._phased, 'no transform above the threshold');
  // Cross the threshold.
  boss.hp = Math.floor(boss.maxHp * 0.5) - 1;
  const strBefore = boss.powers.strength || 0;
  c.checkPhase(boss);
  assert.equal(boss._phased, true, 'transformed at/below half HP');
  assert.ok((boss.powers.strength || 0) > strBefore, 'onEnter buffed the boss');
  // It never transforms twice.
  boss.powers.strength = strBefore;
  c.checkPhase(boss);
  assert.equal(boss.powers.strength || 0, strBefore, 'phase onEnter did not fire again');
});

test('a summoner adds a minion to the board, capped and delayed', () => {
  const run = new RunState('zara', 11);
  const c = new Combat(run, ['choir_master']);
  c.start();
  const boss = c.enemies[0];
  const before = c.livingEnemies().length;
  const mote = c.summonEnemy('echo_mote');
  assert.ok(mote, 'a minion was summoned');
  assert.equal(mote.id, 'echo_mote');
  assert.equal(c.livingEnemies().length, before + 1, 'board grew by one');
  assert.equal(mote._justSummoned, true, 'minion waits a phase before acting');
  assert.ok(mote.intent, 'summoned minion has a telegraphed intent');
  // Board cap: fill to the limit, then further summons are refused.
  let guard = 0;
  while (c.livingEnemies().length < 4 && guard++ < 10) c.summonEnemy('echo_mote');
  assert.equal(c.livingEnemies().length, 4, 'board filled to the cap');
  assert.equal(c.summonEnemy('echo_mote'), null, 'summon refused at the cap');
});

test('an enrage-flagged elite gains Resolve once on its enrage turn', () => {
  const run = new RunState('amara', 9);
  const c = new Combat(run, ['brass_colossus']);
  c.start();
  const elite = c.enemies[0];
  const en = elite.bp.enrage;
  assert.ok(en, 'colossus has an enrage clock');
  // Not yet: before the enrage turn.
  assert.ok(elite.turn < en.turn, 'starts before its enrage turn');
  assert.ok(!elite._enraged);
  // Simulate reaching the enrage turn the way enemyPhase does.
  elite.turn = en.turn;
  const strBefore = elite.powers.strength || 0;
  if (!elite._enraged && elite.turn >= en.turn) {
    elite._enraged = true;
    c.applyPower(elite, 'strength', en.strength, elite);
  }
  assert.equal(elite._enraged, true, 'enraged at its turn');
  assert.equal((elite.powers.strength || 0), strBefore + en.strength, 'gained the enrage Resolve');
});

// ----------------------------------------------------------------- new cards: PR1
console.log('New cards — scars, tempo edge, intent read (PR1)');

test('Reckless Glory deals 12 and adds a Scar to the discard pile', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  playCrafted(c, 'reckless_glory', e);
  assert.equal(e.hp, 999 - 12, 'dealt 12');
  assert.equal(c.discardPile.filter((x) => x.id === 'wound').length, 1, 'a Scar entered the discard');
});

test('Open the Old Wounds consumes held Status cards and deals 9 per', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  c.hand.push(c.makeCard('wound'), c.makeCard('wound'));
  const exBefore = c.consumePile.length;
  playCrafted(c, 'open_old_wounds', e);
  assert.equal(c.consumePile.length - exBefore, 2, 'both Scars consumed');
  assert.equal(e.hp, 999 - 18, 'dealt 9 x2 = 18');
  assert.equal(c.hand.filter((x) => x.id === 'wound').length, 0, 'no Scars left in hand');
});

test('Half-Beat grants 2 Tempo', () => {
  const c = freshCombat();
  assert.equal(c.tempo(), 0);
  playCrafted(c, 'half_beat', null);
  assert.equal(c.tempo(), 2, 'gained 2 Tempo');
});

test('Shattered Cadence deals 16 then breaks Tempo to 0', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  c.gainTempo(5);
  playCrafted(c, 'shattered_cadence', e);
  assert.equal(e.hp, 999 - 16, 'dealt 16');
  assert.equal(c.tempo(), 0, 'rhythm broke to 0');
});

test('Read the Field blocks vs an attacker, else draws', () => {
  const c = freshCombat();
  c.player.block = 0;
  c.enemies[0].intent = { type: 'attack', dmg: 6 };
  playCrafted(c, 'read_the_field', null);
  assert.equal(c.player.block, 5, 'gained Block vs an attacker');

  const c2 = freshCombat();
  c2.player.block = 0;
  for (const e of c2.enemies) e.intent = { type: 'block' };
  const handBefore = c2.hand.length;
  playCrafted(c2, 'read_the_field', null);
  assert.equal(c2.player.block, 0, 'no Block when no attacker');
  assert.equal(c2.hand.length, handBefore + 2, 'drew 2 (played card left hand)');
});

test('Swallow Sorrow eats a Curse for Block + draw, else small Block', () => {
  const c = freshCombat();
  c.player.block = 0;
  c.hand.push(c.makeCard('regret'));
  const exBefore = c.consumePile.length;
  playCrafted(c, 'swallow_sorrow', null);
  assert.equal(c.player.block, 9, 'ate the curse for 9 Block');
  assert.equal(c.consumePile.length - exBefore, 1, 'curse consumed');

  const c2 = freshCombat();
  c2.player.block = 0;
  playCrafted(c2, 'swallow_sorrow', null);
  assert.equal(c2.player.block, 4, 'fallback 4 Block with no junk');
});

// ----------------------------------------------------------------- new cards: PR2
console.log('New cards — Call & Response alternation (PR2)');

test('Step, Turn, Strike deals more right after a Skill', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  playCrafted(c, 'step_turn_strike', e);
  assert.equal(e.hp, 999 - 6, 'base damage with no prior card this turn');

  const c2 = freshCombat();
  const e2 = c2.enemies[0]; e2.block = 0; e2.hp = e2.maxHp = 999;
  playCrafted(c2, 'brace', null); // a Skill
  playCrafted(c2, 'step_turn_strike', e2);
  assert.equal(e2.hp, 999 - 10, 'boosted damage right after a Skill');
});

test('Answer-Song blocks more right after an Attack', () => {
  const c = freshCombat();
  c.player.block = 0;
  playCrafted(c, 'answer_song', null);
  assert.equal(c.player.block, 4, 'base Block with no prior card this turn');

  const c2 = freshCombat();
  const e2 = c2.enemies[0];
  c2.player.block = 0;
  playCrafted(c2, 'slash', e2); // an Attack
  playCrafted(c2, 'answer_song', null);
  assert.equal(c2.player.block, 7, 'boosted Block right after an Attack');
});

test('Call and Response draws on alternation, capped at 3 per turn, reset next turn', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  playCrafted(c, 'call_and_response', null); // power itself never alternates (type 'power')

  let before = c.hand.length;
  playCrafted(c, 'slash', e); // attack after a power: no alternation
  assert.equal(c.hand.length, before, 'no draw: came after a power, not a Skill');

  before = c.hand.length;
  playCrafted(c, 'brace', null); // skill after an attack: alternation #1
  assert.equal(c.hand.length, before + 1, 'alternation drew a card');

  before = c.hand.length;
  playCrafted(c, 'slash', e); // attack after a skill: alternation #2
  assert.equal(c.hand.length, before + 1, 'second alternation drew a card');

  before = c.hand.length;
  playCrafted(c, 'brace', null); // skill after an attack: alternation #3 (hits the cap)
  assert.equal(c.hand.length, before + 1, 'third alternation drew a card');

  before = c.hand.length;
  playCrafted(c, 'slash', e); // would alternate, but the per-turn cap is already spent
  assert.equal(c.hand.length, before, 'capped: fourth alternation this turn does not draw');

  // turnStart resets the per-turn cap (lastPlayedType is still 'attack' from
  // the capped slash above — fire() alone doesn't reset it, only the full
  // startPlayerTurn does — so this play still counts as a skill-after-attack).
  c.fire('turnStart');
  before = c.hand.length;
  playCrafted(c, 'brace', null);
  assert.equal(c.hand.length, before + 1, 'cap reset: alternation drew a card again next turn');
});

// ----------------------------------------------------------------- new cards: PR3
console.log('New cards — The Archive: Ethereal onConsume (PR3)');

test('Echo of the Cantor: onPlay grants Block; onConsume applies Sapped to ALL enemies', () => {
  const c = freshCombat();
  c.player.block = 0;
  playCrafted(c, 'echo_of_the_cantor', null);
  assert.equal(c.player.block, 5, 'granted Block on play');
  assert.equal(c.enemies[0].powers.weak, undefined, 'no Sapped proc from a normal play');
  // exercise the onConsume hook directly (this is what Ethereal / a
  // consume-the-hand effect triggers) without redoing the full turn cycle
  c.consume(c.makeCard('echo_of_the_cantor'));
  assert.equal(c.enemies[0].powers.weak, 1, 'onConsume applied 1 Sapped to the enemy');
});

test('Echo of the Sentinel: onConsume grants more Block than playing it does', () => {
  const c = freshCombat();
  c.player.block = 0;
  playCrafted(c, 'echo_of_the_sentinel', null);
  assert.equal(c.player.block, 4, 'granted the smaller on-play Block');
  c.consume(c.makeCard('echo_of_the_sentinel'));
  assert.equal(c.player.block, 4 + 7, 'onConsume granted the larger Block on top');
});

test('Echo of the Warden: onConsume deals bonus damage to a random enemy', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  playCrafted(c, 'echo_of_the_warden', e);
  assert.equal(e.hp, 999 - 7, 'dealt the on-play damage');
  c.consume(c.makeCard('echo_of_the_warden'));
  assert.equal(e.hp, 999 - 7 - 10, 'onConsume dealt bonus damage on top');
});

test('Remembered Name deals damage whenever a card is Consumed', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  playCrafted(c, 'remembered_name', null); // a power vanishes on play; it is not itself Consumed
  assert.equal(e.hp, 999, 'no proc yet — playing a power does not Consume it');
  c.consume(c.makeCard('wound'));
  assert.equal(e.hp, 999 - 3, 'a Consume event procs Remembered Name');
  c.consume(c.makeCard('wound'));
  assert.equal(e.hp, 999 - 6, 'procs again on a second Consume');
});

test('The Catalogue Opens consumes the hand and deals AoE damage per card', () => {
  const c = freshCombat();
  const e = c.enemies[0]; e.block = 0; e.hp = e.maxHp = 999;
  const heldCards = c.hand.length; // the opening hand (5 cards)
  const exBefore = c.consumePile.length;
  playCrafted(c, 'catalogue_opens', null); // removed from hand before onPlay runs
  assert.equal(c.hand.length, 0, 'hand fully consumed');
  assert.equal(c.consumePile.length - exBefore, heldCards + 1, 'the held cards plus the card itself');
  assert.equal(e.hp, 999 - 4 * heldCards, 'dealt 4 damage per consumed card');
});

// ----------------------------------------------------------------- new cards: PR4
console.log('New cards — Riposte & Flow (PR4)');

test('Riposte deals damage back when the player is hit, then consumes a stack', () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  const fades = [];
  c.fx = (type, payload) => { if (type === 'powerfade') fades.push(payload.key); };
  c.applyPower(c.player, 'riposte', 6, c.player);
  c.enemyAttack(enemy, 5);
  assert.equal(enemy.hp, 999 - 6, 'enemy took the Riposte damage back');
  assert.equal(c.player.powers.riposte, undefined, 'stack consumed');
  assert.ok(fades.includes('riposte'), 'spent Riposte emits a visible expiry beat');
  c.enemyAttack(enemy, 5);
  assert.equal(enemy.hp, 999 - 6, 'no further Riposte damage once the stack is spent');
});

test('Flow makes the whole attack miss, then consumes a stack', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  const hpBefore = c.player.hp;
  c.player.block = 3;
  c.applyPower(c.player, 'flow', 1, c.player);
  c.enemyAttack(enemy, 20);
  assert.equal(c.player.hp, hpBefore, 'no HP lost');
  assert.equal(c.player.block, 3, 'block untouched — the attack never landed');
  assert.equal(c.player.powers.flow, undefined, 'stack consumed');

  c.player.block = 0; // clear the untouched block so the next hit is observable
  c.enemyAttack(enemy, 20);
  assert.equal(c.player.hp, hpBefore - 20, 'second attack lands normally once Flow is spent');
});

test('Answering Steel grants Block and Riposte', () => {
  const c = freshCombat();
  c.player.block = 0;
  playCrafted(c, 'answering_steel', null);
  assert.equal(c.player.block, 5, 'granted Block');
  assert.equal(c.player.powers.riposte, 6, 'granted Riposte');
});

test('Answer in Kind applies Sapped to the attacker on a successful parry, not a missed one', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  playCrafted(c, 'answer_in_kind', null);

  c.player.block = 10;
  c._qtePrompted = true;
  c._parried = false;
  c.enemyAttack(enemy, 3);
  assert.equal(enemy.powers.weak, undefined, 'no proc on a missed parry');

  c.player.block = 10;
  c._qtePrompted = true;
  c._parried = true;
  c.enemyAttack(enemy, 3);
  assert.equal(enemy.powers.weak, 1, 'Sapped applied on a clean parry, and persists past the attack that triggered it');
});

test("Blade Turn reflects the parried attack's full damage, then expires next turn", () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  playCrafted(c, 'blade_turn', null);

  c.player.block = 10;
  c._qtePrompted = true;
  c._parried = true;
  c.enemyAttack(enemy, 7);
  assert.equal(enemy.hp, 999 - 7, "the parried attack's damage reflected back");

  c.fire('turnStart'); // the window closes at the start of the player's next turn
  c.player.block = 10;
  c._qtePrompted = true;
  c._parried = true;
  c.enemyAttack(enemy, 7);
  assert.equal(enemy.hp, 999 - 7, 'no further reflect once the window has expired');
});

test('Read the Wind grants Flow', () => {
  const c = freshCombat();
  playCrafted(c, 'read_the_wind', null);
  assert.equal(c.player.powers.flow, 1, 'granted 1 Flow');
});

test('Untouchable grants Flow at the start of every turn', () => {
  const c = freshCombat();
  playCrafted(c, 'untouchable', null);
  assert.equal(c.player.powers.flow, undefined, 'no Flow yet — only grants on turnStart');
  c.fire('turnStart');
  assert.equal(c.player.powers.flow, 1, 'granted 1 Flow at turn start');
  c.fire('turnStart');
  assert.equal(c.player.powers.flow, 2, 'grants again on the following turn start');
});

// ----------------------------------------------------------------- new cards: PR5
console.log('New cards — The Duel: Challenged mark (PR5)');

test("Challenged adds a flat, unconsumed damage bonus to the player's attacks", () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  assert.equal(c.deal(enemy, 10), 10, 'no bonus without the mark');
  c.applyPower(enemy, 'challenged', 3, c.player);
  assert.equal(c.deal(enemy, 10), 13, 'Challenged adds +3');
  assert.equal(enemy.powers.challenged, 3, 'the mark persists after the hit — not hit-counted');
});

test('Call the Duel marks only one enemy at a time; killing it draws 3 cards', () => {
  const run = new RunState('amara', 55);
  const c = new Combat(run, ['husk_drone', 'husk_drone']);
  c.start();
  const [a, b] = c.enemies;
  a.block = 0; a.hp = a.maxHp = 999;
  b.block = 0; b.hp = b.maxHp = 999;

  playCrafted(c, 'call_the_duel', a);
  assert.equal(a.powers.challenged, 3, 'a is Challenged');
  assert.equal(b.powers.challenged, undefined, 'b is not');

  playCrafted(c, 'call_the_duel', b);
  assert.equal(b.powers.challenged, 3, 'b is now Challenged');
  assert.equal(a.powers.challenged, undefined, 'a lost the mark — only one at a time');

  const handBefore = c.hand.length;
  b.hp = 1;
  c.deal(b, 5);
  assert.equal(b.alive, false, 'the Challenged enemy died');
  assert.equal(c.hand.length, handBefore + 3, 'drew 3 on the Challenged kill');
});

test('Take Their Name only plays with a Challenged enemy, and deals bonus damage', () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  const card = createCard('take_their_name');
  c.hand.push(card);
  c.energy = 5;
  assert.equal(c.canPlay(card), false, 'unplayable with no Challenged enemy');

  c.applyPower(enemy, 'challenged', 3, c.player);
  assert.equal(c.canPlay(card), true, 'playable once an enemy is Challenged');

  assert.equal(c.playCard(card, null), true, 'plays without manual targeting');
  assert.equal(enemy.hp, 999 - 26 - 3, 'dealt 26 plus the Challenged +3 bonus');
  assert.equal(c.player.powers.strength || 0, 0, 'no reward — the enemy survived');
});

test('Take Their Name grants Resolve and healing on a Challenged kill', () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0;
  enemy.hp = 20; // dies to the hit
  c.applyPower(enemy, 'challenged', 3, c.player);
  c.player.hp = Math.max(1, c.player.maxHp - 10);
  const hpBefore = c.player.hp;
  playCrafted(c, 'take_their_name', null);
  assert.equal(enemy.alive, false, 'the Challenged enemy died');
  assert.equal(c.player.powers.strength, 3, 'gained Resolve on the kill');
  assert.equal(c.player.hp, Math.min(c.player.maxHp, hpBefore + 6), 'healed 6 on the kill');
});

// ----------------------------------------------------------------- new cards: PR6
console.log('New cards — Tempo cap & Reckoning (PR6)');

test('gainTempo fires tempoCapped once per crossing into the cap', () => {
  const c = freshCombat();
  let fires = 0;
  c.addTrigger('tempoCapped', () => { fires++; });
  c.gainTempo(5);
  assert.equal(fires, 0, 'below cap: no fire');
  c.gainTempo(5); // now at 10
  assert.equal(fires, 1, 'reaching the cap fires once');
  c.gainTempo(5); // already at cap, add computes to 0
  assert.equal(fires, 1, 'staying at the cap does not refire');
});

test('Overflow triggers AoE damage and resets Tempo to 5 when the cap is hit', () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  playCrafted(c, 'overflow', null);
  c.gainTempo(9);
  assert.equal(enemy.hp, 999, 'no proc below the cap');
  c.gainTempo(1); // hits 10
  assert.equal(enemy.hp, 999 - 8, 'Overflow dealt 8 AoE damage at the cap');
  assert.equal(c.tempo(), 5, 'Tempo reset to 5');

  c.gainTempo(5); // rebuild to the cap
  assert.equal(enemy.hp, 999 - 8 - 8, 'Overflow fires again after rebuilding to the cap');
  assert.equal(c.tempo(), 5, 'reset to 5 again');
});

test('onEnemyDeath increments run.foesSlain', () => {
  const run = new RunState('amara', 79);
  const c = new Combat(run, ['husk_drone', 'husk_drone']);
  c.start();
  assert.equal(run.foesSlain, 0);
  c.applyDamage(c.enemies[0], 999, { isAttack: false });
  assert.equal(run.foesSlain, 1, 'incremented on the first kill');
  c.applyDamage(c.enemies[1], 999, { isAttack: false });
  assert.equal(run.foesSlain, 2, 'incremented on the second kill');
});

test('Reckoning deals damage equal to foes slain this run, capped', () => {
  const run = new RunState('amara', 77);
  const c = new Combat(run, ['husk_drone']);
  c.start();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  run.foesSlain = 5;
  playCrafted(c, 'reckoning', enemy);
  assert.equal(enemy.hp, 999 - 5, 'dealt damage equal to foes slain');
});

test('Reckoning is capped at 40', () => {
  const run = new RunState('amara', 78);
  const c = new Combat(run, ['husk_drone']);
  c.start();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  run.foesSlain = 999;
  playCrafted(c, 'reckoning', enemy);
  assert.equal(enemy.hp, 999 - 40, 'capped at 40');
});

// ----------------------------------------------------------------- new cards: PR7
console.log("New cards — The Spire's Bargains: Debt (PR7)");

test('Borrowed Time grants Àṣẹ now; Debt collects less Àṣẹ at the next turn start', () => {
  const c = freshCombat();
  playCrafted(c, 'borrowed_time', null);
  assert.equal(c.energy, 7, 'gained 2 Àṣẹ on top of the 5 set by playCrafted');
  assert.equal(c.debt.energy, 2, 'incurred 2 Debt');

  c.startPlayerTurn(false);
  assert.equal(c.energy, c.maxEnergy - 2, 'next turn started 2 Àṣẹ short');
  assert.equal(c.debt.energy, 0, 'the ledger cleared after collection');
});

test('Flesh Ledger grants Block now and stacks HP Debt if played again', () => {
  const c = freshCombat();
  c.player.block = 0;
  playCrafted(c, 'flesh_ledger', null);
  assert.equal(c.player.block, 11, 'granted Block');
  assert.equal(c.debt.hp, 5, 'incurred 5 HP Debt');
  assert.ok(c.discardPile.some((x) => x.id === 'flesh_ledger'), 'not Consumed — went to discard');

  playCrafted(c, 'flesh_ledger', null);
  assert.equal(c.debt.hp, 10, 'a second play stacks the Debt');

  const hpBefore = c.player.hp;
  c.startPlayerTurn(false);
  assert.equal(c.player.hp, hpBefore - 10, 'lost the full stacked Debt at turn start');
  assert.equal(c.debt.hp, 0, 'the ledger cleared after collection');
});

test('Advance on the Prize draws now; Debt reduces the next draw by 2', () => {
  const c = freshCombat();
  playCrafted(c, 'advance_on_the_prize', null);
  assert.equal(c.debt.draw, 2, 'incurred a 2-card draw Debt');

  // Discard (not drop) the hand so the deck's total card count is preserved —
  // draw() can reshuffle discard back into the draw pile once it runs dry.
  c.discardPile.push(...c.hand);
  c.hand = [];
  c.startPlayerTurn(false);
  assert.equal(c.hand.length, 3, 'drew only 3 (5 - 2 Debt) instead of the usual 5');
  assert.equal(c.debt.draw, 0, 'the ledger cleared after collection');
});

// ----------------------------------------------------------------- new cards: PR8
console.log('New cards — Misdirection: intent manipulation (PR8)');

test('Provoke the Tell forces an enemy to re-pick its intent, and draws a card', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  enemy.move = 'bogus'; // corrupt the current pick
  enemy.intent = { type: 'unknown' };
  const handBefore = c.hand.length;
  playCrafted(c, 'provoke_the_tell', enemy);
  assert.equal(enemy.move, 'zap', 're-picked a valid move (husk_drone always opens on zap)');
  assert.ok(enemy.intent && enemy.intent.type === 'attack', 'intent refreshed to match the new move');
  assert.equal(c.hand.length, handBefore + 1, 'the Consumed card left for good, and the draw added a new one');
});

test("Stagger skips an enemy's action; its intent carries over unchanged", () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  playCrafted(c, 'stagger', enemy);
  assert.equal(enemy._skipNext, true, 'flagged to skip its next action');

  const moveBefore = enemy.move;
  const intentBefore = enemy.intent;
  const turnBefore = enemy.turn;
  const historyLenBefore = enemy.history.length;
  const hpBefore = c.player.hp;

  // Simulate the skip branch the way enemyPhase's loop does, without paying
  // the real-time waits the full async phase drives.
  if (enemy._skipNext) {
    enemy._skipNext = false;
    enemy.history.push(enemy.move);
    enemy.last = enemy.move;
    enemy.turn += 1;
    c.tickTurnDebuffs(enemy);
  }

  assert.equal(enemy._skipNext, false, 'the flag is consumed');
  assert.equal(enemy.move, moveBefore, 'intent (move id) carries over unchanged — never re-picked');
  assert.equal(enemy.intent, intentBefore, 'intent object carries over unchanged');
  assert.equal(enemy.turn, turnBefore + 1, "the enemy's own turn counter still advances");
  assert.equal(enemy.history.length, historyLenBefore + 1, 'history still records the (unexecuted) move id');
  assert.equal(c.player.hp, hpBefore, 'no damage — the action never ran');
});

// ----------------------------------------------------------------- new cards: PR9
console.log('New cards — Oaths: Vow system (PR9)');

test('Oath of Iron grants Resolve next turn if kept (no HP damage taken)', () => {
  const c = freshCombat();
  playCrafted(c, 'oath_of_iron', null);
  assert.equal(c.player.powers.strength || 0, 0, "no Resolve yet — the vow hasn't resolved");
  c.startPlayerTurn(false);
  assert.equal(c.player.powers.strength, 2, 'kept the vow: gained Resolve');
  assert.equal(c.brokeVowThisCombat, false, 'no vow broken');
  assert.equal(c.vows.length, 0, 'the ledger cleared');
});

test('Oath of Iron grants nothing and marks a broken vow if HP damage is taken', () => {
  const c = freshCombat();
  const enemy = c.enemies[0];
  playCrafted(c, 'oath_of_iron', null);
  c.player.block = 0;
  c.enemyAttack(enemy, 5); // breaks the vow
  c.startPlayerTurn(false);
  assert.equal(c.player.powers.strength || 0, 0, 'the vow was broken — no Resolve');
  assert.equal(c.brokeVowThisCombat, true, 'a vow was broken this combat');
});

test("Oathbreaker's Edge deals more once a Vow has been broken this combat", () => {
  const c = freshCombat();
  const enemy = c.enemies[0]; enemy.block = 0; enemy.hp = enemy.maxHp = 999;
  playCrafted(c, 'oathbreakers_edge', enemy);
  assert.equal(enemy.hp, 999 - 12, 'base damage — no Vow broken yet');

  c.brokeVowThisCombat = true;
  playCrafted(c, 'oathbreakers_edge', enemy);
  assert.equal(enemy.hp, 999 - 12 - 20, 'boosted damage once a Vow has broken');
});

// ------------------------------------------------- Reactive map & Nemesis
console.log('Reactive map (#18) & Nemesis rematch (#19)');

test('actFlags and nemesisDone round-trip through save/load', () => {
  const run = new RunState('amara', 7);
  run.actFlags.hardened = true;
  run.nemesisDone = true;
  const clone = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.deepEqual(clone.actFlags, { hardened: true }, 'per-act flags persisted');
  assert.equal(clone.nemesisDone, true, 'nemesis guard persisted');
  // legacy saves (no keys) load with safe defaults
  const legacy = JSON.parse(JSON.stringify(run.toJSON()));
  delete legacy.actFlags; delete legacy.nemesisDone;
  const old = RunState.fromJSON(legacy);
  assert.deepEqual(old.actFlags, {}, 'legacy save defaults actFlags to {}');
  assert.equal(old.nemesisDone, false, 'legacy save defaults nemesisDone to false');
});

test('reactive-map event choices set the expected actFlags', () => {
  const griot = EVENTS.find((e) => e.id === 'drowned_griot');
  const rest = new RunState('amara', 3);
  griot.choices.find((c) => c.label.startsWith('Lay the griot')).effect(rest);
  assert.equal(rest.actFlags.blessed, true, 'mercy blesses the act');

  const loot = new RunState('amara', 3);
  griot.choices.find((c) => c.label.startsWith('Pry loose')).effect(loot);
  assert.equal(loot.actFlags.hardened, true, 'looting hardens the act');

  const archive = EVENTS.find((e) => e.id === 'archive_of_names');
  const sell = new RunState('amara', 3);
  archive.choices.find((c) => c.label.startsWith('Sell a memory')).effect(sell);
  assert.equal(sell.actFlags.hardened, true, 'selling a memory hardens the act');
});

test('#18 enemyHpMult toughens the fight; playerStartBlock shields at the boss', () => {
  const base = new Combat(new RunState('amara', 55), ['husk_drone']);
  const hard = new Combat(new RunState('amara', 55), ['husk_drone'], { mods: { enemyHpMult: 1.2 } });
  assert.ok(hard.enemies[0].maxHp > base.enemies[0].maxHp, 'hardened enemy has more HP');
  assert.equal(hard.enemies[0].hp, hard.enemies[0].maxHp, 'starts at full');

  const boss = new Combat(new RunState('amara', 55), ['husk_drone'], { mods: { playerStartBlock: 12 } });
  boss.start();
  assert.ok(boss.player.block >= 12, 'the mercy boon grants starting Block');
});

test('#19 nemesis mods rename + buff one enemy and grant Resolve on start', () => {
  const c = new Combat(new RunState('amara', 71), ['static_jackal'], { mods: { nemesisId: 'static_jackal' } });
  const e = c.enemies[0];
  assert.equal(e._nemesis, true, 'flagged as the nemesis');
  assert.match(e.name, /^Rendered /, 'renamed with the Rendered prefix');
  const plain = new Combat(new RunState('amara', 71), ['static_jackal']);
  assert.ok(e.maxHp > plain.enemies[0].maxHp, 'non-boss nemesis is padded');
  c.start();
  assert.ok((e.powers.strength || 0) >= 2, 'nemesis begins with Resolve');
});

test('#19 lastAttackerId records the enemy that damages the player', () => {
  const c = freshCombat();
  c.applyDamage(c.player, 30, { isAttack: true, source: c.enemies[0] });
  assert.equal(c.lastAttackerId, 'husk_drone', 'killer id captured for the next run');
  // player self-damage must not seed a nemesis
  c.lastAttackerId = null;
  c.applyDamage(c.player, 5, { isAttack: false, source: c.player });
  assert.equal(c.lastAttackerId, null, 'self-damage leaves no nemesis');
});

// ----------------------------------------------------------------- summary
console.log('');
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log(`All ${passed} tests passed.`);
}

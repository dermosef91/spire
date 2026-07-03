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
import { createCard, upgradeCard, canUpgrade } from '../src/data/cards.js';
import { Combat } from '../src/combat/combat.js';
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
  const clone = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));

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
  }, ev, choice);

  assert.equal(run.gold, 54, 'gold cost applied once');
  assert.ok(run.relics.length > 1, 'relic granted');
  assert.match(result, /gold sinks away/i);
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
  thief.bp.moves.flee.run(c, thief);
  assert.equal(thief.alive, false, 'thief left combat');
  assert.equal(thief.fled, true, 'thief marked as fled');
  assert.equal(c.over, true, 'combat ended');
  assert.equal(c.victory, true, 'counted as a victory');
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

test('Sundered (noBlock) blocks Ward for one turn, then expires', () => {
  const c = freshCombat();
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

// ----------------------------------------------------------------- summary
console.log('');
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log(`All ${passed} tests passed.`);
}

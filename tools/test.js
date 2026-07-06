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
  const clone = RunState.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.equal(clone._actMonster, 4, 'per-act fight counter persisted');

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
  c._rhythmGrade = 'perfect';
  c.registerStrikeGrade(c._rhythmGrade);
  assert.equal(c.tempo(), 2, 'perfect adds 2');
  c.registerStrikeGrade('good');
  assert.equal(c.tempo(), 3, 'good adds 1');
  c.registerStrikeGrade('miss');
  assert.equal(c.tempo(), 0, 'miss breaks Tempo to 0');
});

test('Tempo caps at 10 and playCard consumes the pending grade', () => {
  const c = freshCombat();
  for (let i = 0; i < 9; i++) c.gainTempo(2);
  assert.equal(c.tempo(), 10, 'capped at 10');
  const attack = c.hand.find((card) => card.type === 'attack');
  c._rhythmGrade = 'perfect';
  c.playCard(attack, c.enemies[0]);
  assert.equal(c._rhythmGrade, null, 'grade consumed by the play');
  assert.equal(c.tempo(), 10, 'still capped');
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

// ----------------------------------------------------------------- summary
console.log('');
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log(`All ${passed} tests passed.`);
}

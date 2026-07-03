// Card blueprints for all three champions plus colorless cards, statuses and curses.
//
// A "blueprint" is shared and immutable. An "instance" (created by createCard)
// holds the mutable per-card data (upgraded state, numeric stats, uid) and
// delegates behavior back to the blueprint via _bp.
//
// onPlay(ctx) drives all effects. The combat engine builds `ctx` per play with
// these helpers: deal, dealAll, gainBlock, applyEnemy, applyAll, applySelf,
// draw, gainEnergy, loseHpSelf, heal, addCard, channel, evoke, exhaustThis, etc.

import { uid } from '../core/util.js';

export const CARDS = {};

function def(id, bp) {
  CARDS[id] = { id, ...bp };
}

// ============================================================== AMARA — Agojie Bladedancer
// Strength ("Resolve"), Block, raw blades and ancestral fury.

def('slash', {
  name: 'Blade Arc', char: 'amara', type: 'attack', rarity: 'basic', cost: 1,
  dmg: 6, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage.`,
  upgrade: (c) => { c.dmg = 9; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});
def('brace', {
  name: 'Iron Stance', char: 'amara', type: 'skill', rarity: 'basic', cost: 1,
  block: 5, target: 'self',
  desc: (c) => `Gain ${c.block} Block.`,
  upgrade: (c) => { c.block = 8; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.block),
});
def('sunder', {
  name: 'Fault Line', char: 'amara', type: 'attack', rarity: 'basic', cost: 2,
  dmg: 8, magic: 2, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Apply ${c.magic} Exposed.`,
  upgrade: (c) => { c.dmg = 10; c.magic = 3; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.applyEnemy('vulnerable', ctx.c.magic); },
});
def('twin_fangs', {
  name: 'Twin Fangs', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 5, hits: 2, target: 'enemy', qteMarks: 2,
  desc: (c) => `Deal ${c.dmg} damage twice.`,
  upgrade: (c) => { c.dmg = 7; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg, ctx.c.hits),
});
def('ironwave', {
  name: 'Obsidian Tide', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 5, block: 5, target: 'enemy',
  desc: (c) => `Gain ${c.block} Block. Deal ${c.dmg} damage.`,
  upgrade: (c) => { c.dmg = 7; c.block = 7; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.deal(ctx.enemy, ctx.c.dmg); },
});
def('pommel', {
  name: 'Hilt Crack', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 9, magic: 1, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Draw ${c.magic} card${c.magic > 1 ? 's' : ''}.`,
  upgrade: (c) => { c.dmg = 10; c.magic = 2; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.draw(ctx.c.magic); },
});
def('cleave', {
  name: 'Ember Sweep', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 8, target: 'all',
  desc: (c) => `Deal ${c.dmg} damage to ALL enemies.`,
  upgrade: (c) => { c.dmg = 11; },
  onPlay: (ctx) => ctx.dealAll(ctx.c.dmg),
});
def('crosscut', {
  name: 'Crosscut', char: 'amara', type: 'attack', rarity: 'common', cost: 2,
  dmg: 12, magic: 2, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Apply ${c.magic} Sapped.`,
  upgrade: (c) => { c.dmg = 14; c.magic = 3; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.applyEnemy('weak', ctx.c.magic); },
});
def('shrug', {
  name: 'Weather the Blow', char: 'amara', type: 'skill', rarity: 'common', cost: 1,
  block: 8, magic: 1, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Draw ${c.magic} card.`,
  upgrade: (c) => { c.block = 11; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.draw(ctx.c.magic); },
});
def('thunderclap', {
  name: 'Concussive Roar', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 4, magic: 1, target: 'all',
  desc: (c) => `Deal ${c.dmg} damage and apply ${c.magic} Exposed to ALL enemies.`,
  upgrade: (c) => { c.dmg = 7; },
  onPlay: (ctx) => { ctx.dealAll(ctx.c.dmg); ctx.applyAll('vulnerable', ctx.c.magic); },
});
def('rising_strike', {
  name: 'Rising Talon', char: 'amara', type: 'attack', rarity: 'uncommon', cost: 2,
  dmg: 13, magic: 1, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Apply ${c.magic} Sapped and ${c.magic} Exposed.`,
  upgrade: (c) => { c.dmg = 13; c.magic = 2; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.applyEnemy('weak', ctx.c.magic); ctx.applyEnemy('vulnerable', ctx.c.magic); },
});
def('war_trance', {
  name: "Hunter's Calm", char: 'amara', type: 'skill', rarity: 'uncommon', cost: 0,
  magic: 2, target: 'self', exhaust: true,
  desc: (c) => `Gain ${c.magic} Resolve. Draw 2 cards. Exhaust.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => { ctx.applySelf('strength', ctx.c.magic); ctx.draw(2); },
});
def('ember_within', {
  name: 'Emberheart', char: 'amara', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 2, target: 'self',
  desc: (c) => `Gain ${c.magic} Resolve.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.applySelf('strength', ctx.c.magic),
});
def('bulwark', {
  name: 'Obsidian Wall', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 1,
  block: 8, magic: 4, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Gain ${c.magic} Bronzeplate.`,
  upgrade: (c) => { c.magic = 6; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.applySelf('metallicize', ctx.c.magic); },
});
def('read_tell', {
  name: 'Read the Tell', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 3, target: 'enemy', exhaust: true,
  desc: (c) => `If the enemy intends to attack, gain ${c.magic} Resolve.`,
  upgrade: (c) => { c.magic = 4; c.exhaust = false; },
  onPlay: (ctx) => { if (ctx.enemy && ctx.enemy.intent && ctx.enemy.intent.type === 'attack') ctx.applySelf('strength', ctx.c.magic); },
});
def('shockwave', {
  name: 'Seismic Fault', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 2,
  magic: 3, target: 'all', exhaust: true,
  desc: (c) => `Apply ${c.magic} Exposed to ALL enemies. Draw 1 card. Exhaust.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => { ctx.applyAll('vulnerable', ctx.c.magic); ctx.draw(1); },
});
def('disarm', {
  name: 'Break the Spear', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 2, target: 'enemy', exhaust: true,
  desc: (c) => `Enemy loses ${c.magic} Resolve. Exhaust.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.applyEnemy('strength', -ctx.c.magic),
});
def('whirlwind', {
  name: 'Cyclone Dance', char: 'amara', type: 'attack', rarity: 'uncommon', cost: 'X',
  dmg: 5, target: 'all',
  desc: (c) => `Deal ${c.dmg} damage to ALL enemies X times.`,
  upgrade: (c) => { c.dmg = 8; },
  onPlay: (ctx) => { for (let i = 0; i < ctx.X; i++) ctx.dealAll(ctx.c.dmg); },
});
def('ancestral_fury', {
  name: 'Rite of Fury', char: 'amara', type: 'power', rarity: 'rare', cost: 3,
  magic: 1, target: 'self',
  desc: (c) => `Gain 2 Resolve. At the start of each turn, gain ${c.magic} Resolve.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => { ctx.applySelf('strength', 2); ctx.combat.addTrigger('turnStart', () => ctx.applySelf('strength', ctx.c.magic), 'Rite of Fury'); },
});
def('blood_offering', {
  name: 'Crimson Rite', char: 'amara', type: 'skill', rarity: 'rare', cost: 0,
  magic: 5, target: 'self', exhaust: true,
  desc: (c) => `Lose ${c.magic} HP. Gain 2 Àṣẹ. Draw ${c.upgraded ? 3 : 2} cards. Exhaust.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => { ctx.loseHpSelf(ctx.c.magic); ctx.gainEnergy(2); ctx.draw(ctx.c.upgraded ? 3 : 2); },
});
def('devour', {
  name: 'Sate', char: 'amara', type: 'attack', rarity: 'rare', cost: 1,
  dmg: 10, magic: 3, target: 'enemy', exhaust: true,
  desc: (c) => `Deal ${c.dmg} damage. If this kills, raise your Max HP by ${c.magic}. Exhaust.`,
  upgrade: (c) => { c.dmg = 12; c.magic = 4; },
  onPlay: (ctx) => {
    const before = ctx.enemy && ctx.enemy.alive;
    ctx.deal(ctx.enemy, ctx.c.dmg);
    if (before && ctx.enemy && !ctx.enemy.alive) ctx.combat.raiseMaxHp(ctx.c.magic);
  },
});
def('harvest', {
  name: 'Reaping Arc', char: 'amara', type: 'attack', rarity: 'rare', cost: 2,
  dmg: 6, magic: 3, target: 'all', exhaust: true,
  desc: (c) => `Deal ${c.dmg} damage to ALL enemies. Heal ${c.magic} HP for each enemy struck. Exhaust.`,
  upgrade: (c) => { c.dmg = 8; c.magic = 4; },
  onPlay: (ctx) => { const n = ctx.combat.livingEnemies().length; ctx.dealAll(ctx.c.dmg); ctx.heal(n * ctx.c.magic); },
});
def('skyfall', {
  name: 'Skyfall Hammer', char: 'amara', type: 'attack', rarity: 'rare', cost: 3,
  dmg: 32, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage.`,
  upgrade: (c) => { c.dmg = 42; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});

// ============================================================== KOFI — Griot of the Cosmos
// Verses, Blight (poison), cheap cards and relentless tempo.

def('jab', {
  name: 'Jab', char: 'kofi', type: 'attack', rarity: 'basic', cost: 1,
  dmg: 6, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage.`,
  upgrade: (c) => { c.dmg = 9; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});
def('refrain', {
  name: 'Refrain', char: 'kofi', type: 'skill', rarity: 'basic', cost: 1,
  block: 5, target: 'self',
  desc: (c) => `Gain ${c.block} Block.`,
  upgrade: (c) => { c.block = 8; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.block),
});
def('cutting_verse', {
  name: 'Cutting Verse', char: 'kofi', type: 'attack', rarity: 'basic', cost: 0,
  dmg: 3, magic: 1, target: 'enemy', verse: true,
  desc: (c) => `Verse. Deal ${c.dmg} damage. Apply ${c.magic} Sapped.`,
  upgrade: (c) => { c.dmg = 4; c.magic = 2; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.applyEnemy('weak', ctx.c.magic); },
});
def('blight_needle', {
  name: 'Blight Needle', char: 'kofi', type: 'attack', rarity: 'common', cost: 1,
  dmg: 5, magic: 4, target: 'enemy', verse: true,
  desc: (c) => `Verse. Deal ${c.dmg} damage. Apply ${c.magic} Blight.`,
  upgrade: (c) => { c.dmg = 6; c.magic = 6; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.applyEnemy('poison', ctx.c.magic); },
});
def('quickstep', {
  name: 'Quickstep', char: 'kofi', type: 'skill', rarity: 'common', cost: 1,
  block: 6, magic: 1, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Draw ${c.magic} card.`,
  upgrade: (c) => { c.block = 8; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.draw(ctx.c.magic); },
});
def('double_tap', {
  name: 'Off-Beat', char: 'kofi', type: 'attack', rarity: 'common', cost: 1,
  dmg: 4, hits: 2, target: 'enemy', verse: true,
  desc: (c) => `Verse. Deal ${c.dmg} damage twice.`,
  upgrade: (c) => { c.dmg = 6; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg, ctx.c.hits),
});
def('crescendo', {
  name: 'Crescendo', char: 'kofi', type: 'skill', rarity: 'common', cost: 1,
  magic: 2, target: 'self', verse: true,
  desc: (c) => `Verse. Draw ${c.magic} cards.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.draw(ctx.c.magic),
});
def('deflect', {
  name: 'Backstop', char: 'kofi', type: 'skill', rarity: 'common', cost: 0,
  block: 4, target: 'self',
  desc: (c) => `Gain ${c.block} Block.`,
  upgrade: (c) => { c.block = 7; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.block),
});
def('shard_burst', {
  name: 'Shard Burst', char: 'kofi', type: 'attack', rarity: 'common', cost: 1,
  dmg: 4, target: 'all', verse: true,
  desc: (c) => `Verse. Deal ${c.dmg} damage to ALL enemies.`,
  upgrade: (c) => { c.dmg = 6; },
  onPlay: (ctx) => ctx.dealAll(ctx.c.dmg),
});
def('backbeat', {
  name: 'Backbeat', char: 'kofi', type: 'skill', rarity: 'common', cost: 1,
  block: 6, magic: 1, target: 'enemy',
  desc: (c) => `Gain ${c.block} Block. Apply ${c.magic} Sapped.`,
  upgrade: (c) => { c.block = 8; c.magic = 2; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.applyEnemy('weak', ctx.c.magic); },
});
def('venom_chorus', {
  name: 'Venom Chorus', char: 'kofi', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 4, target: 'all', verse: true,
  desc: (c) => `Verse. Apply ${c.magic} Blight to ALL enemies.`,
  upgrade: (c) => { c.magic = 6; },
  onPlay: (ctx) => ctx.applyAll('poison', ctx.c.magic),
});
def('syncopation', {
  name: 'Syncopation', char: 'kofi', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Whenever you play a Verse, apply ${c.magic} Blight to a random enemy.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.combat.addTrigger('versePlayed', () => {
    const e = ctx.combat.randomEnemy(); if (e) ctx.combat.applyPower(e, 'poison', ctx.c.magic, ctx.self);
  }, 'Syncopation'),
});
def('accelerando', {
  name: 'Accelerando', char: 'kofi', type: 'skill', rarity: 'uncommon', cost: 0,
  magic: 1, target: 'self', exhaust: true,
  desc: (c) => `Gain 1 Àṣẹ. Draw ${c.magic} card. Exhaust.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => { ctx.gainEnergy(1); ctx.draw(ctx.c.magic); },
});
def('catalyst', {
  name: 'Fester', char: 'kofi', type: 'skill', rarity: 'uncommon', cost: 1,
  target: 'enemy', exhaust: true,
  desc: (c) => `${c.upgraded ? 'Triple' : 'Double'} an enemy's Blight. Draw 1 card. Exhaust.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => { if (ctx.enemy) { const cur = ctx.enemy.powers.poison || 0; const mult = ctx.c.upgraded ? 2 : 1; if (cur) ctx.combat.applyPower(ctx.enemy, 'poison', cur * mult, ctx.self); } ctx.draw(1); },
});
def('bouncing_verse', {
  name: 'Bouncing Verse', char: 'kofi', type: 'attack', rarity: 'uncommon', cost: 1,
  dmg: 3, magic: 4, target: 'none', verse: true,
  desc: (c) => `Verse. Deal ${c.dmg} damage to a random enemy ${c.magic} times.`,
  upgrade: (c) => { c.magic = 5; },
  onPlay: (ctx) => { for (let i = 0; i < ctx.c.magic; i++) { const e = ctx.combat.randomEnemy(); if (e) ctx.deal(e, ctx.c.dmg); } },
});
def('veil', {
  name: 'Nightveil', char: 'kofi', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 1, target: 'self', exhaust: true,
  desc: (c) => `Gain ${c.magic} Phase (reduce all damage to 1 next turn). Exhaust.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.applySelf('intangible', ctx.c.magic),
});
def('blight_bloom', {
  name: 'Blight Bloom', char: 'kofi', type: 'power', rarity: 'rare', cost: 1,
  target: 'self',
  desc: (c) => `When an enemy dies, deal its remaining Blight as damage to ALL other enemies.`,
  upgrade: (c) => { c.cost = 0; },
  onPlay: (ctx) => ctx.combat.bloodBloom = true,
});
def('the_long_song', {
  name: 'The Long Song', char: 'kofi', type: 'power', rarity: 'rare', cost: 2,
  magic: 1, target: 'self',
  desc: (c) => `At the end of your turn, apply Blight to ALL enemies equal to ${c.magic}× the Verses you played this turn.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.combat.addTrigger('turnEnd', () => {
    const n = ctx.combat.versesThisTurn * ctx.c.magic;
    if (n > 0) for (const e of ctx.combat.livingEnemies()) ctx.combat.applyPower(e, 'poison', n, ctx.self);
  }, 'The Long Song'),
});
def('grand_finale', {
  name: 'Final Chorus', char: 'kofi', type: 'attack', rarity: 'rare', cost: 2,
  dmg: 8, target: 'all', qteMarks: 3,
  desc: (c) => `Deal damage to ALL enemies equal to ${c.dmg}× the Verses you played this combat.`,
  upgrade: (c) => { c.dmg = 10; },
  onPlay: (ctx) => ctx.dealAll(ctx.c.dmg * ctx.combat.versesThisCombat),
});

// ============================================================== ZARA — Star-Weaver
// Channels Spirits of the Orisha (orbs): Storm, Tide, Shade, Sun. Focus amplifies them.

def('pulse', {
  name: 'Pulse', char: 'zara', type: 'attack', rarity: 'basic', cost: 1,
  dmg: 6, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage.`,
  upgrade: (c) => { c.dmg = 9; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});
def('barrier', {
  name: 'Barrier', char: 'zara', type: 'skill', rarity: 'basic', cost: 1,
  block: 5, target: 'self',
  desc: (c) => `Gain ${c.block} Block.`,
  upgrade: (c) => { c.block = 8; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.block),
});
def('channel_storm', {
  name: 'Call Lightning', char: 'zara', type: 'skill', rarity: 'basic', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Channel ${c.magic} Storm.${c.upgraded ? ' Draw 1 card.' : ''}`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => { ctx.channel('storm', ctx.c.magic); if (ctx.c.upgraded) ctx.draw(1); },
});
def('resonate', {
  name: 'Resonate', char: 'zara', type: 'skill', rarity: 'basic', cost: 1,
  magic: 2, target: 'self',
  desc: (c) => `Evoke your rightmost Spirit ${c.magic} times.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.evoke(ctx.c.magic),
});
def('static_burst', {
  name: 'Static Burst', char: 'zara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 7, magic: 1, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Channel ${c.magic} Storm.`,
  upgrade: (c) => { c.dmg = 10; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.channel('storm', ctx.c.magic); },
});
def('frostbind', {
  name: 'Frostbind', char: 'zara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 6, magic: 1, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Channel ${c.magic} Tide.`,
  upgrade: (c) => { c.dmg = 9; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.channel('tide', ctx.c.magic); },
});
def('coolhead', {
  name: 'Still Waters', char: 'zara', type: 'skill', rarity: 'common', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Channel ${c.magic} Tide. Draw ${c.upgraded ? 2 : 1} card${c.upgraded ? 's' : ''}.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => { ctx.channel('tide', ctx.c.magic); ctx.draw(ctx.c.upgraded ? 2 : 1); },
});
def('capacitor', {
  name: 'Reservoir', char: 'zara', type: 'skill', rarity: 'common', cost: 1,
  block: 7, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Gain 1 Àṣẹ next turn.`,
  upgrade: (c) => { c.block = 10; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.combat.energyNextTurn += 1; },
});
def('chaos', {
  name: 'Wild Spirit', char: 'zara', type: 'skill', rarity: 'common', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Channel ${c.magic} random Spirit.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => { for (let i = 0; i < ctx.c.magic; i++) ctx.channel(ctx.rng.pick(['storm', 'tide', 'shade', 'sun'])); },
});
def('glacier', {
  name: 'Icewall', char: 'zara', type: 'skill', rarity: 'common', cost: 2,
  block: 7, magic: 2, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Channel ${c.magic} Tide.`,
  upgrade: (c) => { c.block = 10; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.channel('tide', ctx.c.magic); },
});
def('summon_shade', {
  name: 'Summon Shade', char: 'zara', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Channel ${c.magic} Shade.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.channel('shade', ctx.c.magic),
});
def('attune', {
  name: 'Attune', char: 'zara', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 2, target: 'self',
  desc: (c) => `Gain ${c.magic} Focus.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.applySelf('focus', ctx.c.magic),
});
def('doomgloom', {
  name: 'Gathering Dark', char: 'zara', type: 'attack', rarity: 'uncommon', cost: 2,
  dmg: 10, magic: 1, target: 'all',
  desc: (c) => `Deal ${c.dmg} damage to ALL enemies. Channel ${c.magic} Shade.`,
  upgrade: (c) => { c.dmg = 14; },
  onPlay: (ctx) => { ctx.dealAll(ctx.c.dmg); ctx.channel('shade', ctx.c.magic); },
});
def('skim', {
  name: 'Stargaze', char: 'zara', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 3, target: 'self',
  desc: (c) => `Draw ${c.magic} cards.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => ctx.draw(ctx.c.magic),
});
def('echocast', {
  name: 'Echocast', char: 'zara', type: 'skill', rarity: 'uncommon', cost: 'X',
  target: 'self',
  desc: (c) => `Evoke your rightmost Spirit X times.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => ctx.evoke(ctx.X + (ctx.c.upgraded ? 1 : 0)),
});
def('summon_sun', {
  name: 'Kindle the Sun', char: 'zara', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Channel ${c.magic} Sun.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.channel('sun', ctx.c.magic),
});
def('overclock', {
  name: 'Overdrive', char: 'zara', type: 'power', rarity: 'rare', cost: 1,
  magic: 4, target: 'self',
  desc: (c) => `Gain ${c.magic} Focus. At the start of your turn, lose 1 Focus.`,
  upgrade: (c) => { c.magic = 5; },
  onPlay: (ctx) => { ctx.applySelf('focus', ctx.c.magic); ctx.combat.addTrigger('turnStart', () => ctx.applySelf('focus', -1), 'Overdrive'); },
});
def('stormcall', {
  name: 'Stormcall', char: 'zara', type: 'skill', rarity: 'rare', cost: 1,
  magic: 2, target: 'self',
  desc: (c) => `Channel ${c.magic} Storm. Storm evokes now strike ALL enemies.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => { ctx.channel('storm', ctx.c.magic); ctx.combat.stormAll = true; },
});
def('echo_form', {
  name: 'Mirrorcast', char: 'zara', type: 'power', rarity: 'rare', cost: 3,
  target: 'self',
  desc: (c) => `The first card you play each turn is played twice.${''}`,
  upgrade: (c) => { c.cost = 2; },
  onPlay: (ctx) => { ctx.combat.echoForm = true; },
});
def('falling_star', {
  name: 'Falling Star', char: 'zara', type: 'attack', rarity: 'rare', cost: 5,
  dmg: 24, magic: 3, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Channel ${c.magic} Storm.`,
  upgrade: (c) => { c.dmg = 30; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.channel('storm', ctx.c.magic); },
});

// ============================================================== COLORLESS (rewards & shops)
def('shiv', {
  name: 'Shard', char: 'colorless', type: 'attack', rarity: 'special', cost: 0,
  dmg: 4, target: 'enemy', exhaust: true,
  desc: (c) => `Deal ${c.dmg} damage. Exhaust.`,
  upgrade: (c) => { c.dmg = 6; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});
def('flash', {
  name: 'Flash of Insight', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0,
  magic: 1, target: 'self', exhaust: true,
  desc: (c) => `Draw ${c.upgraded ? 3 : 2} cards. Exhaust.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => ctx.draw(ctx.c.upgraded ? 3 : 2),
});
def('panic_button', {
  name: 'Last Resort', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0,
  block: 30, target: 'self', exhaust: true,
  desc: (c) => `Gain ${c.block} Block. You cannot gain Block next turn. Exhaust.`,
  upgrade: (c) => { c.block = 40; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.combat.addTrigger('turnStart', () => ctx.applySelf('noBlock', 1), 'Last Resort', true); },
});
def('apotheosis', {
  name: 'Transcendence', char: 'colorless', type: 'skill', rarity: 'rare', cost: 2,
  target: 'self', exhaust: true,
  desc: (c) => `Upgrade ALL of your cards for the rest of combat. Exhaust.`,
  upgrade: (c) => { c.cost = 1; },
  onPlay: (ctx) => ctx.combat.upgradeAllInCombat(),
});

// ============================================================== STATUS & CURSE
def('wound', {
  name: 'Scar', char: 'status', type: 'status', rarity: 'special', cost: -1,
  target: 'none', unplayable: true,
  desc: () => `Unplayable.`,
  upgrade: () => {},
  onPlay: () => {},
});
def('dazed', {
  name: 'Reeling', char: 'status', type: 'status', rarity: 'special', cost: -1,
  target: 'none', unplayable: true, ethereal: true,
  desc: () => `Unplayable. Ethereal.`,
  upgrade: () => {},
  onPlay: () => {},
});
def('static_curse', {
  name: 'Glitch', char: 'curse', type: 'curse', rarity: 'special', cost: -1,
  target: 'none', unplayable: true,
  desc: () => `Unplayable. While in hand, lose 1 HP at end of turn.`,
  upgrade: () => {},
  onPlay: () => {},
  inHandTurnEnd: (ctx) => ctx.loseHpSelf(1),
});
def('regret', {
  name: 'Sorrow', char: 'curse', type: 'curse', rarity: 'special', cost: -1,
  target: 'none', unplayable: true,
  desc: () => `Unplayable. At end of turn, lose 1 HP for each card in hand.`,
  upgrade: () => {},
  onPlay: () => {},
  inHandTurnEnd: (ctx) => ctx.loseHpSelf(ctx.combat.hand.length),
});

// ----------------------------------------------------------------- instance factory
export function createCard(id, opts = {}) {
  const bp = CARDS[id];
  if (!bp) throw new Error('Unknown card id: ' + id);
  const c = {
    id,
    uid: uid(),
    name: bp.name,
    char: bp.char,
    type: bp.type,
    rarity: bp.rarity || 'common',
    cost: bp.cost,
    baseCost: bp.cost,
    target: bp.target || 'enemy',
    upgraded: false,
    exhaust: !!bp.exhaust,
    ethereal: !!bp.ethereal,
    innate: !!bp.innate,
    retain: !!bp.retain,
    unplayable: !!bp.unplayable,
    verse: !!bp.verse,
    dmg: bp.dmg, block: bp.block, magic: bp.magic, hits: bp.hits || 1,
    _bp: bp,
  };
  if (opts.upgraded) upgradeCard(c);
  return c;
}

export function upgradeCard(c) {
  if (c.upgraded && c._bp.id !== undefined) {
    // some cards set upgraded inside their upgrade(); allow idempotent guard
  }
  if (c.upgraded) return c;
  c._bp.upgrade(c);
  c.upgraded = true;
  if (!c.name.endsWith('+')) c.name = c._bp.name + '+';
  return c;
}

export function canUpgrade(c) {
  return !c.upgraded && c.type !== 'status' && c.type !== 'curse';
}

export function cardDesc(c) {
  return c._bp.desc(c);
}

export const ALL_CARD_IDS = () => Object.keys(CARDS);

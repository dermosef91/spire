// Card blueprints for all three champions plus colorless cards, statuses and curses.
//
// A "blueprint" is shared and immutable. An "instance" (created by createCard)
// holds the mutable per-card data (upgraded state, numeric stats, uid) and
// delegates behavior back to the blueprint via _bp.
//
// onPlay(ctx) drives all effects. The combat engine builds `ctx` per play with
// these helpers: deal, dealAll, gainBlock, applyEnemy, applyAll, applySelf,
// draw, gainEnergy, loseHpSelf, heal, addCard, channel, evoke, consumeThis, etc.

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
  dmg: 8, magic: 2, target: 'enemy', vfx: 'fault-line',
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
  dmg: 6, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Gain Block equal to the HP damage dealt.`,
  upgrade: (c) => { c.dmg = 9; },
  onPlay: (ctx) => { const hp = ctx.deal(ctx.enemy, ctx.c.dmg); if (hp > 0) ctx.gainBlock(hp); },
});
def('pommel', {
  name: 'Hilt Crack', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 8, magic: 4, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Draw 1 card — 2 if you have ${c.magic}+ Tempo.`,
  upgrade: (c) => { c.dmg = 10; c.magic = 3; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.draw(ctx.tempo() >= ctx.c.magic ? 2 : 1); },
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
  block: 6, magic: 1, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Gain ${c.magic} Tempo.`,
  upgrade: (c) => { c.block = 9; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.gainTempo(ctx.c.magic); },
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
  upgrade: (c) => { c.dmg = 16; c.magic = 2; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.applyEnemy('weak', ctx.c.magic); ctx.applyEnemy('vulnerable', ctx.c.magic); },
});
def('war_trance', {
  name: "Hunter's Calm", char: 'amara', type: 'skill', rarity: 'uncommon', cost: 0,
  magic: 2, target: 'self', consume: true,
  desc: (c) => `Gain ${c.magic} Resolve. Draw 2 cards. Consume.`,
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
  magic: 3, target: 'enemy', consume: true,
  desc: (c) => `If the enemy intends to attack, gain ${c.magic} Resolve.`,
  upgrade: (c) => { c.magic = 4; c.consume = false; },
  onPlay: (ctx) => { if (ctx.enemy && ctx.enemy.intent && ctx.enemy.intent.type === 'attack') ctx.applySelf('strength', ctx.c.magic); },
});
def('shockwave', {
  name: 'Seismic Fault', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 2,
  magic: 3, target: 'all', consume: true,
  desc: (c) => `Apply ${c.magic} Exposed to ALL enemies. Draw 1 card. Consume.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => { ctx.applyAll('vulnerable', ctx.c.magic); ctx.draw(1); },
});
def('disarm', {
  name: 'Break the Spear', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 1,
  magic: 2, target: 'enemy', consume: true,
  desc: (c) => `Enemy loses ${c.magic} Resolve. Consume.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.applyEnemy('strength', -ctx.c.magic),
});
def('whirlwind', {
  name: 'Cyclone Dance', char: 'amara', type: 'attack', rarity: 'uncommon', cost: 3,
  dmg: 2, magic: 2, target: 'all', qteMarks: 3,
  desc: (c) => `Deal ${c.dmg} damage to ALL enemies. Consume ALL your Tempo: +${c.magic} damage for each consumed.`,
  upgrade: (c) => { c.dmg = 6; c.magic = 3; },
  onPlay: (ctx) => { const t = ctx.spendAllTempo(); ctx.dealAll(ctx.c.dmg + ctx.c.magic * t); },
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
  magic: 5, target: 'self', consume: true,
  desc: (c) => `Lose ${c.magic} HP. Gain 2 Àṣẹ. Draw ${c.upgraded ? 3 : 2} cards. Consume.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => { ctx.loseHpSelf(ctx.c.magic); ctx.gainEnergy(2); ctx.draw(ctx.c.upgraded ? 3 : 2); },
});
def('devour', {
  name: 'Sate', char: 'amara', type: 'attack', rarity: 'rare', cost: 1,
  dmg: 10, magic: 3, target: 'enemy', consume: true,
  desc: (c) => `Deal ${c.dmg} damage. If this kills, gain ${c.magic} Max HP. Consume.`,
  upgrade: (c) => { c.dmg = 12; c.magic = 4; },
  onPlay: (ctx) => {
    const before = ctx.enemy && ctx.enemy.alive;
    ctx.deal(ctx.enemy, ctx.c.dmg);
    if (before && ctx.enemy && !ctx.enemy.alive) ctx.combat.raiseMaxHp(ctx.c.magic);
  },
});
def('harvest', {
  name: 'Reaping Arc', char: 'amara', type: 'attack', rarity: 'rare', cost: 2,
  dmg: 6, magic: 3, target: 'all', consume: true,
  desc: (c) => `Deal ${c.dmg} damage to ALL enemies. Heal ${c.magic} HP per enemy struck. Consume.`,
  upgrade: (c) => { c.dmg = 8; c.magic = 4; },
  onPlay: (ctx) => { const n = ctx.combat.livingEnemies().length; ctx.dealAll(ctx.c.dmg); ctx.heal(n * ctx.c.magic); },
});
def('skyfall', {
  name: 'Skyfall Hammer', char: 'amara', type: 'attack', rarity: 'rare', cost: 3,
  dmg: 32, target: 'enemy', vfx: 'skyfall-hammer',
  desc: (c) => `Deal ${c.dmg} damage.`,
  upgrade: (c) => { c.dmg = 42; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});

// --- Tempo suite: the Bladedancer reads the rhythm layer. Tempo registers
// before onPlay (see combat.playCard), so these cards count their own strike.
def('flowing_edge', {
  name: 'Flowing Edge', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  magic: 2, target: 'enemy',
  desc: (c) => `Deal ${c.magic} damage for each Tempo you have.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.magic * ctx.tempo()),
});
def('dancers_poise', {
  name: "Dancer's Poise", char: 'amara', type: 'skill', rarity: 'common', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Gain ${c.magic} Block for each Tempo you have.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.magic * ctx.tempo()),
});
def('spiral_finish', {
  name: 'Spiral Finish', char: 'amara', type: 'attack', rarity: 'uncommon', cost: 2,
  magic: 3, target: 'enemy', qteMarks: 2,
  desc: (c) => `Consume ALL your Tempo: deal ${c.magic} damage for each consumed.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => { const t = ctx.spendAllTempo(); ctx.deal(ctx.enemy, ctx.c.magic * t); },
});
def('war_drum_cadence', {
  name: 'War-Drum Cadence', char: 'amara', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `At the start of your turn, if you have 3 or more Tempo, gain ${c.magic} Resolve.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.combat.addTrigger('turnStart', () => {
    if (ctx.combat.tempo() >= 3) ctx.applySelf('strength', ctx.c.magic);
  }, 'War-Drum Cadence'),
});
def('unbroken_dance', {
  name: 'Unbroken Dance', char: 'amara', type: 'power', rarity: 'rare', cost: 2,
  magic: 1, target: 'self',
  desc: (c) => `Whenever you gain Tempo, gain ${c.magic} Block for each Tempo gained.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.combat.addTrigger('tempoGained', ({ amount }) => {
    ctx.combat.gainBlockTo(ctx.combat.player, amount * ctx.c.magic, true);
  }, 'Unbroken Dance'),
});
def('overflow', {
  name: 'Overflow', char: 'amara', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 8, target: 'self',
  desc: (c) => `When your Tempo hits its cap, deal ${c.magic} damage to ALL enemies, then Tempo resets to 5.`,
  upgrade: (c) => { c.magic = 12; },
  onPlay: (ctx) => ctx.combat.addTrigger('tempoCapped', () => {
    ctx.dealAll(ctx.c.magic);
    const t = ctx.combat.tempo();
    if (t > 5) ctx.applySelf('tempo', 5 - t);
  }, 'Overflow'),
});

// --- Oaths: a pledge made now, checked at the start of your next turn. Agojie
// discipline as a mechanic — a self-imposed constraint with no Slay-the-Spire
// equivalent, resolved once by combat.vows in startPlayerTurn.
def('oath_of_iron', {
  name: 'Oath of Iron', char: 'amara', type: 'skill', rarity: 'common', cost: 1, consume: true,
  block: 6, magic: 2, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Vow: take no HP damage before your next turn, then gain ${c.magic} Resolve. Consume.`,
  upgrade: (c) => { c.block = 9; c.magic = 3; },
  onPlay: (ctx) => {
    ctx.gainBlock(ctx.c.block);
    let broken = false;
    ctx.combat.addTrigger('hpLost', () => { broken = true; }, 'Oath of Iron (watch)');
    ctx.combat.vows.push({
      name: 'Oath of Iron',
      check: () => !broken,
      onKept: (combat) => combat.applyPower(combat.player, 'strength', ctx.c.magic, combat.player),
    });
  },
});
def('oathbreakers_edge', {
  name: "Oathbreaker's Edge", char: 'amara', type: 'attack', rarity: 'uncommon', cost: 2,
  dmg: 12, magic: 20, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage — ${c.magic} instead if you've broken a Vow this combat.`,
  upgrade: (c) => { c.dmg = 15; c.magic = 25; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.combat.brokeVowThisCombat ? ctx.c.magic : ctx.c.dmg),
});

// --- Scars & tempo edge: the Bladedancer wears her wounds and gambles her rhythm.
def('reckless_glory', {
  name: 'Reckless Glory', char: 'amara', type: 'attack', rarity: 'common', cost: 1,
  dmg: 12, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Add a Scar to your discard pile.`,
  upgrade: (c) => { c.dmg = 15; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.combat.addCardToPile(ctx.combat.makeCard('wound'), 'discard'); },
});
def('open_old_wounds', {
  name: 'Open the Old Wounds', char: 'amara', type: 'attack', rarity: 'rare', cost: 1,
  dmg: 9, target: 'all',
  desc: (c) => `Consume all Status cards in your hand. Deal ${c.dmg} damage to ALL enemies for each one.`,
  upgrade: (c) => { c.dmg = 12; },
  onPlay: (ctx) => {
    const statuses = ctx.combat.hand.filter((h) => h.type === 'status');
    for (const s of statuses) { ctx.combat.hand.splice(ctx.combat.hand.indexOf(s), 1); ctx.combat.consume(s); }
    if (statuses.length) ctx.dealAll(ctx.c.dmg * statuses.length);
  },
});
def('half_beat', {
  name: 'Half-Beat', char: 'amara', type: 'skill', rarity: 'common', cost: 0,
  magic: 2, target: 'self', consume: true,
  desc: (c) => `Gain ${c.magic} Tempo.${c.consume ? ' Consume.' : ''}`,
  upgrade: (c) => { c.consume = false; },
  onPlay: (ctx) => ctx.gainTempo(ctx.c.magic),
});
def('shattered_cadence', {
  name: 'Shattered Cadence', char: 'amara', type: 'attack', rarity: 'uncommon', cost: 2,
  dmg: 16, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage. Your rhythm breaks — Tempo drops to 0.`,
  upgrade: (c) => { c.dmg = 20; },
  onPlay: (ctx) => { ctx.deal(ctx.enemy, ctx.c.dmg); ctx.combat.breakTempo(); },
});

// --- Riposte & Flow: the Bladedancer answers the blow, or is simply
// somewhere else when it lands. A finite, telegraphed alternative to the
// removed Backlash mechanic, and a true dodge with no Slay-the-Spire analog.
def('answering_steel', {
  name: 'Answering Steel', char: 'amara', type: 'skill', rarity: 'common', cost: 1,
  block: 5, magic: 6, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Gain ${c.magic} Riposte.`,
  upgrade: (c) => { c.block = 7; c.magic = 9; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.applySelf('riposte', ctx.c.magic); },
});
def('answer_in_kind', {
  name: 'Answer in Kind', char: 'amara', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 1, target: 'self',
  desc: (c) => `Whenever you successfully parry, apply ${c.magic} Sapped to the attacker.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => ctx.combat.addTrigger('parrySuccess', ({ enemy }) => {
    if (enemy && enemy.alive) ctx.combat.applyPower(enemy, 'weak', ctx.c.magic, ctx.self);
  }, 'Answer in Kind'),
});
def('blade_turn', {
  name: 'Blade Turn', char: 'amara', type: 'skill', rarity: 'rare', cost: 1, consume: true,
  target: 'self',
  desc: () => `Until your next turn, a successful parry reflects the attack's full damage back at the attacker. Consume.`,
  upgrade: (c) => { c.cost = 0; },
  onPlay: (ctx) => {
    ctx.combat._parryReflect = true;
    ctx.combat.addTrigger('turnStart', () => { ctx.combat._parryReflect = false; }, 'Blade Turn (expire)', true);
  },
});
def('read_the_wind', {
  name: 'Read the Wind', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 1, consume: true,
  magic: 1, target: 'self',
  desc: (c) => `Gain ${c.magic} Flow. Consume.`,
  upgrade: (c) => { c.cost = 0; },
  onPlay: (ctx) => ctx.applySelf('flow', ctx.c.magic),
});
def('untouchable', {
  name: 'Untouchable', char: 'amara', type: 'power', rarity: 'rare', cost: 3,
  magic: 1, target: 'self',
  desc: (c) => `At the start of each turn, gain ${c.magic} Flow.`,
  upgrade: (c) => { c.cost = 2; },
  onPlay: (ctx) => ctx.combat.addTrigger('turnStart', () => ctx.applySelf('flow', ctx.c.magic), 'Untouchable'),
});

// --- The Duel: a single-target mark. Honor demands you finish what you
// started — a commitment archetype with no Slay-the-Spire equivalent.
def('call_the_duel', {
  name: 'Call the Duel', char: 'amara', type: 'skill', rarity: 'uncommon', cost: 0, consume: true,
  magic: 3, target: 'enemy',
  desc: (c) => `Challenge an enemy: your attacks deal +${c.magic} damage to it. On its death, draw 3 cards. Consume.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => {
    if (!ctx.enemy || !ctx.enemy.alive) return;
    // Only one enemy is ever Challenged at a time.
    for (const e of ctx.combat.livingEnemies()) if (e !== ctx.enemy) delete e.powers.challenged;
    ctx.applyEnemy('challenged', ctx.c.magic);
  },
});
def('take_their_name', {
  name: 'Take Their Name', char: 'amara', type: 'attack', rarity: 'rare', cost: 3, consume: true,
  dmg: 26, magic: 3, target: 'none',
  desc: (c) => `Deal ${c.dmg} damage to the Challenged enemy. If it dies, gain ${c.magic} Resolve and heal ${c.upgraded ? 8 : 6}. Consume.`,
  upgrade: (c) => { c.dmg = 34; c.magic = 4; },
  playable: (ctx) => ctx.combat.livingEnemies().some((e) => e.powers.challenged),
  onPlay: (ctx) => {
    const target = ctx.combat.livingEnemies().find((e) => e.powers.challenged);
    if (!target) return;
    const wasAlive = target.alive;
    ctx.deal(target, ctx.c.dmg);
    if (wasAlive && !target.alive) { ctx.applySelf('strength', ctx.c.magic); ctx.heal(ctx.c.upgraded ? 8 : 6); }
  },
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
  magic: 1, target: 'self', consume: true,
  desc: (c) => `Gain 1 Àṣẹ. Draw ${c.magic} card. Consume.`,
  upgrade: (c) => { c.magic = 2; },
  onPlay: (ctx) => { ctx.gainEnergy(1); ctx.draw(ctx.c.magic); },
});
def('catalyst', {
  name: 'Fester', char: 'kofi', type: 'skill', rarity: 'uncommon', cost: 1,
  target: 'enemy', consume: true,
  desc: (c) => `An enemy suffers its Blight as damage now; its Blight isn't reduced. Draw 1 card. Consume.`,
  upgrade: (c) => { c.cost = 0; },
  onPlay: (ctx) => {
    if (ctx.enemy && ctx.enemy.powers.poison) {
      const p = ctx.enemy.powers.poison;
      ctx.combat.log(`${ctx.enemy.name} festers for ${p}!`);
      ctx.combat.loseHp(ctx.enemy, p);
    }
    ctx.draw(1);
  },
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
  magic: 1, target: 'self', consume: true,
  desc: (c) => `Gain ${c.magic} Phase (reduce all damage to 1 next turn). Consume.`,
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
  desc: (c) => `At turn end, apply Blight to ALL enemies equal to ${c.magic}× Verses played this turn.`,
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
  desc: (c) => `Gain ${c.magic} Focus. Lose 1 Focus each turn.`,
  upgrade: (c) => { c.magic = 5; },
  onPlay: (ctx) => { ctx.applySelf('focus', ctx.c.magic); ctx.combat.addTrigger('turnStart', () => ctx.applySelf('focus', -1), 'Overdrive'); },
});
def('stormcall', {
  name: 'Stormcall', char: 'zara', type: 'skill', rarity: 'rare', cost: 1,
  magic: 2, target: 'self',
  desc: (c) => `Channel ${c.magic} Storm. Storm now strikes ALL enemies.`,
  upgrade: (c) => { c.magic = 3; },
  onPlay: (ctx) => { ctx.channel('storm', ctx.c.magic); ctx.combat.stormAll = true; },
});
def('echo_form', {
  name: 'Mirrorcast', char: 'zara', type: 'power', rarity: 'rare', cost: 3,
  target: 'self',
  desc: (c) => `Spirits you Channel arrive twice.`,
  upgrade: (c) => { c.cost = 2; },
  onPlay: (ctx) => { ctx.combat.mirrorChannel = true; },
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
  dmg: 4, target: 'enemy', consume: true,
  desc: (c) => `Deal ${c.dmg} damage. Consume.`,
  upgrade: (c) => { c.dmg = 6; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
});
def('flash', {
  name: 'Flash of Insight', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0,
  magic: 1, target: 'self', consume: true,
  desc: (c) => `Draw ${c.upgraded ? 3 : 2} cards. Consume.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => ctx.draw(ctx.c.upgraded ? 3 : 2),
});
def('panic_button', {
  name: 'Last Resort', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0,
  block: 12, target: 'self', consume: true,
  desc: (c) => `Gain ${c.block} Block. Your rhythm breaks — Tempo drops to 0. Consume.`,
  upgrade: (c) => { c.block = 16; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.combat.breakTempo(); },
});
def('apotheosis', {
  name: 'Transcendence', char: 'colorless', type: 'skill', rarity: 'rare', cost: 1,
  target: 'self', consume: true,
  desc: (c) => `Upgrade all cards in your hand for the rest of combat. Draw 1 card. Consume.`,
  upgrade: (c) => { c.cost = 0; },
  onPlay: (ctx) => {
    for (const h of ctx.combat.hand) if (canUpgrade(h)) upgradeCard(h);
    ctx.draw(1);
  },
});
def('read_the_field', {
  name: 'Read the Field', char: 'colorless', type: 'skill', rarity: 'common', cost: 0,
  block: 5, magic: 2, target: 'self',
  desc: (c) => `If any enemy intends to attack, gain ${c.block} Block. Otherwise draw ${c.magic} cards.`,
  upgrade: (c) => { c.block = 7; c.magic = 3; },
  onPlay: (ctx) => {
    const aggro = ctx.combat.livingEnemies().some((e) => e.intent && e.intent.type && e.intent.type.startsWith('attack'));
    if (aggro) ctx.gainBlock(ctx.c.block); else ctx.draw(ctx.c.magic);
  },
});
def('swallow_sorrow', {
  name: 'Swallow Sorrow', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 1,
  block: 9, magic: 4, target: 'self',
  desc: (c) => `Consume a Status or Curse from your hand: gain ${c.block} Block and draw 1. If you have none, gain ${c.magic} Block.`,
  upgrade: (c) => { c.block = 12; c.magic = 6; },
  onPlay: (ctx) => {
    const junk = ctx.combat.hand.find((h) => h.type === 'status' || h.type === 'curse');
    if (junk) { ctx.combat.hand.splice(ctx.combat.hand.indexOf(junk), 1); ctx.combat.consume(junk); ctx.gainBlock(ctx.c.block); ctx.draw(1); }
    else ctx.gainBlock(ctx.c.magic);
  },
});

// --- Call & Response: Attack/Skill alternation, read via ctx.combat._prevPlayedType
// (the type of the last card played this turn, snapshotted before onPlay runs).
def('step_turn_strike', {
  name: 'Step, Turn, Strike', char: 'colorless', type: 'attack', rarity: 'common', cost: 1,
  dmg: 6, magic: 10, target: 'enemy',
  desc: (c) => `Deal ${c.dmg} damage — ${c.magic} if your previous card this turn was a Skill.`,
  upgrade: (c) => { c.dmg = 8; c.magic = 13; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.combat._prevPlayedType === 'skill' ? ctx.c.magic : ctx.c.dmg),
});
def('answer_song', {
  name: 'Answer-Song', char: 'colorless', type: 'skill', rarity: 'common', cost: 1,
  block: 4, magic: 7, target: 'self',
  desc: (c) => `Gain ${c.block} Block — ${c.magic} if your previous card this turn was an Attack.`,
  upgrade: (c) => { c.block = 5; c.magic = 9; },
  onPlay: (ctx) => ctx.gainBlock(ctx.combat._prevPlayedType === 'attack' ? ctx.c.magic : ctx.c.block),
});
def('call_and_response', {
  name: 'Call and Response', char: 'colorless', type: 'power', rarity: 'uncommon', cost: 1,
  magic: 3, target: 'self',
  desc: (c) => `Play an Attack after a Skill (or a Skill after an Attack) to draw 1 card. Up to ${c.magic}× per turn.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => {
    ctx.combat._callResponseCount = 0;
    ctx.combat.addTrigger('turnStart', () => { ctx.combat._callResponseCount = 0; }, 'Call and Response (reset)');
    ctx.combat.addTrigger('cardPlayed', ({ card, prevType }) => {
      if (ctx.combat._callResponseCount >= ctx.c.magic) return;
      const alternated = (card.type === 'attack' && prevType === 'skill') || (card.type === 'skill' && prevType === 'attack');
      if (alternated) { ctx.combat._callResponseCount += 1; ctx.draw(1); }
    }, 'Call and Response');
  },
});

// --- The Archive: Ethereal as an upside. Each Echo names a champion the
// Spire renders into an enemy for the next climber (see the world's "the
// Spire welcomes climbers home" lie) — remembered instead of erased. Their
// onConsume fires whether they leave play by turn-end Ethereal or a card
// that Consumes the hand outright.
def('echo_of_the_cantor', {
  name: 'Echo of the Cantor', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 1,
  block: 5, magic: 1, target: 'self', ethereal: true,
  desc: (c) => `Gain ${c.block} Block. Ethereal. When Consumed, apply ${c.magic} Sapped to ALL enemies.`,
  upgrade: (c) => { c.block = 7; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.block),
  onConsume: (ctx) => ctx.applyAll('weak', ctx.c.magic),
});
def('echo_of_the_sentinel', {
  name: 'Echo of the Sentinel', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 1,
  block: 4, magic: 7, target: 'self', ethereal: true,
  desc: (c) => `Gain ${c.block} Block. Ethereal. When Consumed, gain ${c.magic} Block.`,
  upgrade: (c) => { c.block = 6; c.magic = 9; },
  onPlay: (ctx) => ctx.gainBlock(ctx.c.block),
  onConsume: (ctx) => ctx.gainBlock(ctx.c.magic),
});
def('echo_of_the_warden', {
  name: 'Echo of the Warden', char: 'colorless', type: 'attack', rarity: 'uncommon', cost: 1,
  dmg: 7, magic: 10, target: 'enemy', ethereal: true,
  desc: (c) => `Deal ${c.dmg} damage. Ethereal. When Consumed, deal ${c.magic} damage to a random enemy.`,
  upgrade: (c) => { c.dmg = 9; c.magic = 13; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, ctx.c.dmg),
  onConsume: (ctx) => { const e = ctx.combat.randomEnemy(); if (e) ctx.combat.applyDamage(e, ctx.c.magic, { isAttack: false }); },
});
def('remembered_name', {
  name: 'Remembered Name', char: 'colorless', type: 'power', rarity: 'rare', cost: 1,
  magic: 3, target: 'self',
  desc: (c) => `Whenever one of your cards is Consumed, deal ${c.magic} damage to a random enemy.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => ctx.combat.addTrigger('cardConsumed', () => {
    const e = ctx.combat.randomEnemy(); if (e) ctx.combat.applyDamage(e, ctx.c.magic, { isAttack: false });
  }, 'Remembered Name'),
});
def('catalogue_opens', {
  name: 'The Catalogue Opens', char: 'colorless', type: 'skill', rarity: 'rare', cost: 2, consume: true,
  dmg: 4, target: 'all',
  desc: (c) => `Consume your hand. Deal ${c.dmg} damage to ALL enemies for each card Consumed. Consume.`,
  upgrade: (c) => { c.dmg = 5; },
  onPlay: (ctx) => {
    const rest = ctx.combat.hand;
    ctx.combat.hand = [];
    for (const card of rest) ctx.combat.consume(card);
    if (rest.length) ctx.dealAll(ctx.c.dmg * rest.length);
  },
});
def('reckoning', {
  name: 'Reckoning', char: 'colorless', type: 'attack', rarity: 'rare', cost: 1,
  magic: 40, target: 'enemy',
  desc: (c) => `Deal damage equal to the number of foes you've slain this run (max ${c.magic}).`,
  upgrade: (c) => { c.magic = 50; },
  onPlay: (ctx) => ctx.deal(ctx.enemy, Math.min(ctx.run.foesSlain, ctx.c.magic)),
});

// --- The Spire's Bargains: power now, a bill collected at the start of your
// next turn (combat.debt, resolved in startPlayerTurn). Win the fight before
// it comes due and the bill is never paid — that race is the whole point.
def('borrowed_time', {
  name: 'Borrowed Time', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0, consume: true,
  magic: 2, target: 'self',
  desc: (c) => `Gain ${c.magic} Àṣẹ. Debt: start next turn with ${c.upgraded ? 1 : 2} less Àṣẹ. Consume.`,
  upgrade: (c) => { c.upgraded = true; },
  onPlay: (ctx) => { ctx.gainEnergy(ctx.c.magic); ctx.combat.debt.energy += ctx.c.upgraded ? 1 : 2; },
});
def('flesh_ledger', {
  name: 'Flesh Ledger', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0,
  block: 11, magic: 5, target: 'self',
  desc: (c) => `Gain ${c.block} Block. Debt: lose ${c.magic} HP at the start of your next turn.`,
  upgrade: (c) => { c.block = 15; },
  onPlay: (ctx) => { ctx.gainBlock(ctx.c.block); ctx.combat.debt.hp += ctx.c.magic; },
});
def('advance_on_the_prize', {
  name: 'Advance on the Prize', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0, consume: true,
  magic: 3, target: 'self',
  desc: (c) => `Draw ${c.magic} cards. Debt: draw 2 fewer next turn. Consume.`,
  upgrade: (c) => { c.magic = 4; },
  onPlay: (ctx) => { ctx.draw(ctx.c.magic); ctx.combat.debt.draw += 2; },
});

// --- Misdirection: read and rewrite intents. StS never lets you touch an
// enemy's telegraphed move; the engine already re-picks intents for boss
// phase transitions, so the verbs here are cheap to expose to cards.
def('provoke_the_tell', {
  name: 'Provoke the Tell', char: 'colorless', type: 'skill', rarity: 'uncommon', cost: 0, consume: true,
  target: 'enemy',
  desc: () => `An enemy re-picks its intent. Draw 1. Consume.`,
  upgrade: (c) => { c.consume = false; },
  onPlay: (ctx) => {
    if (ctx.enemy && ctx.enemy.alive) ctx.combat.pickEnemyMove(ctx.enemy);
    ctx.draw(1);
  },
});
def('stagger', {
  name: 'Stagger', char: 'colorless', type: 'skill', rarity: 'rare', cost: 2, consume: true,
  target: 'enemy',
  desc: () => `An enemy skips its next action; its intent carries over unchanged. Consume.`,
  upgrade: (c) => { c.cost = 1; },
  onPlay: (ctx) => { if (ctx.enemy && ctx.enemy.alive) ctx.enemy._skipNext = true; },
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
    consume: !!bp.consume,
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

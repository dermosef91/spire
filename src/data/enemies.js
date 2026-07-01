// Enemies of the Spire. Each blueprint defines HP range, a move table,
// and an AI (pick) that returns the id of the next move. Moves declare `intent`
// metadata for the UI and a `run(combat, self)` that resolves on the enemy turn.
//
// Combat API used here:
//   combat.enemyAttack(self, dmg, hits)   — strength/weak/vuln applied, hits player
//   combat.gainBlockTo(self, n)           — enemy gains Block
//   combat.applyPower(target, key, n, src)
//   combat.addCardToPile(card, pile)      — e.g. statuses into player piles
//   combat.player
//
// DESIGN — every enemy is built around a distinct "combat puzzle" so no two
// encounters feel alike. Archetypes in play:
//   • Ramper / glass cannon — low HP, grows Resolve each turn → burst it down.
//   • Swarm — many small hits → punished by Block, rewards Backlash.
//   • Retaliator / turtle — Block + Backlash → wants big single hits, not flurries.
//   • Debuffer — stacks Sapped/Brittle/Exposed → pressures your defense.
//   • Poisoner — stacks Blight → a race against the clock.
//   • Charger — telegraphs a huge nuke every few turns → block-timing puzzle.
//   • Support / healer — heals & buffs allies → kill-priority puzzle in groups.
//   • Curse-flooder — jams your deck with Dazed/Wounds → deck disruption.
//   • Life-drain — heals itself as it hits → out-pace its sustain.
//   • Warded — Charm resists your debuffs → forces raw damage.
//   • Berserker — escalating Resolve, no defense → a damage clock.
//   • Phaser — periodic Phase (intangible) → don't waste your burst.

export const ENEMIES = {};
function def(id, bp) { ENEMIES[id] = { id, ...bp }; }

// Helper: a move that just attacks.
const atk = (name, dmg, hits = 1) => ({
  name, intent: { type: 'attack', dmg, hits },
  run: (c, s) => c.enemyAttack(s, dmg, hits),
});

// Helper: heal an enemy and flash the heal FX.
const eHeal = (c, e, n) => {
  if (!e || !e.alive || n <= 0) return;
  e.hp = Math.min(e.maxHp, e.hp + n);
  c.fx('heal', { entity: e, amount: n });
  c.notify();
};
// The most-wounded living ally (by HP fraction). Used by supports/healers.
const weakestAlly = (c) => {
  const allies = c.enemies.filter((e) => e.alive);
  if (!allies.length) return null;
  return allies.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
};
// A random living ally other than `self`, or `self` when it stands alone.
const otherAlly = (c, self) => {
  const others = c.enemies.filter((e) => e.alive && e !== self);
  return others.length ? c.rng.pick(others) : self;
};

// ===================== ACT 1 — The Sunken Market =====================

// Basic attacker — light pressure, an occasional self-buff. The tutorial foe.
def('husk_drone', {
  name: 'Husk Drone', act: 1, hpMin: 10, hpMax: 14,
  moves: {
    zap: atk('Zap', 6),
    buzz: { name: 'Overcharge', intent: { type: 'buffblock', block: 4 }, run: (c, s) => { c.applyPower(s, 'strength', 2, s); c.gainBlockTo(s, 4); } },
  },
  pick: (s, c, rng) => (s.history.filter((m) => m === 'buzz').length === 0 && s.turn === 1 ? 'zap' : (s.turn % 3 === 0 ? 'buzz' : 'zap')),
});

// Swarm / debuffer — quick flurries and Sapped. Block eats its little bites.
def('static_jackal', {
  name: 'Static Jackal', act: 1, hpMin: 13, hpMax: 17,
  moves: {
    bite: atk('Snap', 8),
    howl: { name: 'Howl', intent: { type: 'debuffblock', block: 5 }, run: (c, s) => { c.applyPower(c.player, 'weak', 1, s); c.gainBlockTo(s, 5); } },
    lunge: atk('Lunge', 5, 2),
  },
  pick: (s, c, rng) => rng.pick(['bite', 'lunge', 'howl']),
});

// Retaliator / turtle — parks Block and Backlash, then a heavy Slam. Flurries
// hurt you back; answer it with one big hit or by holding your attacks.
def('brass_sentinel', {
  name: 'Brass Sentinel', act: 1, hpMin: 22, hpMax: 27, startBlock: 6,
  moves: {
    slam: atk('Piston Slam', 10),
    barricade: { name: 'Barricade', intent: { type: 'buffblock', block: 8 }, run: (c, s) => { c.gainBlockTo(s, 8); c.applyPower(s, 'thorns', 3, s); } },
    rivet: { name: 'Rivet', intent: { type: 'attackdebuff', dmg: 6 }, run: (c, s) => { c.enemyAttack(s, 6); c.addCardToPile(c.makeCard('dazed'), 'discard'); } },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'barricade';
    if (s.last === 'barricade') return 'slam';
    return s.turn % 3 === 0 ? 'barricade' : rng.pick(['slam', 'rivet']);
  },
});

// Gold thief — chips your purse and flees. Kill it fast or eat the loss.
def('market_thief', {
  name: 'Market Thief', act: 1, hpMin: 16, hpMax: 20,
  moves: {
    swipe: { name: 'Swipe', intent: { type: 'attack', dmg: 7 }, run: (c, s) => { c.enemyAttack(s, 7); if (!s.fled) c.run.gold = Math.max(0, c.run.gold - 8); } },
    flee: { name: 'Flee', intent: { type: 'unknown' }, run: (c, s) => { s.alive = false; s.fled = true; } },
  },
  pick: (s, c, rng) => (s.turn >= 4 ? 'flee' : 'swipe'),
});

// Poisoner — light attacks but stacks Blight fast. A race: end it before the
// poison snowballs, or bring healing.
def('reef_spitter', {
  name: 'Reef Spitter', act: 1, hpMin: 14, hpMax: 18,
  moves: {
    spit: { name: 'Brine Spit', intent: { type: 'attackdebuff', dmg: 4 }, run: (c, s) => { c.enemyAttack(s, 4); c.applyPower(c.player, 'poison', 3, s); } },
    cloud: { name: 'Blight Cloud', intent: { type: 'debuff' }, run: (c, s) => c.applyPower(c.player, 'poison', 4, s) },
    snap: atk('Shell Snap', 7),
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'spit';
    return s.turn % 3 === 0 ? 'snap' : rng.pick(['spit', 'cloud']);
  },
});

// Support / healer — barely attacks, but mends the most-wounded ally and lends
// it Resolve. In a group it is the priority target; alone it is harmless.
def('tide_priest', {
  name: 'Tide Priest', act: 1, hpMin: 15, hpMax: 19,
  moves: {
    mend: { name: 'Tidal Mending', intent: { type: 'buff' }, run: (c, s) => { eHeal(c, weakestAlly(c) || s, 8); } },
    anoint: { name: 'Anoint', intent: { type: 'buff' }, run: (c, s) => c.applyPower(otherAlly(c, s), 'strength', 2, s) },
    splash: atk('Splash', 5),
  },
  pick: (s, c, rng) => {
    const hurt = c.enemies.some((e) => e.alive && e !== s && e.hp < e.maxHp * 0.6);
    if (hurt) return 'mend';
    return s.turn % 2 === 0 ? 'anoint' : 'splash';
  },
});

// Glass cannon / ramper — tiny HP, grows Resolve every turn and swings for more
// each round. Ignore it and it snowballs; burst it down turn one or two.
def('spark_imp', {
  name: 'Spark Imp', act: 1, hpMin: 8, hpMax: 11,
  moves: {
    kindle: { name: 'Kindle', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 3, s) },
    jolt: atk('Jolt', 5),
  },
  pick: (s, c, rng) => (s.turn === 1 ? 'kindle' : 'jolt'),
});

// Act 1 elite — Warden: enrages, hardening and hitting harder as the fight drags.
def('gilded_warden', {
  name: 'Gilded Warden', act: 1, elite: true, hpMin: 58, hpMax: 64,
  moves: {
    cleave: atk('Wide Cleave', 14),
    barrage: atk('Brass Barrage', 5, 3),
    fortify: { name: 'Fortify', intent: { type: 'buffblock', block: 12 }, run: (c, s) => { c.gainBlockTo(s, 12); c.applyPower(s, 'strength', 2, s); } },
    wrath: { name: 'Gild Wrath', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 4, s) },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'cleave';
    if (s.hp < s.maxHp * 0.4 && s.last !== 'wrath') return 'wrath';
    if (s.last === 'cleave') return 'fortify';
    if (s.last === 'fortify' || s.last === 'wrath') return 'barrage';
    return 'cleave';
  },
});

// Act 1 elite — Rust Maw: a charger. Winds up (Backlash while it coils), then
// unleashes a huge bite. Watch the tell and stack Block for the crush turn.
def('rust_maw', {
  name: 'Rust Maw', act: 1, elite: true, hpMin: 62, hpMax: 68,
  moves: {
    gnash: atk('Gnash', 8, 2),
    coil: { name: 'Coil', intent: { type: 'buffblock', block: 10 }, run: (c, s) => { c.gainBlockTo(s, 10); c.applyPower(s, 'thorns', 4, s); c.applyPower(s, 'strength', 3, s); } },
    crush: { name: 'Rusted Crush', intent: { type: 'attack', dmg: 24 }, run: (c, s) => c.enemyAttack(s, 24) },
  },
  pick: (s, c, rng) => {
    const cyc = ['gnash', 'coil', 'crush'];
    return cyc[(s.turn - 1) % cyc.length];
  },
});

// Act 1 boss
def('the_gatekeeper', {
  name: 'The Gatekeeper', act: 1, boss: true, hpMin: 250, hpMax: 250,
  moves: {
    judge: atk('Judgement', 16),
    barrage: atk('Sevenfold Strike', 4, 4),
    seal: { name: 'Seal the Gate', intent: { type: 'debuffblock', block: 18 }, run: (c, s) => { c.gainBlockTo(s, 18); c.applyPower(c.player, 'frail', 2, s); } },
    decree: { name: 'Decree', intent: { type: 'debuff' }, run: (c, s) => { c.applyPower(c.player, 'weak', 2, s); c.applyPower(c.player, 'vulnerable', 2, s); } },
  },
  pick: (s, c, rng) => {
    const cycle = ['judge', 'seal', 'barrage', 'decree'];
    return cycle[(s.turn - 1) % cycle.length];
  },
});

// ===================== ACT 2 — The Brass Archive =====================

// Debuffer with bite — Rend hits hard, Soul Drain leeches back a little life
// and stacks Brittle so your Block underperforms.
def('sand_wraith', {
  name: 'Sand Wraith', act: 2, hpMin: 28, hpMax: 34,
  moves: {
    rend: atk('Rend', 11),
    drain: { name: 'Soul Drain', intent: { type: 'attackdebuff', dmg: 8 }, run: (c, s) => { c.enemyAttack(s, 8); c.applyPower(c.player, 'frail', 2, s); eHeal(c, s, 4); } },
  },
  pick: (s, c, rng) => rng.pick(['rend', 'drain']),
});

// Retaliator — Reflect stacks heavy Backlash. Multi-hit decks shred themselves
// on it; single big blows are the answer.
def('mirror_shade', {
  name: 'Mirror Shade', act: 2, hpMin: 30, hpMax: 36,
  moves: {
    shard: atk('Shard Volley', 6, 2),
    reflect: { name: 'Reflect', intent: { type: 'buffblock', block: 14 }, run: (c, s) => { c.gainBlockTo(s, 14); c.applyPower(s, 'thorns', 4, s); } },
    glare: { name: 'Glare', intent: { type: 'debuff' }, run: (c, s) => c.applyPower(c.player, 'vulnerable', 2, s) },
  },
  pick: (s, c, rng) => (s.turn % 3 === 0 ? 'reflect' : rng.pick(['shard', 'glare'])),
});

// Poisoner / control — Constrict saps you and shields; Venom stacks Blight.
def('chrome_serpent', {
  name: 'Chrome Serpent', act: 2, hpMin: 40, hpMax: 46,
  moves: {
    constrict: { name: 'Constrict', intent: { type: 'debuffblock', block: 8 }, run: (c, s) => { c.applyPower(c.player, 'weak', 2, s); c.gainBlockTo(s, 8); } },
    crush: atk('Crush', 16),
    venom: { name: 'Venom Spit', intent: { type: 'attackdebuff', dmg: 6 }, run: (c, s) => { c.enemyAttack(s, 6); c.applyPower(c.player, 'poison', 5, s); } },
  },
  pick: (s, c, rng) => (s.turn === 1 ? 'constrict' : rng.pick(['crush', 'venom'])),
});

// Life-drain — every bite heals it. If you can't out-damage its sustain it will
// grind you down. Poison and burst spike through the healing.
def('ink_leech', {
  name: 'Ink Leech', act: 2, hpMin: 26, hpMax: 32,
  moves: {
    latch: { name: 'Latch', intent: { type: 'attack', dmg: 9 }, run: (c, s) => { c.enemyAttack(s, 9); eHeal(c, s, 6); } },
    siphon: { name: 'Siphon', intent: { type: 'attackdebuff', dmg: 5 }, run: (c, s) => { c.enemyAttack(s, 5); c.applyPower(c.player, 'weak', 1, s); eHeal(c, s, 4); } },
    gorge: { name: 'Gorge', intent: { type: 'buff' }, run: (c, s) => eHeal(c, s, 10) },
  },
  pick: (s, c, rng) => {
    if (s.hp < s.maxHp * 0.35) return 'gorge';
    return rng.pick(['latch', 'siphon']);
  },
});

// Curse-flooder / warded — jams Dazed and Wounds into your deck, wraps itself in
// Charm so your debuffs slide off. A deck-disruption puzzle: it wants a long
// fight, so end it quickly or rely on Exhaust.
def('null_scribe', {
  name: 'Null Scribe', act: 2, hpMin: 30, hpMax: 36,
  moves: {
    redact: { name: 'Redact', intent: { type: 'debuff' }, run: (c, s) => { c.addCardToPile(c.makeCard('dazed'), 'draw'); c.addCardToPile(c.makeCard('dazed'), 'draw'); } },
    scrawl: { name: 'Scrawl Wound', intent: { type: 'attackdebuff', dmg: 6 }, run: (c, s) => { c.enemyAttack(s, 6); c.addCardToPile(c.makeCard('wound'), 'discard'); } },
    ward: { name: 'Ward', intent: { type: 'buffblock', block: 8 }, run: (c, s) => { c.gainBlockTo(s, 8); c.applyPower(s, 'artifact', 2, s); } },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'ward';
    const cyc = ['redact', 'scrawl', 'ward', 'scrawl'];
    return cyc[(s.turn - 2) % cyc.length];
  },
});

// Charger — small pokes while it charges (Backlash + Resolve), then a devastating
// Lance. The intent telegraphs the crush turn; time your Block.
def('glyph_sentry', {
  name: 'Glyph Sentry', act: 2, hpMin: 34, hpMax: 40, startBlock: 8,
  moves: {
    spark: atk('Rune Spark', 7),
    charge: { name: 'Charge Glyph', intent: { type: 'buffblock', block: 12 }, run: (c, s) => { c.gainBlockTo(s, 12); c.applyPower(s, 'strength', 4, s); } },
    lance: { name: 'Prism Lance', intent: { type: 'attack', dmg: 22 }, run: (c, s) => c.enemyAttack(s, 22) },
  },
  pick: (s, c, rng) => {
    const cyc = ['spark', 'charge', 'lance'];
    return cyc[(s.turn - 1) % cyc.length];
  },
});

// Act 2 elite — Colossus: alternates a huge Quake, a twin punch, and re-plating
// with Backlash. A stat-check on both offense and your ability to break Block.
def('brass_colossus', {
  name: 'Brass Colossus', act: 2, elite: true, hpMin: 120, hpMax: 130, startBlock: 15,
  moves: {
    quake: atk('Quake', 22),
    twin: atk('Piston Punch', 9, 2),
    plate: { name: 'Replate', intent: { type: 'buffblock', block: 20 }, run: (c, s) => { c.gainBlockTo(s, 20); c.applyPower(s, 'thorns', 6, s); } },
    overload: { name: 'Overload', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 4, s) },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'plate';
    const cyc = ['twin', 'overload', 'quake'];
    return cyc[(s.turn - 2) % cyc.length];
  },
});

// Act 2 elite — Obsidian Maw: a berserker. No defense, only escalation — it
// gains Resolve every turn and hits harder each round. A pure damage clock.
def('obsidian_maw', {
  name: 'Obsidian Maw', act: 2, elite: true, hpMin: 108, hpMax: 116,
  moves: {
    rend: atk('Obsidian Rend', 13),
    devour: { name: 'Devour', intent: { type: 'attack', dmg: 10, hits: 2 }, run: (c, s) => c.enemyAttack(s, 10, 2) },
    hunger: { name: 'Growing Hunger', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 3, s) },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'hunger';
    // Escalates: every third turn it feeds its hunger again.
    if (s.turn % 3 === 0) return 'hunger';
    return s.turn % 2 === 0 ? 'devour' : 'rend';
  },
});

// Act 2 boss
def('the_archivist', {
  name: 'The Archivist', act: 2, boss: true, hpMin: 320, hpMax: 320,
  moves: {
    erase: atk('Erase', 20),
    catalog: { name: 'Catalog', intent: { type: 'attackdebuff', dmg: 10 }, run: (c, s) => { c.enemyAttack(s, 10); c.addCardToPile(c.makeCard('dazed'), 'draw'); c.addCardToPile(c.makeCard('dazed'), 'draw'); } },
    censor: { name: 'Censor', intent: { type: 'debuffblock', block: 25 }, run: (c, s) => { c.gainBlockTo(s, 25); c.applyPower(c.player, 'weak', 2, s); } },
    purge: { name: 'Purge', intent: { type: 'attack', dmg: 7, hits: 3 }, run: (c, s) => c.enemyAttack(s, 7, 3) },
  },
  pick: (s, c, rng) => {
    const cyc = ['catalog', 'erase', 'censor', 'purge'];
    return cyc[(s.turn - 1) % cyc.length];
  },
});

// ===================== ACT 3 — The Static Crown =====================

// Debuffer — every other turn it hexes you with Exposed + Sapped, then wails.
def('void_chanter', {
  name: 'Void Chanter', act: 3, hpMin: 42, hpMax: 48,
  moves: {
    wail: atk('Wail', 13),
    hex: { name: 'Hex', intent: { type: 'debuff' }, run: (c, s) => { c.applyPower(c.player, 'vulnerable', 2, s); c.applyPower(c.player, 'weak', 2, s); } },
  },
  pick: (s, c, rng) => (s.turn % 2 === 0 ? 'hex' : 'wail'),
});

// Charger — beams and blesses itself, then a colossal Smite. High burst you must
// block for, wrapped in self-buffs.
def('static_seraph', {
  name: 'Static Seraph', act: 3, hpMin: 50, hpMax: 58,
  moves: {
    beam: atk('Beam', 10, 2),
    bless: { name: 'False Blessing', intent: { type: 'buffblock', block: 16 }, run: (c, s) => { c.gainBlockTo(s, 16); c.applyPower(s, 'strength', 3, s); } },
    smite: atk('Smite', 25),
  },
  pick: (s, c, rng) => (s.turn % 3 === 0 ? 'smite' : rng.pick(['beam', 'bless'])),
});

// Phaser — periodically slips into Phase, shrugging off a whole turn of damage.
// Don't dump your burst into a phased turn; chip it or wait it out.
def('echo_wraith', {
  name: 'Echo Wraith', act: 3, hpMin: 44, hpMax: 50,
  moves: {
    flurry: atk('Echo Flurry', 5, 3),
    rake: atk('Rake', 14),
    phase: { name: 'Phase Shift', intent: { type: 'buff' }, run: (c, s) => { c.applyPower(s, 'intangible', 2, s); c.applyPower(c.player, 'weak', 1, s); } },
  },
  pick: (s, c, rng) => {
    if (s.turn % 3 === 0) return 'phase';
    return rng.pick(['flurry', 'rake']);
  },
});

// Support / healer — mends allies and lends them Resolve while chipping at you.
// The lynchpin of Act 3 packs: cut it down before it snowballs the group.
def('hollow_cantor', {
  name: 'Hollow Cantor', act: 3, hpMin: 46, hpMax: 52,
  moves: {
    dirge: { name: 'Dirge', intent: { type: 'buff' }, run: (c, s) => { eHeal(c, weakestAlly(c) || s, 12); c.applyPower(otherAlly(c, s), 'strength', 2, s); } },
    hymn: { name: 'Warding Hymn', intent: { type: 'buffblock', block: 12 }, run: (c, s) => { c.gainBlockTo(otherAlly(c, s), 10); c.applyPower(s, 'artifact', 1, s); } },
    lash: atk('Candle Lash', 11),
  },
  pick: (s, c, rng) => {
    const hurt = c.enemies.some((e) => e.alive && e !== s && e.hp < e.maxHp * 0.55);
    if (hurt) return 'dirge';
    return s.turn % 2 === 0 ? 'hymn' : 'lash';
  },
});

// Berserker — no defense, pure escalation. Feeds its Resolve and swings ever
// harder. A brutal damage race: kill it or be flattened.
def('ember_colossus', {
  name: 'Ember Colossus', act: 3, hpMin: 56, hpMax: 64,
  moves: {
    stomp: atk('Magma Stomp', 16),
    sunder: { name: 'Sunder', intent: { type: 'attackdebuff', dmg: 12 }, run: (c, s) => { c.enemyAttack(s, 12); c.applyPower(c.player, 'frail', 2, s); } },
    seethe: { name: 'Seethe', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 4, s) },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'seethe';
    if (s.turn % 3 === 0) return 'seethe';
    return s.turn % 2 === 0 ? 'sunder' : 'stomp';
  },
});

// Swarm / curse-flooder — flurries of tiny hits and Static curses that bleed you
// while they clog your hand. Block blunts the flurry; Exhaust clears the curses.
def('static_swarm', {
  name: 'Static Swarm', act: 3, hpMin: 40, hpMax: 46,
  moves: {
    scatter: atk('Scatterstatic', 3, 5),
    surge: atk('Surge', 12),
    corrupt: { name: 'Corrupt', intent: { type: 'debuff' }, run: (c, s) => { c.addCardToPile(c.makeCard('static_curse'), 'discard'); c.applyPower(c.player, 'weak', 1, s); } },
  },
  pick: (s, c, rng) => {
    if (s.turn % 3 === 0) return 'corrupt';
    return rng.pick(['scatter', 'surge']);
  },
});

// Act 3 elite
def('chrome_archon', {
  name: 'Chrome Archon', act: 3, elite: true, hpMin: 160, hpMax: 170, startBlock: 20,
  moves: {
    annihilate: atk('Annihilate', 30),
    swarm: atk('Nanoswarm', 6, 4),
    reweave: { name: 'Reweave', intent: { type: 'buffblock', block: 24 }, run: (c, s) => { c.gainBlockTo(s, 24); c.applyPower(s, 'strength', 3, s); c.applyPower(s, 'thorns', 6, s); } },
  },
  pick: (s, c, rng) => {
    const cyc = ['swarm', 'reweave', 'annihilate'];
    return cyc[(s.turn - 1) % cyc.length];
  },
});

// Act 3 final boss
def('heart_of_static', {
  name: 'Heart of Static', act: 3, boss: true, finalBoss: true, hpMin: 800, hpMax: 800,
  moves: {
    blast: atk('Reality Blast', 42),
    multibeam: atk('Cascade', 5, 6),
    static_field: { name: 'Static Field', intent: { type: 'debuffblock', block: 20 }, run: (c, s) => { for (let i = 0; i < 3; i++) c.addCardToPile(c.makeCard('dazed'), 'draw'); c.applyPower(c.player, 'weak', 1, s); c.gainBlockTo(s, 20); } },
    rebuild: { name: 'Rebuild', intent: { type: 'buffblock', block: 30 }, run: (c, s) => { c.gainBlockTo(s, 30); c.applyPower(s, 'strength', 4, s); } },
  },
  buff: { name: 'Invincibility', desc: 'Caps the damage taken in a single turn.' },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'static_field';
    const cyc = ['blast', 'multibeam', 'rebuild', 'static_field', 'multibeam', 'blast'];
    return cyc[(s.turn - 2) % cyc.length];
  },
});

export function enemyById(id) { return ENEMIES[id]; }

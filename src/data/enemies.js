// Enemies of the Spire. Each blueprint defines HP range, a glyph, a move table,
// and an AI (pick) that returns the id of the next move. Moves declare `intent`
// metadata for the UI and a `run(combat, self)` that resolves on the enemy turn.
//
// Combat API used here:
//   combat.enemyAttack(self, dmg, hits)   — strength/weak/vuln applied, hits player
//   combat.gainBlockTo(self, n)           — enemy gains Block
//   combat.applyPower(target, key, n, src)
//   combat.addCardToPile(card, pile)      — e.g. statuses into player piles
//   combat.player

export const ENEMIES = {};
function def(id, bp) { ENEMIES[id] = { id, ...bp }; }

// Helper: a move that just attacks.
const atk = (name, dmg, hits = 1) => ({
  name, intent: { type: 'attack', dmg, hits },
  run: (c, s) => c.enemyAttack(s, dmg, hits),
});

// ===================== ACT 1 — The Sunken Market =====================
def('husk_drone', {
  name: 'Husk Drone', glyph: '🛸', act: 1, hpMin: 10, hpMax: 14,
  moves: {
    zap: atk('Zap', 6),
    buzz: { name: 'Overcharge', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 2, s) },
  },
  pick: (s, c, rng) => (s.history.filter((m) => m === 'buzz').length === 0 && s.turn === 1 ? 'zap' : (s.turn % 3 === 0 ? 'buzz' : 'zap')),
});
def('static_jackal', {
  name: 'Static Jackal', glyph: '🐺', act: 1, hpMin: 13, hpMax: 17,
  moves: {
    bite: atk('Snap', 8),
    howl: { name: 'Howl', intent: { type: 'debuff' }, run: (c, s) => c.applyPower(c.player, 'weak', 1, s) },
    lunge: atk('Lunge', 5, 2),
  },
  pick: (s, c, rng) => rng.pick(['bite', 'lunge', 'howl']),
});
def('brass_sentinel', {
  name: 'Brass Sentinel', glyph: '🗿', act: 1, hpMin: 20, hpMax: 25,
  moves: {
    slam: atk('Slam', 9),
    guard: { name: 'Lock Down', intent: { type: 'block', block: 8 }, run: (c, s) => c.gainBlockTo(s, 8) },
    rivet: { name: 'Rivet', intent: { type: 'attackdebuff', dmg: 6 }, run: (c, s) => { c.enemyAttack(s, 6); c.addCardToPile(c.makeCard('dazed'), 'discard'); } },
  },
  pick: (s, c, rng) => (s.turn % 3 === 0 ? 'guard' : rng.pick(['slam', 'rivet'])),
});
def('market_thief', {
  name: 'Market Thief', glyph: '🦝', act: 1, hpMin: 16, hpMax: 20,
  moves: {
    swipe: { name: 'Swipe', intent: { type: 'attack', dmg: 7 }, run: (c, s) => { c.enemyAttack(s, 7); if (!s.fled) c.run.gold = Math.max(0, c.run.gold - 8); } },
    flee: { name: 'Flee', intent: { type: 'unknown' }, run: (c, s) => { s.alive = false; s.fled = true; } },
  },
  pick: (s, c, rng) => (s.turn >= 4 ? 'flee' : 'swipe'),
});

// Act 1 elites
def('gilded_warden', {
  name: 'Gilded Warden', glyph: '👹', act: 1, elite: true, hpMin: 58, hpMax: 64,
  moves: {
    cleave: atk('Wide Cleave', 14),
    barrage: atk('Brass Barrage', 5, 3),
    fortify: { name: 'Fortify', intent: { type: 'buffblock', block: 12 }, run: (c, s) => { c.gainBlockTo(s, 12); c.applyPower(s, 'strength', 2, s); } },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'cleave';
    if (s.last === 'cleave') return 'fortify';
    if (s.last === 'fortify') return 'barrage';
    return 'cleave';
  },
});

// Act 1 boss
def('the_gatekeeper', {
  name: 'The Gatekeeper', glyph: '⛩️', act: 1, boss: true, hpMin: 250, hpMax: 250,
  moves: {
    judge: atk('Judgement', 16),
    barrage: atk('Sevenfold Strike', 4, 4),
    seal: { name: 'Seal the Gate', intent: { type: 'buffblock', block: 18 }, run: (c, s) => { c.gainBlockTo(s, 18); c.applyPower(c.player, 'frail', 2, s); } },
    decree: { name: 'Decree', intent: { type: 'debuff' }, run: (c, s) => { c.applyPower(c.player, 'weak', 2, s); c.applyPower(c.player, 'vulnerable', 2, s); } },
  },
  pick: (s, c, rng) => {
    const cycle = ['judge', 'seal', 'barrage', 'decree'];
    return cycle[(s.turn - 1) % cycle.length];
  },
});

// ===================== ACT 2 — The Brass Archive =====================
def('sand_wraith', {
  name: 'Sand Wraith', glyph: '👁️', act: 2, hpMin: 28, hpMax: 34,
  moves: {
    rend: atk('Rend', 11),
    drain: { name: 'Soul Drain', intent: { type: 'attackdebuff', dmg: 8 }, run: (c, s) => { c.enemyAttack(s, 8); c.applyPower(c.player, 'frail', 2, s); } },
  },
  pick: (s, c, rng) => rng.pick(['rend', 'drain']),
});
def('mirror_shade', {
  name: 'Mirror Shade', glyph: '🪞', act: 2, hpMin: 30, hpMax: 36,
  moves: {
    shard: atk('Shard Volley', 6, 2),
    reflect: { name: 'Reflect', intent: { type: 'buffblock', block: 14 }, run: (c, s) => { c.gainBlockTo(s, 14); c.applyPower(s, 'thorns', 3, s); } },
    glare: { name: 'Glare', intent: { type: 'debuff' }, run: (c, s) => c.applyPower(c.player, 'vulnerable', 2, s) },
  },
  pick: (s, c, rng) => (s.turn % 3 === 0 ? 'reflect' : rng.pick(['shard', 'glare'])),
});
def('chrome_serpent', {
  name: 'Chrome Serpent', glyph: '🐍', act: 2, hpMin: 40, hpMax: 46,
  moves: {
    constrict: { name: 'Constrict', intent: { type: 'debuff' }, run: (c, s) => c.applyPower(c.player, 'weak', 2, s) },
    crush: atk('Crush', 16),
    venom: { name: 'Venom Spit', intent: { type: 'attackdebuff', dmg: 6 }, run: (c, s) => { c.enemyAttack(s, 6); c.applyPower(c.player, 'poison', 4, s); } },
  },
  pick: (s, c, rng) => (s.turn === 1 ? 'constrict' : rng.pick(['crush', 'venom'])),
});

// Act 2 elite
def('brass_colossus', {
  name: 'Brass Colossus', glyph: '🤖', act: 2, elite: true, hpMin: 120, hpMax: 130,
  moves: {
    quake: atk('Quake', 22),
    twin: atk('Piston Punch', 9, 2),
    plate: { name: 'Replate', intent: { type: 'buffblock', block: 20 }, run: (c, s) => { c.gainBlockTo(s, 20); c.applyPower(s, 'metallicize', 4, s); } },
    overload: { name: 'Overload', intent: { type: 'buff' }, run: (c, s) => c.applyPower(s, 'strength', 4, s) },
  },
  pick: (s, c, rng) => {
    if (s.turn === 1) return 'plate';
    const cyc = ['twin', 'overload', 'quake'];
    return cyc[(s.turn - 2) % cyc.length];
  },
});

// Act 2 boss
def('the_archivist', {
  name: 'The Archivist', glyph: '📚', act: 2, boss: true, hpMin: 320, hpMax: 320,
  moves: {
    erase: atk('Erase', 20),
    catalog: { name: 'Catalog', intent: { type: 'attackdebuff', dmg: 10 }, run: (c, s) => { c.enemyAttack(s, 10); c.addCardToPile(c.makeCard('dazed'), 'draw'); c.addCardToPile(c.makeCard('dazed'), 'draw'); } },
    censor: { name: 'Censor', intent: { type: 'buffblock', block: 25 }, run: (c, s) => { c.gainBlockTo(s, 25); c.applyPower(c.player, 'weak', 2, s); } },
    purge: { name: 'Purge', intent: { type: 'attack', dmg: 7, hits: 3 }, run: (c, s) => c.enemyAttack(s, 7, 3) },
  },
  pick: (s, c, rng) => {
    const cyc = ['catalog', 'erase', 'censor', 'purge'];
    return cyc[(s.turn - 1) % cyc.length];
  },
});

// ===================== ACT 3 — The Static Crown =====================
def('void_chanter', {
  name: 'Void Chanter', glyph: '🌑', act: 3, hpMin: 42, hpMax: 48,
  moves: {
    wail: atk('Wail', 13),
    hex: { name: 'Hex', intent: { type: 'debuff' }, run: (c, s) => { c.applyPower(c.player, 'vulnerable', 2, s); c.applyPower(c.player, 'weak', 2, s); } },
  },
  pick: (s, c, rng) => (s.turn % 2 === 0 ? 'hex' : 'wail'),
});
def('static_seraph', {
  name: 'Static Seraph', glyph: '😇', act: 3, hpMin: 50, hpMax: 58,
  moves: {
    beam: atk('Beam', 10, 2),
    bless: { name: 'False Blessing', intent: { type: 'buffblock', block: 16 }, run: (c, s) => { c.gainBlockTo(s, 16); c.applyPower(s, 'strength', 3, s); } },
    smite: atk('Smite', 25),
  },
  pick: (s, c, rng) => (s.turn % 3 === 0 ? 'smite' : rng.pick(['beam', 'bless'])),
});

// Act 3 elite
def('chrome_archon', {
  name: 'Chrome Archon', glyph: '👾', act: 3, elite: true, hpMin: 160, hpMax: 170,
  moves: {
    annihilate: atk('Annihilate', 30),
    swarm: atk('Nanoswarm', 6, 4),
    reweave: { name: 'Reweave', intent: { type: 'buffblock', block: 24 }, run: (c, s) => { c.gainBlockTo(s, 24); c.applyPower(s, 'strength', 3, s); c.applyPower(s, 'metallicize', 5, s); } },
  },
  pick: (s, c, rng) => {
    const cyc = ['swarm', 'reweave', 'annihilate'];
    return cyc[(s.turn - 1) % cyc.length];
  },
});

// Act 3 final boss
def('heart_of_static', {
  name: 'Heart of Static', glyph: '💠', act: 3, boss: true, finalBoss: true, hpMin: 800, hpMax: 800,
  moves: {
    blast: atk('Reality Blast', 42),
    multibeam: atk('Cascade', 5, 6),
    static_field: { name: 'Static Field', intent: { type: 'debuff' }, run: (c, s) => { for (let i = 0; i < 3; i++) c.addCardToPile(c.makeCard('dazed'), 'draw'); c.applyPower(c.player, 'weak', 1, s); } },
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

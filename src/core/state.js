// RunState — the persistent state of a single climb: champion, HP, gold, deck,
// relics, potions, the map and where we are on it. Serializable for save/load.

import { RNG, randomSeed } from './rng.js';
import { CHARACTERS } from '../data/characters.js';
import { RELICS } from '../data/relics.js';
import { createCard, upgradeCard, canUpgrade } from '../data/cards.js';
import { generateMap } from '../map/mapgen.js';

// Ascension ladder — each level ADDS its modifier on top of every lower level,
// so the climb grows steadily crueler. Unlocked one at a time by winning at the
// current highest level. Level 0 is the baseline (no modifiers).
export const ASCENSION_LEVELS = [
  { lvl: 1, name: 'Bloodied Elites', desc: 'Elite enemies have 25% more HP.' },
  { lvl: 2, name: 'Swollen Ranks', desc: 'All enemies have 12% more HP.' },
  { lvl: 3, name: 'Lean Purse', desc: 'Begin each run with 25% less gold.' },
  { lvl: 4, name: 'Shallow Rest', desc: 'Ancestor Fires heal 20% of Max HP (was 30%).' },
  { lvl: 5, name: 'Lingering Static', desc: 'Begin each run with a Wound curse in your deck.' },
  { lvl: 6, name: 'Cruel Crowns', desc: 'Bosses have 25% more HP.' },
  { lvl: 7, name: 'Frayed Vessel', desc: 'Begin each run at 90% HP.' },
  { lvl: 8, name: 'Relentless Spire', desc: 'Elites and normal enemies gain a further 10% HP.' },
  { lvl: 9, name: 'Sharpened Static', desc: 'All enemies deal 10% more damage.' },
  { lvl: 10, name: 'Hoarded Reserves', desc: 'Carry one fewer potion (2 slots).' },
  { lvl: 11, name: 'Crowned in Wrath', desc: 'Bosses begin combat with 2 Resolve.' },
  { lvl: 12, name: 'The Spire Bites', desc: 'Enemies deal a further 10% more damage.' },
];
export const MAX_ASCENSION = ASCENSION_LEVELS.length;

export class RunState {
  constructor(charId, seed = randomSeed(), ascension = 0) {
    const ch = CHARACTERS[charId];
    this.seed = seed;
    this.rng = new RNG(seed);
    this.characterId = charId;
    this.character = ch;
    this.ascension = Math.max(0, Math.min(MAX_ASCENSION, ascension | 0));
    this.maxHp = ch.maxHp;
    this.hp = ch.maxHp;
    this.gold = ch.startGold;
    if (this.ascension >= 3) this.gold = Math.floor(this.gold * 0.75); // A3 Lean Purse
    this.act = 1;
    this.maxPotions = (this.ascension >= 10) ? 2 : 3; // A10 Hoarded Reserves
    this.potions = [];
    this.relics = [];
    this.deck = ch.deck.map((id) => ({ id, upgraded: false }));
    if (this.ascension >= 5) this.deck.push({ id: 'wound', upgraded: false }); // A5 Lingering Static
    if (this.ascension >= 7) this.hp = Math.floor(this.maxHp * 0.9); // A7 Frayed Vessel
    this.encountersCleared = 0;
    this.eliteCleared = 0;
    this.bossesDefeated = 0;
    this.usedEvents = [];

    // starter relic
    this.addRelic(ch.relic, true);

    // map
    this.map = generateMap(this.rng, this.act);
    this.position = null; // {row, col}
    this.lastResult = null;
  }

  // -------- relics --------
  addRelic(id, silent = false) {
    if (this.relics.includes(id)) return null;
    this.relics.push(id);
    const r = RELICS[id];
    if (r && r.onAcquire) r.onAcquire(this);
    if (r && r.onRunStart) r.onRunStart(this);
    return r ? r.name : null;
  }
  hasRelic(id) { return this.relics.includes(id); }
  energyBonus() { return this.relics.reduce((s, id) => s + (RELICS[id]?.energyBonus || 0), 0); }
  restHealBonus() { return this.relics.reduce((s, id) => s + (RELICS[id]?.restBonus || 0), 0); }
  canRestHeal() { return !this.relics.some((id) => RELICS[id]?.blockRestHeal); }

  grantRandomRelic() {
    const pool = Object.values(RELICS).filter(
      (r) => !this.relics.includes(r.id) && r.rarity !== 'starter' && r.rarity !== 'boss'
    );
    if (!pool.length) return null;
    const r = this.rng.pick(pool);
    this.addRelic(r.id);
    return r.name;
  }

  // -------- ascension modifiers --------
  // HP multiplier applied to an enemy blueprint when a fight begins.
  enemyHpMult(bp) {
    const a = this.ascension || 0;
    let m = 1;
    if (a >= 2) m *= 1.12;                      // A2 Swollen Ranks (all)
    if (a >= 8 && !bp.boss) m *= 1.10;          // A8 Relentless Spire (non-boss)
    if (bp.elite && a >= 1) m *= 1.25;          // A1 Bloodied Elites
    if (bp.boss && a >= 6) m *= 1.25;           // A6 Cruel Crowns
    return m;
  }
  restHealFraction() { return (this.ascension >= 4) ? 0.20 : 0.30; } // A4 Shallow Rest

  // Damage multiplier applied to every enemy attack (ascension scaling).
  enemyDamageMult() {
    const a = this.ascension || 0;
    let m = 1;
    if (a >= 9) m *= 1.10;   // A9 Sharpened Static
    if (a >= 12) m *= 1.10;  // A12 The Spire Bites
    return m;
  }

  // -------- hp / gold --------
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  takeDamage(n) { this.hp = Math.max(0, this.hp - n); }
  isDead() { return this.hp <= 0; }

  // -------- deck --------
  addCardById(id, upgraded = false) { this.deck.push({ id, upgraded }); }
  removeCardAt(i) { this.deck.splice(i, 1); }
  upgradeCardAt(i) { if (!this.deck[i].upgraded) this.deck[i].upgraded = true; }

  upgradeRandom(type, count) {
    const idxs = this.deck
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.upgraded && createCard(c.id).type === type);
    const chosen = this.rng.sample(idxs, count);
    for (const { i } of chosen) this.deck[i].upgraded = true;
  }

  // Build a display instance for a deck entry
  instance(entry) {
    const c = createCard(entry.id);
    if (entry.upgraded) upgradeCard(c);
    return c;
  }

  // -------- potions --------
  addPotion(id) {
    if (this.potions.length >= this.maxPotions) return false;
    this.potions.push(id);
    return true;
  }
  removePotionAt(i) { this.potions.splice(i, 1); }

  // -------- serialization --------
  toJSON() {
    return {
      seed: this.seed,
      rngState: this.rng.state,
      characterId: this.characterId,
      ascension: this.ascension,
      maxHp: this.maxHp, hp: this.hp, gold: this.gold,
      act: this.act,
      potions: this.potions, relics: this.relics, deck: this.deck,
      encountersCleared: this.encountersCleared, eliteCleared: this.eliteCleared,
      bossesDefeated: this.bossesDefeated, usedEvents: this.usedEvents,
      map: this.map, position: this.position,
    };
  }

  static fromJSON(data) {
    const run = Object.create(RunState.prototype);
    run.seed = data.seed;
    run.rng = new RNG(data.seed);
    run.rng.state = data.rngState;
    run.characterId = data.characterId;
    run.character = CHARACTERS[data.characterId];
    run.ascension = data.ascension || 0;
    run.maxHp = data.maxHp; run.hp = data.hp; run.gold = data.gold;
    run.act = data.act;
    run.maxPotions = 3;
    run.potions = data.potions || [];
    run.relics = data.relics || [];
    run.deck = data.deck || [];
    run.encountersCleared = data.encountersCleared || 0;
    run.eliteCleared = data.eliteCleared || 0;
    run.bossesDefeated = data.bossesDefeated || 0;
    run.usedEvents = data.usedEvents || [];
    run.map = data.map;
    run.position = data.position;
    run.lastResult = null;
    return run;
  }
}

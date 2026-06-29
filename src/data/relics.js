// Relics — ancestral artifacts that bend the rules of combat and the climb.
// Each relic may define lifecycle hooks the engine/run calls:
//   startCombat(combat)  — when a fight begins
//   energyBonus          — extra Àṣẹ gained at the start of each turn
//   onRunStart(run)      — applied once when acquired / run begins
// Plus event-style hooks registered via combat triggers inside startCombat.

export const RELICS = {};
function def(id, bp) { RELICS[id] = { id, ...bp }; }

// --------- Starter relics (one per champion) ---------
def('ancestral_cuirass', {
  name: 'Ancestral Cuirass', rarity: 'starter', char: 'amara',
  desc: 'At the start of each combat, gain 3 Ward.',
  startCombat: (combat) => combat.gainBlockTo(combat.player, 3, true),
});
def('griot_drum', {
  name: "Griot's Drum", rarity: 'starter', char: 'kofi',
  desc: 'At the start of each combat, apply 1 Sapped to ALL enemies.',
  startCombat: (combat) => { for (const e of combat.livingEnemies()) combat.applyPower(e, 'weak', 1, combat.player); },
});
def('star_lens', {
  name: 'Star Lens', rarity: 'starter', char: 'zara',
  desc: 'At the start of each combat, Channel 1 Storm.',
  startCombat: (combat) => combat.channel('storm', 1),
});

// --------- Common ---------
def('brass_anklet', {
  name: 'Brass Anklet', rarity: 'common',
  desc: 'At the start of each combat, gain 1 temporary Resolve... no — gain 1 Àṣẹ on turn 1.',
  startCombat: (combat) => { combat.bonusEnergyTurn1 = (combat.bonusEnergyTurn1 || 0) + 1; },
});
def('kente_wrap', {
  name: 'Kente Wrap', rarity: 'common',
  desc: 'At the start of each combat, gain 4 Ward.',
  startCombat: (combat) => combat.gainBlockTo(combat.player, 4, true),
});
def('cowrie_purse', {
  name: 'Cowrie Purse', rarity: 'common',
  desc: 'Gain 60 gold immediately.',
  onRunStart: (run) => { run.gold += 60; },
});
def('healing_gourd', {
  name: 'Healing Gourd', rarity: 'common',
  desc: 'At the end of each combat, heal 4 HP.',
  combatEnd: (run) => { run.heal(4); },
});
def('whetstone_idol', {
  name: 'Whetstone Idol', rarity: 'common',
  desc: 'Upgrade 2 random Attacks when acquired.',
  onAcquire: (run) => run.upgradeRandom('attack', 2),
});
def('ancestor_bead', {
  name: 'Ancestor Bead', rarity: 'common',
  desc: 'Whenever you rest at a fire, heal an additional 5 HP.',
  restBonus: 5,
});

// --------- Uncommon ---------
def('sun_disk', {
  name: 'Sun Disk', rarity: 'uncommon',
  desc: 'Every 3rd turn, gain 1 extra Àṣẹ.',
  startCombat: (combat) => combat.addTrigger('turnStart', () => {
    combat._sunDisk = (combat._sunDisk || 0) + 1;
    if (combat._sunDisk % 3 === 0) combat.gainEnergy(1);
  }, 'Sun Disk'),
});
def('obsidian_charm', {
  name: 'Obsidian Charm', rarity: 'uncommon',
  desc: 'The first time you lose HP each combat, gain 3 Resolve.',
  startCombat: (combat) => {
    combat._obsidianUsed = false;
    combat.addTrigger('hpLost', () => {
      if (!combat._obsidianUsed) { combat._obsidianUsed = true; combat.applyPower(combat.player, 'strength', 3, combat.player); }
    }, 'Obsidian Charm');
  },
});
def('talking_drum', {
  name: 'Talking Drum', rarity: 'uncommon',
  desc: 'Whenever you play 3 cards in a single turn, draw 1 card.',
  startCombat: (combat) => combat.addTrigger('cardPlayed', () => {
    if (combat.cardsThisTurn > 0 && combat.cardsThisTurn % 3 === 0) combat.draw(1);
  }, 'Talking Drum'),
});
def('mask_of_masks', {
  name: 'Mask of Masks', rarity: 'uncommon',
  desc: 'At the start of each combat, apply 1 Exposed to ALL enemies.',
  startCombat: (combat) => { for (const e of combat.livingEnemies()) combat.applyPower(e, 'vulnerable', 1, combat.player); },
});
def('iron_lattice', {
  name: 'Iron Lattice', rarity: 'uncommon',
  desc: 'At the end of your turn, if you have 0 Ward, gain 6 Ward.',
  startCombat: (combat) => combat.addTrigger('turnEnd', () => {
    if (combat.player.block === 0) combat.gainBlockTo(combat.player, 6, true);
  }, 'Iron Lattice'),
});

// --------- Rare ---------
def('twin_serpent', {
  name: 'Twin Serpent Ring', rarity: 'rare',
  desc: 'At the start of each combat, draw 2 extra cards on turn 1.',
  startCombat: (combat) => { combat._extraOpenDraw = (combat._extraOpenDraw || 0) + 2; },
});
def('heart_of_nyumbani', {
  name: 'Heart of Nyumbani', rarity: 'rare',
  desc: 'Gain 1 extra Àṣẹ at the start of each turn. Lose 5 Max HP.',
  energyBonus: 1,
  onAcquire: (run) => { run.maxHp = Math.max(1, run.maxHp - 5); run.hp = Math.min(run.hp, run.maxHp); },
});
def('ancestor_idol', {
  name: 'Idol of the Ancestors', rarity: 'rare',
  desc: 'The first attack you play each combat deals double damage.',
  startCombat: (combat) => { combat.firstAttackDouble = true; },
});
def('cosmic_egg', {
  name: 'Cosmic Egg', rarity: 'rare',
  desc: 'Powers you play cost 0 Àṣẹ... once per turn.',
  startCombat: (combat) => { combat.freePowerEachTurn = true; },
});
def('eternal_flame', {
  name: 'Eternal Flame', rarity: 'boss',
  desc: 'Gain 1 extra Àṣẹ each turn. At the start of each combat, add a Wound to your draw pile.',
  energyBonus: 1,
  startCombat: (combat) => combat.addCardToPile(combat.makeCard('wound'), 'draw'),
});
def('ascendant_crown', {
  name: 'Ascendant Crown', rarity: 'boss',
  desc: 'Gain 1 extra Àṣẹ each turn. You can no longer heal at fires (channel power instead).',
  energyBonus: 1,
  blockRestHeal: true,
});

export function relicById(id) { return RELICS[id]; }

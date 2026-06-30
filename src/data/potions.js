// Potions — single-use brews and reagents. use(ctx) runs inside combat;
// some (heal) also work on the map via a separate path in the run controller.

export const POTIONS = {};
function def(id, bp) { POTIONS[id] = { id, ...bp }; }

def('elixir', {
  name: 'Elixir of Ìyá', rarity: 'common', color: '#e0457b',
  desc: 'Heal 25% of your Max HP.',
  combatOnly: false,
  use: (ctx) => ctx.run.heal(Math.floor(ctx.run.maxHp * 0.25)),
});
def('rage_brew', {
  name: 'Rage Brew', rarity: 'common', color: '#d94f2b',
  desc: 'Gain 2 Resolve this combat.',
  combatOnly: true,
  use: (ctx) => ctx.combat.applyPower(ctx.combat.player, 'strength', 2, ctx.combat.player),
});
def('swift_brew', {
  name: 'Swiftroot Brew', rarity: 'common', color: '#37b6a6',
  desc: 'Draw 3 cards.',
  combatOnly: true,
  use: (ctx) => ctx.combat.draw(3),
});
def('block_brew', {
  name: 'Blockstone Brew', rarity: 'common', color: '#6fa8dc',
  desc: 'Gain 12 Block.',
  combatOnly: true,
  use: (ctx) => ctx.combat.gainBlockTo(ctx.combat.player, 12, true),
});
def('energy_brew', {
  name: 'Sunfire Draught', rarity: 'common', color: '#f1c232',
  desc: 'Gain 2 Àṣẹ.',
  combatOnly: true,
  use: (ctx) => ctx.combat.gainEnergy(2),
});
def('blight_brew', {
  name: 'Blight Vial', rarity: 'uncommon', color: '#6aa84f',
  desc: 'Apply 6 Blight to a target enemy.',
  combatOnly: true, targeted: true,
  use: (ctx) => { if (ctx.target) ctx.combat.applyPower(ctx.target, 'poison', 6, ctx.combat.player); },
});
def('weak_brew', {
  name: 'Saplight Tonic', rarity: 'uncommon', color: '#8e7cc3',
  desc: 'Apply 3 Sapped to ALL enemies.',
  combatOnly: true,
  use: (ctx) => { for (const e of ctx.combat.livingEnemies()) ctx.combat.applyPower(e, 'weak', 3, ctx.combat.player); },
});
def('focus_brew', {
  name: 'Clarity Draught', rarity: 'uncommon', color: '#a4c2f4',
  desc: 'Gain 2 Focus this combat.',
  combatOnly: true,
  use: (ctx) => ctx.combat.applyPower(ctx.combat.player, 'focus', 2, ctx.combat.player),
});
def('fairy_brew', {
  name: "Ancestor's Breath", rarity: 'rare', color: '#ffd966',
  desc: 'If you would die this combat, instead heal to 30% Max HP.',
  combatOnly: true, passive: true,
  use: (ctx) => { ctx.combat.fairyShield = true; },
});
def('fury_brew', {
  name: 'Cataclysm Draught', rarity: 'rare', color: '#cc0000',
  desc: 'Deal 10 damage to ALL enemies 3 times.',
  combatOnly: true,
  use: (ctx) => { for (let i = 0; i < 3; i++) ctx.combat.dealAllRaw(10); },
});

export function potionById(id) { return POTIONS[id]; }

// Status effects ("powers") and keywords. The Spire's mechanics, dressed in
// afrofuturist language. Mechanic names are kept readable; flavor lives in the
// descriptions and the world around them.

// Each power carries the metadata the combat engine reads directly, so the
// "how does this status behave" knowledge lives here rather than in hardcoded
// lists scattered through combat.js:
//   type: 'buff' | 'debuff'          — Charm (artifact) only negates debuffs.
//   ticksDown: true                  — decrements by 1 at the owner's turn boundary
//                                       (tickTurnDebuffs). Omit for statuses cleared
//                                       another way (poison ticks by value; regen
//                                       decays at turn end; noBlock is re-applied).
//   signed: true                     — may hold a negative value (e.g. Resolve), so
//                                       it is removed only at exactly 0. Powers
//                                       without this flag clamp away at <= 0.
export const POWERS = {
  // --- Core combat resource ---
  block: {
    name: 'Block',
    type: 'buff',
    desc: 'Absorbs incoming damage. Most Block fades at the start of your turn.',
  },

  // --- Persistent buffs ---
  strength: {
    name: 'Resolve',
    type: 'buff',
    signed: true,
    desc: 'Increases attack damage by {n} per hit.',
  },
  dexterity: {
    name: 'Grace',
    type: 'buff',
    desc: 'Increases Block gained from cards by {n}.',
  },
  regen: {
    name: 'Regrowth',
    type: 'buff',
    desc: 'Heal {n} HP at the end of your turn, then it decreases by 1.',
  },
  metallicize: {
    name: 'Bronzeplate',
    type: 'buff',
    desc: 'At the end of your turn, gain {n} Block.',
  },
  thorns: {
    name: 'Backlash',
    type: 'buff',
    desc: 'When attacked, deal {n} damage back to the attacker.',
  },
  artifact: {
    name: 'Charm',
    type: 'buff',
    desc: 'Negates the next {n} debuffs applied to you.',
  },
  intangible: {
    name: 'Phase',
    type: 'buff',
    ticksDown: true,
    desc: 'Reduce ALL damage and HP loss to 1 this turn.',
  },
  invincibility: {
    name: 'Invincibility',
    type: 'buff',
    desc: 'Takes at most {n} damage per turn.',
  },
  focus: {
    name: 'Focus',
    type: 'buff',
    desc: 'Increases the potency of channeled Spirits by {n}.',
  },

  // --- Debuffs ---
  vulnerable: {
    name: 'Exposed',
    type: 'debuff',
    ticksDown: true,
    desc: 'Takes 50% more damage from attacks.',
  },
  weak: {
    name: 'Sapped',
    type: 'debuff',
    ticksDown: true,
    desc: 'Deals 25% less attack damage.',
  },
  frail: {
    name: 'Brittle',
    type: 'debuff',
    ticksDown: true,
    desc: 'Gains 25% less Block from cards.',
  },
  poison: {
    name: 'Blight',
    type: 'debuff',
    desc: 'Lose {n} HP at the start of turn, then it decreases by 1.',
  },
  entangle: {
    name: 'Snared',
    type: 'debuff',
    signed: true,
    desc: 'Cannot play Attacks this turn.',
  },
  strengthDown: {
    name: 'Resolve Down',
    type: 'debuff',
    signed: true,
    desc: 'At end of turn, lose {n} Resolve.',
  },
  noBlock: {
    name: 'Sundered',
    type: 'debuff',
    signed: true,
    desc: 'Cannot gain Block this turn.',
  },
};

// Card keywords (rules glossary)
export const KEYWORDS = {
  Exhaust: 'When played, this card leaves play for the rest of combat.',
  Ethereal: 'If this card is in your hand at the end of your turn, it is Exhausted.',
  Innate: 'You start each combat with this card in your opening hand.',
  Retain: 'This card is not discarded at the end of your turn.',
  Verse: 'A song-card. Some effects grow stronger with each Verse played.',
  Spirit: 'Channeled energy of an Orisha. Evoke or stack them for power.',
  Àṣẹ: 'The power to make things be. The energy that fuels every card.',
};

export function powerName(key) {
  return POWERS[key]?.name || key;
}

// Status effects ("powers") and keywords. The Spire's mechanics, dressed in
// afrofuturist language. Mechanic names are kept readable; flavor lives in the
// descriptions and the world around them.

// type: 'buff' | 'debuff'
// duration: 'turn' (decrements each owner turn start) | 'persist' (stays) | 'value' (counts down by use)
export const POWERS = {
  // --- Core combat resource ---
  block: {
    name: 'Ward',
    type: 'buff',
    icon: '🛡',
    desc: 'Absorbs incoming damage. Most Wards fade at the start of your turn.',
  },

  // --- Persistent buffs ---
  strength: {
    name: 'Resolve',
    type: 'buff',
    icon: '💪',
    desc: 'Increases attack damage by {n} per hit.',
  },
  dexterity: {
    name: 'Grace',
    type: 'buff',
    icon: '🌀',
    desc: 'Increases Ward gained from cards by {n}.',
  },
  regen: {
    name: 'Regrowth',
    type: 'buff',
    duration: 'turn',
    icon: '🌿',
    desc: 'Heal {n} HP at the end of your turn, then it decreases by 1.',
  },
  metallicize: {
    name: 'Bronzeplate',
    type: 'buff',
    icon: '🥉',
    desc: 'At the end of your turn, gain {n} Ward.',
  },
  thorns: {
    name: 'Backlash',
    type: 'buff',
    icon: '🌵',
    desc: 'When attacked, deal {n} damage back to the attacker.',
  },
  artifact: {
    name: 'Charm',
    type: 'buff',
    icon: '🔮',
    desc: 'Negates the next {n} debuffs applied to you.',
  },
  intangible: {
    name: 'Phase',
    type: 'buff',
    duration: 'turn',
    icon: '👻',
    desc: 'Reduce ALL damage and HP loss to 1 this turn.',
  },
  rhythm: {
    name: 'Rhythm',
    type: 'buff',
    icon: '🥁',
    desc: 'Each Verse played this combat adds power to your refrains.',
  },
  focus: {
    name: 'Focus',
    type: 'buff',
    icon: '✨',
    desc: 'Increases the potency of channeled Spirits by {n}.',
  },

  // --- Debuffs ---
  vulnerable: {
    name: 'Exposed',
    type: 'debuff',
    duration: 'turn',
    icon: '🎯',
    desc: 'Takes 50% more damage from attacks.',
  },
  weak: {
    name: 'Sapped',
    type: 'debuff',
    duration: 'turn',
    icon: '🥀',
    desc: 'Deals 25% less attack damage.',
  },
  frail: {
    name: 'Brittle',
    type: 'debuff',
    duration: 'turn',
    icon: '💔',
    desc: 'Gains 25% less Ward from cards.',
  },
  poison: {
    name: 'Blight',
    type: 'debuff',
    duration: 'value',
    icon: '☠',
    desc: 'Lose {n} HP at the start of turn, then it decreases by 1.',
  },
  entangle: {
    name: 'Snared',
    type: 'debuff',
    duration: 'turn',
    icon: '🕸',
    desc: 'Cannot play Attacks this turn.',
  },
  strengthDown: {
    name: 'Resolve Down',
    type: 'debuff',
    duration: 'turn',
    icon: '📉',
    desc: 'At end of turn, lose {n} Resolve.',
  },
  noBlock: {
    name: 'Sundered',
    type: 'debuff',
    duration: 'turn',
    icon: '🚫',
    desc: 'Cannot gain Ward this turn.',
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
export function powerIcon(key) {
  return POWERS[key]?.icon || '•';
}

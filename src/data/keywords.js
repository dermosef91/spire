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
//                                       decays at turn end).
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
  tempo: {
    name: 'Tempo',
    type: 'buff',
    desc: 'The rhythm of the fight. Clean strikes build it (+1, +2 on a Perfect) and parries add 1; a missed beat breaks it to 0. Some cards grow stronger with Tempo or consume it. Caps at 10.',
  },
  // riposte's value is a damage amount, spent in full on the next attack hit
  // taken (not a hit-count like Exposed/Sapped/Brittle below). flow's value
  // IS a hit-count (consumed one dodge at a time), same pattern as those.
  // Neither ticks down with the turn clock.
  riposte: {
    name: 'Riposte',
    type: 'buff',
    desc: 'The next attack that hits you is answered for {n} damage, then Riposte is spent.',
  },
  flow: {
    name: 'Flow',
    type: 'buff',
    desc: 'The next {n} enemy attacks against you miss entirely. Each dodge consumes one stack.',
  },

  // --- Debuffs ---
  // Exposed / Sapped / Brittle are HIT-COUNTED, not turn-timed: each stack is
  // consumed by the event it modifies (a hit taken, a hit made, a Block gain)
  // and persists until then. No ticksDown — the clock never touches them.
  challenged: {
    name: 'Challenged',
    type: 'debuff',
    desc: 'Your attacks deal +{n} damage to this unit. A persistent mark, not consumed by hits — it lasts until removed or the unit dies.',
  },
  vulnerable: {
    name: 'Exposed',
    type: 'debuff',
    desc: 'The next {n} hits against this unit deal 50% more damage. Each hit consumes one stack.',
  },
  weak: {
    name: 'Sapped',
    type: 'debuff',
    desc: "This unit's next {n} attack hits deal 25% less damage. Each hit consumes one stack.",
  },
  frail: {
    name: 'Brittle',
    type: 'debuff',
    desc: 'The next {n} times this unit gains Block from cards, it gains 25% less.',
  },
  poison: {
    name: 'Blight',
    type: 'debuff',
    desc: 'Lose {n} HP at the start of turn, then it decreases by 1. When a Blighted foe dies, its remaining Blight leaps to a random living enemy.',
  },
  entangle: {
    name: 'Snared',
    type: 'debuff',
    ticksDown: true,
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
    ticksDown: true,
    desc: 'Cannot gain Block this turn.',
  },
};

// Card keywords (rules glossary)
export const KEYWORDS = {
  Consume: 'When played, this card leaves play for the rest of combat.',
  Ethereal: 'If this card is in your hand at the end of your turn, it is Consumed.',
  Innate: 'You start each combat with this card in your opening hand.',
  Retain: 'This card is not discarded at the end of your turn.',
  Verse: 'A song-card. Some effects grow stronger with each Verse played.',
  Spirit: 'Channeled energy of an Orisha. Evoke or stack them for power.',
  Àṣẹ: 'The power to make things be. The energy that fuels every card.',
};

export function powerName(key) {
  return POWERS[key]?.name || key;
}

// Glossary entries for highlighted terms that aren't POWERS/KEYWORDS entries
// themselves (Zara's Spirit orbs + verbs) — see components.js's EXTRA_KEYWORDS,
// which lists the same names for highlighting.
const EXTRA_GLOSSARY = {
  Storm: 'A Spirit orb. Passively strikes a random enemy each turn; Evoke it to strike harder immediately.',
  Tide: 'A Spirit orb. Passively grants Block each turn; Evoke it to gain a burst of Block immediately.',
  Shade: 'A Spirit orb. Stores power each turn; Evoke it to unleash all its stored damage at once.',
  Sun: 'A Spirit orb. Passively grants Àṣẹ next turn; Evoke it to gain Àṣẹ immediately.',
  Evoke: 'Trigger a Spirit orb’s strong effect immediately, then it fades.',
  Channel: 'Place a Spirit orb into an empty slot.',
};

// Reverse index: displayed keyword text -> { name, desc }, built from POWERS
// (keyed by internal id), KEYWORDS and EXTRA_GLOSSARY (keyed by display name).
const KEYWORD_INDEX = (() => {
  const idx = {};
  for (const key of Object.keys(POWERS)) idx[POWERS[key].name] = { name: POWERS[key].name, desc: POWERS[key].desc };
  for (const name of Object.keys(KEYWORDS)) idx[name] = { name, desc: KEYWORDS[name] };
  for (const name of Object.keys(EXTRA_GLOSSARY)) idx[name] = { name, desc: EXTRA_GLOSSARY[name] };
  return idx;
})();

// Look up a highlighted keyword's glossary entry by its displayed text, for
// the click-to-explain popup on `.kw` spans (see game.js's setupGlossaryPopups).
export function keywordInfo(text) {
  const hit = KEYWORD_INDEX[text];
  if (!hit) return null;
  return { name: hit.name, desc: hit.desc.replace('{n}', 'X') };
}

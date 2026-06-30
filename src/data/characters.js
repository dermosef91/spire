// The three champions chosen to climb the Obsidian Spire.

export const CHARACTERS = {
  amara: {
    id: 'amara',
    name: 'Amara',
    title: 'The Agojie Bladedancer',
    glyph: '⚔️',
    color: '#e0457b',
    accent: '#ffd166',
    maxHp: 80,
    startGold: 99,
    relic: 'ancestral_cuirass',
    blurb:
      'A warrior of the all-woman regiment of Dahomey, reforged in star-iron. She fights with Resolve and unbreakable Block, turning ancestral fury into edge and armor.',
    deck: ['slash', 'slash', 'slash', 'slash', 'slash', 'brace', 'brace', 'brace', 'brace', 'sunder'],
    cardPool: [
      'twin_fangs', 'ironwave', 'pommel', 'cleave', 'crosscut', 'shrug', 'thunderclap',
      'rising_strike', 'war_trance', 'ember_within', 'bulwark', 'read_tell', 'shockwave', 'disarm', 'whirlwind',
      'ancestral_fury', 'blood_offering', 'devour', 'harvest', 'skyfall',
    ],
  },
  kofi: {
    id: 'kofi',
    name: 'Kofi',
    title: 'The Griot of the Cosmos',
    glyph: '🎶',
    color: '#37b6a6',
    accent: '#a4f0d6',
    maxHp: 68,
    startGold: 99,
    relic: 'griot_drum',
    blurb:
      'Keeper of star-songs, he weaponizes memory and rhythm. His Verses stack Blight and tempo until the enemy unravels mid-chorus.',
    deck: ['jab', 'jab', 'jab', 'jab', 'jab', 'refrain', 'refrain', 'refrain', 'refrain', 'cutting_verse'],
    cardPool: [
      'blight_needle', 'quickstep', 'double_tap', 'crescendo', 'deflect', 'shard_burst', 'backbeat',
      'venom_chorus', 'syncopation', 'accelerando', 'catalyst', 'bouncing_verse', 'veil',
      'blight_bloom', 'the_long_song', 'grand_finale',
    ],
  },
  zara: {
    id: 'zara',
    name: 'Zara',
    title: 'The Star-Weaver',
    glyph: '✨',
    color: '#8e7cc3',
    accent: '#c8b6ff',
    maxHp: 72,
    startGold: 99,
    relic: 'star_lens',
    orbSlots: 3,
    blurb:
      'She channels the Orisha as Spirits — Storm, Tide, Shade and Sun — orbiting her like satellites. Focus bends their power; Evoke unleashes it.',
    deck: ['pulse', 'pulse', 'pulse', 'pulse', 'barrier', 'barrier', 'barrier', 'barrier', 'channel_storm', 'resonate'],
    cardPool: [
      'static_burst', 'frostbind', 'coolhead', 'capacitor', 'chaos', 'glacier',
      'summon_shade', 'attune', 'doomgloom', 'skim', 'echocast', 'summon_sun',
      'overclock', 'stormcall', 'echo_form', 'falling_star',
    ],
  },
};

export const COLORLESS_POOL = ['shiv', 'flash', 'panic_button', 'apotheosis'];

export function characterById(id) { return CHARACTERS[id]; }

// Encounter tables per act. Each entry is a list of enemy ids that spawn together.
// `weak` encounters are used for the first couple of fights in an act.

export const ENCOUNTERS = {
  1: {
    weak: [
      ['husk_drone'],
      ['static_jackal'],
      ['husk_drone', 'husk_drone'],
    ],
    normal: [
      ['static_jackal', 'husk_drone'],
      ['brass_sentinel'],
      ['market_thief', 'husk_drone'],
      ['static_jackal', 'static_jackal'],
      ['brass_sentinel', 'husk_drone'],
    ],
    elite: [
      ['gilded_warden'],
      ['gilded_warden', 'husk_drone'],
    ],
    boss: [['the_gatekeeper']],
  },
  2: {
    weak: [
      ['sand_wraith'],
      ['mirror_shade'],
    ],
    normal: [
      ['sand_wraith', 'mirror_shade'],
      ['chrome_serpent'],
      ['mirror_shade', 'mirror_shade'],
      ['chrome_serpent', 'sand_wraith'],
    ],
    elite: [
      ['brass_colossus'],
      ['mirror_shade', 'chrome_serpent'],
    ],
    boss: [['the_archivist']],
  },
  3: {
    weak: [
      ['void_chanter'],
      ['static_seraph'],
    ],
    normal: [
      ['void_chanter', 'void_chanter'],
      ['static_seraph', 'void_chanter'],
      ['static_seraph', 'static_seraph'],
    ],
    elite: [
      ['chrome_archon'],
      ['chrome_archon', 'void_chanter'],
    ],
    boss: [['heart_of_static']],
  },
};

export const ACT_NAMES = {
  1: 'The Sunken Market',
  2: 'The Brass Archive',
  3: 'The Static Crown',
};

export const ACT_BLURB = {
  1: 'Below the Obsidian Spire sprawls a flooded bazaar of brass and bone, where corrupted guardians barter in static.',
  2: 'Endless shelves of forgotten names spiral upward. The Archive remembers everything — and forgets you on purpose.',
  3: 'At the summit the Static sings. Here the Ancestors once touched the cosmos. Cleanse the Heart, or be unwritten.',
};

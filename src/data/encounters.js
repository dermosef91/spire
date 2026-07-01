// Encounter tables per act. Each entry is a list of enemy ids that spawn together.
// `weak` encounters are used for the first couple of fights in an act.

// Encounters deliberately mix archetype ROLES so each fight poses a different
// question: a healer beside an attacker (kill-priority), a poisoner beside a
// turtle (race vs. wall), a glass-cannon swarm (burst check), etc.
export const ENCOUNTERS = {
  1: {
    weak: [
      ['husk_drone'],
      ['static_jackal'],
      ['reef_spitter'],                        // lone poisoner — learn the clock
      ['husk_drone', 'husk_drone'],
    ],
    normal: [
      ['spark_imp', 'spark_imp'],              // twin glass cannons — burst check
      ['tide_priest', 'static_jackal'],        // healer + attacker — kill priority
      ['brass_sentinel'],                      // retaliator wall
      ['reef_spitter', 'brass_sentinel'],      // poison behind a turtle — race the wall
      ['market_thief', 'husk_drone'],          // thief pressure
      ['tide_priest', 'spark_imp'],            // healer feeds a ramping cannon
      ['static_jackal', 'reef_spitter'],       // swarm + poison
    ],
    elite: [
      ['gilded_warden'],
      ['rust_maw'],
      ['gilded_warden', 'spark_imp'],
    ],
    boss: [['the_gatekeeper']],
  },
  2: {
    weak: [
      ['sand_wraith'],
      ['ink_leech'],                           // lone life-drain — out-pace it
      ['glyph_sentry'],                        // lone charger — block the lance
    ],
    normal: [
      ['sand_wraith', 'mirror_shade'],         // debuff + retaliator
      ['chrome_serpent'],                      // poison/control
      ['null_scribe', 'ink_leech'],            // deck jam + sustain — end it fast
      ['glyph_sentry', 'sand_wraith'],         // charger + debuffer
      ['ink_leech', 'ink_leech'],              // double drain — sustain race
      ['mirror_shade', 'null_scribe'],         // wall + warded flooder
      ['chrome_serpent', 'reef_spitter'],      // stacked poison
    ],
    elite: [
      ['brass_colossus'],
      ['obsidian_maw'],
      ['obsidian_maw', 'null_scribe'],         // berserker + deck jam
    ],
    boss: [['the_archivist']],
  },
  3: {
    weak: [
      ['void_chanter'],
      ['echo_wraith'],                         // lone phaser — don't waste burst
      ['static_swarm'],                        // lone swarm + curses
    ],
    normal: [
      ['hollow_cantor', 'ember_colossus'],     // healer feeding a berserker
      ['static_seraph', 'void_chanter'],       // charger + debuffer
      ['echo_wraith', 'static_swarm'],         // phaser + swarm
      ['ember_colossus'],                      // solo berserker — a pure clock
      ['hollow_cantor', 'echo_wraith'],        // healer + phaser — attrition
      ['static_swarm', 'void_chanter'],        // curses + hexes
    ],
    elite: [
      ['chrome_archon'],
      ['chrome_archon', 'hollow_cantor'],      // elite backed by a healer
      ['ember_colossus', 'ember_colossus'],
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
  1: 'They say the Spire lifts its champions home to the Ancestors. The climb begins in the flooded market at its root, where the old guardians bar the way — brass and bone that were, they whisper, climbers once themselves.',
  2: 'The Archive files every name that ever climbed. It remembers all of them, shelf on shelf — and it already has a page for you, as though your ascent were long finished and only waiting to be read back.',
  3: 'At the summit the Static sings in a thousand kept voices. This is where climbers are welcomed home. Reach the Heart that renders them, and learn what that welcome is made of.',
};

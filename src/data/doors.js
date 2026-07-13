// Door prose for the Descent-Vote (see map/climbgen.js).
//
// The Spire offers thresholds, not map nodes. Each door carries an *omen tier*
// governing how much its prose gives away — and the prose is drawn from a pool
// keyed so that it can never lie about what's behind it:
//
//   plain[act][type]      — type is revealed, so the copy can name it directly.
//   veiled[act][category] — only danger|comfort is shown; copy is union-safe.
//   sealed[act]           — genuinely ambiguous; any type could follow.
//
// Categories keep veiled copy honest: a "warm hearth-light" line can only ever
// attach to a comfort door, never to a fight. Everything stays original to the
// ÀṢẸ world (the Sunken Market, the Brass Archive, the Static Crown).
//
// PHASE 1 ships a minimal-but-real set (pools non-empty for every cell so the
// generator + tests have honest content). Phase 4 expands to the no-repeat
// volume targets.

export const OMEN_CATEGORY = { monster: 'danger', elite: 'danger', shop: 'comfort', rest: 'comfort', treasure: 'comfort', event: 'comfort' };
export function omenCategory(type) { return OMEN_CATEGORY[type] || 'comfort'; }

export const DOOR_PROSE = {
  // ─────────────────────────────── PLAIN — type revealed ───────────────────
  plain: {
    1: {
      monster: [
        'A low channel where the tide-brass rattles. Something is already moving in the dark water.',
        'The stalls here are overturned, and the thing that overturned them has not left.',
        'Wet footprints climb the ramp ahead, too many of them, and none coming back down.',
      ],
      elite: [
        'A market guardian stands in the arch, cowrie-shells and star-iron welded to its brass. It was a champion, once.',
        'The doorway is barred by something tall and patient, still wearing the medals of a climber who never went home.',
        'A warden of the Sunken Market blocks the stair, humming a victory it no longer remembers winning.',
      ],
      shop: [
        'The bazaar\'s lanterns are lit and a merchant of brass and bone is already counting on your arrival.',
        'A stall hung with charms and salvage rings a small bell as you approach. Coin talks here.',
        'Someone has laid out wares on a drowned counter, patient as the tide, waiting to trade.',
      ],
      rest: [
        'An ancestor fire burns low in a dry alcove, its smoke curling upward like an invitation to breathe.',
        'A sheltered hollow, warm with banked embers, where the market\'s murmur finally quiets.',
        'Cowrie-strung driftwood makes a windbreak around a small flame. You could rest here.',
      ],
      treasure: [
        'A silt-choked reliquary sits half-open, something inside it catching the lantern-light.',
        'A drowned strongbox rests on the sill, its lock long rotted through. Untouched.',
        'An offering-chest, sealed against the tide, waits with its cargo dry and glinting.',
      ],
      event: [
        'A figure waits between the stalls with a question already shaped on its lips.',
        'The water here holds a strangeness — a choice, folded into the market\'s hush.',
        'Something in this alcove wants to bargain, and it is not selling goods.',
      ],
    },
    2: {
      monster: [
        'The shelves here have been pulled down into a nest, and the nest is occupied.',
        'Ink runs across the floor in a trail. It is still wet, and it leads toward you.',
        'A reading-room, its lamps guttering, where something turns the pages without hands.',
      ],
      elite: [
        'A griot of the Archive fills the corridor, brass throat wide, ready to sing you catalogued and filed.',
        'A tall archivist waits among the stacks, kora strung with the sinew of the last climber it welcomed.',
        'The way is held by a keeper of names — yours already inked on the scroll at its belt.',
      ],
      shop: [
        'A clerk of the Archive has opened a side-ledger: goods for coin, off the record, for now.',
        'Between two collapsing shelves, a trader in salvaged pages waits with a knowing smile.',
        'A brass automaton has set out wares in neat rows and will haggle in exact fractions.',
      ],
      rest: [
        'A dry study nook, a reading-lamp still warm, quiet enough to gather yourself.',
        'An abandoned scriptorium where the ancestor fire has been kept alight by no one.',
        'A cushioned alcove behind the stacks, hushed, where you could close your eyes a while.',
      ],
      treasure: [
        'A locked archive-drawer stands slightly ajar, something gold-leafed inside.',
        'A cataloguer\'s cache, forgotten between accessions, its seal unbroken.',
        'A reliquary shelf holds one boxed treasure the ledgers never recorded.',
      ],
      event: [
        'A scribe looks up from its endless copying and beckons you closer.',
        'The Archive has left a page turned to you, and a decision written in the margin.',
        'Something among the shelves offers a trade of memory for memory.',
      ],
    },
    3: {
      monster: [
        'The static thickens into a shape here, and the shape has too many arms.',
        'A choir-stall where one voice has gone wrong, wet and hungry beneath the harmony.',
        'The air crackles around something that used to be a person and is now mostly noise.',
      ],
      elite: [
        'A star-weaver wearing a dead diadem bars the crown-stair, its orbs gone dark and cold.',
        'A kept champion stands in the light of the Crown, rendered gorgeous and wrong, waiting for you.',
        'The way up is held by a welcomed one — crowned, hollowed, and very glad you\'ve come.',
      ],
      shop: [
        'A vendor of the Crown\'s leavings has set a stall in the static, prices in things you can spare.',
        'Amid the hum, a merchant offers relics stripped from those already folded in.',
        'A quiet dealer waits with wares that gleam too brightly, and will take your coin gladly.',
      ],
      rest: [
        'A pocket of stillness in the Crown\'s roar, an ancestor fire impossibly lit, warm and waiting.',
        'A hollow where the static thins to a hush. You could breathe here, briefly.',
        'A last quiet ledge below the summit, embers glowing, offered like a kindness.',
      ],
      treasure: [
        'A crown-offering sits unclaimed on a plinth of light, radiant and untouched.',
        'A reliquary of the ascended stands open, its keeper long since folded away.',
        'One box remains sealed among the Crown\'s spoils, humming with something kept.',
      ],
      event: [
        'A half-unwritten pilgrim turns its smeared face toward you with an offer.',
        'The Crown itself seems to pause, and set a choice before you like bait.',
        'Something in the static knows your name and wishes to discuss the terms.',
      ],
    },
  },

  // ─────────────────────────── VEILED — danger | comfort only ───────────────
  veiled: {
    1: {
      danger: [
        'Something large draws breath beyond this arch. You can\'t yet see its shape.',
        'The water past this door is disturbed, and whatever moves in it is close.',
        'A wrongness leans against the far side of the threshold, waiting to be let in.',
      ],
      comfort: [
        'A warm light spills from beyond this door, and no menace with it — not yet.',
        'The air past the sill is dry and still, promising respite of some kind.',
        'Something beyond offers rather than threatens; its exact gift stays hidden.',
      ],
    },
    2: {
      danger: [
        'Ink-wet and ragged, the far room holds something that turns toward footsteps.',
        'A held breath in the stacks beyond, and the certainty it is not friendly.',
        'Past this door the shelves have been disturbed by something that is still there.',
      ],
      comfort: [
        'A steady lamplight glows beyond the shelves, unhurried and unhostile.',
        'The far side of this door is quiet in a way that means opportunity, not ambush.',
        'Something past the threshold means to deal with you kindly. What, it won\'t say.',
      ],
    },
    3: {
      danger: [
        'The static past this door has weight, and appetite, and knows you\'re here.',
        'Something crowned and wrong waits just out of sight beyond the sill.',
        'The hum past the threshold sharpens to a point aimed inward.',
      ],
      comfort: [
        'A gentler frequency hums past this door, offering more than it takes — this once.',
        'Beyond the sill the roar softens to a welcome. Its price stays unspoken.',
        'Something past this door means you well, in the Crown\'s own unsettling way.',
      ],
    },
  },

  // ─────────────────────────────── SEALED — anything ───────────────────────
  sealed: {
    1: [
      'This door was not here a moment ago. It offers nothing but its own dark seam.',
      'A threshold with no omen at all, silent as the silt. You cannot read it.',
      'The market gives no sign of what waits behind this one. Only that it waits.',
    ],
    2: [
      'A blank archive-door, uncatalogued, its contents scrubbed from every ledger.',
      'The Archive declines to name what lies beyond this seam. Deliberately.',
      'No omen, no index, no tell — only a door the shelves refuse to describe.',
    ],
    3: [
      'The static swallows all sign of what waits past this door. It could be anything.',
      'A seam of pure white noise. The Crown withholds its intent entirely.',
      'This threshold gives nothing away. Even the hum goes quiet before it.',
    ],
  },

  // The terminal boss gate (single door on the summit).
  boss: {
    1: ['The tide-brass parts on a vast chamber where the market\'s true guardian waits atop the water.'],
    2: ['The stacks open onto a great vault, and the thing that keeps every name rises to meet you.'],
    3: ['The static peels back from the summit itself, and what wears the Crown turns to welcome you home.'],
  },
};

// ─────────────────────────────── Named Thresholds ──────────────────────────
// Micro-events at the sill — a line and (phase 2) a decision before entry.
// Phase 1 defines the data; the scene interprets `resolve` later.
export const NAMED_DOORS = [
  {
    id: 'toll_door',
    name: 'The Toll Door',
    acts: [1, 2, 3],
    forType: 'treasure',
    prose: 'A brass hand bars this door, palm up. "A coin to cross," it grinds. "The reward beyond is worth more than the toll."',
    resolve: { kind: 'toll', gold: 15 },
  },
  {
    id: 'bleeding_seam',
    name: 'The Bleeding Seam',
    acts: [1, 2, 3],
    prose: 'A shortcut yawns in the wall, warm and red at its edges. It would carry you far — and take a little of you in passing.',
    resolve: { kind: 'shortcut', skip: 2, hpCost: 8 },
  },
  {
    id: 'kind_door',
    name: 'The Kind Door',
    acts: [1, 2, 3],
    forType: 'rest',
    prose: 'This door is already open, warmth pouring through, no lock and no price. Nothing waits to catch you. Nothing at all.',
    resolve: { kind: 'boon', heal: 10 },
  },
  {
    id: 'mimic_frame',
    name: 'The Mimic Frame',
    acts: [2, 3],
    prose: 'The door-frame flexes as you reach for it, brass teeth unfolding from the lintel. The door itself means to fight.',
    resolve: { kind: 'ambush' },
  },
];

// ─────────────────────────────── Curator voice ─────────────────────────────
// The Spire's line above the offer, keyed to hidden appetite. Sweeter as it
// grows more certain you're ready to be welcomed home.
export const CURATOR_LINES = {
  high: [
    'You climb so well. Rest. Please.',
    'Look how strong you\'ve grown. Let the Spire care for you a while.',
    'No need to hurry, favored one. Everything here is for you.',
  ],
  mid: [
    'The Spire watches you choose.',
    'Two ways up. The Spire is patient.',
    'Choose. The climb remembers either way.',
  ],
  low: [
    'Not yet. You are not yet ready to come home.',
    'Prove the climb was not wasted on you.',
    'The Spire is hungry, and you are still so thin.',
  ],
};

// The Spire's voice — the griot narrator. First-person, warm, welcoming, and
// quietly possessive: a host that is really a furnace. On a first play these
// read as invitation; the two victory endings (and the world's reveal that the
// Spire renders winners into the next climber's enemies) recontextualize them
// as extraction dressed as apotheosis. Keep new lines short (one caption),
// warm on the surface, with the lie only just under it.
//
// Each entry: { text, gate, metaKey? }
//   gate 'meta'   — fire once EVER, guarded by a persisted meta flag (metaKey).
//                   Reserved for the marquee first-play beats.
//   gate 'run'    — fire once per run (in-memory; may re-fire after a reload).
//   gate 'always' — fire every time (endpoint screens that render once).
// The Narrator (src/ui/narrator.js) reads gate/metaKey; call sites just pass an id.

export const LINES = {
  // --- Scene beats (marquee, once ever) ---
  first_map: {
    text: 'Climb, child of Nyumbani. I have kept your place warm.',
    gate: 'meta', metaKey: 'narrSeenFirstMap',
  },
  act_intro_1: {
    text: 'Welcome home. So many came before you — you will feel them in the walls.',
    gate: 'meta', metaKey: 'narrSeenActIntro1',
  },
  act_intro_2: {
    text: 'Higher now. I remember every name that reached this far. I keep them all.',
    gate: 'meta', metaKey: 'narrSeenActIntro2',
  },
  act_intro_3: {
    text: 'Almost home, almost mine. The Crown has been polished for a head like yours.',
    gate: 'meta', metaKey: 'narrSeenActIntro3',
  },
  first_shop: {
    text: 'Trade freely. Everything here was left by someone who no longer needs it.',
    gate: 'meta', metaKey: 'narrSeenShop',
  },
  first_rest: {
    text: 'Rest by the ancestor-fire. Its embers were people once; they will warm you all the same.',
    gate: 'meta', metaKey: 'narrSeenRest',
  },
  first_event: {
    text: 'Curious? Good. The curious climb faster — and I do love a swift ascent.',
    gate: 'meta', metaKey: 'narrSeenEvent',
  },
  first_treasure: {
    text: 'A gift, freely given. I am generous with those I mean to keep.',
    gate: 'meta', metaKey: 'narrSeenTreasure',
  },

  // --- Combat beats ---
  first_perfect: {
    text: 'Yes — the drum hears you. Keep that rhythm; I am listening.',
    gate: 'meta', metaKey: 'narrSeenPerfect',
  },
  first_kill: {
    text: 'It thanks you, in its way. You have freed a climber from their long watch.',
    gate: 'meta', metaKey: 'narrSeenKill',
  },
  first_tempo_break: {
    text: 'The rhythm slips. No matter — I have all the time you have left.',
    gate: 'meta', metaKey: 'narrSeenTempoBreak',
  },
  boss_approach: {
    text: 'This one was a champion, once. It climbed as you climb — now it only guards the door I opened for you.',
    gate: 'run',
  },
  first_low_hp: {
    text: 'So much of you spent already. Do not fear falling — falling is only another way down to me.',
    gate: 'run',
  },

  // --- Endpoints (fire every time; each screen renders once) ---
  defeat: {
    text: 'Rest now, climber. You are home. You were always going to be home.',
    gate: 'always',
  },
  victory_ascend: {
    text: 'Rise, and take your place among the kept. I knew you would. I always know.',
    gate: 'always',
  },
  victory_unwrite: {
    text: 'You heard me. Beneath every welcome, the furnace — and you have let it go cold.',
    gate: 'always',
  },
};

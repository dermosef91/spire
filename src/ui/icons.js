// Custom SVG iconography + animated character/enemy "models" for the
// Incandescent theme. Everything is inline, line-art, themed via CSS variables
// (var(--orange/--amber/--ember/--cream)) and animated with lightweight CSS
// utility classes (.spin/.spin-slow/.bob/.breathe/.flicker/.pulse) defined in
// styles.css. No emoji, no external assets.

const NS = 'xmlns="http://www.w3.org/2000/svg"';

// Wrap inner markup into a square, overflow-visible svg.
function S(inner, { vb = '0 0 100 100', cls = '' } = {}) {
  return `<svg ${NS} viewBox="${vb}" class="svg-ic ${cls}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
const O = 'var(--orange)', A = 'var(--amber)', E = 'var(--ember)', C = 'var(--cream)';

// Concentric-ring backdrop used inside models.
function rings(cx, cy, n = 3, step = 12, col = O, op = 0.5) {
  let s = '';
  for (let i = 1; i <= n; i++) s += `<circle cx="${cx}" cy="${cy}" r="${i * step}" stroke="${col}" stroke-width="1" opacity="${op}"/>`;
  return s;
}
function rays(cx, cy, r1, r2, count = 12, col = O, op = 0.5, w = 1.5) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    s += `<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * r2}" y2="${cy + Math.sin(a) * r2}" stroke="${col}" stroke-width="${w}" opacity="${op}"/>`;
  }
  return s;
}
function orbitDots(cx, cy, r, count, dotR = 3, col = A) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    s += `<circle cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" r="${dotR}" fill="${col}"/>`;
  }
  return s;
}

/* ============================== UI ICONS ============================== */
export const UI = {
  heart: S(`<path d="M50 78 C18 55 22 28 40 28 C49 28 50 38 50 38 C50 38 51 28 60 28 C78 28 82 55 50 78Z" fill="${E}" stroke="${O}" stroke-width="4"/>`),
  coin: S(`<circle cx="50" cy="50" r="30" fill="${A}" stroke="${C}" stroke-width="3"/><circle cx="50" cy="50" r="22" fill="none" stroke="#6a3a10" stroke-width="2"/><path d="M44 40 q12 10 0 20 M56 40 q-12 10 0 20" stroke="#6a3a10" stroke-width="3"/>`),
  energy: S(`${rays(50, 50, 30, 42, 12, O, 0.6, 2)}<circle cx="50" cy="50" r="26" fill="none" stroke="${O}" stroke-width="4"/><path d="M54 30 L40 54 H50 L46 70 L62 44 H52 Z" fill="${A}" stroke="${C}" stroke-width="2"/>`),
  shield: S(`<path d="M50 18 L78 28 V52 C78 70 64 80 50 84 C36 80 22 70 22 52 V28 Z" fill="#123" stroke="#9fc2ff" stroke-width="4"/><path d="M50 30 V72" stroke="#9fc2ff" stroke-width="3" opacity="0.7"/>`),
  draw: S(`<rect x="30" y="26" width="34" height="48" rx="4" transform="rotate(-10 47 50)" fill="#16100b" stroke="${O}" stroke-width="4"/><circle cx="47" cy="50" r="9" fill="none" stroke="${A}" stroke-width="3"/>`),
  discard: S(`<rect x="30" y="30" width="40" height="44" rx="4" fill="#16100b" stroke="${O}" stroke-width="4"/><path d="M38 44 L62 64 M62 44 L38 64" stroke="${E}" stroke-width="4"/>`),
  exhaust: S(`<rect x="32" y="30" width="36" height="44" rx="4" fill="#16100b" stroke="${O}" stroke-width="4" opacity="0.8"/><path d="M50 26 C60 36 40 40 50 52 C60 64 40 68 50 78" stroke="${A}" stroke-width="3" fill="none"/>`),
  gear: S(`<circle cx="50" cy="50" r="14" fill="none" stroke="${O}" stroke-width="5"/>${rays(50, 50, 20, 30, 8, O, 1, 6)}`),
  fullscreen: S(`<path d="M28 40 V28 H40 M60 28 H72 V40 M72 60 V72 H60 M40 72 H28 V60" stroke="${O}" stroke-width="5"/>`),
  skull: S(`<path d="M50 22 C32 22 24 36 24 48 C24 58 30 62 32 68 L34 78 H66 L68 68 C70 62 76 58 76 48 C76 36 68 22 50 22Z" fill="#16100b" stroke="${O}" stroke-width="4"/><circle cx="40" cy="50" r="6" fill="${E}"/><circle cx="60" cy="50" r="6" fill="${E}"/>`),
};

/* ============================== INTENTS ============================== */
export const INTENT = {
  attack: `<svg ${NS} viewBox="0 0 100 100" class="svg-ic" fill="none"><path d="M30 70 L70 30 M62 30 H72 V40 M30 62 L40 72" stroke="${E}" stroke-width="8" stroke-linecap="round"/></svg>`,
  block: UI.shield,
  buff: `<svg ${NS} viewBox="0 0 100 100" class="svg-ic" fill="none"><path d="M50 22 L72 54 H58 V78 H42 V54 H28 Z" fill="${A}" stroke="${C}" stroke-width="3"/></svg>`,
  debuff: `<svg ${NS} viewBox="0 0 100 100" class="svg-ic" fill="none"><path d="M50 78 L28 46 H42 V22 H58 V46 H72 Z" fill="${O}" stroke="${C}" stroke-width="3"/></svg>`,
  unknown: `<svg ${NS} viewBox="0 0 100 100" class="svg-ic" fill="none"><path d="M38 40 C38 28 62 28 62 42 C62 52 50 52 50 62" stroke="${O}" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="76" r="5" fill="${O}"/></svg>`,
};

/* ============================== MAP NODES ============================== */
export const NODE = {
  monster: S(`<path d="M30 70 L70 30 M30 30 L70 70" stroke="currentColor" stroke-width="9"/>`),
  elite: S(`<path d="M50 20 L60 42 L84 44 L66 60 L72 84 L50 70 L28 84 L34 60 L16 44 L40 42 Z" fill="none" stroke="currentColor" stroke-width="6"/>`),
  boss: S(`${rings(50, 50, 2, 16, 'currentColor', 0.5)}<circle cx="50" cy="50" r="16" fill="#1a0603" stroke="currentColor" stroke-width="5"/><path d="M34 40 L40 52 L50 36 L60 52 L66 40 V62 H34Z" fill="currentColor"/>`),
  event: S(`<path d="M40 42 C40 28 64 30 62 44 C60 54 50 54 50 64" stroke="currentColor" stroke-width="8"/><circle cx="50" cy="78" r="5" fill="currentColor"/>`),
  shop: S(`<path d="M28 38 H72 L68 64 H32 Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M36 38 L40 26 H60 L64 38" stroke="currentColor" stroke-width="5"/><circle cx="42" cy="72" r="4" fill="currentColor"/><circle cx="58" cy="72" r="4" fill="currentColor"/>`),
  rest: S(`<path d="M50 24 C58 40 72 44 64 62 C60 72 40 72 36 62 C28 44 42 40 50 24Z" fill="${E}" stroke="currentColor" stroke-width="4"/><path d="M50 40 C54 50 60 52 56 62" stroke="${A}" stroke-width="3"/>`),
  treasure: S(`<rect x="26" y="42" width="48" height="32" rx="4" fill="#16100b" stroke="currentColor" stroke-width="5"/><path d="M26 42 C26 28 74 28 74 42" stroke="currentColor" stroke-width="5"/><rect x="46" y="50" width="8" height="12" fill="${A}"/>`),
};

/* ============================== POWERS / STATUS ============================== */
const POWER_SVG = {
  strength: `<path d="M30 58 q-6 -10 4 -12 l18 -4 q4 -14 14 -10 q10 4 4 16 l-2 8 q10 6 4 16 q-6 8 -18 6 l-20 -4 q-12 -4 -8 -12Z" fill="${O}" stroke="${C}" stroke-width="3"/>`,
  dexterity: `<path d="M28 64 C40 40 60 40 72 64 M50 40 V64" stroke="${A}" stroke-width="7"/>`,
  block: `<path d="M50 22 L76 30 V52 C76 68 64 78 50 82 C36 78 24 68 24 52 V30Z" fill="#123a5a" stroke="#9fc2ff" stroke-width="4"/>`,
  regen: `<path d="M50 74 C30 60 30 38 50 26 C70 38 70 60 50 74Z" fill="${A}" stroke="${C}" stroke-width="3"/>`,
  metallicize: `<rect x="28" y="38" width="44" height="30" rx="4" fill="${A}" stroke="${C}" stroke-width="3"/>`,
  thorns: `<path d="M50 24 L58 46 L80 50 L58 54 L50 76 L42 54 L20 50 L42 46Z" fill="${O}" stroke="${C}" stroke-width="2"/>`,
  artifact: `<path d="M50 22 L74 38 V62 L50 78 L26 62 V38Z" fill="none" stroke="${A}" stroke-width="5"/>`,
  intangible: `<path d="M32 76 V36 C32 18 68 18 68 36 V76 L60 68 L52 76 L44 68 L36 76Z" fill="#2a2a3a" stroke="${C}" stroke-width="3" opacity="0.8"/>`,
  focus: `<circle cx="50" cy="50" r="10" fill="${A}"/>${rays(50, 50, 16, 30, 8, O, 0.9, 4)}`,
  vulnerable: `<circle cx="50" cy="50" r="24" fill="none" stroke="${O}" stroke-width="5"/><circle cx="50" cy="50" r="10" fill="${E}"/>`,
  weak: `<path d="M34 36 C30 56 44 64 50 76 C56 64 70 56 66 36" stroke="${O}" stroke-width="6" fill="none"/>`,
  frail: `<path d="M50 22 V46 M50 46 L40 56 M50 46 L60 56 M50 56 V78" stroke="${O}" stroke-width="5"/>`,
  poison: `<path d="M50 26 C66 46 70 58 62 70 C56 80 44 80 38 70 C30 58 34 46 50 26Z" fill="#7bbf3a" stroke="${C}" stroke-width="3"/><circle cx="46" cy="60" r="3" fill="#0a0604"/>`,
  entangle: `<path d="M30 40 Q50 60 70 40 M30 56 Q50 76 70 56" stroke="${O}" stroke-width="5" fill="none"/>`,
  strengthDown: `<path d="M30 40 l40 0 M50 40 L50 70 L40 60 M50 70 L60 60" stroke="${O}" stroke-width="6"/>`,
  noBlock: `<path d="M50 22 L76 30 V52 C76 68 64 78 50 82 C36 78 24 68 24 52 V30Z" fill="none" stroke="${O}" stroke-width="4"/><path d="M30 30 L70 74" stroke="${E}" stroke-width="5"/>`,
};
export function powerIcon(key) {
  return S(POWER_SVG[key] || `<circle cx="50" cy="50" r="22" stroke="${O}" stroke-width="5"/>`);
}

/* ============================== POTION ============================== */
export function potionIcon() {
  return S(`<path d="M42 22 H58 V36 L68 64 C72 76 62 84 50 84 C38 84 28 76 32 64 L42 36Z" fill="var(--pcolor,${O})" stroke="${C}" stroke-width="3" opacity="0.92"/><rect x="40" y="18" width="20" height="7" rx="2" fill="${C}"/><ellipse cx="50" cy="64" rx="14" ry="8" fill="rgba(255,255,255,0.25)"/>`);
}

/* ============================== RELICS ============================== */
const RELIC_SVG = {
  ancestral_cuirass: `<path d="M30 30 H70 L64 76 H36Z" fill="#16100b" stroke="${O}" stroke-width="4"/><path d="M50 34 V72 M38 44 H62" stroke="${A}" stroke-width="3"/>`,
  griot_drum: `<ellipse cx="50" cy="36" rx="22" ry="8" fill="none" stroke="${O}" stroke-width="4"/><path d="M28 36 V62 C28 70 72 70 72 62 V36" stroke="${O}" stroke-width="4" fill="none"/><path d="M30 40 L70 60 M70 40 L30 60" stroke="${A}" stroke-width="2"/>`,
  star_lens: `${rings(50, 50, 2, 12, O, 0.6)}<circle cx="50" cy="50" r="10" fill="${A}"/><circle cx="50" cy="50" r="26" stroke="${O}" stroke-width="4"/>`,
  default: `<circle cx="50" cy="50" r="26" fill="#16100b" stroke="${O}" stroke-width="4"/>${orbitDots(50, 50, 26, 6, 2.5, A)}<circle cx="50" cy="50" r="9" fill="${A}"/>`,
  cowrie_purse: `<ellipse cx="50" cy="54" rx="24" ry="20" fill="#16100b" stroke="${O}" stroke-width="4"/><path d="M50 40 V68 M42 48 q8 6 0 12 M58 48 q-8 6 0 12" stroke="${A}" stroke-width="3"/>`,
  sun_disk: `${rays(50, 50, 18, 32, 12, O, 0.9, 3)}<circle cx="50" cy="50" r="16" fill="${A}" stroke="${C}" stroke-width="2"/>`,
  mask_of_masks: `<path d="M34 28 H66 C70 48 62 78 50 78 C38 78 30 48 34 28Z" fill="#16100b" stroke="${O}" stroke-width="4"/><circle cx="42" cy="46" r="4" fill="${A}"/><circle cx="58" cy="46" r="4" fill="${A}"/><path d="M44 62 H56" stroke="${A}" stroke-width="3"/>`,
  eternal_flame: `<path d="M50 22 C62 42 76 48 66 66 C60 78 40 78 34 66 C26 50 40 44 50 22Z" fill="${E}" stroke="${A}" stroke-width="3"/>`,
  ascendant_crown: `<path d="M28 64 L34 36 L44 52 L50 32 L56 52 L66 36 L72 64Z" fill="${A}" stroke="${C}" stroke-width="3"/><circle cx="50" cy="30" r="3" fill="${C}"/>`,
  heart_of_nyumbani: `<path d="M50 78 C18 55 22 28 40 28 C49 28 50 38 50 38 C50 38 51 28 60 28 C78 28 82 55 50 78Z" fill="${E}" stroke="${A}" stroke-width="3"/>`,
};
export function relicIcon(id) { return S(RELIC_SVG[id] || RELIC_SVG.default); }

/* ============================== CARD ART MOTIFS ============================== */
const M = {
  blade: `<path d="M30 72 L66 30 L72 28 L70 34 L34 76 Z" fill="${A}" stroke="${C}" stroke-width="2"/><path d="M28 70 L34 76 L26 78Z" fill="${O}"/>`,
  hammer: `<rect x="36" y="24" width="28" height="18" rx="3" fill="${A}" stroke="${C}" stroke-width="2"/><rect x="46" y="40" width="8" height="38" fill="${O}"/>`,
  twin: `<path d="M30 74 L58 34 M70 74 L42 34" stroke="${A}" stroke-width="6"/><path d="M58 34 L62 28 M42 34 L38 28" stroke="${O}" stroke-width="6"/>`,
  shield: `<path d="M50 22 L76 32 V54 C76 70 64 80 50 84 C36 80 24 70 24 54 V32Z" fill="#16100b" stroke="${A}" stroke-width="4"/><path d="M50 34 V74" stroke="${O}" stroke-width="3" opacity="0.8"/>`,
  wave: `<path d="M22 56 q10 -22 20 0 t20 0 t20 0" stroke="${A}" stroke-width="6" fill="none"/><path d="M22 66 q14 -10 28 0 t28 0" stroke="${O}" stroke-width="3" opacity="0.7" fill="none"/>`,
  burst: `${rays(50, 52, 12, 34, 14, O, 0.9, 3)}<circle cx="50" cy="52" r="9" fill="${A}"/>`,
  reticle: `<circle cx="50" cy="52" r="22" stroke="${O}" stroke-width="4"/><circle cx="50" cy="52" r="6" fill="${E}"/><path d="M50 22 V34 M50 70 V82 M20 52 H32 M68 52 H80" stroke="${A}" stroke-width="3"/>`,
  note: `<circle cx="40" cy="68" r="10" fill="${A}" stroke="${C}" stroke-width="2"/><path d="M50 66 V28 L70 34 V40 L50 34" fill="${O}" stroke="${C}" stroke-width="2"/>`,
  poison: `<path d="M50 24 C68 48 72 60 62 72 C55 81 45 81 38 72 C28 60 32 48 50 24Z" fill="#7bbf3a" stroke="${A}" stroke-width="2"/><circle cx="45" cy="60" r="4" fill="#0a0604"/>`,
  cards: `<rect x="30" y="34" width="26" height="38" rx="3" transform="rotate(-12 43 53)" fill="#16100b" stroke="${O}" stroke-width="3"/><rect x="44" y="32" width="26" height="38" rx="3" transform="rotate(8 57 51)" fill="#16100b" stroke="${A}" stroke-width="3"/>`,
  fist: `<path d="M34 50 q-6 -10 4 -12 l16 -2 q6 -12 14 -8 q8 6 2 16 q8 4 4 14 q-4 10 -16 8 l-18 -2 q-12 -2 -10 -12Z" fill="${O}" stroke="${C}" stroke-width="2"/>`,
  blood: `<path d="M50 22 C64 44 70 58 60 70 C54 79 46 79 40 70 C30 58 36 44 50 22Z" fill="${E}" stroke="${A}" stroke-width="2"/>`,
  crescent: `<path d="M64 26 C40 30 36 70 60 76 C40 84 22 64 26 46 C30 30 46 24 64 26Z" fill="#2a1a40" stroke="${A}" stroke-width="3"/>${orbitDots(50, 50, 30, 4, 2, O)}`,
  orbStorm: `${rays(50, 50, 14, 30, 10, A, 0.8, 3)}<circle cx="50" cy="50" r="14" fill="${A}"/><path d="M52 40 L44 54 H52 L48 64 L58 48 H50Z" fill="#0a0604"/>`,
  orbTide: `<circle cx="50" cy="50" r="22" fill="#1a3a5a" stroke="#7ad0ff" stroke-width="3"/><path d="M32 50 q9 -14 18 0 t18 0" stroke="#bfeaff" stroke-width="3" fill="none"/>`,
  orbShade: `<circle cx="50" cy="50" r="22" fill="#1a0e22" stroke="${A}" stroke-width="3"/><path d="M58 38 A18 18 0 1 0 58 62 A13 13 0 1 1 58 38Z" fill="${A}"/>`,
  orbSun: `${rays(50, 50, 16, 32, 12, O, 1, 3)}<circle cx="50" cy="50" r="15" fill="${E}" stroke="${A}" stroke-width="2"/>`,
  eye: `<path d="M22 50 C36 32 64 32 78 50 C64 68 36 68 22 50Z" fill="#16100b" stroke="${O}" stroke-width="4"/><circle cx="50" cy="50" r="9" fill="${A}"/><circle cx="50" cy="50" r="3" fill="#0a0604"/>`,
  evoke: `${rings(50, 50, 3, 10, O, 0.7)}<circle cx="50" cy="50" r="7" fill="${A}"/>`,
  brokenBlade: `<path d="M34 72 L48 52 M54 44 L66 28 L70 26 L68 32 L58 46" stroke="${A}" stroke-width="5"/><path d="M30 70 L36 76 L28 78Z" fill="${O}"/>`,
  ascend: `<path d="M50 24 L58 44 L80 46 L62 60 L68 82 L50 68 L32 82 L38 60 L20 46 L42 44Z" fill="none" stroke="${A}" stroke-width="4"/><path d="M50 40 V60 M42 50 H58" stroke="${O}" stroke-width="3"/>`,
  curse: `<circle cx="50" cy="50" r="26" fill="#120a14" stroke="#6a4a8a" stroke-width="4"/><path d="M38 44 L46 50 L38 56 M62 44 L54 50 L62 56 M42 66 H58" stroke="#a98fcf" stroke-width="3"/>`,
  glitch: `<path d="M28 40 H58 L50 50 H72 L40 70 L48 56 H30Z" fill="${O}" stroke="${A}" stroke-width="2"/>`,
};
const CARD_MOTIF = {
  // Amara
  slash: 'blade', brace: 'shield', sunder: 'reticle', twin_fangs: 'twin', ironwave: 'wave', pommel: 'cards',
  cleave: 'burst', crosscut: 'reticle', shrug: 'cards', thunderclap: 'burst', rising_strike: 'reticle',
  war_trance: 'cards', ember_within: 'fist', bulwark: 'shield', read_tell: 'eye', shockwave: 'burst',
  disarm: 'brokenBlade', whirlwind: 'burst', ancestral_fury: 'fist', blood_offering: 'blood', devour: 'blood',
  harvest: 'blood', skyfall: 'hammer',
  // Kofi
  jab: 'blade', refrain: 'shield', cutting_verse: 'note', blight_needle: 'poison', quickstep: 'cards',
  double_tap: 'twin', crescendo: 'note', deflect: 'shield', shard_burst: 'burst', backbeat: 'note',
  venom_chorus: 'poison', syncopation: 'note', accelerando: 'evoke', catalyst: 'poison', bouncing_verse: 'note',
  veil: 'crescent', blight_bloom: 'poison', the_long_song: 'note', grand_finale: 'burst',
  // Zara
  pulse: 'burst', barrier: 'shield', channel_storm: 'orbStorm', resonate: 'evoke', static_burst: 'orbStorm',
  frostbind: 'orbTide', coolhead: 'orbTide', capacitor: 'orbSun', chaos: 'evoke', glacier: 'orbTide',
  summon_shade: 'orbShade', attune: 'eye', doomgloom: 'orbShade', skim: 'cards', echocast: 'evoke',
  summon_sun: 'orbSun', overclock: 'eye', stormcall: 'orbStorm', echo_form: 'evoke', falling_star: 'orbStorm',
  // colorless + status/curse
  shiv: 'blade', flash: 'cards', panic_button: 'shield', apotheosis: 'ascend',
  wound: 'glitch', dazed: 'glitch', static_curse: 'curse', regret: 'curse',
};
export function cardArt(id) { return S(M[CARD_MOTIF[id]] || M.burst, { cls: 'card-art-svg' }); }

/* ============================== CHARACTER MODELS ============================== */
// Each model fills the medallion core; figure in cream/orange line-art on the
// disc, with looping CSS-driven motion. Built to read at small sizes.

// Champions — detailed, shaded full-figure portraits (viewBox 0 0 100 110, the
// figure rises from the disc). Layered fills give woodcut depth; CSS classes
// animate sub-parts. DK = darkest base, MD = mid shade.
const DK = '#1c0f06', MD = '#3a1d0a', DKv = '#160c22';
const CHARVB = '0 0 100 112';

const CHAR = {
  // Amara — Agojie bladedancer: crowned warrior, cowrie collar, kente robe, crossed star-iron blades.
  amara: S(`
    <defs></defs>
    <g class="m-spin" opacity="0.5">${rays(50, 50, 30, 50, 20, O, 0.45, 1.6)}</g>
    <g class="m-gleam">
      <path d="M20 96 L48 50 L51 52 L26 100Z" fill="${MD}" stroke="${C}" stroke-width="1.4"/><path d="M48 50 l5 -5 1 7 -4 3Z" fill="${A}" stroke="${C}" stroke-width="1"/>
      <path d="M80 96 L52 50 L49 52 L74 100Z" fill="${MD}" stroke="${A}" stroke-width="1.4"/><path d="M52 50 l-5 -5 -1 7 4 3Z" fill="${O}" stroke="${C}" stroke-width="1"/>
    </g>
    <g class="m-breathe">
      <!-- robe with kente bands -->
      <path d="M26 108 L31 64 Q50 55 69 64 L74 108Z" fill="${DK}" stroke="${O}" stroke-width="2.4"/>
      <path d="M40 63 V108 M50 60 V108 M60 63 V108" stroke="${A}" stroke-width="1.3" opacity="0.65"/>
      <path d="M31 78 H69 M30 92 H70" stroke="${E}" stroke-width="1.6" opacity="0.6"/>
      <!-- shoulder armor -->
      <path d="M28 66 Q50 52 72 66 L67 60 Q50 49 33 60Z" fill="${E}" stroke="${A}" stroke-width="1.4"/>
      <!-- cowrie collar + neck -->
      <path d="M45 55 H55 L53 61 H47Z" fill="${DK}" stroke="${O}" stroke-width="1.8"/>
      <path d="M37 56 Q50 64 63 56" fill="none" stroke="${A}" stroke-width="2"/>
      <circle cx="42" cy="57" r="1.4" fill="${A}"/><circle cx="50" cy="59" r="1.4" fill="${A}"/><circle cx="58" cy="57" r="1.4" fill="${A}"/>
      <!-- head, side-shaded -->
      <ellipse cx="50" cy="40" rx="10.5" ry="12" fill="${DK}" stroke="${O}" stroke-width="2.4"/>
      <path d="M50 28 a10.5 12 0 0 0 0 24Z" fill="#000" opacity="0.28"/>
      <!-- crown / headwrap with rays -->
      <path d="M38 33 Q50 21 62 33 L59 29 Q50 23 41 29Z" fill="${E}" stroke="${A}" stroke-width="1.4"/>
      <path d="M50 22 V13 M43 24 L39 16 M57 24 L61 16" stroke="${A}" stroke-width="2"/><circle cx="50" cy="12" r="2.2" fill="${A}"/>
      <!-- face: eyes + markings -->
      <path d="M44 38 h4 M52 38 h4" stroke="${A}" stroke-width="1.8"/>
      <path d="M50 41 V45 M45 46 Q50 50 55 46" stroke="${A}" stroke-width="1.2" fill="none"/>
      <path d="M41 35 l-2 -3 M59 35 l2 -3" stroke="${A}" stroke-width="1"/>
      <circle cx="38" cy="45" r="2.2" fill="none" stroke="${A}" stroke-width="1.4"/><circle cx="62" cy="45" r="2.2" fill="none" stroke="${A}" stroke-width="1.4"/>
    </g>`, { vb: CHARVB }),

  // Kofi — griot of the cosmos: robed bard cradling a great kora, notes rising.
  kofi: S(`
    <g class="m-notes" opacity="0.9"><path d="M72 30 V12 L82 15 V20 L72 17" fill="${A}"/><circle cx="70" cy="30" r="2.6" fill="${A}"/><circle cx="80" cy="20" r="2" fill="${O}"/></g>
    <g class="m-breathe">
      <!-- robe -->
      <path d="M27 108 L32 62 Q50 54 68 62 L73 108Z" fill="${DK}" stroke="${O}" stroke-width="2.4"/>
      <path d="M44 62 L42 108 M58 62 L60 108" stroke="${A}" stroke-width="1.3" opacity="0.6"/>
      <path d="M32 80 H68 M31 94 H69" stroke="${E}" stroke-width="1.4" opacity="0.55"/>
      <!-- head + short locs -->
      <ellipse cx="44" cy="38" rx="9.5" ry="11" fill="${DK}" stroke="${O}" stroke-width="2.4"/>
      <path d="M44 28 a9.5 11 0 0 0 0 22Z" fill="#000" opacity="0.26"/>
      <path d="M35 33 q9 -11 18 0 M37 30 v-4 M42 27 v-4 M47 27 v-4 M52 29 v-4" stroke="${A}" stroke-width="1.5"/>
      <path d="M40 39 h3 M48 39 h3" stroke="${A}" stroke-width="1.6"/>
      <path d="M44 41 v3 M41 46 q3 3 6 0" stroke="${A}" stroke-width="1.1" fill="none"/>
      <!-- kora: resonator gourd, neck, bridge, many strings -->
      <ellipse cx="43" cy="66" rx="16" ry="18" fill="${DKv}" stroke="${A}" stroke-width="2.4"/>
      <ellipse cx="43" cy="66" rx="8.5" ry="9.5" fill="none" stroke="${O}" stroke-width="1.5"/>
      <circle cx="43" cy="66" r="2.2" fill="${O}"/>
      <line x1="43" y1="48" x2="43" y2="84" stroke="${O}" stroke-width="2.4"/>
      <path d="M48 50 L80 16" stroke="${O}" stroke-width="3"/>
      <g class="m-strings"><path d="M38 50 L70 16 M42 50 L74 16 M46 50 L78 16" stroke="${A}" stroke-width="0.7"/></g>
      <circle cx="80" cy="16" r="2.6" fill="${A}"/>
    </g>`, { vb: CHARVB }),

  // Zara — star-weaver: robed channeler, star diadem, raised hands, orbiting spirit-orbs.
  zara: S(`
    <circle cx="50" cy="42" r="27" fill="none" stroke="${O}" stroke-width="1.4" opacity="0.5" class="m-spin"/>
    <g class="m-orbit"><circle cx="82" cy="42" r="4" fill="${A}"/><circle cx="18" cy="42" r="3" fill="${O}"/><circle cx="50" cy="73" r="3.4" fill="${E}"/></g>
    <g class="m-breathe">
      <!-- robe -->
      <path d="M27 108 L31 60 Q50 52 69 60 L73 108Z" fill="${DKv}" stroke="${O}" stroke-width="2.4"/>
      <path d="M50 60 V108" stroke="${A}" stroke-width="1.2" opacity="0.5"/>
      <path d="M38 74 L50 67 L62 74" fill="none" stroke="${A}" stroke-width="1.4" opacity="0.6"/>
      <path d="M34 88 H66" stroke="${E}" stroke-width="1.4" opacity="0.5"/>
      <!-- channeling arms -->
      <path d="M33 64 Q22 52 25 40 M67 64 Q78 52 75 40" stroke="${O}" stroke-width="2.4" fill="none"/>
      <circle cx="25" cy="39" r="2.4" fill="${A}"/><circle cx="75" cy="39" r="2.4" fill="${A}"/>
      <!-- head + star diadem -->
      <ellipse cx="50" cy="40" rx="9.5" ry="11" fill="${DKv}" stroke="${A}" stroke-width="2.4"/>
      <path d="M50 40 a9.5 11 0 0 0 0 22" fill="#000" opacity="0.24"/>
      <path d="M50 28 l2.2 -7 2.2 7Z M50 28 l-2.2 -7 -2.2 7Z" fill="${A}"/>
      <circle cx="50" cy="17" r="2.4" fill="${A}"/>
      <path d="M45 39 h3 M52 39 h3" stroke="${A}" stroke-width="1.6"/>
      <path d="M46 46 q4 4 8 0" stroke="${A}" stroke-width="1.2" fill="none"/>
    </g>`, { vb: CHARVB }),
};

/* ============================== ENEMY MODELS ============================== */
const ENE = {
  // Act 1
  husk_drone: S(`
    <g class="m-spin" opacity="0.55">${orbitDots(50, 48, 32, 6, 2, O)}</g>
    <g class="m-bob">
      <polygon points="50,22 74,46 50,60 26,46" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <polygon points="50,22 74,46 50,46" fill="#000" opacity="0.3"/>
      <polygon points="50,30 64,46 50,54 36,46" fill="none" stroke="${A}" stroke-width="1.4"/>
      <circle cx="50" cy="46" r="8" fill="${E}"/><circle cx="50" cy="46" r="3" fill="${A}"/>
      <path d="M30 60 L50 68 L70 60" stroke="${O}" stroke-width="2.6" fill="none"/>
      <path d="M38 64 L50 60 L62 64" stroke="${A}" stroke-width="1.4" fill="none"/>
    </g>`),
  static_jackal: S(`
    <g class="m-flicker">
      <path d="M24 76 L33 44 L27 28 L43 39 L57 39 L73 28 L67 44 L76 76Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M24 76 L33 44 L50 50 L50 76Z" fill="#000" opacity="0.28"/>
      <path d="M33 44 L43 39 L40 49Z M67 44 L57 39 L60 49Z" fill="${MD}"/>
      <path d="M38 53 L46 57 L38 61 M62 53 L54 57 L62 61" stroke="${E}" stroke-width="3" fill="none"/>
      <path d="M43 69 H57 M46 65 L50 68 L54 65" stroke="${A}" stroke-width="2.2" fill="none"/>
    </g>`),
  brass_sentinel: S(`
    <g class="m-breathe">
      <rect x="31" y="42" width="38" height="40" rx="4" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <rect x="31" y="42" width="19" height="40" fill="#000" opacity="0.26"/>
      <rect x="37" y="24" width="26" height="22" rx="4" fill="${DK}" stroke="${A}" stroke-width="2.4"/>
      <path d="M43 35 H57" stroke="${E}" stroke-width="4"/>
      <path d="M37 52 H63 M37 60 H63" stroke="${A}" stroke-width="1.4" opacity="0.6"/>
      <circle cx="50" cy="70" r="6.5" fill="none" stroke="${A}" stroke-width="2.6"/><circle cx="50" cy="70" r="2" fill="${O}"/>
      <rect x="44" y="18" width="12" height="6" fill="${MD}" stroke="${A}" stroke-width="1.2"/>
    </g>`),
  market_thief: S(`
    <g class="m-shift">
      <path d="M33 82 C33 52 67 52 67 82Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M33 82 C33 52 50 52 50 52 L50 82Z" fill="#000" opacity="0.26"/>
      <path d="M38 46 C38 26 62 26 62 46 L57 52 H43Z" fill="${DK}" stroke="${A}" stroke-width="2.4"/>
      <path d="M44 45 h4 M52 45 h4" stroke="${E}" stroke-width="2.4"/>
      <circle cx="71" cy="64" r="6.5" fill="${A}" stroke="${C}" stroke-width="1.4"/><path d="M68 61 q6 3 0 6" stroke="#6a3a10" stroke-width="1.6" fill="none"/>
    </g>`),
  gilded_warden: S(`
    <g class="m-spin" opacity="0.55">${rays(50, 46, 22, 40, 18, A, 0.6, 2)}</g>
    <g class="m-breathe">
      <path d="M28 84 L40 50 H60 L72 84Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M28 84 L40 50 H50 L50 84Z" fill="#000" opacity="0.26"/>
      <path d="M35 48 C35 24 65 24 65 48Z" fill="${DK}" stroke="${A}" stroke-width="2.6"/>
      <path d="M43 40 H57 M50 30 V46" stroke="${E}" stroke-width="3"/>
      <path d="M40 56 H60 M38 66 H62" stroke="${A}" stroke-width="1.4" opacity="0.6"/>
      <circle cx="50" cy="20" r="2.4" fill="${A}"/>
    </g>`),
  the_gatekeeper: S(`
    <g class="m-spin" opacity="0.45">${rings(50, 44, 3, 14, A, 0.45)}</g>
    <g class="m-breathe">
      <path d="M22 84 V42 H78 V84 M22 42 L17 32 H83 L78 42" stroke="${O}" stroke-width="3" fill="${DK}"/>
      <path d="M33 84 V54 H44 V84 M56 84 V54 H67 V84" fill="#000" stroke="${A}" stroke-width="2"/>
      <circle cx="50" cy="42" r="9" fill="#000" stroke="${E}" stroke-width="3"/><circle cx="50" cy="42" r="3.4" fill="${A}"/>
      <path d="M17 32 L50 22 L83 32" fill="none" stroke="${A}" stroke-width="2"/>
    </g>`),
  // Act 2
  sand_wraith: S(`
    <g class="m-drift">
      <path d="M50 22 C72 22 76 46 71 61 C67 76 56 71 50 84 C44 71 33 76 29 61 C24 46 28 22 50 22Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M50 22 C39 22 31 34 30 50 L50 50Z" fill="#000" opacity="0.26"/>
      <path d="M22 50 C36 35 64 35 78 50 C64 63 36 63 22 50Z" fill="${MD}" stroke="${A}" stroke-width="2"/>
      <circle cx="50" cy="50" r="8" fill="${E}"/><circle cx="50" cy="50" r="3" fill="${A}"/>
      <path d="M34 70 q16 10 32 0" stroke="${A}" stroke-width="1.4" fill="none" opacity="0.6"/>
    </g>`),
  mirror_shade: S(`
    <g class="m-flicker">
      <path d="M50 18 L76 50 L50 82 L24 50Z" fill="${DK}" stroke="${A}" stroke-width="2.6"/>
      <path d="M50 18 L50 82 L24 50Z" fill="#000" opacity="0.3"/>
      <path d="M50 18 L76 50 M24 50 H76" stroke="${O}" stroke-width="1.6" opacity="0.7"/>
      <circle cx="50" cy="50" r="6.5" fill="${E}"/><circle cx="50" cy="50" r="2.2" fill="${A}"/>
      <path d="M38 36 L46 44 M62 36 L54 44" stroke="${A}" stroke-width="1.2"/>
    </g>`),
  chrome_serpent: S(`
    <g class="m-coil">
      <path d="M24 72 q14 -22 25 -3 q11 19 27 -7" stroke="${O}" stroke-width="7" fill="none"/>
      <path d="M24 72 q14 -22 25 -3 q11 19 27 -7" stroke="${A}" stroke-width="2" fill="none" opacity="0.6"/>
      <path d="M76 62 l9 -5 -3 9Z" fill="${E}" stroke="${A}" stroke-width="1"/>
      <circle cx="28" cy="68" r="3.2" fill="${E}"/>
      <path d="M40 60 l3 3 M54 56 l3 3" stroke="${A}" stroke-width="1.4"/>
    </g>`),
  brass_colossus: S(`
    <g class="m-breathe">
      <rect x="18" y="46" width="9" height="30" rx="2" fill="${MD}" stroke="${O}" stroke-width="1.6"/>
      <rect x="73" y="46" width="9" height="30" rx="2" fill="${MD}" stroke="${O}" stroke-width="1.6"/>
      <rect x="27" y="42" width="46" height="42" rx="4" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <rect x="27" y="42" width="23" height="42" fill="#000" opacity="0.26"/>
      <rect x="39" y="22" width="22" height="22" rx="4" fill="${DK}" stroke="${A}" stroke-width="2.4"/>
      <path d="M44 33 H56" stroke="${E}" stroke-width="4.5"/>
      <circle cx="50" cy="62" r="8" fill="none" stroke="${A}" stroke-width="2.6"/><circle cx="50" cy="62" r="2.6" fill="${O}"/>
      <path d="M34 50 H40 M60 50 H66" stroke="${A}" stroke-width="1.6" opacity="0.6"/>
    </g>`),
  the_archivist: S(`
    <g class="m-spin" opacity="0.45">${rings(50, 50, 3, 13, A, 0.45)}</g>
    <g class="m-breathe">
      <path d="M28 72 L28 34 L50 43 L72 34 L72 72 L50 80Z" fill="${DKv}" stroke="${O}" stroke-width="2.6"/>
      <path d="M28 34 L50 43 L50 80 L28 72Z" fill="#000" opacity="0.28"/>
      <line x1="50" y1="43" x2="50" y2="80" stroke="${A}" stroke-width="2"/>
      <path d="M34 50 L46 54 M66 50 L54 54" stroke="${A}" stroke-width="1.2" opacity="0.6"/>
      <circle cx="40" cy="58" r="3.2" fill="${E}"/><circle cx="60" cy="58" r="3.2" fill="${E}"/>
    </g>`),
  // Act 3
  void_chanter: S(`
    <circle cx="50" cy="40" r="11" fill="#000" stroke="${E}" stroke-width="3" class="m-pulse"/>
    <g class="m-drift">
      <path d="M31 84 C29 52 71 52 69 84Z" fill="${DKv}" stroke="${O}" stroke-width="2.6"/>
      <path d="M31 84 C30 56 50 53 50 53 L50 84Z" fill="#000" opacity="0.3"/>
      <path d="M37 50 C37 26 63 26 63 50 L57 56 H43Z" fill="${DKv}" stroke="${A}" stroke-width="2.4"/>
      <path d="M44 60 q6 5 12 0" stroke="${E}" stroke-width="1.6" fill="none"/>
    </g>`),
  static_seraph: S(`
    <g class="m-spin" opacity="0.6">${rays(50, 42, 12, 32, 18, A, 0.7, 2)}</g>
    <g class="m-breathe">
      <path d="M18 52 Q42 38 36 64 Q30 54 18 52Z M82 52 Q58 38 64 64 Q70 54 82 52Z" fill="${MD}" stroke="${A}" stroke-width="1.8"/>
      <path d="M40 82 C40 58 60 58 60 82Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <circle cx="50" cy="44" r="10" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <circle cx="50" cy="26" r="9" fill="none" stroke="${A}" stroke-width="2"/>
      <path d="M45 43 h3 M52 43 h3" stroke="${E}" stroke-width="2"/>
    </g>`),
  chrome_archon: S(`
    <g class="m-spin" opacity="0.55">${orbitDots(50, 50, 35, 8, 3, E)}</g>
    <g class="m-breathe">
      <polygon points="50,22 75,39 75,65 50,82 25,65 25,39" fill="${DKv}" stroke="${O}" stroke-width="2.6"/>
      <polygon points="50,22 75,39 75,65 50,82" fill="#000" opacity="0.26"/>
      <polygon points="50,32 65,42 65,60 50,70 35,60 35,42" fill="none" stroke="${A}" stroke-width="1.4"/>
      <circle cx="42" cy="48" r="3.4" fill="${E}"/><circle cx="58" cy="48" r="3.4" fill="${E}"/><circle cx="50" cy="62" r="3.4" fill="${A}"/>
    </g>`),
  heart_of_static: S(`
    <g class="m-spin">${rays(50, 50, 26, 46, 24, O, 0.5, 2)}</g>
    <g class="m-spin-rev" opacity="0.7">${rings(50, 50, 3, 13, A, 0.55)}</g>
    <g class="m-pulse">
      <circle cx="50" cy="50" r="22" fill="#0a0403" stroke="${E}" stroke-width="4"/>
      <circle cx="50" cy="50" r="22" fill="none" stroke="${A}" stroke-width="1" opacity="0.6"/>
      <path d="M50 32 C62 44 62 44 50 50 C38 56 38 56 50 68" stroke="${A}" stroke-width="3" fill="none"/>
      <circle cx="50" cy="50" r="6.5" fill="${O}"/><circle cx="50" cy="50" r="2.6" fill="${C}"/>
    </g>`),
};

const GENERIC_ENEMY = S(`<g class="m-bob"><polygon points="50,26 72,48 50,74 28,48" fill="${DK}" stroke="${O}" stroke-width="2.6"/><circle cx="50" cy="48" r="7" fill="${E}"/><circle cx="50" cy="48" r="2.6" fill="${A}"/></g>`);

export function characterModel(id) { return CHAR[id] || CHAR.amara; }
export function enemyModel(id) { return ENE[id] || GENERIC_ENEMY; }
export function combatModel(ent, charId) { return ent.isPlayer ? characterModel(charId) : enemyModel(ent.id); }

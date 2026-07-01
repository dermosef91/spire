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
  drawStack: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115 135" class="svg-ic" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="12" width="68" height="100" rx="5" fill="#0c0806" stroke="#5c544a" stroke-width="1.5" opacity="0.4" transform="rotate(-10 46 62)"/><rect x="17" y="15" width="68" height="100" rx="5" fill="#0d0805" stroke="#7e746a" stroke-width="1.8" opacity="0.8" transform="rotate(-7 51 65)"/><g transform="rotate(-4 56 68)"><rect x="22" y="18" width="68" height="100" rx="5" fill="#0f0906" stroke="#dcd4cc" stroke-width="2"/><rect x="26" y="22" width="60" height="92" rx="3.5" stroke="#ffab47" stroke-width="0.8" opacity="0.3"/><path d="M 28 28 L 28 24 L 32 24" stroke="#ffab47" stroke-width="1"/><path d="M 84 28 L 84 24 L 80 24" stroke="#ffab47" stroke-width="1"/><path d="M 28 104 L 28 108 L 32 108" stroke="#ffab47" stroke-width="1"/><path d="M 84 104 L 84 108 L 80 108" stroke="#ffab47" stroke-width="1"/><line x1="29" y1="68" x2="83" y2="68" stroke="#dcd4cc" stroke-width="0.8" opacity="0.5"/><line x1="56" y1="36" x2="56" y2="100" stroke="#dcd4cc" stroke-width="0.8" opacity="0.5"/><circle cx="29" cy="68" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="83" cy="68" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="56" cy="36" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="56" cy="100" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="56" cy="68" r="22" stroke="#dcd4cc" stroke-width="1.2"/><circle cx="56" cy="68" r="17" stroke="#ffab47" stroke-width="0.8" stroke-dasharray="1 2"/><circle cx="56" cy="68" r="13" stroke="#ff6a1a" stroke-width="2"/><circle cx="56" cy="68" r="8" stroke="#ffab47" stroke-width="1" fill="#130b07"/><circle cx="56" cy="68" r="3" fill="#ffab47"/></g></svg>`,
  discardStack: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115 135" class="svg-ic" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="32" y="12" width="68" height="100" rx="5" fill="#0c0806" stroke="#5c544a" stroke-width="1.5" opacity="0.4" transform="rotate(8 66 62)"/><rect x="27" y="15" width="68" height="100" rx="5" fill="#0d0805" stroke="#7e746a" stroke-width="1.8" opacity="0.8" transform="rotate(4 61 65)"/><g transform="rotate(-4 56 68)"><rect x="22" y="18" width="68" height="100" rx="5" fill="#0f0906" stroke="#dcd4cc" stroke-width="2"/><rect x="26" y="22" width="60" height="92" rx="3.5" stroke="#ffab47" stroke-width="0.8" opacity="0.3"/><path d="M 28 28 L 28 24 L 32 24" stroke="#ffab47" stroke-width="1"/><path d="M 84 28 L 84 24 L 80 24" stroke="#ffab47" stroke-width="1"/><path d="M 28 104 L 28 108 L 32 108" stroke="#ffab47" stroke-width="1"/><path d="M 84 104 L 84 108 L 80 108" stroke="#ffab47" stroke-width="1"/><line x1="29" y1="68" x2="83" y2="68" stroke="#dcd4cc" stroke-width="0.8" opacity="0.5"/><line x1="56" y1="36" x2="56" y2="100" stroke="#dcd4cc" stroke-width="0.8" opacity="0.5"/><circle cx="29" cy="68" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="83" cy="68" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="56" cy="36" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="56" cy="100" r="1" fill="#dcd4cc" opacity="0.8"/><circle cx="56" cy="68" r="22" stroke="#dcd4cc" stroke-width="1.2"/><circle cx="56" cy="68" r="17" stroke="#ffab47" stroke-width="0.8" stroke-dasharray="1 2"/><circle cx="56" cy="68" r="13" stroke="#ff6a1a" stroke-width="2"/><circle cx="56" cy="68" r="8" stroke="#ffab47" stroke-width="1" fill="#130b07"/><circle cx="56" cy="68" r="3" fill="#ffab47"/></g></svg>`,
  exhaustStack: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115 135" class="svg-ic" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="32" y="12" width="68" height="100" rx="5" fill="#07060b" stroke="#353b50" stroke-width="1.5" opacity="0.3" transform="rotate(8 66 62)"/><rect x="27" y="15" width="68" height="100" rx="5" fill="#07060b" stroke="#4a5270" stroke-width="1.8" opacity="0.6" transform="rotate(4 61 65)"/><g transform="rotate(-4 56 68)"><rect x="22" y="18" width="68" height="100" rx="5" fill="#090710" stroke="#8fa3db" stroke-width="2" opacity="0.9"/><rect x="26" y="22" width="60" height="92" rx="3.5" stroke="#bc8aff" stroke-width="0.8" opacity="0.3"/><path d="M 28 28 L 28 24 L 32 24" stroke="#bc8aff" stroke-width="1"/><path d="M 84 28 L 84 24 L 80 24" stroke="#bc8aff" stroke-width="1"/><path d="M 28 104 L 28 108 L 32 108" stroke="#bc8aff" stroke-width="1"/><path d="M 84 104 L 84 108 L 80 108" stroke="#bc8aff" stroke-width="1"/><path d="M56 36 C66 48 46 52 56 68 C66 84 46 88 56 100" stroke="#8fa3db" stroke-width="2.5" fill="none" opacity="0.75"/><path d="M56 44 C62 52 50 56 56 68 C62 80 50 84 56 92" stroke="#bc8aff" stroke-width="1.5" fill="none" opacity="0.6"/></g></svg>`,
  gear: S(`<circle cx="50" cy="50" r="14" fill="none" stroke="${O}" stroke-width="5"/>${rays(50, 50, 20, 30, 8, O, 1, 6)}`),
  fullscreen: S(`<path d="M28 40 V28 H40 M60 28 H72 V40 M72 60 V72 H60 M40 72 H28 V60" stroke="${O}" stroke-width="5"/>`),
  soundOn: S(`<path d="M36 40 H44 L56 28 V72 L44 60 H36 Z" stroke="${O}" stroke-width="5" fill="none"/><path d="M66 38 A18 18 0 0 1 66 62 M76 30 A30 30 0 0 1 76 70" stroke="${O}" stroke-width="5" fill="none"/>`),
  soundOff: S(`<path d="M36 40 H44 L56 28 V72 L44 60 H36 Z" stroke="${O}" stroke-width="5" fill="none"/><path d="M66 42 L78 58 M78 42 L66 58" stroke="${O}" stroke-width="5" fill="none"/>`),
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
// Carved line-art glyphs themed via the per-node `color` (currentColor) with
// ember/amber accents. Built to read as silhouettes at ~26px on the act map.
export const NODE = {
  // Combat — a fanged spirit-mask: spiked crown, fierce inward eyes, bared teeth.
  monster: S(`
    <path d="M30 30 Q50 23 70 30 Q73 46 64 62 Q56 80 50 82 Q44 80 36 62 Q27 46 30 30Z" fill="#16100b" stroke="currentColor" stroke-width="5"/>
    <path d="M36 30 V22 M50 28 V19 M64 30 V22" stroke="currentColor" stroke-width="2.6"/>
    <path d="M36 44 L47 47 L36 51 M64 44 L53 47 L64 51" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M50 52 V58" stroke="currentColor" stroke-width="2.6"/>
    <path d="M41 64 L45 71 L50 64 L55 71 L59 64" stroke="currentColor" stroke-width="3.4" fill="none"/>`),
  // Elite — a horned demon skull: curved horns, ember eyes, gnashing teeth.
  elite: S(`
    <path d="M31 42 Q22 30 20 22 Q30 26 36 38 M69 42 Q78 30 80 22 Q70 26 64 38" stroke="currentColor" stroke-width="4.5" fill="none"/>
    <path d="M50 28 C34 28 28 42 28 54 C28 62 33 66 35 72 L37 80 H63 L65 72 C67 66 72 62 72 54 C72 42 66 28 50 28Z" fill="#16100b" stroke="currentColor" stroke-width="5"/>
    <path d="M35 52 L46 47 L46 59Z M65 52 L54 47 L54 59Z" fill="${E}" stroke="currentColor" stroke-width="1.5"/>
    <path d="M46 63 L50 69 L54 63" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M43 73 V80 M50 72 V80 M57 73 V80" stroke="currentColor" stroke-width="2.6"/>`),
  // Boss — a crowned, horned warlord skull on a halo of rings.
  boss: S(`
    ${rings(50, 50, 2, 17, 'currentColor', 0.3)}
    <path d="M28 44 Q15 30 12 20 Q26 26 33 40 M72 44 Q85 30 88 20 Q74 26 67 40" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M50 24 L45 11 M50 24 L55 11" stroke="currentColor" stroke-width="3.4"/>
    <path d="M50 26 C31 26 23 42 23 56 C23 66 29 70 31 78 L34 88 H66 L69 78 C71 70 77 66 77 56 C77 42 69 26 50 26Z" fill="#1a0603" stroke="currentColor" stroke-width="5"/>
    <path d="M33 54 L45 48 L45 62Z M67 54 L55 48 L55 62Z" fill="${E}" stroke="currentColor" stroke-width="1.6"/>
    <path d="M45 65 L50 72 L55 65" stroke="currentColor" stroke-width="3" fill="none"/>
    <path d="M41 80 V88 M50 79 V88 M59 80 V88" stroke="currentColor" stroke-width="3"/>`),
  // Unknown event — a glyph-question rising from a spark, with drifting motes.
  event: S(`
    <path d="M39 42 C39 27 65 29 63 44 C61 55 50 54 50 65" stroke="currentColor" stroke-width="8"/>
    <circle cx="50" cy="79" r="5" fill="currentColor"/>
    <path d="M24 30 l2.4 5.4 5.4 2.4 -5.4 2.4 -2.4 5.4 -2.4 -5.4 -5.4 -2.4 5.4 -2.4Z" fill="${A}" opacity="0.85"/>
    <circle cx="74" cy="62" r="2.4" fill="${A}" opacity="0.7"/>`),
  // Bazaar — a striped market awning over a stall counter and a coin.
  shop: S(`
    <path d="M30 40 L34 27 H66 L70 40 Z" fill="#16100b" stroke="currentColor" stroke-width="3.5"/>
    <path d="M42 27 L41 40 M50 27 V40 M58 27 L59 40" stroke="currentColor" stroke-width="2" opacity="0.75"/>
    <path d="M31 40 V74 H69 V40" fill="none" stroke="currentColor" stroke-width="3.4"/>
    <path d="M31 58 H69" stroke="currentColor" stroke-width="2.4" opacity="0.7"/>
    <circle cx="50" cy="65" r="6.5" fill="none" stroke="${A}" stroke-width="3"/>
    <path d="M50 61 V69 M47 63 q3.5 2 0 4" stroke="${A}" stroke-width="2" fill="none"/>`),
  // Ancestor Fire — a campfire flame dancing over crossed logs.
  rest: S(`
    <path d="M50 24 C59 39 71 44 62 61 C58 71 42 71 38 61 C31 47 43 42 50 24Z" fill="${E}" stroke="currentColor" stroke-width="4"/>
    <path d="M50 39 C54 47 59 50 54 60" stroke="${A}" stroke-width="3" fill="none"/>
    <path d="M28 74 L72 66 M28 66 L72 74" stroke="currentColor" stroke-width="4"/>`),
  // Treasure — a banded chest with a glinting lock and a sparkle.
  treasure: S(`
    <path d="M26 44 C26 30 74 30 74 44" fill="#16100b" stroke="currentColor" stroke-width="5"/>
    <rect x="26" y="44" width="48" height="30" rx="3" fill="#16100b" stroke="currentColor" stroke-width="5"/>
    <path d="M26 56 H74" stroke="currentColor" stroke-width="3"/>
    <rect x="44" y="51" width="12" height="13" rx="2.5" fill="${A}" stroke="currentColor" stroke-width="2"/>
    <circle cx="50" cy="56" r="2" fill="#16100b"/><path d="M50 56 V61" stroke="#16100b" stroke-width="1.8"/>
    <path d="M70 33 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8Z" fill="${A}" opacity="0.85"/>`),
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
  invincibility: `<path d="M50 20 L78 32 V54 C78 72 65 82 50 88 C35 82 22 72 22 54 V32Z" fill="none" stroke="${A}" stroke-width="5"/><path d="M50 30 L68 38 V54 C68 66 60 73 50 78 C40 73 32 66 32 54 V38Z" fill="${O}" stroke="${C}" stroke-width="3"/>`,
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

  // ---- Act 1 additions ----
  // Poisoner — a barbed clam with a dripping brine maw.
  reef_spitter: S(`
    <g class="m-breathe">
      <path d="M22 62 Q50 40 78 62 Q64 74 50 74 Q36 74 22 62Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M24 60 Q50 44 76 60" stroke="${A}" stroke-width="1.6" fill="none" opacity="0.7"/>
      <path d="M30 63 L28 55 M40 66 L39 57 M60 66 L61 57 M70 63 L72 55" stroke="${A}" stroke-width="1.6"/>
      <path d="M40 66 Q50 58 60 66 Q50 72 40 66Z" fill="#0a1410" stroke="${E}" stroke-width="2"/>
      <circle cx="50" cy="66" r="2.6" fill="${E}"/>
      <path d="M42 74 q-1 8 0 10 M58 74 q1 8 0 10" stroke="#6ee0a0" stroke-width="2.2" fill="none" opacity="0.8"/>
    </g>`),
  // Support / healer — a robed conch that pours a mending aura.
  tide_priest: S(`
    <g class="m-spin" opacity="0.5">${rings(50, 44, 2, 12, A, 0.4)}</g>
    <g class="m-drift">
      <path d="M32 84 C32 54 68 54 68 84Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M32 84 C32 54 50 54 50 54 L50 84Z" fill="#000" opacity="0.26"/>
      <path d="M40 54 C36 30 64 30 60 54Z" fill="${MD}" stroke="${A}" stroke-width="2.2"/>
      <path d="M44 42 Q50 34 56 42 Q50 50 44 42Z" fill="#0d1a1c" stroke="${E}" stroke-width="1.8"/>
      <circle cx="50" cy="42" r="2.2" fill="${E}"/>
      <path d="M50 22 v6 M44 26 l4 3 M56 26 l-4 3" stroke="#7fe6c0" stroke-width="2" opacity="0.8"/>
    </g>`),
  // Glass cannon — a spark mote crackling with too much charge.
  spark_imp: S(`
    <g class="m-flicker">${rays(50, 52, 12, 24, 8, A, 0.7, 2)}</g>
    <g class="m-bob">
      <path d="M50 32 L60 52 L52 52 L58 70 L40 48 L48 48 Z" fill="${A}" stroke="${C}" stroke-width="2"/>
      <circle cx="50" cy="50" r="12" fill="none" stroke="${O}" stroke-width="2" opacity="0.6"/>
      <circle cx="46" cy="46" r="2" fill="${E}"/><circle cx="55" cy="47" r="2" fill="${E}"/>
    </g>`),
  // Elite charger — a coiled maw ringed with jagged rusted teeth.
  rust_maw: S(`
    <g class="m-breathe">
      <circle cx="50" cy="54" r="26" fill="${DK}" stroke="${O}" stroke-width="2.8"/>
      <circle cx="50" cy="54" r="26" fill="#000" opacity="0.2"/>
      <path d="M28 46 L34 56 L40 46 L46 56 L52 46 L58 56 L64 46 L70 56" stroke="${A}" stroke-width="2.6" fill="none"/>
      <path d="M30 62 L36 52 L42 62 L48 52 L54 62 L60 52 L66 62" stroke="${A}" stroke-width="2.6" fill="none"/>
      <circle cx="50" cy="54" r="7" fill="#180a04" stroke="${E}" stroke-width="2.4"/>
      <circle cx="50" cy="54" r="2.4" fill="${E}"/>
    </g>`),

  // ---- Act 2 additions ----
  // Life-drain — a segmented leech with a barbed sucker.
  ink_leech: S(`
    <g class="m-coil">
      <path d="M28 76 Q26 44 50 40 Q74 36 72 20" fill="none" stroke="${O}" stroke-width="7"/>
      <path d="M28 76 Q26 44 50 40 Q74 36 72 20" fill="none" stroke="${DK}" stroke-width="4"/>
      <circle cx="30" cy="72" r="7" fill="${DKv}" stroke="${E}" stroke-width="2.4"/>
      <circle cx="30" cy="72" r="2.6" fill="${E}"/>
      <path d="M40 58 h6 M44 48 h6 M56 40 h6" stroke="${A}" stroke-width="1.6" opacity="0.7"/>
      <path d="M72 20 l-4 6 h8 Z" fill="${E}"/>
    </g>`),
  // Curse-flooder — a masked scribe unspooling a redacting scroll.
  null_scribe: S(`
    <g class="m-drift">
      <rect x="34" y="26" width="32" height="52" rx="3" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M34 26 q-6 3 0 6 M66 26 q6 3 0 6 M34 72 q-6 3 0 6 M66 72 q6 3 0 6" stroke="${A}" stroke-width="2" fill="none"/>
      <path d="M40 38 H60 M40 46 H60 M40 54 H54" stroke="#000" stroke-width="3" opacity="0.5"/>
      <path d="M40 38 H60 M40 46 H60 M40 54 H54" stroke="${A}" stroke-width="1" opacity="0.6"/>
      <circle cx="50" cy="62" r="6" fill="#0a0810" stroke="${E}" stroke-width="2"/><circle cx="50" cy="62" r="2" fill="${E}"/>
    </g>`),
  // Charger — a hovering rune-star charging to a bright core.
  glyph_sentry: S(`
    <g class="m-spin" opacity="0.6">${rings(50, 50, 2, 16, A, 0.5)}</g>
    <g class="m-pulse">
      <path d="M50 20 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42Z" fill="${DKv}" stroke="${O}" stroke-width="2.6"/>
      <path d="M50 30 L55 46 L70 50 L55 54 L50 70 L45 54 L30 50 L45 46Z" fill="none" stroke="${A}" stroke-width="1.4"/>
      <circle cx="50" cy="50" r="7" fill="#0a0810" stroke="${E}" stroke-width="2.4"/><circle cx="50" cy="50" r="2.6" fill="${E}"/>
    </g>`),
  // Elite berserker — a jagged obsidian void with a gnashing seam.
  obsidian_maw: S(`
    <g class="m-breathe">
      <polygon points="50,18 78,40 70,74 50,84 30,74 22,40" fill="#0d0714" stroke="${O}" stroke-width="2.8"/>
      <polygon points="50,18 78,40 70,74 50,84" fill="#000" opacity="0.32"/>
      <path d="M34 46 L42 54 L34 60 M66 46 L58 54 L66 60" stroke="${E}" stroke-width="3" fill="none"/>
      <path d="M38 68 L44 62 L50 68 L56 62 L62 68" stroke="${A}" stroke-width="2.6" fill="none"/>
      <circle cx="50" cy="40" r="3" fill="${E}"/>
    </g>`),

  // ---- Act 3 additions ----
  // Phaser — a wraith flanked by flickering echoes of itself.
  echo_wraith: S(`
    <g class="m-flicker" opacity="0.35">
      <path d="M40 82 C34 52 66 52 60 82Z" fill="none" stroke="${A}" stroke-width="2" transform="translate(-9 0)"/>
      <path d="M40 82 C34 52 66 52 60 82Z" fill="none" stroke="${A}" stroke-width="2" transform="translate(9 0)"/>
    </g>
    <g class="m-drift">
      <path d="M36 84 C30 50 70 50 64 84Z" fill="${DKv}" stroke="${O}" stroke-width="2.6"/>
      <path d="M36 84 C31 54 50 51 50 51 L50 84Z" fill="#000" opacity="0.3"/>
      <path d="M40 50 C40 28 60 28 60 50 L54 56 H46Z" fill="${DKv}" stroke="${A}" stroke-width="2.2"/>
      <circle cx="45" cy="44" r="2.4" fill="${E}"/><circle cx="55" cy="44" r="2.4" fill="${E}"/>
    </g>`),
  // Support / healer — a candle-crowned cantor pouring a warding light.
  hollow_cantor: S(`
    <g class="m-flicker">${rays(50, 22, 4, 12, 6, A, 0.6, 2)}</g>
    <g class="m-drift">
      <path d="M33 84 C33 52 67 52 67 84Z" fill="${DK}" stroke="${O}" stroke-width="2.6"/>
      <path d="M33 84 C33 52 50 52 50 52 L50 84Z" fill="#000" opacity="0.26"/>
      <rect x="42" y="30" width="16" height="22" rx="3" fill="${MD}" stroke="${A}" stroke-width="2"/>
      <path d="M50 30 Q46 24 50 18 Q54 24 50 30Z" fill="${E}" stroke="${A}" stroke-width="1.4"/>
      <circle cx="46" cy="42" r="2" fill="${E}"/><circle cx="54" cy="42" r="2" fill="${E}"/>
    </g>`),
  // Berserker — a hulking magma golem seamed with fire.
  ember_colossus: S(`
    <g class="m-breathe">
      <path d="M26 84 L32 46 Q50 36 68 46 L74 84Z" fill="#160a06" stroke="${O}" stroke-width="2.8"/>
      <path d="M26 84 L32 46 Q41 41 50 40 L50 84Z" fill="#000" opacity="0.28"/>
      <path d="M40 50 L46 58 L40 64 M60 50 L54 58 L60 64" stroke="${E}" stroke-width="3" fill="none"/>
      <path d="M36 72 Q50 66 64 72" stroke="${E}" stroke-width="2.6" fill="none"/>
      <path d="M44 46 L48 54 L44 60 M56 46 L52 54 L56 60" stroke="${A}" stroke-width="1.4" opacity="0.7"/>
      <path d="M30 40 L36 30 M70 40 L64 30" stroke="${E}" stroke-width="2.4"/>
    </g>`),
  // Swarm — a scattered cluster of charged static shards.
  static_swarm: S(`
    <g class="m-flicker">
      <path d="M50 24 L56 40 L50 46 L44 40Z" fill="${A}" stroke="${C}" stroke-width="1.4"/>
      <path d="M30 44 L38 50 L34 58 L26 54Z" fill="${DK}" stroke="${O}" stroke-width="1.8"/>
      <path d="M70 44 L74 54 L66 58 L62 50Z" fill="${DK}" stroke="${O}" stroke-width="1.8"/>
      <path d="M40 62 L48 66 L44 74 L36 70Z" fill="${DK}" stroke="${A}" stroke-width="1.8"/>
      <path d="M60 62 L66 70 L58 74 L54 66Z" fill="${DK}" stroke="${A}" stroke-width="1.8"/>
      <path d="M50 46 L34 54 M50 46 L66 54 M44 70 L50 60 L58 70" stroke="${E}" stroke-width="1.4" opacity="0.7"/>
      <circle cx="50" cy="52" r="3" fill="${E}"/>
    </g>`),
};

const GENERIC_ENEMY = S(`<g class="m-bob"><polygon points="50,26 72,48 50,74 28,48" fill="${DK}" stroke="${O}" stroke-width="2.6"/><circle cx="50" cy="48" r="7" fill="${E}"/><circle cx="50" cy="48" r="2.6" fill="${A}"/></g>`);

export function characterModel(id) { return CHAR[id] || CHAR.amara; }
export function enemyModel(id) { return ENE[id] || GENERIC_ENEMY; }
export function combatModel(ent, charId) { return ent.isPlayer ? characterModel(charId) : enemyModel(ent.id); }

// Shared UI components: cards, relics, potions, the run top-bar, and tooltips.
import { el } from '../core/util.js';
import { cardDesc } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { POWERS } from '../data/keywords.js';

const TYPE_GLYPH = {
  amara: '⚔️', kofi: '🎶', zara: '✨', colorless: '◈', status: '✖', curse: '☠',
};

// Distinct art per card id for flavor and readability at a glance.
const CARD_ART = {
  // Amara
  slash: '🗡️', brace: '🛡️', sunder: '💥', twin_fangs: '🐅', ironwave: '🌊', pommel: '🤜',
  cleave: '🪓', crosscut: '✖️', shrug: '🤷🏾', thunderclap: '⛈️', rising_strike: '🔺',
  war_trance: '🥁', ember_within: '🔥', bulwark: '🧱', read_tell: '👁️', shockwave: '📳',
  disarm: '🦾', whirlwind: '🌪️', ancestral_fury: '😤', blood_offering: '🩸', devour: '🦷',
  harvest: '🌾', skyfall: '🔨',
  // Kofi
  jab: '👊🏾', refrain: '🎵', cutting_verse: '🎼', blight_needle: '💉', quickstep: '👣',
  double_tap: '🥢', crescendo: '📈', deflect: '🪶', shard_burst: '🔆', backbeat: '🎶',
  venom_chorus: '☣️', syncopation: '🪘', accelerando: '⚡', catalyst: '⚗️', bouncing_verse: '🎯',
  veil: '🌫️', blight_bloom: '🌺', the_long_song: '🎺', grand_finale: '🎆',
  // Zara
  pulse: '🔵', barrier: '🔰', channel_storm: '🌩️', resonate: '📡', static_burst: '⚡',
  frostbind: '❄️', coolhead: '🧊', capacitor: '🔋', chaos: '🎲', glacier: '🏔️',
  summon_shade: '🌑', attune: '🧿', doomgloom: '🌚', skim: '🗂️', echocast: '🔁',
  summon_sun: '☀️', overclock: '⏱️', stormcall: '🌀', echo_form: '♾️', falling_star: '☄️',
  // Colorless / status
  shiv: '🔪', flash: '💡', panic_button: '🚨', apotheosis: '🌟',
  wound: '🩹', dazed: '😵', static_curse: '📺', regret: '😔',
};

export function renderCard(card, opts = {}) {
  const typeClass = `type-${card.type}`;
  const node = el('div', {
    class: `card ${typeClass} ${card.upgraded ? 'upgraded' : ''} ${opts.class || ''} ${opts.disabled ? 'disabled' : ''}`,
    attrs: { 'data-uid': card.uid || '' },
  });

  let costText = card.cost === 'X' ? 'X' : card.cost;
  if (card.cost === -1) costText = '';
  node.appendChild(el('div', { class: 'card-cost', text: String(costText) }));
  node.appendChild(el('div', { class: 'card-art', text: CARD_ART[card.id] || card._bp?.art || TYPE_GLYPH[card.char] || '◈' }));
  node.appendChild(el('div', { class: 'card-name', text: card.name }));
  node.appendChild(el('div', { class: 'card-type', text: card.type.toUpperCase() }));
  node.appendChild(el('div', { class: 'card-desc', html: highlightKeywords(cardDesc(card)) }));

  if (opts.onClick) node.addEventListener('click', () => opts.onClick(card, node));
  if (opts.onHover) {
    node.addEventListener('mouseenter', () => opts.onHover(card, node, true));
    node.addEventListener('mouseleave', () => opts.onHover(card, node, false));
  }
  return node;
}

export function highlightKeywords(text) {
  const kws = ['Ward', 'Resolve', 'Grace', 'Exposed', 'Sapped', 'Brittle', 'Blight', 'Phase',
    'Verse', 'Spirit', 'Storm', 'Tide', 'Shade', 'Sun', 'Focus', 'Àṣẹ', 'Backlash', 'Bronzeplate',
    'Exhaust', 'Ethereal', 'Innate', 'Retain', 'Regrowth', 'Charm', 'Evoke', 'Channel', 'Max HP'];
  let out = text;
  for (const k of kws) {
    out = out.replace(new RegExp(`\\b(${k})\\b`, 'g'), '<span class="kw">$1</span>');
  }
  return out;
}

export function relicChip(relicId, onHover) {
  const r = RELICS[relicId];
  if (!r) return el('span');
  const cls = `relic relic-${r.rarity}`;
  const node = el('div', { class: cls, text: relicGlyph(r), title: `${r.name} — ${r.desc}` });
  if (onHover) {
    node.addEventListener('mouseenter', () => onHover(r, node, true));
    node.addEventListener('mouseleave', () => onHover(r, node, false));
    // Touch: tap a relic to inspect it (hover never fires on touch).
    node.addEventListener('click', (e) => { e.stopPropagation(); onHover(r, node, true); });
  }
  return node;
}

function relicGlyph(r) {
  const map = {
    ancestral_cuirass: '🛡', griot_drum: '🥁', star_lens: '🔭', brass_anklet: '⚙',
    kente_wrap: '🧣', cowrie_purse: '🐚', healing_gourd: '🍵', whetstone_idol: '🗿',
    ancestor_bead: '📿', sun_disk: '☀', obsidian_charm: '⬛', talking_drum: '🪘',
    mask_of_masks: '🎭', iron_lattice: '🔩', twin_serpent: '🐍', heart_of_nyumbani: '❤',
    ancestor_idol: '🪬', cosmic_egg: '🥚', eternal_flame: '🔥', ascendant_crown: '👑',
  };
  return map[r.id] || '✦';
}

export function potionChip(potionId, idx, onClick, onHover) {
  const p = POTIONS[potionId];
  if (!p) return el('span');
  const node = el('div', { class: 'potion', style: { '--pcolor': p.color }, text: '⚗', title: `${p.name} — ${p.desc}` });
  if (onClick) node.addEventListener('click', () => onClick(p, idx));
  if (onHover) {
    node.addEventListener('mouseenter', () => onHover(p, node, true));
    node.addEventListener('mouseleave', () => onHover(p, node, false));
  }
  return node;
}

export function topBar(run, extra = {}) {
  const bar = el('div', { class: 'topbar' });
  const left = el('div', { class: 'tb-left' });
  left.appendChild(el('div', { class: 'tb-char', html: `${run.character.glyph} <b>${run.character.name}</b>` }));
  left.appendChild(el('div', { class: 'tb-hp', html: `❤ <b>${run.hp}</b>/${run.maxHp}` }));
  left.appendChild(el('div', { class: 'tb-gold', html: `🪙 <b>${run.gold}</b>` }));
  left.appendChild(el('div', { class: 'tb-act', text: `Act ${run.act}` }));

  const right = el('div', { class: 'tb-right' });
  const potionWrap = el('div', { class: 'tb-potions' });
  for (let i = 0; i < run.maxPotions; i++) {
    if (run.potions[i]) potionWrap.appendChild(potionChip(run.potions[i], i, extra.onPotion, extra.onHover));
    else potionWrap.appendChild(el('div', { class: 'potion empty', text: '+' }));
  }
  right.appendChild(potionWrap);
  const relicWrap = el('div', { class: 'tb-relics' });
  for (const rid of run.relics) relicWrap.appendChild(relicChip(rid, extra.onHover));
  right.appendChild(relicWrap);

  bar.appendChild(left);
  bar.appendChild(right);
  return bar;
}

export function powerPips(entity) {
  const wrap = el('div', { class: 'powers' });
  if (entity.block > 0) wrap.appendChild(el('div', { class: 'pip pip-block', html: `🛡 ${entity.block}`, title: 'Ward — absorbs damage' }));
  for (const [key, val] of Object.entries(entity.powers)) {
    if (!val) continue;
    const def = POWERS[key];
    if (!def) continue;
    const cls = def.type === 'buff' ? 'pip-buff' : 'pip-debuff';
    wrap.appendChild(el('div', { class: `pip ${cls}`, html: `${def.icon} ${val}`, title: `${def.name}: ${def.desc.replace('{n}', val)}` }));
  }
  return wrap;
}

export function button(label, onClick, cls = '') {
  return el('button', { class: `btn ${cls}`, text: label, on: { click: onClick } });
}

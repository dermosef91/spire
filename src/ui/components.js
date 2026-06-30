// Shared UI components: cards, relics, potions, the run top-bar, and tooltips.
import { el } from '../core/util.js';
import { cardDesc } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { POWERS } from '../data/keywords.js';
import { UI, cardArt, relicIcon, potionIcon, powerIcon } from './icons.js';
import { fullscreenSupported, toggleFullscreen } from '../core/fullscreen.js';
import { hasCardArt } from './card-art.js';

export function renderCard(card, opts = {}) {
  const typeClass = `type-${card.type}`;
  const node = el('div', {
    class: `card ${typeClass} ${card.upgraded ? 'upgraded' : ''} ${opts.class || ''} ${opts.disabled ? 'disabled' : ''}`,
    attrs: { 'data-uid': card.uid || '' },
  });

  let costText = card.cost === 'X' ? 'X' : card.cost;
  if (card.cost === -1) costText = '';
  node.appendChild(el('div', { class: 'card-cost' }, [el('span', { text: String(costText) })]));

  // Corner decorations
  node.appendChild(el('div', { class: 'card-corners' }, [
    el('div', { class: 'corner-tl' }),
    el('div', { class: 'corner-tr' }),
    el('div', { class: 'corner-bl' }),
    el('div', { class: 'corner-br' }),
  ]));

  // Inner double border frame
  node.appendChild(el('div', { class: 'card-frame' }));

  node.appendChild(el('div', { class: 'card-name', text: card.name }));
  const artChildren = [
    el('div', { class: 'art-motif' }),
    el('div', { class: 'art-glyph', html: cardArt(card.id) }),
  ];
  if (hasCardArt(card.id)) {
    const img = el('img', {
      class: 'card-art-img',
      attrs: { src: `assets/card-art/${card.id}.png`, alt: '', draggable: 'false' },
    });
    img.onerror = () => { img.style.display = 'none'; };
    artChildren.push(img);
  }
  node.appendChild(el('div', { class: 'card-art' }, artChildren));
  node.appendChild(el('div', { class: 'card-type' }, [el('span', { text: card.type.toUpperCase() })]));
  node.appendChild(el('div', { class: 'card-desc' }, [el('span', { class: 'card-desc-in', html: highlightKeywords(cardDesc(card)) })]));

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
  const node = el('div', { class: cls, html: relicIcon(relicId), title: `${r.name} — ${r.desc}` });
  if (onHover) {
    node.addEventListener('mouseenter', () => onHover(r, node, true));
    node.addEventListener('mouseleave', () => onHover(r, node, false));
    // Touch: tap a relic to inspect it (hover never fires on touch).
    node.addEventListener('click', (e) => { e.stopPropagation(); onHover(r, node, true); });
  }
  return node;
}

export function potionChip(potionId, idx, onClick, onHover) {
  const p = POTIONS[potionId];
  if (!p) return el('span');
  const node = el('div', { class: 'potion', style: { '--pcolor': p.color }, html: potionIcon(), title: `${p.name} — ${p.desc}` });
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
  left.appendChild(el('div', { class: 'tb-char', html: `<b>${run.character.name}</b>` }));
  left.appendChild(el('div', { class: 'tb-hp', html: `<i class="tb-ic">${UI.heart}</i> <b>${run.hp}</b>/${run.maxHp}` }));
  left.appendChild(el('div', { class: 'tb-gold', html: `<i class="tb-ic">${UI.coin}</i> <b>${run.gold}</b>` }));
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

  if (fullscreenSupported()) {
    right.appendChild(el('button', {
      class: 'tb-fs', html: UI.fullscreen, attrs: { 'aria-label': 'Toggle fullscreen', title: 'Fullscreen' },
      on: { click: () => toggleFullscreen(document.documentElement) },
    }));
  }

  bar.appendChild(left);
  bar.appendChild(right);
  return bar;
}

export function powerPips(entity) {
  const wrap = el('div', { class: 'powers' });
  if (entity.block > 0) wrap.appendChild(el('div', { class: 'pip pip-block', html: `<i class="pip-ic">${powerIcon('block')}</i> ${entity.block}`, title: 'Ward — absorbs damage' }));
  for (const [key, val] of Object.entries(entity.powers)) {
    if (!val) continue;
    const def = POWERS[key];
    if (!def) continue;
    const cls = def.type === 'buff' ? 'pip-buff' : 'pip-debuff';
    wrap.appendChild(el('div', { class: `pip ${cls}`, html: `<i class="pip-ic">${powerIcon(key)}</i> ${val}`, title: `${def.name}: ${def.desc.replace('{n}', val)}` }));
  }
  return wrap;
}

export function button(label, onClick, cls = '') {
  const isPrimary = cls.split(' ').includes('primary');
  
  const leftOrn = isPrimary 
    ? `<svg class="btn-svg-target" viewBox="0 0 44 44" width="44" height="44">
        <line x1="22" y1="2" x2="22" y2="42" stroke="currentColor" stroke-width="1.5" />
        <line x1="2" y1="22" x2="42" y2="22" stroke="currentColor" stroke-width="1.5" />
        <circle cx="22" cy="22" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M22 2 L22 6 M22 38 L22 42 M2 22 L6 22 M38 22 L42 22" stroke="currentColor" stroke-width="2" />
        <circle cx="22" cy="22" r="7" fill="#ff5a00" />
        <circle cx="22" cy="22" r="2.5" fill="#fff" />
       </svg>`
    : `<svg class="btn-svg-flourish-left" viewBox="0 0 24 24" width="18" height="18">
        <path d="M18 6 L10 12 L18 18 M12 6 L4 12 L12 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="22" y1="8" x2="22" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
       </svg>`;

  const rightOrn = isPrimary
    ? `<svg class="btn-svg-chevron-right" viewBox="0 0 16 16" width="16" height="16">
        <path d="M3 3 L9 8 L3 13 M8 3 L14 8 L8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
       </svg>`
    : `<svg class="btn-svg-flourish-right" viewBox="0 0 24 24" width="18" height="18">
        <path d="M6 6 L14 12 L6 18 M12 6 L20 12 L12 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="2" y1="8" x2="2" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
       </svg>`;

  return el('button', {
    class: `btn ${cls}`,
    html: `
      <span class="btn-decor border-outer"></span>
      <span class="btn-decor border-inner"></span>
      <span class="btn-body"></span>
      <span class="btn-content">${label}</span>
      <span class="btn-ornament left">${leftOrn}</span>
      <span class="btn-ornament right">${rightOrn}</span>
    `,
    on: { click: onClick }
  });
}

// Shared UI components: cards, relics, potions, the run top-bar, and tooltips.
import { el } from '../core/util.js';
import { cardDesc } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { POWERS, KEYWORDS } from '../data/keywords.js';
import { UI, cardArt, relicIcon, potionIcon, powerIcon } from './icons.js';
import { fullscreenSupported, toggleFullscreen } from '../core/fullscreen.js';
import { hasCardArt } from './card-art.js';
import { hasRelicArt } from './relic-art.js';
import { hasPotionArt } from './potion-art.js';
import { audio } from '../audio.js';
import { clearSave } from '../core/save.js';

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
  node.addEventListener('mousemove', (e) => {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) - 0.5;
    const py = ((e.clientY - rect.top) / rect.height) - 0.5;
    node.style.setProperty('--mx', String(px));
    node.style.setProperty('--my', String(py));
  });
  node.addEventListener('mouseleave', () => {
    node.style.removeProperty('--mx');
    node.style.removeProperty('--my');
  });
  scheduleFit(node);
  return node;
}

// Auto-fit: shrink the description font just enough that long text fits the
// fixed-size card box instead of overflowing or growing the card. Cards keep a
// uniform size; only the text scales. Purely cosmetic.
export function fitCardDesc(node) {
  const desc = node && node.querySelector('.card-desc');
  if (!desc) return;
  desc.style.setProperty('--desc-scale', '1');
  let scale = 1;
  const MIN = 0.62, STEP = 0.05;
  // scrollHeight > clientHeight means the text spills past the box.
  for (let guard = 0; guard < 12 && scale > MIN && desc.scrollHeight > desc.clientHeight + 0.5; guard++) {
    scale -= STEP;
    desc.style.setProperty('--desc-scale', scale.toFixed(3));
  }
}

// Fit after the node is laid out in the DOM. Fonts load async, so also re-fit
// once web fonts are ready (their metrics change how much text fits).
function scheduleFit(node) {
  if (typeof requestAnimationFrame !== 'function') return;
  const run = () => { if (node.isConnected) fitCardDesc(node); };
  requestAnimationFrame(() => requestAnimationFrame(run));
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(run)).catch(() => {});
  }
}

// Orientation/resize changes --card-h (and thus the base font), so re-fit every
// card currently on screen. Debounced to one pass per frame.
if (typeof window !== 'undefined') {
  let queued = false;
  window.addEventListener('resize', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      document.querySelectorAll('.card').forEach(fitCardDesc);
    });
  });
}

// Keywords to visually highlight in card and tooltip text. Derived from the
// status-effect and glossary tables (the source of truth in keywords.js) plus a
// few UI verbs and Spirit/orb names that aren't themselves POWERS/KEYWORDS
// entries, so adding a status effect keeps it highlighted automatically.
const EXTRA_KEYWORDS = ['Storm', 'Tide', 'Shade', 'Sun', 'Evoke', 'Channel', 'Max HP'];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Match longest names first (single-pass alternation) so multi-word names like
// "Resolve Down" win over the "Resolve" that is a substring of them.
const HIGHLIGHT_RE = new RegExp(
  '\\b(' + [...new Set([
    ...Object.values(POWERS).map((p) => p.name),
    ...Object.keys(KEYWORDS),
    ...EXTRA_KEYWORDS,
  ])].sort((a, b) => b.length - a.length).map(escapeRe).join('|') + ')\\b',
  'g'
);

export function highlightKeywords(text) {
  return text.replace(HIGHLIGHT_RE, '<span class="kw">$1</span>');
}

// Distinct keyword names found in `text`, in first-appearance order — used to
// build a "here's what these effects mean" glossary popup instead of
// re-printing text already visible on the card face.
export function keywordsIn(text) {
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(HIGHLIGHT_RE)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

export function relicChip(relicId, onHover) {
  const r = RELICS[relicId];
  if (!r) return el('span');
  const cls = `relic relic-${r.rarity}`;
  const node = el('div', { class: cls, html: relicIcon(relicId), title: `${r.name} — ${r.desc}`, attrs: { 'data-relic-id': relicId } });

  if (hasRelicArt(relicId)) {
    const img = el('img', {
      class: 'relic-art-img',
      attrs: { src: `assets/relic-art/${relicId}.png`, alt: '', draggable: 'false' },
    });
    img.onerror = () => { img.style.display = 'none'; };
    node.appendChild(img);
  }

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
  
  if (hasPotionArt(potionId)) {
    const img = el('img', {
      class: 'potion-art-img',
      attrs: { src: `assets/potion-art/${potionId}.png`, alt: '', draggable: 'false' },
    });
    img.onerror = () => { img.remove(); };
    node.appendChild(img);
  }

  if (onClick) node.addEventListener('click', () => onClick(p, idx));
  if (onHover) {
    node.addEventListener('mouseenter', () => onHover(p, node, true));
    node.addEventListener('mouseleave', () => onHover(p, node, false));
  }
  return node;
}

// Previous top-bar vitals, kept across rebuilds so gold/HP changes count
// up/down instead of snapping. The top bar is re-rendered from scratch on
// every scene change and every combat update, so comparing against this
// module-level cache (rather than diffing DOM) sidesteps the rebuild race
// documented for applyGoldFx. Keyed per run so continuing a different run
// doesn't animate a bogus delta.
let _vitals = { key: null, hp: null, gold: null };

// Count the <b> from `from` to `to` over ~450ms and flash its chip. The new
// bar is already built with the final value, so a torn-down node just stops.
function animateVital(chip, from, to, dirClass) {
  if (from == null || from === to) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const boldEl = chip.querySelector('b');
  if (!boldEl) return;
  chip.classList.add(dirClass);
  setTimeout(() => chip.classList.remove(dirClass), 700);
  const dur = 450;
  const start = performance.now();
  const step = (now) => {
    if (!boldEl.isConnected) return;
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    boldEl.textContent = String(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function topBar(run, extra = {}) {
  const bar = el('div', { class: 'topbar' });
  const left = el('div', { class: 'tb-left' });
  left.appendChild(el('div', { class: 'tb-char', html: `<b>${run.character.name}</b>` }));
  // In combat, run.hp only gets written back from the live combat.player.hp
  // mirror when combat ends — use the caller's live hp/maxHp (extra.hp/
  // extra.maxHp, e.g. combatView passing c.player.hp) when given, so the
  // header doesn't show a stale value while a potion/card heal is only
  // reflected on the in-combat health bar.
  const tbHp = extra.hp ?? run.hp;
  const tbMaxHp = extra.maxHp ?? run.maxHp;
  const hpChip = el('div', { class: 'tb-hp', html: `<i class="tb-ic">${UI.heart}</i> <b>${tbHp}</b>/${tbMaxHp}` });
  const goldChip = el('div', { class: 'tb-gold', html: `<i class="tb-ic">${UI.coin}</i> <b>${run.gold}</b>` });
  left.appendChild(hpChip);
  left.appendChild(goldChip);
  left.appendChild(el('div', { class: 'tb-act', text: `Act ${run.act}` }));
  const runKey = `${run.seed}:${run.characterId}`;
  if (_vitals.key !== runKey) _vitals = { key: runKey, hp: null, gold: null };
  animateVital(hpChip, _vitals.hp, tbHp, tbHp > _vitals.hp ? 'tb-delta-up' : 'tb-delta-down');
  animateVital(goldChip, _vitals.gold, run.gold, run.gold > _vitals.gold ? 'tb-delta-up' : 'tb-delta-down');
  _vitals.hp = tbHp;
  _vitals.gold = run.gold;

  const right = el('div', { class: 'tb-right' });
  const potionWrap = el('div', { class: 'tb-potions' });
  for (let i = 0; i < run.maxPotions; i++) {
    if (run.potions[i]) potionWrap.appendChild(potionChip(run.potions[i], i, extra.onPotion, extra.onHover));
    else potionWrap.appendChild(el('div', { class: 'potion empty', html: potionIcon(), attrs: { 'aria-label': 'Empty potion slot' } }));
  }
  right.appendChild(potionWrap);
  const relicWrap = el('div', { class: 'tb-relics' });
  for (const rid of run.relics) relicWrap.appendChild(relicChip(rid, extra.onHover));
  right.appendChild(relicWrap);

  const muteBtn = el('button', {
    class: 'tb-mute',
    html: audio.muted ? UI.soundOff : UI.soundOn,
    attrs: {
      'aria-label': audio.muted ? 'Unmute all sounds' : 'Mute all sounds',
      title: audio.muted ? 'Unmute Sound' : 'Mute Sound'
    },
    on: {
      click: () => {
        const isMuted = audio.toggleMute();
        muteBtn.innerHTML = isMuted ? UI.soundOff : UI.soundOn;
        muteBtn.setAttribute('aria-label', isMuted ? 'Unmute all sounds' : 'Mute all sounds');
        muteBtn.setAttribute('title', isMuted ? 'Unmute Sound' : 'Mute Sound');
      }
    }
  });
  right.appendChild(muteBtn);

  const game = window.__ase;

  if (fullscreenSupported()) {
    right.appendChild(el('button', {
      class: 'tb-fs', html: UI.fullscreen, attrs: { 'aria-label': 'Toggle fullscreen', title: 'Fullscreen' },
      on: { click: () => toggleFullscreen(document.documentElement) },
    }));
  }

  // Abandon run: clears the save and returns to title. Reuses the same
  // confirm overlay as potions/purchases since it's just as irreversible.
  if (game) {
    right.appendChild(el('button', {
      class: 'tb-abandon', html: UI.exit, attrs: { 'aria-label': 'Abandon run and return to title', title: 'Abandon Run' },
      on: {
        click: () => {
          audio.play('click');
          game.confirm(
            'Abandon this climb?',
            'Your current run will be lost for good. This cannot be undone.',
            () => { clearSave(); game.run = null; game.showTitle(); },
            'Abandon Run'
          );
        }
      },
    }));
  }

  bar.appendChild(left);
  bar.appendChild(right);
  return bar;
}

export function powerPips(entity) {
  const wrap = el('div', { class: 'powers' });
  if (entity.block > 0) wrap.appendChild(el('div', { class: 'pip pip-block', html: `<i class="pip-ic">${powerIcon('block')}</i> ${entity.block}`, title: 'Block — absorbs damage' }));
  for (const [key, val] of Object.entries(entity.powers)) {
    if (!val) continue;
    const def = POWERS[key];
    if (!def) continue;
    const cls = def.type === 'buff' ? 'pip-buff' : 'pip-debuff';
    wrap.appendChild(el('div', { class: `pip ${cls}`, html: `<i class="pip-ic">${powerIcon(key)}</i> ${val}`, title: `${def.name}: ${def.desc.replace('{n}', val)}` }));
  }
  return wrap;
}

export const FLOURISH_LEFT = `<svg class="btn-svg-flourish-left" viewBox="0 0 24 24" width="18" height="18">
        <path d="M18 6 L10 12 L18 18 M12 6 L4 12 L12 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="22" y1="8" x2="22" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
       </svg>`;

export const FLOURISH_RIGHT = `<svg class="btn-svg-flourish-right" viewBox="0 0 24 24" width="18" height="18">
        <path d="M6 6 L14 12 L6 18 M12 6 L20 12 L12 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="2" y1="8" x2="2" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
       </svg>`;

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
    : FLOURISH_LEFT;

  const rightOrn = isPrimary
    ? `<svg class="btn-svg-chevron-right" viewBox="0 0 16 16" width="16" height="16">
        <path d="M3 3 L9 8 L3 13 M8 3 L14 8 L8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
       </svg>`
    : FLOURISH_RIGHT;

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
    on: {
      click: onClick,
      mousemove: (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const px = ((e.clientX - rect.left) / rect.width) - 0.5;
        const py = ((e.clientY - rect.top) / rect.height) - 0.5;
        e.currentTarget.style.setProperty('--mx', String(px));
        e.currentTarget.style.setProperty('--my', String(py));
      },
      mouseleave: (e) => {
        e.currentTarget.style.removeProperty('--mx');
        e.currentTarget.style.removeProperty('--my');
      }
    }
  });
}

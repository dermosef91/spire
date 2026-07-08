// Debug: Content Browser — an internal balance-review tool listing every
// card, relic and potion in the game together with rarity/ownership/
// availability info. Not part of the player-facing game; reachable from the
// title screen only while DEBUG_MENU_ENABLED is true below (flip it to false
// to hide the entry point once a balance pass is done — the scene itself
// stays reachable via window.__ase.showDebugMenu() either way, since scenes
// mixed onto Game.prototype are always callable from the console).
//
// Mixed onto Game.prototype (see game.js). Methods use `this` (the Game
// instance), same pattern as every other scenes/*.js module.

import { el, clear } from '../core/util.js';
import { CARDS, createCard, cardDesc, ALL_CARD_IDS } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { CHARACTERS, COLORLESS_POOL } from '../data/characters.js';
import { CARD_UNLOCKS } from '../core/cardUnlocks.js';
import { renderCard, relicChip, potionChip, button } from '../ui/components.js';
import { audio } from '../audio.js';

export const DEBUG_MENU_ENABLED = true;

function ownerLabel(charField) {
  if (charField === 'colorless') return 'Colorless';
  if (charField === 'status') return 'Status/Curse (not owned, granted by effects)';
  return CHARACTERS[charField]?.name || charField || '—';
}

// Where a card can actually be obtained: starter deck, a character's reward
// pool, the shared colorless reward pool, or nowhere (created only by card/
// enemy effects, e.g. Wound/Dazed/Shard).
function cardAvailability(id) {
  const starterFor = Object.keys(CHARACTERS).filter((c) => CHARACTERS[c].deck.includes(id));
  const poolFor = Object.keys(CHARACTERS).filter((c) => CHARACTERS[c].cardPool.includes(id));
  const colorless = COLORLESS_POOL.includes(id);
  if (!starterFor.length && !poolFor.length && !colorless) return 'Not draftable — created by card/enemy effects only';
  const bits = [];
  if (starterFor.length) bits.push(`Starter deck: ${starterFor.map((c) => CHARACTERS[c].name).join(', ')}`);
  if (poolFor.length) bits.push(`Reward pool: ${poolFor.map((c) => CHARACTERS[c].name).join(', ')}`);
  if (colorless) bits.push('Colorless reward pool (any character)');
  return bits.join(' · ');
}

function relicAvailability(r) {
  if (r.rarity === 'starter') return `Starting relic — ${ownerLabel(r.char)} only`;
  if (r.rarity === 'boss') return 'Boss reward only (offered on every Act boss kill)';
  return 'Random drop — elite/treasure/shop pool (common/uncommon/rare)';
}

// Mirrors the fixed weights in scenes/rewards.js randomPotion().
const POTION_WEIGHTS = { common: 65, uncommon: 27, rare: 8 };
function potionAvailability(p) {
  const w = POTION_WEIGHTS[p.rarity] || 0;
  const total = Object.values(POTION_WEIGHTS).reduce((a, b) => a + b, 0);
  return `Random drop weight ${w}/${total} (~${Math.round((w / total) * 100)}% of potion rolls)`;
}

function infoLine(text, cls = '') {
  return el('div', { class: `debug-info-line ${cls}`, text });
}

export const DebugScene = {
  showDebugMenu() {
    const panel = el('div', { class: 'debug-menu' });
    panel.appendChild(el('h2', { text: 'Debug: Content Browser' }));
    panel.appendChild(el('p', {
      class: 'debug-sub',
      text: 'Internal balance-review tool — every card, relic and potion with rarity/ownership/availability. Not shown to players.',
    }));

    const tabs = el('div', { class: 'debug-tabs' });
    const body = el('div', { class: 'debug-body' });
    const tabDefs = [
      { id: 'cards', label: 'Cards', render: () => this.renderDebugCards(body) },
      { id: 'relics', label: 'Relics', render: () => this.renderDebugRelics(body) },
      { id: 'potions', label: 'Potions', render: () => this.renderDebugPotions(body) },
    ];
    let active = tabDefs[0].id;
    const renderTabs = () => {
      clear(tabs);
      for (const t of tabDefs) {
        tabs.appendChild(button(t.label, () => { active = t.id; renderTabs(); t.render(); }, active === t.id ? 'primary' : ''));
      }
    };
    renderTabs();
    tabDefs[0].render();

    panel.appendChild(tabs);
    panel.appendChild(body);
    panel.appendChild(button('← Back', () => { audio.play('click'); this.showTitle(); }));
    this.setScene(panel, 'debug');
  },

  renderDebugCards(body) {
    clear(body);
    const grid = el('div', { class: 'debug-grid' });
    for (const id of ALL_CARD_IDS()) {
      const bp = CARDS[id];
      const inst = createCard(id);
      const row = el('div', { class: 'debug-row' });
      row.appendChild(renderCard(inst, { onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card') }));
      const info = el('div', { class: 'debug-info' });
      info.appendChild(infoLine(`${bp.name} (${id})`, 'debug-name'));
      info.appendChild(infoLine(`Rarity: ${bp.rarity || 'common'} · Type: ${bp.type} · Cost: ${bp.cost === -1 ? '—' : bp.cost}`));
      info.appendChild(infoLine(`Owner: ${ownerLabel(bp.char)}`));
      info.appendChild(infoLine(cardAvailability(id)));
      info.appendChild(infoLine(cardDesc(inst), 'debug-desc'));
      if (bp.locked) {
        const u = CARD_UNLOCKS[id];
        info.appendChild(infoLine(`Locked — ${u ? u.desc : 'unlock condition unknown'}`, 'debug-locked'));
      }
      row.appendChild(info);
      grid.appendChild(row);
    }
    body.appendChild(grid);
  },

  renderDebugRelics(body) {
    clear(body);
    const grid = el('div', { class: 'debug-grid' });
    for (const id of Object.keys(RELICS)) {
      const r = RELICS[id];
      const row = el('div', { class: 'debug-row' });
      row.appendChild(relicChip(id, (o, n, on) => this.tooltip(o, n, on)));
      const info = el('div', { class: 'debug-info' });
      info.appendChild(infoLine(`${r.name} (${id})`, 'debug-name'));
      info.appendChild(infoLine(`Rarity: ${r.rarity}`));
      info.appendChild(infoLine(relicAvailability(r)));
      info.appendChild(infoLine(r.desc, 'debug-desc'));
      row.appendChild(info);
      grid.appendChild(row);
    }
    body.appendChild(grid);
  },

  renderDebugPotions(body) {
    clear(body);
    const grid = el('div', { class: 'debug-grid' });
    Object.keys(POTIONS).forEach((id, i) => {
      const p = POTIONS[id];
      const row = el('div', { class: 'debug-row' });
      row.appendChild(potionChip(id, i, null, (o, n, on) => this.tooltip(o, n, on)));
      const info = el('div', { class: 'debug-info' });
      info.appendChild(infoLine(`${p.name} (${id})`, 'debug-name'));
      info.appendChild(infoLine(`Rarity: ${p.rarity} · ${p.combatOnly === false ? 'Usable anywhere' : 'Combat only'}`));
      info.appendChild(infoLine(potionAvailability(p)));
      info.appendChild(infoLine(p.desc, 'debug-desc'));
      row.appendChild(info);
      grid.appendChild(row);
    });
    body.appendChild(grid);
  },
};

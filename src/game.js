// Game controller: the scene state machine that ties together the title screen,
// character select, the act map, combat, rewards, shops, rest sites and events.
//
// The class here holds only the shared plumbing every scene needs — the render
// target, the current RunState, tooltips, the scene swap/veil transition and a
// couple of shared overlays. Each scene's rendering/logic lives in its own
// module under `scenes/` and is mixed onto the prototype via Object.assign
// below, so `this.showMap()`, `this.setScene(...)`, etc. resolve exactly as
// before. This keeps any one scene's code in a small, self-contained file.

import { el, clear } from './core/util.js';
import { saveRun, loadMeta } from './core/save.js';
import { cardDesc } from './data/cards.js';
import { POTIONS } from './data/potions.js';
import { renderCard, topBar, button } from './ui/components.js';
import { updateBackground } from './ui/backgrounds.js';
import { background } from './fx/background.js';
import { audio } from './audio.js';
import { isTouchDevice } from './core/fullscreen.js';

import { TitleScene } from './scenes/title.js';
import { MapScene } from './scenes/map.js';
import { CombatScene } from './scenes/combat.js';
import { RewardScene } from './scenes/rewards.js';
import { ShopScene } from './scenes/shop.js';
import { RestScene } from './scenes/rest.js';
import { EventScene } from './scenes/event.js';
import { TreasureScene } from './scenes/treasure.js';
import { EndScene } from './scenes/end.js';

export class Game {
  constructor(root) {
    this.root = root;
    this.run = null;
    this.touch = isTouchDevice();
    this.tip = el('div', { class: 'tooltip', id: 'tooltip' });
    document.body.appendChild(this.tip);
    this.meta = loadMeta();
    this.selectedAscension = Math.min(this.meta.ascension || 0, this.meta.maxAscension || 0);
    this.setupMobile();
  }

  isTouch() { return this.touch; }
  rhythmOn() { return this.meta.rhythm !== false; }

  // ----------------------------------------------------------- mobile / fullscreen
  setupMobile() {
    // (Fullscreen toggle lives in the top bar in-run, and on the title screen.)
    // Non-blocking "rotate to landscape" hint (CSS decides when to show it).
    this.rotateHint = el('div', { class: 'rotate-hint', html: '<span class="rot-ic">⟳</span> Rotate to landscape for the best view' });
    document.body.appendChild(this.rotateHint);

    if (this.touch) document.body.classList.add('is-touch');

    // A tap/click anywhere that is not an inspectable chip/card/tooltip dismisses the tooltip.
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.relic, .potion, .card, .tooltip')) {
        this.tooltip(null, null, false);
      }
    }, true);
  }

  // A small yes/no confirm overlay (used for irreversible touch actions like potions).
  confirm(title, desc, onYes) {
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box confirm-box' });
    box.appendChild(el('h3', { text: title }));
    if (desc) box.appendChild(el('p', { class: 'event-text', html: desc }));
    const row = el('div', { class: 'confirm-row' });
    row.appendChild(button('Use', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      onYes();
    }, 'primary'));
    row.appendChild(button('Cancel', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
    }));
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ----------------------------------------------------------- scene helpers
  setScene(node, sceneClass = '') {
    this.tooltip(null, null, false);
    clear(this.root);
    // Remove previous scene classes from body and add the current one
    document.body.className = document.body.className.replace(/\bscene-\S+/g, '');
    if (sceneClass) document.body.classList.add(`scene-${sceneClass}`);

    const wrap = el('div', { class: `scene ${sceneClass}` }, [node]);
    this.root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));

    // Update dynamic background image based on active scene and act
    const actNum = this.run ? this.run.act : null;
    updateBackground(sceneClass, actNum);
    // Shift the animated starfield palette to match the current act (or title).
    const bg = background();
    if (bg) bg.setAct(this.run ? this.run.act : 'title');
  }

  // Fade a full-screen veil in, swap scenes underneath it at peak opacity, then
  // fade it back out — a slower, less abrupt handoff when entering a map node.
  // `swapFn` performs the actual scene change (usually a setScene call).
  veilTransition(swapFn) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inMs = reduce ? 140 : 280;
    const holdMs = reduce ? 40 : 110;
    const outMs = reduce ? 140 : 340;
    const veil = el('div', { class: 'scene-veil' });
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add('veil-on'));
    setTimeout(() => {
      swapFn();
      setTimeout(() => {
        veil.classList.remove('veil-on');
        setTimeout(() => veil.remove(), outMs + 60);
      }, holdMs);
    }, inMs);
  }

  tooltip(obj, node, on, kind) {
    if (!on) { this.tip.style.display = 'none'; return; }
    let html = '';
    if (kind === 'card') {
      html = `<b>${obj.name}</b> · ${obj.cost === 'X' ? 'X' : obj.cost} Àṣẹ · ${obj.type}<br>${cardDesc(obj)}`;
    } else if (obj.desc !== undefined && obj.rarity !== undefined && POTIONS[obj.id]) {
      html = `<b>${obj.name}</b><br>${obj.desc}`;
    } else if (obj.desc !== undefined) {
      html = `<b>${obj.name}</b><br>${obj.desc}`;
    } else return;
    this.tip.innerHTML = html;
    this.tip.style.display = 'block';
    const r = node.getBoundingClientRect();
    const tw = 240;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
    this.tip.style.left = left + 'px';
    this.tip.style.width = tw + 'px';
    let top = r.top - this.tip.offsetHeight - 10;
    if (top < 8) top = r.bottom + 10;
    this.tip.style.top = top + 'px';
  }

  // ----------------------------------------------------------- shared overlays
  // Deck card-picker overlay, used by rest (via smithUpgrade), events
  // (upgrade/remove) and the shop's reforge service.
  deckOverlay(filterFn, onPick, title, sound) {
    const run = this.run;
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box deck-overlay' });
    box.appendChild(el('h3', { text: title }));
    const grid = el('div', { class: 'deck-grid' });
    run.deck.forEach((entry, i) => {
      const inst = run.instance(entry);
      inst._i = i; entry._i = i;
      const ok = filterFn(inst);
      const node = renderCard(inst, {
        disabled: !ok,
        onClick: ok ? () => {
          if (sound) audio.play(sound);
          this.tooltip(null, null, false);
          document.body.removeChild(overlay);
          onPick(entry);
        } : null,
        onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card'),
      });
      grid.appendChild(node);
    });
    box.appendChild(grid);
    box.appendChild(button('Cancel', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
    }));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // Generic "here's what happened, then back to the map" result screen, used by
  // treasure, rest and events.
  resultThenMap(text) {
    const run = this.run;
    saveRun(run);
    const panel = el('div', { class: 'event-scene result' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(el('div', { class: 'event-art', text: '…' }));
    panel.appendChild(el('p', { class: 'event-text', html: text }));
    panel.appendChild(button('Continue →', () => { if (run.isDead()) this.gameOver(false); else this.showMap(); }, 'primary'));
    this.setScene(panel, 'event');
  }
}

// Compose the per-scene method sets onto the prototype. Each mixin is a plain
// object of methods that use `this` (the Game instance) — see scenes/*.js.
Object.assign(
  Game.prototype,
  TitleScene,
  MapScene,
  CombatScene,
  RewardScene,
  ShopScene,
  RestScene,
  EventScene,
  TreasureScene,
  EndScene,
);

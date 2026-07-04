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
import { saveRun, loadMeta, saveMeta } from './core/save.js';
import { cardDesc, upgradeCard } from './data/cards.js';
import { POTIONS } from './data/potions.js';
import { RELICS } from './data/relics.js';
import { relicIcon, INTENT_INFO } from './ui/icons.js';
import { hasRelicArt } from './ui/relic-art.js';
import { renderCard, topBar, button, highlightKeywords } from './ui/components.js';
import { keywordInfo } from './data/keywords.js';
import { updateBackground } from './ui/backgrounds.js';
import { background } from './fx/background.js';
import { audio } from './audio.js';
import { isTouchDevice } from './core/fullscreen.js';
import { KeyboardController } from './core/keyboard.js';

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
    this.kw = el('div', { class: 'tooltip kw-popup', id: 'kwPopup' });
    document.body.appendChild(this.kw);
    this.kwNode = null;
    this.meta = loadMeta();
    this.selectedAscension = Math.min(this.meta.ascension || 0, this.meta.maxAscension || 0);
    this.setupMobile();
    this.setupGlossaryPopups();
    this.keyboard = new KeyboardController(this);
  }

  isTouch() { return this.touch; }
  rhythmOn() { return this.meta.rhythm !== false; }
  setRhythm(on) {
    this.meta.rhythm = !!on;
    saveMeta(this.meta);
    // Rebind the live combat's parry prompt so the toggle applies mid-fight
    // (attack QTEs already check rhythmOn() on every card play).
    if (this.combatView) this.combatView.bindParryPrompt();
    return this.rhythmOn();
  }

  // ----------------------------------------------------------- mobile / fullscreen
  setupMobile() {
    // (Fullscreen toggle lives in the top bar in-run, and on the title screen.)
    // Non-blocking "rotate to landscape" hint (CSS decides when to show it).
    this.rotateHint = el('div', { class: 'rotate-hint', html: '<span class="rot-ic">⟳</span> Rotate to landscape for the best view' });
    document.body.appendChild(this.rotateHint);

    if (this.touch) document.body.classList.add('is-touch');

    // A tap/click anywhere that is not an inspectable chip/card/tooltip dismisses the tooltip.
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.relic, .potion, .card, .tooltip, .pip, .block-badge, .kw, .intent')) {
        this.tooltip(null, null, false);
      }
    }, true);
  }

  // ----------------------------------------------------------- glossary popups
  // A small popup (separate from the main hover tooltip) explaining a keyword
  // ("Exposed" -> its status-effect description) or an enemy intent icon
  // ("Strategic" -> "This enemy intends to use a Buff.").
  setupGlossaryPopups() {
    // Click/tap only (not hover): cards lift on `:hover`, which shifts a
    // highlighted keyword span out from under a stationary cursor and would
    // make a hover-preview flicker open and shut. A click needs no follow-up
    // pointer movement, so it isn't affected.
    const closeKw = () => { this.kw.style.display = 'none'; this.kwNode = null; };

    // Hand cards are played via a pointerdown-driven drag/tap gesture (see
    // CombatView.onCardPointerDown), which fires and resolves before any
    // 'click' event does. Stop it at the source so tapping a keyword inside a
    // card's text doesn't also play the card.
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.kw, .intent-atk, .intent-def, .intent-buf, .intent-deb, .intent-unk')) e.stopPropagation();
    }, true);

    // Click (mouse or touch): toggles the popup for a keyword span or an
    // intent icon (a second click on the same one closes it), and stops the
    // click from also playing the card / targeting the enemy underneath.
    // Captured so it runs before those handlers.
    document.addEventListener('click', (e) => {
      const kwSpan = e.target.closest('.kw');
      if (kwSpan) {
        e.stopPropagation();
        const info = keywordInfo(kwSpan.textContent);
        if (!info) return;
        if (this.kwNode === kwSpan) { closeKw(); return; }
        this.infoPopup(`<b>${info.name}</b><br>${info.desc}`, kwSpan);
        return;
      }
      const intentIcon = e.target.closest('.intent-atk, .intent-def, .intent-buf, .intent-deb, .intent-unk');
      if (intentIcon) {
        e.stopPropagation();
        const info = INTENT_INFO[intentIcon.dataset.intentType];
        if (!info) return;
        if (this.kwNode === intentIcon) { closeKw(); return; }
        this.infoPopup(`<b>${info.label}</b><br>${info.desc}`, intentIcon);
        return;
      }
      if (this.kwNode) closeKw();
    }, true);
  }

  // Positions a floating box (main tooltip or glossary popup) near `node`.
  positionBox(box, node, width) {
    box.style.display = 'block';
    box.style.width = width + 'px';
    const r = node.getBoundingClientRect();
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    box.style.left = left + 'px';
    let top = r.top - box.offsetHeight - 10;
    if (top < 8) top = r.bottom + 10;
    box.style.top = top + 'px';
  }

  infoPopup(html, node) {
    this.kw.innerHTML = html;
    this.positionBox(this.kw, node, 220);
    this.kwNode = node;
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
    if (this.keyboard) this.keyboard.clearFocus();
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
      html = `<b>${obj.name}</b> · ${obj.cost === 'X' ? 'X' : obj.cost} Àṣẹ · ${obj.type}<br>${highlightKeywords(cardDesc(obj))}`;
    } else if (obj.desc !== undefined && obj.rarity !== undefined && POTIONS[obj.id]) {
      html = `<b>${obj.name}</b><br>${highlightKeywords(obj.desc)}`;
    } else if (obj.desc !== undefined) {
      html = `<b>${obj.name}</b><br>${highlightKeywords(obj.desc)}`;
    } else return;
    this.tip.innerHTML = html;
    this.positionBox(this.tip, node, 240);
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

  // View cards in a pile (e.g. draw or discard pile) in a random order
  viewCardsOverlay(cards, title) {
    const shuffled = cards.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box pile-overlay' });
    box.appendChild(el('h3', { text: title }));
    const grid = el('div', { class: 'deck-grid' });
    shuffled.forEach((c) => {
      const node = renderCard(c, {
        onClick: (cd, n) => this.tooltip(cd, n, true, 'card'),
        onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card'),
      });
      grid.appendChild(node);
    });
    box.appendChild(grid);
    box.appendChild(button('Close', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
    }));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // Side-by-side preview of a card and its upgraded form, gated by a confirm.
  upgradePreview(entry, onConfirm, onCancel, options = {}) {
    const run = this.run;
    const before = run.instance(entry);
    const after = run.instance(entry);
    upgradeCard(after);
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box smith-preview' });
    box.appendChild(el('h3', { text: options.title || 'Reforge this card?' }));
    const compare = el('div', { class: 'smith-compare' });
    const beforeCol = el('div', { class: 'smith-col' });
    beforeCol.appendChild(el('div', { class: 'smith-label', text: options.labelBefore || 'Current' }));
    beforeCol.appendChild(renderCard(before, { onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card') }));
    compare.appendChild(beforeCol);
    compare.appendChild(el('div', { class: 'smith-arrow', html: '<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true"><path d="M2 12h24M18 4l10 8-10 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
    const afterCol = el('div', { class: 'smith-col' });
    afterCol.appendChild(el('div', { class: 'smith-label upgraded', text: options.labelAfter || 'Reforged' }));
    afterCol.appendChild(renderCard(after, { onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card') }));
    compare.appendChild(afterCol);
    box.appendChild(compare);
    const controls = el('div', { class: 'confirm-row' });
    controls.appendChild(button(options.confirmText || 'Reforge', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      onConfirm();
    }, 'primary'));
    controls.appendChild(button('Cancel', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      if (onCancel) onCancel();
    }));
    box.appendChild(controls);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // Build the visual for a relic: the line-art SVG as a base, with the real
  // generated sprite (assets/relic-art/<id>.png) overlaid on top when one
  // exists — same "art overrides icon" pattern as relicChip() in components.js.
  relicVisual(relicId, cls) {
    const node = el('div', { class: cls, html: relicIcon(relicId) });
    if (hasRelicArt(relicId)) {
      const img = el('img', {
        class: 'relic-art-img',
        attrs: { src: `assets/relic-art/${relicId}.png`, alt: '', draggable: 'false' },
      });
      img.onerror = () => { img.remove(); };
      node.appendChild(img);
    }
    return node;
  }

  // Celebrate a newly acquired relic: a large reveal overlay (image + description)
  // with a fanfare, then the relic flies to its slot in the top bar. `onClaim`
  // is the caller's follow-up (rebuild the scene so the new relic chip exists);
  // it runs the instant the reveal is dismissed, before the flight begins.
  relicAcquired(relicId, onClaim) {
    const r = RELICS[relicId];
    if (!r) { onClaim(); return; }
    audio.play('relic');

    const overlay = el('div', { class: 'overlay relic-reveal-overlay' });
    const box = el('div', { class: `relic-reveal relic-${r.rarity}` });
    box.appendChild(el('div', { class: 'relic-reveal-rays' }));
    box.appendChild(el('div', { class: 'relic-reveal-kicker', text: 'Ancestral Relic Acquired' }));
    const disc = el('div', { class: 'relic-reveal-disc' }, [
      el('div', { class: 'relic-reveal-halo' }),
      this.relicVisual(relicId, 'relic-reveal-icon'),
    ]);
    box.appendChild(disc);
    box.appendChild(el('div', { class: 'relic-reveal-rarity', text: (r.rarity || '').toUpperCase() }));
    box.appendChild(el('div', { class: 'relic-reveal-name', text: r.name }));
    box.appendChild(el('div', { class: 'relic-reveal-desc', html: r.desc }));
    box.appendChild(el('div', { class: 'relic-reveal-hint', text: this.isTouch() ? 'Tap to claim' : 'Click to claim' }));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    let claimed = false;
    const claim = () => {
      if (claimed) return;
      claimed = true;
      const icon = disc.querySelector('.relic-reveal-icon');
      const fromRect = icon.getBoundingClientRect();
      overlay.remove();
      onClaim();
      this.flyRelicToSlot(relicId, fromRect);
    };
    overlay.addEventListener('click', claim);
  }

  // Animate a clone of the relic icon from `fromRect` to its freshly-rendered
  // chip in the top bar. Purely cosmetic; the relic is already owned by now.
  flyRelicToSlot(relicId, fromRect) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The just-added relic is the last chip in the (rebuilt) top bar.
    const chips = document.querySelectorAll('.tb-relics .relic');
    const target = chips[chips.length - 1];
    if (reduce || !target) { if (target) target.classList.add('relic-landed'); return; }
    const toRect = target.getBoundingClientRect();

    const clone = this.relicVisual(relicId, 'relic-fly');
    const fx = fromRect.left + fromRect.width / 2;
    const fy = fromRect.top + fromRect.height / 2;
    const tx = toRect.left + toRect.width / 2;
    const ty = toRect.top + toRect.height / 2;
    Object.assign(clone.style, {
      left: `${fx}px`, top: `${fy}px`,
      width: `${fromRect.width}px`, height: `${fromRect.height}px`,
    });
    document.body.appendChild(clone);
    target.classList.add('relic-incoming');

    let finished = false;
    const land = () => {
      if (finished) return;
      finished = true;
      clone.remove();
      target.classList.remove('relic-incoming');
      target.classList.add('relic-landed');
      audio.play('relicland');
    };
    requestAnimationFrame(() => {
      const scale = toRect.width / fromRect.width;
      clone.style.transform = `translate(-50%, -50%) translate(${tx - fx}px, ${ty - fy}px) scale(${scale})`;
      clone.style.opacity = '0.85';
    });
    clone.addEventListener('transitionend', land, { once: true });
    setTimeout(land, 950);
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

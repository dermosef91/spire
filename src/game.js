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
import { relicIcon } from './ui/icons.js';
import { renderCard, topBar, button } from './ui/components.js';
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
    this.meta = loadMeta();
    this.selectedAscension = Math.min(this.meta.ascension || 0, this.meta.maxAscension || 0);
    this.setupMobile();
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
      if (!e.target.closest('.relic, .potion, .card, .tooltip, .pip, .block-badge')) {
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
      el('div', { class: 'relic-reveal-icon', html: relicIcon(relicId) }),
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

    const clone = el('div', { class: 'relic-fly', html: relicIcon(relicId) });
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

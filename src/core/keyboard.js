// Keyboard controller: manages global and context-sensitive keyboard controls/navigation.
export class KeyboardController {
  constructor(game) {
    this.game = game;
    this.currentIndex = -1;
    this.active = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e), true);
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('click', (e) => this.onClick(e), true);
  }

  onMouseMove(e) {
    const dist = Math.hypot(e.clientX - this.lastMousePos.x, e.clientY - this.lastMousePos.y);
    if (dist > 5) {
      if (this.active) {
        this.clearFocus();
        this.active = false;
      }
    }
    this.lastMousePos = { x: e.clientX, y: e.clientY };
  }

  onClick(e) {
    if (e.detail > 0) {
      if (this.active) {
        this.clearFocus();
        this.active = false;
      }
    }
  }

  clearFocus() {
    const activeEl = document.querySelector('.kb-focus');
    if (activeEl) {
      activeEl.classList.remove('kb-focus');
      activeEl.dispatchEvent(new Event('mouseleave'));
    }
    this.currentIndex = -1;
  }

  getElements() {
    // 1. Overlay priority
    const overlay = document.querySelector('.overlay');
    if (overlay) {
      return Array.from(overlay.querySelectorAll('.btn, button, .card:not(.disabled)'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
    }

    // 2. Combat Scene
    const isCombat = document.body.classList.contains('scene-combat');
    if (isCombat) {
      if (document.querySelector('.combat-scene.targeting')) {
        const enemies = Array.from(document.querySelectorAll('.combatant.targetable'))
          .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        const cancelButtons = Array.from(document.querySelectorAll('.card.previewing'))
          .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        return [...enemies, ...cancelButtons];
      }

      const handCards = Array.from(document.querySelectorAll('.hand .card'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
      const controlButtons = Array.from(document.querySelectorAll('.end-turn, .potion:not(.empty), .screen-pile, .tb-fs, .tb-mute'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
      return [...handCards, ...controlButtons];
    }

    // 3. Main Scenes
    const query = [
      '.choices .btn',
      '.choices button',
      '.char-card:not(.char-locked) .btn',
      '.char-card:not(.char-locked)',
      '.map-node.reachable',
      '.shop-item',
      '.shop-mini',
      '.reward-row',
      '.potion:not(.empty)',
      '.title-setting-btn',
      '.tb-fs',
      '.tb-mute',
      '.reward-content > .btn',
      '.end-scene .btn',
      '.title-buttons .btn',
      '.act-intro .btn'
    ].join(', ');

    let els = Array.from(document.querySelectorAll(query))
      .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);

    els = els.filter(el => {
      if (el.classList.contains('char-card') && el.querySelector('.btn')) {
        return false;
      }
      return true;
    });

    const topBarEls = els.filter(el => el.closest('.topbar') || el.classList.contains('tb-fs') || el.classList.contains('tb-mute'));
    const mainEls = els.filter(el => !topBarEls.includes(el));
    return [...mainEls, ...topBarEls];
  }

  onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (document.querySelector('.qte-layer')) {
      return;
    }

    const key = e.key;
    const elements = this.getElements();
    if (elements.length === 0) return;

    // Escape handling
    if (key === 'Escape' || key === 'Esc') {
      const cancelBtn = elements.find(el => {
        const txt = el.textContent.toLowerCase();
        return txt.includes('back') || txt.includes('cancel') || txt.includes('skip') || txt.includes('close') || txt.includes('leave');
      });
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        cancelBtn.click();
        this.clearFocus();
        return;
      }
    }

    // End Turn handling in combat
    const isCombat = document.body.classList.contains('scene-combat');
    const hasOverlay = !!document.querySelector('.overlay');
    if (isCombat && !hasOverlay && (key === 'e' || key === 'E')) {
      const endTurnBtn = document.querySelector('.end-turn');
      if (endTurnBtn && !endTurnBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        endTurnBtn.click();
        this.clearFocus();
        return;
      }
    }

    // Number keys direct shortcuts (1-9, 0 for 10)
    // Note: in combat (not targeting, no overlay), let combatView keydown select cards
    const isCombatHandKeys = isCombat && !hasOverlay && !document.querySelector('.combat-scene.targeting');
    if (!isCombatHandKeys && ((key >= '1' && key <= '9') || key === '0')) {
      const num = key === '0' ? 10 : parseInt(key);
      const idx = num - 1;
      if (idx >= 0 && idx < elements.length) {
        e.preventDefault();
        e.stopPropagation();
        const targetEl = elements[idx];
        this.activateElement(targetEl);
        this.setFocus(elements, idx);
        return;
      }
    }

    // Arrow keys / Tab navigation
    let dir = 0;
    if (key === 'Tab') {
      dir = e.shiftKey ? -1 : 1;
    } else if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'd' || key === 's') {
      dir = 1;
    } else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'a' || key === 'w') {
      dir = -1;
    }

    if (dir !== 0) {
      e.preventDefault();
      e.stopPropagation();
      this.active = true;

      let nextIdx = 0;
      if (this.currentIndex === -1) {
        nextIdx = dir === 1 ? 0 : elements.length - 1;
      } else {
        nextIdx = (this.currentIndex + dir + elements.length) % elements.length;
      }

      this.setFocus(elements, nextIdx);
    }

    // Enter / Space selection activation
    if ((key === 'Enter' || key === ' ') && this.active && this.currentIndex !== -1) {
      e.preventDefault();
      e.stopPropagation();
      const targetEl = elements[this.currentIndex];
      if (targetEl) {
        this.activateElement(targetEl);
      }
    }
  }

  activateElement(el) {
    if (el.classList.contains('char-card')) {
      const btn = el.querySelector('.btn');
      if (btn) btn.click();
    } else if (el.classList.contains('in-hand')) {
      const uid = el.getAttribute('data-uid');
      if (uid && this.game.combatView && this.game.combatView.combat) {
        const card = this.game.combatView.combat.hand.find(c => String(c.uid) === uid);
        if (card) {
          this.game.combatView.clickCard(card);
        }
      }
    } else {
      el.click();
    }
  }

  setFocus(elements, index) {
    this.clearFocus();
    this.currentIndex = index;
    const el = elements[index];
    if (el) {
      this.active = true;
      el.classList.add('kb-focus');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el.dispatchEvent(new Event('mouseenter'));
    }
  }
}

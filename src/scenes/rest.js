// Rest site (Ancestor Fire): heal, or the Smith flow (pick → preview → confirm)
// for upgrading a card.
//
// Mixed onto Game.prototype (see game.js). Uses the shared `deckOverlay` picker
// (game.js) for card selection.

import { el } from '../core/util.js';
import { topBar, button, renderCard } from '../ui/components.js';
import { canUpgrade, upgradeCard } from '../data/cards.js';
import { NODE } from '../ui/icons.js';
import { audio } from '../audio.js';

export const RestScene = {
  showRest() {
    const run = this.run;
    const panel = el('div', { class: 'rest-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(el('div', { class: 'rest-fire', html: NODE.rest }));
    panel.appendChild(el('h2', { text: 'An Ancestor Fire' }));
    panel.appendChild(el('p', { class: 'event-text', text: 'Warmth in the cold throat of the Spire. You may tend your wounds or sharpen your craft.' }));
    const choices = el('div', { class: 'choices' });
    if (run.canRestHeal()) {
      const amt = Math.floor(run.maxHp * run.restHealFraction()) + run.restHealBonus();
      choices.appendChild(button(`Rest — heal ${amt} HP`, () => {
        run.heal(amt); audio.play('reward'); this.resultThenMap(`You rest and recover ${amt} HP.`);
      }, 'primary'));
    }
    choices.appendChild(button('Smith — upgrade a card', () => {
      this.smithUpgrade((entry) => {
        run.deck[entry._i].upgraded = true; audio.play('reward'); this.resultThenMap('Your card is reforged, keener than before.');
      });
    }));
    panel.appendChild(choices);
    this.setScene(panel, 'rest');
  },

  // Smith flow: pick a card, then preview current → reforged and confirm before
  // the upgrade is actually applied. Cancelling the preview returns to the picker.
  smithUpgrade(onConfirm) {
    this.deckOverlay((c) => canUpgrade(c), (entry) => {
      this.upgradePreview(entry, () => onConfirm(entry), () => this.smithUpgrade(onConfirm));
    }, 'Upgrade which card?', 'cardflip');
  },

  // Side-by-side preview of a card and its upgraded form, gated by a confirm.
  upgradePreview(entry, onConfirm, onCancel) {
    const run = this.run;
    const before = run.instance(entry);
    const after = run.instance(entry);
    upgradeCard(after);
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box smith-preview' });
    box.appendChild(el('h3', { text: 'Reforge this card?' }));
    const compare = el('div', { class: 'smith-compare' });
    const beforeCol = el('div', { class: 'smith-col' });
    beforeCol.appendChild(el('div', { class: 'smith-label', text: 'Current' }));
    beforeCol.appendChild(renderCard(before, { onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card') }));
    compare.appendChild(beforeCol);
    compare.appendChild(el('div', { class: 'smith-arrow', html: '<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true"><path d="M2 12h24M18 4l10 8-10 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
    const afterCol = el('div', { class: 'smith-col' });
    afterCol.appendChild(el('div', { class: 'smith-label upgraded', text: 'Reforged' }));
    afterCol.appendChild(renderCard(after, { onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card') }));
    compare.appendChild(afterCol);
    box.appendChild(compare);
    const controls = el('div', { class: 'confirm-row' });
    controls.appendChild(button('Reforge', () => {
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
  },
};

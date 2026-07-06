// Rest site (Ancestor Fire): heal, or the Smith flow (pick → preview → confirm)
// for upgrading a card.
//
// Mixed onto Game.prototype (see game.js). Uses the shared `deckOverlay` picker
// (game.js) for card selection.

import { el } from '../core/util.js';
import { topBar, button, renderCard } from '../ui/components.js';
import { canUpgrade } from '../data/cards.js';
import { NODE } from '../ui/icons.js';
import { audio } from '../audio.js';

export const RestScene = {
  showRest() {
    const run = this.run;
    this.narrator.say('first_rest');
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
};

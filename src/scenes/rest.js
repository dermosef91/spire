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
import { ensureFxLayer, floatText } from '../ui/fx.js';

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
        // Ceremony beat: heal immediately (state first, cosmetics after), then
        // let embers rise off the fire and the heal number float before the
        // result screen. Double-taps are blocked by the .resting guard.
        if (panel.classList.contains('resting')) return;
        run.heal(amt);
        audio.play('reward');
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const proceed = () => this.resultThenMap(`You rest and recover ${amt} HP.`);
        if (reduceMotion) { proceed(); return; }
        panel.classList.add('resting');
        const layer = ensureFxLayer(panel);
        const fire = panel.querySelector('.rest-fire');
        floatText(layer, fire, `+${amt} HP`, 'heal');
        const lr = layer.getBoundingClientRect();
        const fr = fire.getBoundingClientRect();
        for (let i = 0; i < 9; i++) {
          const ember = el('div', { class: 'rest-ember' });
          ember.style.left = (fr.left - lr.left + fr.width * (0.3 + Math.random() * 0.4)) + 'px';
          ember.style.top = (fr.top - lr.top + fr.height * 0.55) + 'px';
          ember.style.setProperty('--dx', (Math.random() * 56 - 28) + 'px');
          ember.style.setProperty('--dur', (0.9 + Math.random() * 0.5) + 's');
          ember.style.setProperty('--delay', (i * 0.07) + 's');
          layer.appendChild(ember);
          setTimeout(() => ember.remove(), 1700);
        }
        setTimeout(proceed, 1150);
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

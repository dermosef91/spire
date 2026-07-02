// Treasure cache: gold plus a random relic.
//
// Mixed onto Game.prototype (see game.js).

import { el } from '../core/util.js';
import { topBar, button } from '../ui/components.js';
import { NODE } from '../ui/icons.js';
import { audio } from '../audio.js';

export const TreasureScene = {
  showTreasure() {
    const run = this.run;
    const panel = el('div', { class: 'event-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(el('div', { class: 'event-art', html: NODE.treasure }));
    panel.appendChild(el('h2', { text: 'A Cache of the Ancients' }));
    panel.appendChild(el('p', { class: 'event-text', text: 'A reliquary of humming brass rests in an alcove of bioluminescent moss. Within: coin, and something older.' }));
    const choices = el('div', { class: 'choices' });
    choices.appendChild(button('Open the cache', () => {
      const gold = run.rng.int(25, 45);
      run.gold += gold;
      const name = run.grantRandomRelic();
      audio.play('reward');
      this.resultThenMap(`You find ${gold} gold` + (name ? ` and the <b>${name}</b>.` : '.'));
    }, 'primary'));
    panel.appendChild(choices);
    this.setScene(panel, 'event');
  },
};

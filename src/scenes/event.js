// Random events: pick an unused event for the act, render its choices + art,
// and resolve the chosen branch (including upgrade / remove-for-gold sub-flows).
//
// Mixed onto Game.prototype (see game.js).

import { el } from '../core/util.js';
import { topBar, button } from '../ui/components.js';
import { canUpgrade } from '../data/cards.js';
import { eventsForAct } from '../data/events.js';
import { NODE } from '../ui/icons.js';

// Event illustration: prefer a generated PNG, fall back to the committed SVG
// placeholder, and finally to the generic "?" node glyph if neither exists.
function eventArt(ev) {
  const wrap = el('div', { class: 'event-art event-art-img' });
  const id = ev.art || ev.id;
  const img = el('img', { class: 'event-illo', attrs: { src: `assets/event-art/${id}.png`, alt: ev.name, draggable: 'false' } });
  img.onerror = () => {
    img.onerror = () => { img.remove(); wrap.classList.remove('event-art-img'); wrap.innerHTML = NODE.event; };
    img.src = `assets/event-art/${id}.svg`;
  };
  wrap.appendChild(img);
  return wrap;
}

export const EventScene = {
  showEvent() {
    const run = this.run;
    const pool = eventsForAct(run.act).filter((e) => !run.usedEvents.includes(e.id));
    const ev = (pool.length ? run.rng.pick(pool) : run.rng.pick(eventsForAct(run.act)));
    run.usedEvents.push(ev.id);
    const panel = el('div', { class: 'event-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(eventArt(ev));
    panel.appendChild(el('h2', { text: ev.name }));
    panel.appendChild(el('p', { class: 'event-text', text: ev.text }));
    const choices = el('div', { class: 'choices' });
    for (const ch of ev.choices) {
      if (ch.condition && !ch.condition(run)) continue;
      choices.appendChild(button(ch.label, () => this.resolveEventChoice(ev, ch)));
    }
    panel.appendChild(choices);
    this.setScene(panel, 'event');
  },

  resolveEventChoice(ev, ch) {
    const run = this.run;
    if (ch.flow === 'upgrade') {
      this.deckOverlay((c) => canUpgrade(c), (entry) => {
        run.deck[entry._i].upgraded = true;
        this.resultThenMap(ch.effect(run));
      }, 'Upgrade which card?', 'cardflip');
      return;
    }
    if (ch.flow === 'removeForGold') {
      if (run.gold < (ch.gold || 0)) { this.resultThenMap('You cannot afford that.'); return; }
      this.deckOverlay(() => true, (entry) => {
        run.gold -= ch.gold; run.removeCardAt(entry._i);
        this.resultThenMap(ch.effect(run));
      }, 'Remove which card?');
      return;
    }
    const text = ch.effect(run);
    if (run.isDead()) { this.gameOver(false); return; }
    this.resultThenMap(text);
  },
};

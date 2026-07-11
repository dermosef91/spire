// The Brass Bazaar: shop scene, inventory generation and purchase handling.
//
// Mixed onto Game.prototype (see game.js).

import { el } from '../core/util.js';
import { renderCard, topBar, relicChip, potionChip, button, highlightKeywords, sceneHeading } from '../ui/components.js';
import { CARDS, createCard } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { COLORLESS_POOL } from '../data/characters.js';
import { isCardLocked } from '../core/cardUnlocks.js';
import { UI, potionIcon } from '../ui/icons.js';
import { audio } from '../audio.js';

export const ShopScene = {
  showShop() {
    const run = this.run;
    if (!run._shop) run._shop = this.generateShop();
    const shop = run._shop;
    const panel = el('div', { class: 'shop-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(sceneHeading('The Brass Bazaar'));
    panel.appendChild(el('div', { class: 'shop-gold', html: `You carry <i class="tb-ic">${UI.coin}</i> <b>${run.gold}</b> gold` }));

    const cardSec = el('div', { class: 'shop-section' });
    cardSec.appendChild(el('h3', { text: 'Cards' }));
    const cardRow = el('div', { class: 'card-row' });
    shop.cards.forEach((item, i) => {
      if (item.sold) { cardRow.appendChild(el('div', { class: 'card sold', text: 'SOLD' })); return; }
      const holder = el('div', { class: 'shop-item' });
      holder.appendChild(renderCard(item.card, { disabled: run.gold < item.price, onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card') }));
      holder.appendChild(el('div', { class: `price ${run.gold < item.price ? 'cant' : ''}`, html: `<i class="tb-ic">${UI.coin}</i> ${item.price}` }));
      holder.addEventListener('click', () => this.buy(shop, 'cards', i));
      cardRow.appendChild(holder);
    });
    cardSec.appendChild(cardRow);
    panel.appendChild(cardSec);

    const otherSec = el('div', { class: 'shop-section shop-mixed' });
    // relics
    shop.relics.forEach((item, i) => {
      if (item.sold) return;
      const r = RELICS[item.id];
      const holder = el('div', { class: 'shop-mini' });
      holder.appendChild(relicChip(item.id, (o, n, on) => this.tooltip(o, n, on)));
      holder.appendChild(el('div', { class: 'mini-label', text: r.name }));
      holder.appendChild(el('div', { class: `price ${run.gold < item.price ? 'cant' : ''}`, html: `<i class="tb-ic">${UI.coin}</i> ${item.price}` }));
      holder.addEventListener('click', () => this.confirmBuy(shop, 'relics', i));
      otherSec.appendChild(holder);
    });
    // potions
    shop.potions.forEach((item, i) => {
      if (item.sold) return;
      const p = POTIONS[item.id];
      const holder = el('div', { class: 'shop-mini' });
      holder.appendChild(potionChip(item.id, null, null, (o, n, on) => this.tooltip(o, n, on)));
      holder.appendChild(el('div', { class: 'mini-label', text: p.name }));
      holder.appendChild(el('div', { class: `price ${run.gold < item.price ? 'cant' : ''}`, html: `<i class="tb-ic">${UI.coin}</i> ${item.price}` }));
      holder.addEventListener('click', () => this.confirmBuy(shop, 'potions', i));
      otherSec.appendChild(holder);
    });
    panel.appendChild(otherSec);

    // card removal service
    const removeRow = el('div', { class: 'shop-section' });
    if (!shop.removeUsed) {
      removeRow.appendChild(button(`Reforge — remove a card (${shop.removePrice} gold)`, () => {
        if (run.gold < shop.removePrice) { audio.play('error'); return; }
        this.deckOverlay(() => true, (entry) => {
          run.gold -= shop.removePrice; run.removeCardAt(entry._i); shop.removeUsed = true; shop.removePrice += 25;
          audio.play('coin'); this.showShop();
        }, 'Remove which card?', 'click_heavy');
      }));
    } else removeRow.appendChild(el('div', { class: 'event-text', text: 'The smith has unmade one card for you already.' }));
    panel.appendChild(removeRow);

    panel.appendChild(button('Leave the bazaar →', () => { run._shop = null; this.showMap(); }, 'primary'));
    this.setScene(panel, 'shop');
  },

  generateShop() {
    const run = this.run;
    const pool = run.character.cardPool.filter((id) => !isCardLocked(id, this.meta));
    const cardIds = run.rng.sample(pool, Math.min(4, pool.length));
    const colorlessPool = COLORLESS_POOL.filter((id) => !isCardLocked(id, this.meta));
    if (colorlessPool.length) cardIds.push(run.rng.pick(colorlessPool));
    const priceFor = (rar) => ({ common: run.rng.int(45, 60), uncommon: run.rng.int(70, 90), rare: run.rng.int(120, 160), special: run.rng.int(70, 100), basic: 50 }[rar] || 60);
    const cards = cardIds.map((id) => ({ card: createCard(id), price: priceFor(CARDS[id].rarity), sold: false }));

    const ownedSafe = Object.values(RELICS).filter((r) => !run.relics.includes(r.id) && r.rarity !== 'starter' && r.rarity !== 'boss');
    const relicPick = run.rng.sample(ownedSafe, Math.min(2, ownedSafe.length));
    const relics = relicPick.map((r) => ({ id: r.id, price: run.rng.int(130, 200), sold: false }));

    const potionPick = [this.randomPotion(), this.randomPotion()];
    const potions = potionPick.map((id) => ({ id, price: run.rng.int(50, 75), sold: false }));

    return { cards, relics, potions, removeUsed: false, removePrice: 75 };
  },

  // Explain what a relic/potion does and let the player back out before the
  // gold leaves their pouch — cards skip this (their face already shows
  // everything, and the shop's card row has no room for a second click).
  confirmBuy(shop, kind, i) {
    const run = this.run;
    const item = shop[kind][i];
    if (item.sold) return;
    if (run.gold < item.price) { audio.play('error'); return; }
    const data = kind === 'relics' ? RELICS[item.id] : POTIONS[item.id];

    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box confirm-box shop-confirm' });
    box.appendChild(el('div', { class: 'shop-confirm-icon' }, [
      kind === 'relics' ? relicChip(item.id, null) : potionChip(item.id, null, null, null),
    ]));
    box.appendChild(el('h3', { text: data.name }));
    box.appendChild(el('p', { class: 'event-text', html: highlightKeywords(data.desc) }));
    box.appendChild(el('div', { class: 'shop-confirm-price', html: `<i class="tb-ic">${UI.coin}</i> ${item.price} gold` }));
    const row = el('div', { class: 'confirm-row' });
    row.appendChild(button('Buy', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      this.buy(shop, kind, i);
    }, 'primary'));
    row.appendChild(button('Cancel', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
    }));
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  buy(shop, kind, i) {
    const run = this.run;
    const item = shop[kind][i];
    if (item.sold) return;
    if (run.gold < item.price) { audio.play('error'); return; }
    if (kind === 'relics') {
      run.gold -= item.price; item.sold = true;
      run.addRelic(item.id);
      this.tooltip(null, null, false);
      audio.play('coin');
      this.relicAcquired(item.id, () => this.showShop());
      return;
    }
    if (kind === 'cards') { run.addCardById(item.card.id, item.card.upgraded); }
    else if (kind === 'potions') {
      if (!run.addPotion(item.id)) {
        // Full belt: swap-or-drink overlay; gold is only charged on resolve.
        this.offerPotionSwap(item.id, (took) => {
          if (!took) return;
          run.gold -= item.price; item.sold = true;
          audio.play('coin');
          this.showShop();
        });
        return;
      }
    }
    run.gold -= item.price; item.sold = true;
    this.tooltip(null, null, false);
    audio.play('coin');
    this.showShop();
  },
};

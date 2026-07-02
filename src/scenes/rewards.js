// Post-combat rewards: gold/potion/relic/card rolls, the reward screen, and the
// card-choice overlay + reward-generation helpers.
//
// Mixed onto Game.prototype (see game.js).

import { el, clear } from '../core/util.js';
import { renderCard, topBar, button, FLOURISH_LEFT, FLOURISH_RIGHT } from '../ui/components.js';
import { CARDS, createCard, upgradeCard } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { COLORLESS_POOL } from '../data/characters.js';
import { UI, relicIcon, potionIcon } from '../ui/icons.js';
import { audio } from '../audio.js';

export const RewardScene = {
  showRewards(kind) {
    const run = this.run;
    const goldRange = kind === 'boss' ? [40, 60] : kind === 'elite' ? [25, 35] : [10, 20];
    const gold = run.rng.int(goldRange[0], goldRange[1]);

    const rewards = [];
    rewards.push({ type: 'gold', amount: gold, taken: false });
    // potion drop chance
    const potionChance = kind === 'boss' ? 1 : kind === 'elite' ? 0.5 : 0.4;
    if (run.rng.bool(potionChance) && run.potions.length < run.maxPotions) {
      rewards.push({ type: 'potion', id: this.randomPotion(), taken: false });
    }
    // relic for elite/boss. Bosses crown you with a boss-tier relic (the
    // Ascendant Crown among them) — an offer you may take or leave on the map.
    if (kind === 'boss') {
      const bid = run.pickBossRelicId();
      rewards.push(bid ? { type: 'bossrelic', id: bid, taken: false } : { type: 'relic', taken: false });
    } else if (kind === 'elite') {
      rewards.push({ type: 'relic', taken: false });
    }
    // card reward
    rewards.push({ type: 'card', options: this.cardRewardOptions(kind), taken: false });

    this.renderRewards(rewards, kind);
  },

  renderRewards(rewards, kind) {
    const run = this.run;
    const panel = el('div', { class: 'reward-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    const list = el('div', { class: 'reward-list' });
    let autoProceedScheduled = false;

    const rebuild = () => {
      clear(list);
      for (const rw of rewards) {
        if (rw.taken) continue;
        const row = el('button', {
          class: 'reward-row',
          html: `
            <span class="btn-decor border-outer"></span>
            <span class="btn-decor border-inner"></span>
            <span class="btn-body"></span>
            <span class="btn-ornament left">${FLOURISH_LEFT}</span>
            <span class="btn-ornament right">${FLOURISH_RIGHT}</span>
            <span class="reward-row-content"></span>
          `
        });
        const content = row.querySelector('.reward-row-content');
        if (rw.type === 'gold') {
          content.appendChild(el('div', { class: 'reward-icon', html: UI.coin }));
          content.appendChild(el('div', { class: 'reward-label', text: `${rw.amount} gold` }));
          row.addEventListener('click', () => { run.gold += rw.amount; rw.taken = true; audio.play('select'); rebuild(); });
        } else if (rw.type === 'potion') {
          const p = POTIONS[rw.id];
          content.appendChild(el('div', { class: 'reward-icon', style: { '--pcolor': p.color }, html: potionIcon() }));
          content.appendChild(el('div', { class: 'reward-label', html: `<b>${p.name}</b> — ${p.desc}` }));
          row.addEventListener('click', () => {
            if (run.addPotion(rw.id)) { rw.taken = true; audio.play('select'); rebuild(); }
          });
        } else if (rw.type === 'relic') {
          content.appendChild(el('div', { class: 'reward-icon', html: relicIcon('default') }));
          content.appendChild(el('div', { class: 'reward-label', text: 'Ancestral Relic' }));
          row.addEventListener('click', () => {
            const name = run.grantRandomRelic();
            rw.taken = true; audio.play('reward'); rebuild();
          });
        } else if (rw.type === 'bossrelic') {
          const rel = RELICS[rw.id];
          content.appendChild(el('div', { class: 'reward-icon', html: relicIcon('default') }));
          content.appendChild(el('div', { class: 'reward-label', html: `<b>${rel.name}</b> — ${rel.desc}` }));
          row.addEventListener('click', () => {
            run.addRelic(rw.id);
            rw.taken = true; audio.play('reward'); rebuild();
          });
        } else if (rw.type === 'card') {
          content.appendChild(el('div', { class: 'reward-icon', html: UI.draw }));
          content.appendChild(el('div', { class: 'reward-label', text: 'Add a card to your deck' }));
          row.addEventListener('click', () => {
            this.cardChoiceOverlay(rw.options, (picked) => {
              if (picked) run.addCardById(picked.id, picked.upgraded);
              rw.taken = true; rebuild();
            });
          });
        }
        list.appendChild(row);
      }
      if (rewards.every((r) => r.taken)) {
        list.appendChild(el('div', { class: 'reward-done', text: 'All rewards collected.' }));
        if (!autoProceedScheduled) {
          autoProceedScheduled = true;
          setTimeout(() => {
            if (this.run && rewards.every((r) => r.taken)) {
              this.afterNode(kind);
            }
          }, 300);
        }
      }
    };
    rebuild();

    const content = el('div', { class: 'reward-content' }, [
      el('h2', { class: 'reward-title', text: kind === 'boss' ? 'Boss Vanquished!' : kind === 'elite' ? 'Elite Slain!' : 'Victory' }),
      list,
      button('Proceed →', () => this.afterNode(kind), 'primary')
    ]);
    panel.appendChild(content);

    this.setScene(panel, 'reward');
  },

  cardChoiceOverlay(options, onDone) {
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box card-picker' });
    box.appendChild(el('h3', { text: 'Choose a card' }));
    const hint = el('div', { class: 'card-picker-hint', text: 'Tap a card to preview it, tap again to confirm' });
    const row = el('div', { class: 'card-row' });

    const finish = (c) => {
      this.tooltip(null, null, false);
      audio.play('select');
      document.body.removeChild(overlay);
      onDone(c);
    };

    let selectedCard = null;
    let selectedNode = null;
    for (const c of options) {
      const node = renderCard(c, {
        onClick: () => {
          if (selectedCard === c) { finish(c); return; }
          if (selectedNode) selectedNode.classList.remove('selected');
          selectedCard = c;
          selectedNode = node;
          node.classList.add('selected');
          hint.textContent = 'Tap again to confirm';
          // Also drives the tooltip on tap, not just hover, so touch users
          // (no mouseenter) still get the full, un-clipped card text.
          this.tooltip(c, node, true, 'card');
        },
        onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card'),
      });
      row.appendChild(node);
    }
    box.appendChild(row);
    box.appendChild(hint);
    box.appendChild(button('Skip', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      onDone(null);
    }));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  cardRewardOptions(kind) {
    const run = this.run;
    const pool = run.character.cardPool.slice();
    // small chance to inject a colorless option
    const byRar = { common: [], uncommon: [], rare: [] };
    for (const id of pool) { const r = CARDS[id].rarity; if (byRar[r]) byRar[r].push(id); }
    const weights = (kind === 'boss' || kind === 'elite') ? { common: 35, uncommon: 50, rare: 15 } : { common: 62, uncommon: 32, rare: 6 };
    const rar = ['common', 'uncommon', 'rare'];
    const opts = [];
    let guard = 0;
    while (opts.length < 3 && guard++ < 50) {
      const r = run.rng.weighted(rar.map((v) => ({ value: v, weight: weights[v] })));
      const arr = byRar[r].length ? byRar[r] : byRar.common;
      if (!arr.length) break;
      const id = run.rng.pick(arr);
      if (!opts.includes(id)) opts.push(id);
    }
    // include a colorless sometimes
    if (run.rng.bool(0.12) && opts.length === 3) opts[2] = run.rng.pick(COLORLESS_POOL);
    return opts.map((id) => { const c = createCard(id); if (run.rng.bool(0.10)) upgradeCard(c); return c; });
  },

  randomPotion() {
    const pool = Object.values(POTIONS);
    const weights = pool.map((p) => ({ value: p.id, weight: p.rarity === 'common' ? 65 : p.rarity === 'uncommon' ? 27 : 8 }));
    return this.run.rng.weighted(weights);
  },
};

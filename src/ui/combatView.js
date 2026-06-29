// Renders the combat scene and wires player interaction to the engine.
import { el, clear } from '../core/util.js';
import { renderCard, powerPips, topBar } from './components.js';
import { audio } from '../audio.js';

export class CombatView {
  constructor(game, combat) {
    this.game = game;
    this.combat = combat;
    this.root = null;
    this.pendingCard = null; // card awaiting an enemy target
    this.onEnd = null;
    this.ended = false;
  }

  mount(root) {
    this.root = root;
    this.combat.onUpdate = () => this.render();
    this.combat.start();
    this.render();
  }

  render() {
    if (!this.root) return;
    const c = this.combat;
    clear(this.root);
    const scene = el('div', { class: 'combat-scene' });

    scene.appendChild(topBar(this.game.run, {
      onPotion: (p, i) => this.tryPotion(p, i),
      onHover: (obj, node, on) => this.game.tooltip(obj, node, on),
    }));

    // Battlefield
    const field = el('div', { class: 'battlefield' });

    // Player side
    const pside = el('div', { class: 'player-side' });
    pside.appendChild(this.renderCombatant(c.player, false));
    if (c.isOrbUser()) pside.appendChild(this.renderOrbs());
    field.appendChild(pside);

    // Enemies
    const eside = el('div', { class: 'enemy-side' });
    for (const e of c.enemies) {
      if (!e.alive) continue;
      eside.appendChild(this.renderCombatant(e, true));
    }
    field.appendChild(eside);
    scene.appendChild(field);

    // Combat log (compact)
    const log = el('div', { class: 'combat-log' });
    log.appendChild(el('div', { text: c.logs.slice(-2).join('  ·  ') }));
    scene.appendChild(log);

    // Hand + controls
    scene.appendChild(this.renderControls());
    scene.appendChild(this.renderHand());

    this.root.appendChild(scene);

    if (c.over && !this.ended) {
      this.ended = true;
      setTimeout(() => this.onEnd && this.onEnd(c), 700);
    }
  }

  renderCombatant(ent, isEnemy) {
    const wrap = el('div', { class: `combatant ${isEnemy ? 'enemy' : 'player'} ${this.pendingCard && isEnemy ? 'targetable' : ''}` });
    if (isEnemy) wrap.appendChild(this.renderIntent(ent));
    const sprite = el('div', { class: 'sprite', text: ent.glyph });
    if (this.pendingCard && isEnemy && ent.alive) {
      sprite.classList.add('clickable');
      wrap.addEventListener('click', () => this.confirmTarget(ent));
    }
    wrap.appendChild(sprite);
    wrap.appendChild(el('div', { class: 'name', text: ent.name }));
    // HP bar
    const hpbar = el('div', { class: 'hpbar' });
    const pct = Math.max(0, (ent.hp / ent.maxHp) * 100);
    hpbar.appendChild(el('div', { class: 'hpfill', style: { width: pct + '%' } }));
    hpbar.appendChild(el('div', { class: 'hptext', text: `${Math.max(0, ent.hp)}/${ent.maxHp}` }));
    wrap.appendChild(hpbar);
    wrap.appendChild(powerPips(ent));
    return wrap;
  }

  renderIntent(enemy) {
    const it = enemy.intent;
    const wrap = el('div', { class: 'intent' });
    if (!it) { wrap.appendChild(el('span', { text: '…' })); return wrap; }
    const c = this.combat;
    const parts = [];
    if (it.type === 'attack' || it.type === 'attackdebuff') {
      const dmg = c.calcAttackDamage(it.dmg, enemy, c.player);
      const hits = it.hits || 1;
      parts.push(el('span', { class: 'intent-atk', html: `⚔ ${dmg}${hits > 1 ? `×${hits}` : ''}` }));
    }
    if (it.type === 'attackdebuff' || it.type === 'debuff') parts.push(el('span', { class: 'intent-deb', text: '☠' }));
    if (it.type === 'block' || it.type === 'buffblock') parts.push(el('span', { class: 'intent-def', text: '🛡' }));
    if (it.type === 'buff' || it.type === 'buffblock') parts.push(el('span', { class: 'intent-buf', text: '⬆' }));
    if (it.type === 'unknown') parts.push(el('span', { class: 'intent-unk', text: '❔' }));
    for (const p of parts) wrap.appendChild(p);
    wrap.title = it.name || '';
    return wrap;
  }

  renderOrbs() {
    const c = this.combat;
    const wrap = el('div', { class: 'orbs' });
    for (let i = 0; i < c.orbSlots; i++) {
      const orb = c.orbs[i];
      if (orb) {
        const cls = `orb orb-${orb.type}`;
        const label = orb.type === 'shade' ? String(orb.value) : '';
        wrap.appendChild(el('div', { class: cls, text: label, title: orbTitle(orb, c) }));
      } else {
        wrap.appendChild(el('div', { class: 'orb empty' }));
      }
    }
    if (c.focus()) wrap.appendChild(el('div', { class: 'orb-focus', html: `✨${c.focus()}` }));
    return wrap;
  }

  renderControls() {
    const c = this.combat;
    const bar = el('div', { class: 'combat-controls' });
    const energy = el('div', { class: 'energy', html: `<span class="energy-orb">${c.energy}</span><span class="energy-max">/${c.maxEnergy}</span> Àṣẹ` });
    bar.appendChild(energy);

    const piles = el('div', { class: 'piles' });
    piles.appendChild(el('div', { class: 'pile', html: `🂠 Draw <b>${c.drawPile.length}</b>` }));
    piles.appendChild(el('div', { class: 'pile', html: `🗑 Discard <b>${c.discardPile.length}</b>` }));
    if (c.exhaustPile.length) piles.appendChild(el('div', { class: 'pile', html: `💨 Exhaust <b>${c.exhaustPile.length}</b>` }));
    bar.appendChild(piles);

    const endBtn = el('button', {
      class: 'btn end-turn', text: this.pendingCard ? 'Cancel' : 'End Turn',
      on: { click: () => { if (this.pendingCard) { this.pendingCard = null; this.render(); } else this.endTurn(); } },
    });
    if (c.animating) endBtn.disabled = true;
    bar.appendChild(endBtn);
    return bar;
  }

  renderHand() {
    const c = this.combat;
    const hand = el('div', { class: 'hand' });
    for (const card of c.hand) {
      const playable = c.canPlay(card);
      const node = renderCard(card, {
        disabled: !playable,
        class: this.pendingCard === card ? 'selected' : '',
        onClick: () => this.clickCard(card),
        onHover: (cd, n, on) => this.game.tooltip(cd, n, on, 'card'),
      });
      hand.appendChild(node);
    }
    return hand;
  }

  clickCard(card) {
    const c = this.combat;
    if (c.animating || c.over) return;
    if (!c.canPlay(card)) { audio.play('error'); return; }
    if (card.target === 'enemy') {
      // need a target
      const living = c.livingEnemies();
      if (living.length === 1) { this.playCard(card, living[0]); return; }
      this.pendingCard = this.pendingCard === card ? null : card;
      this.render();
    } else {
      this.playCard(card, c.randomEnemy());
    }
  }

  confirmTarget(enemy) {
    if (!this.pendingCard) return;
    const card = this.pendingCard;
    this.pendingCard = null;
    this.playCard(card, enemy);
  }

  playCard(card, target) {
    audio.play(card.type === 'attack' ? 'attack' : 'skill');
    this.combat.playCard(card, target);
  }

  endTurn() {
    audio.play('endturn');
    this.pendingCard = null;
    this.combat.endTurn();
  }

  tryPotion(potion, idx) {
    const c = this.combat;
    if (c.over) return;
    if (potion.targeted) {
      const living = c.livingEnemies();
      if (living.length === 1) { c.usePotion(potion, living[0]); this.game.run.removePotionAt(idx); this.render(); return; }
      // simple: target first enemy for now via selection
      this.pendingPotion = { potion, idx };
      // reuse target flow: temporarily set pendingCard-like; simpler: pick random
      c.usePotion(potion, c.randomEnemy());
      this.game.run.removePotionAt(idx);
      this.render();
      return;
    }
    c.usePotion(potion, null);
    this.game.run.removePotionAt(idx);
    audio.play('skill');
    this.render();
  }
}

function orbTitle(orb, c) {
  const f = c.focus();
  const map = {
    storm: `Storm — passive: ${3 + f} to a random enemy. Evoke: ${8 + f}.`,
    tide: `Tide — passive: gain ${2 + f} Ward. Evoke: gain ${5 + f} Ward.`,
    shade: `Shade — passive: stores +${4 + f} damage (now ${orb.value}). Evoke: deal stored damage.`,
    sun: `Sun — passive: +1 Àṣẹ next turn. Evoke: gain 2 Àṣẹ now.`,
  };
  return map[orb.type] || orb.type;
}

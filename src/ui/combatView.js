// Combat scene view. Combatant elements are built once and updated in place so
// that hit shakes, lunges, flashes and floating numbers can animate without the
// DOM being torn down on every state change. The top bar, controls and hand are
// cheap and re-rendered each update.
import { el, clear } from '../core/util.js';
import { renderCard, topBar } from './components.js';
import { POWERS } from '../data/keywords.js';
import { audio } from '../audio.js';
import { ensureFxLayer, floatText, hitFlash, shake, lunge, slash, ring, screenShake, burst } from './fx.js';
import { combatModel, INTENT, UI, powerIcon } from './icons.js';
import { spriteOrSvg } from './sprites.js';

const eidOf = (ent) => (ent.isPlayer ? 'p' : 'e' + ent.idx);

export class CombatView {
  constructor(game, combat) {
    this.game = game;
    this.combat = combat;
    this.root = null;
    this.scene = null;
    this.pendingCard = null;
    this.onEnd = null;
    this.ended = false;
    this.drag = null;
    this._dragMove = (e) => this.dragMove(e);
    this._dragEnd = (e) => this.dragEnd(e);
    this.els = {};        // eid -> combatant element
    this.parts = {};      // eid -> { intent, glyph, hpfill, hptext, block, powers, medallion }
  }

  mount(root) {
    this.root = root;
    this.combat.onUpdate = () => this.update();
    this.combat.fx = (type, payload) => this.onFx(type, payload);
    this.build();
    this.combat.start();
    this.update();
  }

  build() {
    clear(this.root);
    const scene = el('div', { class: 'combat-scene' });
    this.scene = scene;
    this.topbarHolder = el('div', { class: 'combat-topbar' });
    scene.appendChild(this.topbarHolder);

    const field = el('div', { class: 'battlefield' });
    this.playerSide = el('div', { class: 'player-side' });
    this.enemySide = el('div', { class: 'enemy-side' });
    field.appendChild(this.playerSide);
    field.appendChild(this.enemySide);
    scene.appendChild(field);

    // player combatant (+ orbs holder beneath)
    this.els.p = this.buildCombatant(this.combat.player, false);
    this.playerSide.appendChild(this.els.p);
    if (this.combat.isOrbUser()) {
      this.orbsHolder = el('div', { class: 'orbs' });
      this.playerSide.appendChild(this.orbsHolder);
    }

    // enemies
    for (const e of this.combat.enemies) {
      const node = this.buildCombatant(e, true);
      this.els[eidOf(e)] = node;
      this.enemySide.appendChild(node);
    }

    this.logHolder = el('div', { class: 'combat-log' });
    scene.appendChild(this.logHolder);
    this.controlsHolder = el('div', { class: 'combat-controls-holder' });
    scene.appendChild(this.controlsHolder);
    this.handHolder = el('div', { class: 'hand' });
    scene.appendChild(this.handHolder);

    this.root.appendChild(scene);
    this.fxLayer = ensureFxLayer(scene);
  }

  buildCombatant(ent, isEnemy) {
    const wrap = el('div', { class: `combatant ${isEnemy ? 'enemy' : 'player'}`, attrs: { 'data-eid': eidOf(ent) } });
    const parts = {};
    if (isEnemy) { parts.intent = el('div', { class: 'intent' }); wrap.appendChild(parts.intent); }

    const stage = el('div', { class: 'stage' });
    parts.medallion = el('div', { class: 'medallion' });
    const spriteId = ent.isPlayer ? this.combat.run.character.id : ent.id;
    const svgHtml = combatModel(ent, this.combat.run.character.id);
    parts.glyph = el('div', { class: 'glyph imodel' }, [spriteOrSvg(spriteId, svgHtml)]);
    parts.block = el('div', { class: 'block-badge', style: { display: 'none' } });
    parts.medallion.appendChild(el('div', { class: 'med-ring' }));
    parts.medallion.appendChild(el('div', { class: 'med-core' }, [parts.glyph]));
    parts.medallion.appendChild(parts.block);
    stage.appendChild(parts.medallion);
    stage.appendChild(el('div', { class: 'ground-shadow' }));
    wrap.appendChild(stage);

    wrap.appendChild(el('div', { class: 'cname', text: ent.name }));
    const hpwrap = el('div', { class: 'hpbar' });
    parts.hpfill = el('div', { class: 'hpfill' });
    parts.hptext = el('div', { class: 'hptext' });
    hpwrap.appendChild(parts.hpfill); hpwrap.appendChild(parts.hptext);
    wrap.appendChild(hpwrap);
    parts.powers = el('div', { class: 'powers' });
    wrap.appendChild(parts.powers);

    if (isEnemy) wrap.addEventListener('click', () => { if (this.pendingCard && ent.alive) this.confirmTarget(ent); });

    this.parts[eidOf(ent)] = parts;
    return wrap;
  }

  // ----------------------------------------------------------- update (in place)
  update() {
    if (!this.scene) return;
    const c = this.combat;

    clear(this.topbarHolder).appendChild(topBar(this.game.run, {
      onPotion: (p, i) => this.tryPotion(p, i),
      onHover: (o, n, on) => this.game.tooltip(o, n, on),
    }));

    this.updateCombatant(c.player);
    for (const e of c.enemies) {
      const id = eidOf(e);
      if (e.alive) { if (this.els[id]) this.updateCombatant(e); }
      else if (this.els[id] && !this.els[id]._removing) {
        const node = this.els[id]; node._removing = true; node.classList.add('dying');
        setTimeout(() => { node.remove(); }, 620);
        delete this.els[id];
      }
    }

    if (this.orbsHolder) this.updateOrbs();

    // targeting affordance
    const targeting = !!this.pendingCard;
    this.scene.classList.toggle('targeting', targeting);
    for (const e of c.enemies) {
      const node = this.els[eidOf(e)];
      if (node) node.classList.toggle('targetable', targeting && e.alive);
    }

    clear(this.logHolder).appendChild(el('div', { text: c.logs.slice(-2).join('   ·   ') }));
    this.renderControls();
    this.renderHand();

    if (c.over && !this.ended) {
      this.ended = true;
      this.scene.classList.add(c.victory ? 'won' : 'lost');
      setTimeout(() => this.onEnd && this.onEnd(c), 850);
    }
  }

  updateCombatant(ent) {
    const p = this.parts[eidOf(ent)];
    if (!p) return;
    const pct = Math.max(0, (ent.hp / ent.maxHp) * 100);
    p.hpfill.style.width = pct + '%';
    p.hpfill.classList.toggle('low', pct < 35);
    p.hptext.textContent = `${Math.max(0, ent.hp)}/${ent.maxHp}`;
    if (ent.block > 0) { p.block.style.display = ''; p.block.textContent = ent.block; }
    else p.block.style.display = 'none';
    // powers (block shown separately)
    clear(p.powers);
    for (const [key, val] of Object.entries(ent.powers)) {
      if (!val) continue;
      const def = POWERS[key]; if (!def) continue;
      const cls = def.type === 'buff' ? 'pip-buff' : 'pip-debuff';
      p.powers.appendChild(el('div', {
        class: `pip ${cls}`, html: `<i class="pip-ic">${powerIcon(key)}</i> ${val}`,
        title: `${def.name}: ${def.desc.replace('{n}', val)}`,
      }));
    }
    // intent
    if (p.intent) this.renderIntent(ent, p.intent);
  }

  renderIntent(enemy, wrap) {
    clear(wrap);
    const it = enemy.intent;
    if (!it) { wrap.appendChild(el('span', { text: '…' })); return; }
    const c = this.combat;
    if (it.type === 'attack' || it.type === 'attackdebuff') {
      const dmg = c.calcAttackDamage(it.dmg, enemy, c.player);
      const hits = it.hits || 1;
      wrap.appendChild(el('span', { class: 'intent-atk', html: `<i class="intent-ic">${INTENT.attack}</i>${dmg}${hits > 1 ? `×${hits}` : ''}` }));
    }
    if (it.type === 'attackdebuff' || it.type === 'debuff') wrap.appendChild(el('span', { class: 'intent-deb', html: `<i class="intent-ic">${INTENT.debuff}</i>` }));
    if (it.type === 'block' || it.type === 'buffblock') wrap.appendChild(el('span', { class: 'intent-def', html: `<i class="intent-ic">${INTENT.block}</i>` }));
    if (it.type === 'buff' || it.type === 'buffblock') wrap.appendChild(el('span', { class: 'intent-buf', html: `<i class="intent-ic">${INTENT.buff}</i>` }));
    if (it.type === 'unknown') wrap.appendChild(el('span', { class: 'intent-unk', html: `<i class="intent-ic">${INTENT.unknown}</i>` }));
    wrap.title = it.name || '';
  }

  updateOrbs() {
    const c = this.combat;
    clear(this.orbsHolder);
    for (let i = 0; i < c.orbSlots; i++) {
      const orb = c.orbs[i];
      if (orb) {
        const label = orb.type === 'shade' ? String(orb.value) : '';
        this.orbsHolder.appendChild(el('div', { class: `orb orb-${orb.type}`, text: label, title: orbTitle(orb, c) }));
      } else this.orbsHolder.appendChild(el('div', { class: 'orb empty' }));
    }
    if (c.focus()) this.orbsHolder.appendChild(el('div', { class: 'orb-focus', html: `<i class="pip-ic">${powerIcon('focus')}</i>${c.focus()}` }));
  }

  renderControls() {
    const c = this.combat;
    const bar = clear(this.controlsHolder);
    bar.className = 'combat-controls-holder combat-controls';
    bar.appendChild(el('div', { class: 'energy', html: `<span class="energy-orb">${c.energy}</span><span class="energy-max">/${c.maxEnergy}</span>` }));
    const piles = el('div', { class: 'piles' });
    piles.appendChild(el('div', { class: 'pile', html: `<i class="pile-ic">${UI.draw}</i><b>${c.drawPile.length}</b>` }));
    piles.appendChild(el('div', { class: 'pile', html: `<i class="pile-ic">${UI.discard}</i><b>${c.discardPile.length}</b>` }));
    if (c.exhaustPile.length) piles.appendChild(el('div', { class: 'pile', html: `<i class="pile-ic">${UI.exhaust}</i><b>${c.exhaustPile.length}</b>` }));
    bar.appendChild(piles);
    const endBtn = el('button', {
      class: 'btn end-turn', text: this.pendingCard ? 'Cancel' : 'End Turn',
      on: { click: () => { if (this.pendingCard) { this.pendingCard = null; this.update(); } else this.endTurn(); } },
    });
    if (c.animating) endBtn.disabled = true;
    bar.appendChild(endBtn);
  }

  renderHand() {
    const c = this.combat;
    const hand = clear(this.handHolder);
    for (const card of c.hand) {
      const playable = c.canPlay(card);
      const node = renderCard(card, {
        disabled: !playable,
        class: 'in-hand ' + (this.pendingCard === card ? 'selected' : ''),
        onHover: (cd, n, on) => { if (!this.drag) this.game.tooltip(cd, n, on, 'card'); },
      });
      // Drag-and-drop to play (mouse + touch); a tap falls back to click-to-play.
      node.addEventListener('pointerdown', (e) => this.onCardPointerDown(e, card, node));
      hand.appendChild(node);
    }
  }

  // ----------------------------------------------------------- input
  clickCard(card) {
    const c = this.combat;
    if (c.animating || c.over) return;
    if (!c.canPlay(card)) { audio.play('error'); return; }
    if (card.target === 'enemy') {
      const living = c.livingEnemies();
      if (living.length === 1) { this.playCard(card, living[0]); return; }
      this.pendingCard = this.pendingCard === card ? null : card;
      this.update();
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

  // ----------------------------------------------------------- drag & drop
  onCardPointerDown(e, card, node) {
    if (this.combat.animating || this.combat.over) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.drag) return;
    const r = node.getBoundingClientRect();
    this.drag = {
      card, node, id: e.pointerId, sx: e.clientX, sy: e.clientY,
      w: r.width, h: r.height, moved: false,
      handTop: this.handHolder.getBoundingClientRect().top,
    };
    try { node.setPointerCapture(e.pointerId); } catch (_) {}
    node.addEventListener('pointermove', this._dragMove);
    node.addEventListener('pointerup', this._dragEnd);
    node.addEventListener('pointercancel', this._dragEnd);
  }

  dragMove(e) {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      d.moved = true;
      this.game.tooltip(null, null, false);
      d.node.classList.add('dragging');
      d.node.style.width = d.w + 'px';
      d.node.style.height = d.h + 'px';
      if (d.card.target === 'enemy') this.scene.classList.add('targeting');
    }
    d.node.style.left = (e.clientX - d.w / 2) + 'px';
    d.node.style.top = (e.clientY - d.h / 2) + 'px';
    const playable = this.combat.canPlay(d.card);
    if (d.card.target === 'enemy') {
      const hit = this.enemyAt(e.clientX, e.clientY);
      this.setDragOver(hit ? hit.node : null);
      d.node.classList.toggle('will-play', !!hit && playable);
    } else {
      const inZone = e.clientY < d.handTop - 6;
      d.node.classList.toggle('will-play', inZone && playable);
    }
  }

  dragEnd(e) {
    const d = this.drag;
    if (!d) return;
    d.node.removeEventListener('pointermove', this._dragMove);
    d.node.removeEventListener('pointerup', this._dragEnd);
    d.node.removeEventListener('pointercancel', this._dragEnd);
    try { d.node.releasePointerCapture(d.id); } catch (_) {}
    this.drag = null;
    this.setDragOver(null);
    this.scene.classList.remove('targeting');

    if (!d.moved) { this.clickCard(d.card); return; } // tap → click-to-play

    let played = false;
    if (this.combat.canPlay(d.card)) {
      if (d.card.target === 'enemy') {
        const hit = this.enemyAt(e.clientX, e.clientY);
        if (hit) { this.playCard(d.card, hit.e); played = true; }
      } else if (e.clientY < d.handTop - 6) {
        this.playCard(d.card, this.combat.randomEnemy());
        played = true;
      }
    }
    if (!played) audio.play('error');
    this.update(); // re-render the hand (clears the lifted node, restores layout)
  }

  enemyAt(x, y) {
    const pad = 14;
    for (const en of this.combat.livingEnemies()) {
      const node = this.els[eidOf(en)];
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return { e: en, node };
    }
    return null;
  }

  setDragOver(node) {
    if (this._dragOverNode === node) return;
    if (this._dragOverNode) this._dragOverNode.classList.remove('drag-over');
    this._dragOverNode = node;
    if (node) node.classList.add('drag-over');
  }

  playCard(card, target) {
    audio.play(card.type === 'attack' ? 'attack' : 'skill');
    // brief play animation on the card element
    const cardEl = this.handHolder.querySelector(`.card[data-uid="${card.uid}"]`);
    if (cardEl) { cardEl.classList.add('playing'); }
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
    if (this.game.isTouch() && !this._potionConfirmed) {
      this.game.confirm(`Use ${potion.name}?`, potion.desc, () => { this._potionConfirmed = true; this.tryPotion(potion, idx); this._potionConfirmed = false; });
      return;
    }
    if (potion.targeted) {
      const living = c.livingEnemies();
      const tgt = living.length === 1 ? living[0] : c.randomEnemy();
      c.usePotion(potion, tgt);
      this.game.run.removePotionAt(idx);
      this.update();
      return;
    }
    c.usePotion(potion, null);
    this.game.run.removePotionAt(idx);
    audio.play('skill');
    this.update();
  }

  // ----------------------------------------------------------- FX dispatch
  elFor(ent) { return ent ? this.els[eidOf(ent)] : null; }

  onFx(type, payload) {
    const layer = this.fxLayer;
    if (!layer) return;
    if (type === 'attackstart') {
      const src = this.elFor(payload.source);
      lunge(src, payload.source && payload.source.isPlayer ? 'right' : 'left');
      return;
    }
    if (type === 'damage') {
      const el2 = this.elFor(payload.target);
      if (!el2) return;
      if (payload.hpLost > 0) {
        floatText(layer, el2, String(payload.hpLost), 'damage');
        hitFlash(el2, 'damage');
        const big = payload.hpLost >= 14;
        shake(el2, big);
        if (payload.isAttack) slash(layer, el2);
        if (payload.target.isPlayer || big) screenShake(this.scene, big);
      } else if (payload.blocked > 0) {
        floatText(layer, el2, 'WARD', 'blocked');
        hitFlash(el2, 'block');
      }
      return;
    }
    if (type === 'block') {
      const el2 = this.elFor(payload.entity); if (!el2) return;
      floatText(layer, el2, `+${payload.amount}`, 'block');
      ring(layer, el2, 'rgba(94,169,230,0.9)');
      return;
    }
    if (type === 'heal') {
      const el2 = this.elFor(payload.entity); if (!el2) return;
      floatText(layer, el2, `+${payload.amount}`, 'heal');
      hitFlash(el2, 'heal');
      return;
    }
    if (type === 'power') {
      const el2 = this.elFor(payload.target); if (!el2) return;
      const def = POWERS[payload.key]; if (!def) return;
      floatText(layer, el2, `${def.icon}${payload.amount > 0 ? '+' : ''}${payload.amount}`, def.type === 'buff' ? 'buff' : 'debuff');
      return;
    }
    if (type === 'death') {
      const el2 = this.elFor(payload.target); if (!el2) return;
      burst(layer, el2, '#ffce5c', 18);
      el2.classList.add('dying');
      return;
    }
  }
}

function orbTitle(orb, c) {
  const f = c.focus();
  const map = {
    storm: `Storm — passive: ${3 + f} to a random enemy. Evoke: ${8 + f}.`,
    tide: `Tide — passive: gain ${2 + f} Ward. Evoke: gain ${5 + f} Ward.`,
    shade: `Shade — passive: stores +${4 + f} (now ${orb.value}). Evoke: deal stored.`,
    sun: `Sun — passive: +1 Àṣẹ next turn. Evoke: gain 2 Àṣẹ.`,
  };
  return map[orb.type] || orb.type;
}

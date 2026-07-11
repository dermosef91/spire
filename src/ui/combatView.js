// Combat scene view. Combatant elements are built once and updated in place so
// that hit shakes, lunges, flashes and floating numbers can animate without the
// DOM being torn down on every state change. The top bar, controls and hand are
// cheap and re-rendered each update.
import { el, clear } from '../core/util.js';
import { renderCard, topBar } from './components.js';
import { POWERS } from '../data/keywords.js';
import { audio } from '../audio.js';
import { ensureFxLayer, floatText, floatHTML, hitFlash, shake, lunge, slash, ring, screenShake, burst, shine, chargeUp, singleFrameAnim, faultLineVFX } from './fx.js';
import { runAttackQTE, runParryQTE } from './rhythm.js';
import { combatModel, INTENT, UI, powerIcon } from './icons.js';
import { spriteOrSvg, hasSprite } from './sprites.js';
import { background } from '../fx/background.js';

const eidOf = (ent) => (ent.isPlayer ? 'p' : 'e' + ent.idx);

export class CombatView {
  constructor(game, combat) {
    this.game = game;
    this.combat = combat;
    this.root = null;
    this.scene = null;
    this.pendingCard = null;
    this.previewCard = null; // first-tap preview; a second tap on it commits
    this.onEnd = null;
    this.ended = false;
    this.drag = null;
    this._dragMove = (e) => this.dragMove(e);
    this._dragEnd = (e) => this.dragEnd(e);
    this.els = {};        // eid -> combatant element
    this.parts = {};      // eid -> { intent, glyph, hpfill, hptext, block, powers, medallion }
    this._lastHandCards = [];
    this._lastEnergy = null; // for the energy-spent pulse
    this._lastHp = {};       // eid -> hp, for the hp-bar ghost trail
    this._lastPowers = {};   // eid -> {key: val}, for pip gain pops
    this._lastIntent = {};   // eid -> signature, for new-intent pops
    this.tempPoses = {};  // locks pose updates during dynamic animations
    this._suggestEndTurn = false; // true once no card in hand is playable
    this._focusEndTurnPending = false;
    this.endTurnBtn = null;
  }

  // Does this card visibly synergize with the current board? (used to telegraph
  // a "combo-ready" glow so players learn interactions). Kept intentionally
  // conservative: attacks light up when a foe is Exposed (takes +50% damage).
  comboHint(card) {
    if (card.type !== 'attack') return false;
    return this.combat.livingEnemies().some((e) => e.powers.vulnerable);
  }

  // (Re)wire the enemy-attack parry QTE to the current rhythm setting. Called
  // from mount and again by Game.setRhythm() when the top-bar toggle flips
  // mid-combat — attack QTEs check rhythmOn() per play, the parry prompt is
  // bound once, so it must be rebound here.
  bindParryPrompt() {
    this.combat.parryPrompt = this.game.rhythmOn()
      ? (e) => runParryQTE({ isTouch: this.game.isTouch(), isTutorial: !this.game.meta.tutorialDone, marks: this.parryMarksFor(e) })
      : null;
  }

  // Bigger incoming attacks demand more than a single timed press: one
  // directional swipe per blow (multi-hit flurries), capped at 3, plus a
  // bump for a single heavy nuke even at hits=1 so telegraphed boss swings
  // still read as a harder parry.
  parryMarksFor(e) {
    const move = e && e.bp && e.bp.moves[e.move];
    const intent = move && move.intent;
    const dmg = (intent && intent.dmg) || 0;
    const hits = (intent && intent.hits) || 1;
    let marks = Math.min(3, hits);
    if (dmg >= 20) marks = Math.max(marks, 2);
    if (dmg >= 30) marks = Math.max(marks, 3);
    return marks;
  }

  mount(root) {
    this.root = root;
    this.combat.onUpdate = () => this.update();
    this.combat.fx = (type, payload) => this.onFx(type, payload);
    this.bindParryPrompt();
    this._lastHandCards = [];
    this.build();

    this._onKeydown = (e) => this.handleKeydown(e);
    document.addEventListener('keydown', this._onKeydown);

    // Slower combat open: show a "Battle Start" banner first, then let the
    // opening draw play out after it so cards deal in one-by-one rather than
    // appearing underneath the popup.
    this.announce('Battle Start', { kind: 'battle' });
    setTimeout(() => { if (this.scene && !this.combat.over) this.combat.start(); }, 650);
  }

  handleKeydown(e) {
    if (this.ended || this.combat.over || this.combat.animating) return;

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    const key = e.key;
    if ((key >= '1' && key <= '9') || key === '0') {
      const idx = key === '0' ? 9 : parseInt(key) - 1;
      const hand = this.combat.hand;
      if (idx >= 0 && idx < hand.length) {
        e.preventDefault();
        e.stopPropagation();
        this.clickCard(hand[idx]);
      }
    } else if ((key === ' ' || e.code === 'Space') && this.previewCard) {
      e.preventDefault();
      e.stopPropagation();
      this.clickCard(this.previewCard);
    } else if (key === 'Escape' || key === 'Esc') {
      if (this.previewCard || this.pendingCard) {
        e.preventDefault();
        e.stopPropagation();
        this.previewCard = null;
        this.pendingCard = null;
        this.update();
      }
    }
  }

  // Centered turn/battle announcement banner. Purely cosmetic — dropped into the
  // fx layer and self-removes once its CSS animation finishes.
  announce(text, opts = {}) {
    const layer = this.fxLayer;
    if (!layer) return;
    const kind = opts.kind || 'turn';
    const node = el('div', { class: `combat-announce announce-${kind}`, text });
    layer.appendChild(node);
    setTimeout(() => { node.remove(); }, opts.duration || 1150);
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

    scene.addEventListener('click', (e) => {
      if (!e.target.closest('.card, .combatant, .btn, .screen-pile, .potion-slot, .topbar-btn')) {
        if (this.pendingCard || this.previewCard) {
          this.pendingCard = null;
          this.previewCard = null;
          this.update();
        }
      }
    });

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

    this.drawPileEl = el('div', { class: 'screen-pile draw-pile', title: 'Draw Pile' });
    this.drawPileEl.addEventListener('click', () => {
      if (this.ended || this.combat.over) return;
      audio.play('select');
      this.game.viewCardsOverlay(this.combat.drawPile, `Draw Pile (${this.combat.drawPile.length})`);
    });
    scene.appendChild(this.drawPileEl);

    this.discardPileEl = el('div', { class: 'screen-pile discard-pile', title: 'Discard Pile' });
    this.discardPileEl.addEventListener('click', () => {
      if (this.ended || this.combat.over) return;
      audio.play('select');
      this.game.viewCardsOverlay(this.combat.discardPile, `Discard Pile (${this.combat.discardPile.length})`);
    });
    scene.appendChild(this.discardPileEl);
    this.consumePileEl = el('div', { class: 'screen-pile consume-pile', title: 'Consume Pile', style: { display: 'none' } });
    scene.appendChild(this.consumePileEl);

    this.root.appendChild(scene);
    this.fxLayer = ensureFxLayer(scene);
  }

  buildCombatant(ent, isEnemy) {
    const wrap = el('div', { class: `combatant ${isEnemy ? 'enemy' : 'player'}`, attrs: { 'data-eid': eidOf(ent) } });
    const parts = {};
    if (isEnemy) { parts.intent = el('div', { class: 'intent' }); wrap.appendChild(parts.intent); }

    const stage = el('div', { class: 'stage' });
    parts.medallion = el('div', { class: 'medallion' });
    parts.medallion.appendChild(el('div', { class: 'med-ring' }));
    parts.medallion.appendChild(el('div', { class: 'med-core' }));

    const spriteId = ent.isPlayer ? this.combat.run.character.id : ent.id;
    const svgHtml = combatModel(ent, this.combat.run.character.id);
    parts.glyph = el('div', { class: 'glyph imodel' }, [spriteOrSvg(spriteId, svgHtml)]);
    parts.block = el('div', { class: 'block-badge', style: { display: 'none' } });

    stage.appendChild(parts.medallion);
    stage.appendChild(parts.glyph);
    stage.appendChild(el('div', { class: 'ground-shadow' }));
    wrap.appendChild(stage);

    // New health bar / nameplate design
    const infoWrap = el('div', { class: 'combatant-info' });

    const nameRow = el('div', { class: 'combatant-name-row' });
    const nameEl = el('div', { class: 'combatant-name', text: ent.name });
    const badgeEl = el('div', { class: 'combatant-badge', html: BADGE_SVG });
    nameRow.appendChild(nameEl);
    nameRow.appendChild(badgeEl);

    const hpwrap = el('div', { class: 'hpbar' });
    // Ghost trail: a pale fill behind the real one that lingers at the old
    // width after a hit, then drains down (delayed transition in styles.css).
    parts.hpghost = el('div', { class: 'hpghost' });
    parts.hpfill = el('div', { class: 'hpfill' });
    parts.hptext = el('div', { class: 'hptext' });
    hpwrap.appendChild(parts.hpghost);
    hpwrap.appendChild(parts.hpfill);
    hpwrap.appendChild(parts.hptext);

    infoWrap.appendChild(nameRow);
    infoWrap.appendChild(hpwrap);
    infoWrap.appendChild(parts.block);
    wrap.appendChild(infoWrap);

    parts.powers = el('div', { class: 'powers' });
    wrap.appendChild(parts.powers);

    const blockDef = POWERS.block;
    if (blockDef) {
      parts.block.addEventListener('mouseenter', () => {
        this.game.tooltip({ name: blockDef.name, desc: blockDef.desc }, parts.block, true);
      });
      parts.block.addEventListener('mouseleave', () => {
        this.game.tooltip(null, null, false);
      });
      parts.block.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.tooltip({ name: blockDef.name, desc: blockDef.desc }, parts.block, true);
      });
    }

    if (isEnemy) wrap.addEventListener('click', () => { if (this.pendingCard && ent.alive) this.confirmTarget(ent); });

    this.parts[eidOf(ent)] = parts;
    return wrap;
  }

  // ----------------------------------------------------------- update (in place)
  update() {
    if (!this.scene) return;
    this.game.tooltip(null, null, false);
    const c = this.combat;

    clear(this.topbarHolder).appendChild(topBar(this.game.run, {
      hp: c.player.hp,
      maxHp: c.player.maxHp,
      onPotion: (p, i) => this.tryPotion(p, i),
      onHover: (o, n, on) => this.game.tooltip(o, n, on),
    }));
    this.applyRelicPulses();
    this.applyGoldFx();

    this.updateCombatant(c.player);
    for (const e of c.enemies) {
      const id = eidOf(e);
      if (e.alive) {
        // A foe summoned mid-combat has no node yet — build one on the fly and
        // let it animate in via the `.summoning` entrance class.
        if (!this.els[id]) {
          const node = this.buildCombatant(e, true);
          node.classList.add('summoning');
          this.els[id] = node;
          this.enemySide.appendChild(node);
        }
        this.updateCombatant(e);
      }
      else if (this.els[id] && !this.els[id]._removing) {
        const node = this.els[id]; node._removing = true;
        delete this.els[id];
        // Give the killing hit a 0.5s beat to land before the enemy visibly
        // collapses (plus the player-swing beat) — otherwise the collapse
        // animation could start before the hit's damage number/flash even
        // show. The 'death' fx handler computed the delay from its payload
        // and stashed it on the node; it fires synchronously during the hit,
        // before this microtask-deferred update runs.
        setTimeout(() => {
          node.classList.add('dying');
          setTimeout(() => { node.remove(); }, 620);
        }, node._deathFxDelay || 500);
      }
    }

    if (this.orbsHolder) this.updateOrbs();

    // Shrink the enemy medallions when the board gets crowded (summoners can put
    // 3+ foes on one side, which otherwise wraps into the hand).
    const livingCount = c.livingEnemies().length;
    this.enemySide.classList.toggle('enemies-3', livingCount === 3);
    this.enemySide.classList.toggle('enemies-4', livingCount >= 4);

    // targeting affordance
    const targeting = !!this.pendingCard;
    this.scene.classList.toggle('targeting', targeting);
    for (const e of c.enemies) {
      const node = this.els[eidOf(e)];
      if (node) node.classList.toggle('targetable', targeting && e.alive);
    }

    // targeting prompt
    let promptEl = this.scene.querySelector('.targeting-prompt');
    if (targeting) {
      if (!promptEl) {
        promptEl = el('div', { class: 'targeting-prompt', text: 'SELECT A TARGET' });
        this.scene.appendChild(promptEl);
      }
    } else {
      if (promptEl) promptEl.remove();
    }

    // Drop a stale preview if that card has left the hand (played/discarded).
    if (this.previewCard && !c.hand.some((cd) => cd.uid === this.previewCard.uid)) this.previewCard = null;

    clear(this.logHolder).appendChild(el('div', { text: c.logs.slice(-2).join('   ·   ') }));
    this.renderControls();
    this.renderHand();
    this.syncEndTurnFocus();

    if (c.over && !this.ended) {
      this.ended = true;
      if (this._onKeydown) {
        document.removeEventListener('keydown', this._onKeydown);
        this._onKeydown = null;
      }
      c.parryPrompt = null;
      this.scene.classList.add(c.victory ? 'won' : 'lost');
      // Victory now waits a bit longer than a loss: the killing enemy's death
      // collapse is deliberately delayed ~0.5s+ (see the 'death' fx / dying
      // branch above), so the reward hand-off needs the extra room or it cuts
      // that animation short.
      setTimeout(() => this.onEnd && this.onEnd(c), c.victory ? 1350 : 850);
    }
  }

  updateCombatant(ent) {
    const p = this.parts[eidOf(ent)];
    if (!p) return;

    // Persistent state auras (survive in-place re-renders).
    const wrap = this.els[eidOf(ent)];
    if (wrap) {
      wrap.classList.toggle('phased', !!ent._phased);
      wrap.classList.toggle('enraged', !!ent._enraged);
      wrap.classList.toggle('nemesis', !!ent._nemesis);
    }

    if (!this.tempPoses[eidOf(ent)]) {
      this.setSpritePose(ent, ent.block > 0 ? 'block' : 'idle');
    }

    const pct = Math.max(0, (ent.hp / ent.maxHp) * 100);
    p.hpfill.style.width = pct + '%';
    p.hpfill.classList.toggle('low', pct < 35);
    p.hptext.textContent = `${Math.max(0, ent.hp)}/${ent.maxHp}`;
    // Ghost trail: on damage, freeze the ghost where it currently sits (so a
    // second hit mid-drain doesn't jump it back up) and let the delayed CSS
    // transition drain it down to the new fill. Heals/first render just snap it.
    const eid = eidOf(ent);
    if (p.hpghost && this._lastHp[eid] !== ent.hp) {
      const g = p.hpghost;
      const prev = this._lastHp[eid];
      if (prev == null || ent.hp >= prev) {
        g.style.transition = 'none';
        g.style.width = pct + '%';
        void g.offsetWidth;
        g.style.transition = '';
      } else {
        const barW = g.parentElement ? g.parentElement.clientWidth : 0;
        const curPct = barW > 0 ? (g.getBoundingClientRect().width / barW) * 100 : pct;
        g.style.transition = 'none';
        g.style.width = Math.max(curPct, pct) + '%';
        void g.offsetWidth;
        g.style.transition = '';
        requestAnimationFrame(() => { g.style.width = pct + '%'; });
      }
      this._lastHp[eid] = ent.hp;
    }
    if (ent.block > 0) { p.block.style.display = ''; p.block.textContent = ent.block; }
    else p.block.style.display = 'none';
    // powers (block shown separately)
    clear(p.powers);
    const prevPowers = this._lastPowers[eid] || {};
    for (const [key, val] of Object.entries(ent.powers)) {
      if (!val) continue;
      const def = POWERS[key]; if (!def) continue;
      // Pop a pip that just appeared or grew — class applied at build time so
      // there's no rAF race with the in-place re-render.
      const pop = !(key in prevPowers) || val > prevPowers[key] ? ' pip-pop' : '';
      const cls = (def.type === 'buff' ? 'pip-buff' : 'pip-debuff') + pop;
      let desc = def.desc;
      if (desc.includes('{n}')) {
        desc = desc.replace(/{n}/g, val);
      } else if (def.ticksDown) {
        desc = `${desc} (${val} turn${val > 1 ? 's' : ''} remaining)`;
      }
      const pip = el('div', {
        class: `pip ${cls}`, html: `<i class="pip-ic">${powerIcon(key)}</i> ${val}`,
        title: `${def.name}: ${desc}`,
      });
      pip.addEventListener('mouseenter', () => {
        this.game.tooltip({ name: def.name, desc }, pip, true);
      });
      pip.addEventListener('mouseleave', () => {
        this.game.tooltip(null, null, false);
      });
      pip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.tooltip({ name: def.name, desc }, pip, true);
      });
      p.powers.appendChild(pip);
    }
    this._lastPowers[eid] = { ...ent.powers };
    // intent
    if (p.intent) this.renderIntent(ent, p.intent);
  }

  renderIntent(enemy, wrap) {
    clear(wrap);
    const it = enemy.intent;
    if (!it) { wrap.appendChild(el('span', { text: '…' })); return; }
    const c = this.combat;
    if (it.type === 'attack' || it.type === 'attackdebuff' || it.type === 'attacksteal') {
      const dmg = c.calcAttackDamage(it.dmg, enemy, c.player);
      const hits = it.hits || 1;
      wrap.appendChild(el('span', { class: 'intent-atk', attrs: { 'data-intent-type': 'attack' }, html: `<i class="intent-ic">${INTENT.attack}</i>${dmg}${hits > 1 ? `×${hits}` : ''}` }));
    }
    if (it.type === 'attackdebuff' || it.type === 'debuff' || it.type === 'debuffblock') wrap.appendChild(el('span', { class: 'intent-deb', attrs: { 'data-intent-type': 'debuff' }, html: `<i class="intent-ic">${INTENT.debuff}</i>` }));
    if (it.type === 'attacksteal') {
      const goldAmt = it.gold || 0;
      wrap.appendChild(el('span', { class: 'intent-steal', attrs: { 'data-intent-type': 'steal' }, html: `<i class="intent-ic">${INTENT.steal}</i>${goldAmt > 0 ? goldAmt : ''}` }));
    }
    if (it.type === 'block' || it.type === 'buffblock' || it.type === 'debuffblock') {
      const blockAmt = it.block || 0;
      wrap.appendChild(el('span', { class: 'intent-def', attrs: { 'data-intent-type': 'block' }, html: `<i class="intent-ic">${INTENT.block}</i>${blockAmt > 0 ? blockAmt : ''}` }));
    }
    if (it.type === 'buff' || it.type === 'buffblock') wrap.appendChild(el('span', { class: 'intent-buf', attrs: { 'data-intent-type': 'buff' }, html: `<i class="intent-ic">${INTENT.buff}</i>` }));
    if (it.type === 'unknown') wrap.appendChild(el('span', { class: 'intent-unk', attrs: { 'data-intent-type': 'unknown' }, html: `<i class="intent-ic">${INTENT.unknown}</i>` }));
    if (it.type === 'counter') wrap.appendChild(el('span', { class: 'intent-ctr', attrs: { 'data-intent-type': 'counter' }, html: `<i class="intent-ic">${INTENT.counter}</i>` }));
    if (it.type === 'flee') wrap.appendChild(el('span', { class: 'intent-flee', attrs: { 'data-intent-type': 'flee' }, html: `<i class="intent-ic">${INTENT.flee}</i>` }));
    wrap.title = it.name || '';
    // Pop the pill when the telegraphed move actually changed (move name, type
    // or the displayed damage — Strength/Exposed shifts count too). Skipped on
    // the first render so the battle-start entrance isn't doubled.
    const eid = eidOf(enemy);
    const sig = `${it.name || ''}|${wrap.textContent}`;
    if (this._lastIntent[eid] !== undefined && this._lastIntent[eid] !== sig) {
      wrap.classList.remove('intent-new');
      void wrap.offsetWidth;
      wrap.classList.add('intent-new');
      setTimeout(() => wrap.classList.remove('intent-new'), 450);
    }
    this._lastIntent[eid] = sig;
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
    const energyEl = el('div', { class: 'energy', html: `<span class="energy-orb">${c.energy}</span><span class="energy-max">/${c.maxEnergy}</span>` });
    // Pulse the orb when Àṣẹ is spent (down) or granted (up) this update.
    if (this._lastEnergy != null && !c.over) {
      const orb = energyEl.querySelector('.energy-orb');
      if (c.energy < this._lastEnergy) orb.classList.add('spent');
      else if (c.energy > this._lastEnergy) orb.classList.add('gained');
    }
    this._lastEnergy = c.energy;
    bar.appendChild(energyEl);

    // Update screen piles (absolute positioned stacks)
    if (this.drawPileEl) {
      clear(this.drawPileEl);
      this.drawPileEl.appendChild(el('div', { class: 'pile-stack-art', html: UI.drawStack }));
      this.drawPileEl.appendChild(el('div', { class: 'pile-badge', text: String(c.drawPile.length) }));
    }
    if (this.discardPileEl) {
      clear(this.discardPileEl);
      this.discardPileEl.appendChild(el('div', { class: 'pile-stack-art', html: UI.discardStack }));
      this.discardPileEl.appendChild(el('div', { class: 'pile-badge', text: String(c.discardPile.length) }));
    }
    if (this.consumePileEl) {
      clear(this.consumePileEl);
      if (c.consumePile.length) {
        this.consumePileEl.style.display = '';
        this.consumePileEl.appendChild(el('div', { class: 'pile-stack-art', html: UI.consumeStack }));
        this.consumePileEl.appendChild(el('div', { class: 'pile-badge', text: String(c.consumePile.length) }));
      } else {
        this.consumePileEl.style.display = 'none';
      }
    }
    const textStr = this.pendingCard ? 'Cancel' : 'End Turn';
    // Nothing left to play this turn (empty hand, or every card in hand is
    // unaffordable/unplayable) — suggest the only legal action.
    const suggestEndTurn = !c.over && !c.animating && !this.pendingCard && !c.hand.some((card) => c.canPlay(card));
    this._focusEndTurnPending = suggestEndTurn && !this._suggestEndTurn;
    this._suggestEndTurn = suggestEndTurn;
    const endBtn = el('button', {
      class: 'btn end-turn' + (suggestEndTurn ? ' suggested' : ''),
      html: `
        <span class="end-turn-decor border-outer"></span>
        <span class="end-turn-decor border-inner"></span>
        <span class="end-turn-body"></span>
        <span class="end-turn-content">
          <span class="end-turn-text">${textStr}</span>

        </span>
      `,
      on: {
        click: () => { if (this.pendingCard) { this.pendingCard = null; this.previewCard = null; this.update(); } else this.endTurn(); },
        mousemove: (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const px = ((e.clientX - rect.left) / rect.width) - 0.5;
          const py = ((e.clientY - rect.top) / rect.height) - 0.5;
          e.currentTarget.style.setProperty('--mx', String(px));
          e.currentTarget.style.setProperty('--my', String(py));
        },
        mouseleave: (e) => {
          e.currentTarget.style.removeProperty('--mx');
          e.currentTarget.style.removeProperty('--my');
        }
      },
    });
    if (c.animating) endBtn.disabled = true;
    bar.appendChild(endBtn);
    this.endTurnBtn = endBtn;
  }

  renderHand() {
    const c = this.combat;

    // 1. Identify which cards are being removed from the hand
    const prevHand = this._lastHandCards || [];
    const currentHand = c.hand;
    this._lastHandCards = currentHand.slice();

    const goneCards = prevHand.filter(pc => !currentHand.some(cc => cc.uid === pc.uid));

    // Animate gone/played/discarded cards
    if (goneCards.length > 0 && this.scene && this.discardPileEl) {
      const sceneRect = this.scene.getBoundingClientRect();

      goneCards.forEach((card) => {
        const cardEl = this.handHolder.querySelector(`.card[data-uid="${card.uid}"]`);
        if (cardEl) {
          const isConsumed = card.consume || card.type === 'power' || card._forceConsume || (c.consumePile && c.consumePile.some(ec => ec.uid === card.uid));
          const targetPileEl = (isConsumed && this.consumePileEl) ? this.consumePileEl : this.discardPileEl;

          if (targetPileEl) {
            const cardRect = cardEl.getBoundingClientRect();
            const clone = cardEl.cloneNode(true);

            clone.classList.remove('in-hand', 'selected', 'dragging');
            clone.classList.add('flying-card');

            const startX = cardRect.left - sceneRect.left;
            const startY = cardRect.top - sceneRect.top;

            clone.style.position = 'absolute';
            clone.style.left = `${startX}px`;
            clone.style.top = `${startY}px`;
            clone.style.width = `${cardRect.width}px`;
            clone.style.height = `${cardRect.height}px`;
            clone.style.margin = '0';
            clone.style.zIndex = '100';
            clone.style.pointerEvents = 'none';
            clone.style.transformOrigin = 'center center';
            clone.style.transform = cardEl.style.transform || window.getComputedStyle(cardEl).transform;

            this.scene.appendChild(clone);

            // Determine destination rect
            let destRect;
            if (isConsumed && (!this.consumePileEl || !c.consumePile || c.consumePile.length === 0)) {
              const discRect = this.discardPileEl.getBoundingClientRect();
              destRect = {
                left: discRect.left,
                top: discRect.top - 102,
                width: discRect.width,
                height: discRect.height
              };
            } else {
              destRect = targetPileEl.getBoundingClientRect();
            }

            const destX = (destRect.left - sceneRect.left) + (destRect.width / 2) - (cardRect.width / 2);
            const destY = (destRect.top - sceneRect.top) + (destRect.height / 2) - (cardRect.height / 2);

            const anim = clone.animate([
              {
                transform: clone.style.transform,
                opacity: 1
              },
              {
                transform: `translate(${destX - startX}px, ${destY - startY}px) scale(0.18) rotate(35deg)`,
                opacity: 0
              }
            ], {
              duration: 450,
              easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
            });

            anim.onfinish = () => {
              clone.remove();
            };
          }
        }
      });
    }

    const hand = clear(this.handHolder);
    const N = c.hand.length;
    const mid = (N - 1) / 2;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const newCardsToAnimate = [];

    c.hand.forEach((card, idx) => {
      const playable = c.canPlay(card);
      const affordable = playable ? 'affordable ' : '';
      const combo = (playable && this.comboHint(card)) ? 'combo-ready ' : '';
      const isPreview = this.previewCard && this.previewCard.uid === card.uid;
      const node = renderCard(card, {
        disabled: !playable,
        class: 'in-hand ' + affordable + combo + (this.pendingCard && this.pendingCard.uid === card.uid ? 'selected ' : '') + (isPreview ? 'previewing' : ''),
        onHover: (cd, n, on) => { if (!this.drag) this.game.tooltip(cd, n, on, 'card-full'); },
      });

      const diff = idx - mid;
      // A previewed card sits straight and un-dipped so it reads as a clean preview.
      const angle = isPreview ? 0 : diff * Math.min(8, 32 / Math.max(1, N));
      const shift = isPreview ? 0 : Math.pow(Math.abs(diff), 1.5) * 5;

      node.style.setProperty('--angle', `${angle}deg`);
      node.style.setProperty('--shift', `${shift}px`);

      // Drag-and-drop to play (mouse + touch); a tap falls back to click-to-play.
      node.addEventListener('pointerdown', (e) => this.onCardPointerDown(e, card, node));
      hand.appendChild(node);

      // 2. Identify new cards to animate (skipped entirely under reduced motion,
      // so those cards just render straight into place with no hide/fly step).
      const isNew = !prevHand.some(pc => pc.uid === card.uid);
      if (isNew && this.drawPileEl && !reduceMotion) {
        newCardsToAnimate.push({ node, newIdx: newCardsToAnimate.length });

        // Hide card immediately before layout and animation
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
      }
    });

    // Overlap cards instead of overflowing/scrolling once a wide hand no
    // longer fits the available width (mainly landscape phones, where a big
    // hand used to run off past the pinned energy orb / End Turn and require
    // a horizontal scroll to reach). Must run before the rAF-deferred fly-in
    // animation below reads card positions, so it lands on the final,
    // overlapped layout rather than the pre-overlap one.
    this.applyHandSpacing(hand, N);

    // 3. Animate new cards flying from draw pile
    if (newCardsToAnimate.length > 0 && this.drawPileEl) {
      requestAnimationFrame(() => {
        const drawRect = this.drawPileEl.getBoundingClientRect();
        if (drawRect.width > 0) {
          newCardsToAnimate.forEach(({ node, newIdx }) => {
            if (!document.body.contains(node)) return;

            const nodeRect = node.getBoundingClientRect();
            if (nodeRect.width > 0) {
              const dx = drawRect.left - nodeRect.left;
              const dy = drawRect.top - nodeRect.top;

              const fannedTransform = window.getComputedStyle(node).transform;
              // Widen the stagger a touch so cards clearly deal in one-by-one.
              const delay = Math.min(newIdx * 95, 520);

              setTimeout(() => {
                if (document.body.contains(node)) audio.play('draw');
              }, delay);

              const anim = node.animate([
                {
                  transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(0deg)`,
                  opacity: 0
                },
                {
                  transform: fannedTransform,
                  opacity: 1
                }
              ], {
                duration: 450,
                easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.12)',
                delay: delay
              });

              anim.onfinish = () => {
                node.style.opacity = '';
                node.style.pointerEvents = '';
              };
            } else {
              // Safeguard if layout measurements failed
              node.style.opacity = '';
              node.style.pointerEvents = '';
            }
          });
        } else {
          // Safeguard if draw pile measurements failed
          newCardsToAnimate.forEach(({ node }) => {
            node.style.opacity = '';
            node.style.pointerEvents = '';
          });
        }
      });
    }
  }

  // Replaces the flexbox `gap` between hand cards with explicit per-card
  // margins so the spacing can go negative (cards overlapping) once the fan
  // no longer fits `hand`'s available width — a wide hand then reads as an
  // overlapped stack instead of spilling past the container and needing a
  // horizontal scroll. A card can always still be seen in full: hover/
  // .selected/.previewing already lift it to a higher z-index (styles.css).
  // Overlap is capped at 55% of a card's width so a very large hand still
  // leaves each card's cost/title readable before falling back to the
  // existing horizontal scroll for the remainder.
  applyHandSpacing(hand, N) {
    const cardNodes = hand.children;
    if (!cardNodes.length) return;
    const style = window.getComputedStyle(hand);
    const baseGap = parseFloat(style.columnGap) || 0;
    const available = hand.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const cardWidth = cardNodes[0].offsetWidth;
    if (!cardWidth || !available) return;
    const natural = cardWidth * N + baseGap * (N - 1);
    let gap = baseGap;
    if (natural > available && N > 1) {
      const reduction = (natural - available) / (N - 1);
      gap = Math.max(baseGap - reduction, -cardWidth * 0.55);
    }
    hand.style.gap = '0px';
    for (let i = 0; i < cardNodes.length; i++) {
      cardNodes[i].style.marginLeft = i === 0 ? '0px' : `${gap}px`;
    }
  }

  // Nudges the keyboard "play cursor" onto End Turn the instant it becomes
  // the only legal action, so keyboard players can just hit Enter. Only fires
  // on the false→true edge (not every re-render) so it never fights a player
  // who has deliberately tabbed elsewhere (e.g. to check a pile) while the
  // suggestion is still active.
  syncEndTurnFocus() {
    if (!this._focusEndTurnPending) return;
    this._focusEndTurnPending = false;
    const kb = this.game.keyboard;
    if (!kb || !this.endTurnBtn) return;
    const elements = kb.getElements();
    const idx = elements.indexOf(this.endTurnBtn);
    if (idx !== -1) kb.setFocus(elements, idx);
  }

  // ----------------------------------------------------------- input
  clickCard(card) {
    const c = this.combat;
    if (c.animating || c.over) return;
    const living = c.livingEnemies();
    const isRegularAttack = card.type === 'attack' && card.target === 'enemy';
    const needsTargetFirst = isRegularAttack && living.length > 1;

    // If the card is already selected/previewed:
    if (this.previewCard && this.previewCard.uid === card.uid) {
      // If we needed a target first and they tapped the card itself again, cancel selection.
      if (needsTargetFirst) {
        this.previewCard = null;
        this.pendingCard = null;
        this.update();
        return;
      }
      // Second tap on a normal previewed card → commit.
      this.previewCard = null;
      if (!c.canPlay(card)) { audio.play('error'); this.update(); return; }
      if (card.target === 'enemy') {
        if (living.length === 1) { this.playCard(card, living[0]); return; }
        this.pendingCard = card;
        this.update();
      } else {
        this.playCard(card, c.randomEnemy());
      }
      return;
    }

    // First tap on the card:
    audio.play('pickcard');
    this.previewCard = card;
    if (needsTargetFirst) {
      this.pendingCard = card;
    } else {
      this.pendingCard = null;
    }
    this.update();
  }

  confirmTarget(enemy) {
    if (!this.pendingCard) return;
    const card = this.pendingCard;
    this.pendingCard = null;
    this.previewCard = null;
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
    node.addEventListener('lostpointercapture', this._dragEnd);
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
    d.node.removeEventListener('lostpointercapture', this._dragEnd);
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

  async playCard(card, target) {
    this.previewCard = null;
    const c = this.combat;
    const marks = this.marksFor(card);
    // The QTE result travels into the engine as explicit playCard opts; the
    // engine echoes card/charge back out through the fx payloads its handlers
    // read (see FX_HANDLERS below), so no state is smuggled between the two.
    let rhythmGrade = null;
    let rhythmMult = 1;
    let charge = 0;
    if (this.game.rhythmOn() && !this.rhythmSuppressed && card.type === 'attack' && !c.over) {
      c.animating = true; // blocks End Turn and further card input during the QTE
      this.update();
      const { grade, mult } = await runAttackQTE({
        marks,
        isTouch: this.game.isTouch(),
        isTutorial: !this.game.meta.tutorialDone
      });
      c.animating = false;
      rhythmGrade = grade;
      rhythmMult = mult;
      // Strong attack — 3+ QTE marks — charges up for a more epic strike,
      // burning brighter the cleaner the timing.
      if (marks >= 3) charge = grade === 'perfect' ? 5 : grade === 'miss' ? 3 : 4;
    } else if (card.type === 'attack' && marks >= 3 && !c.over) {
      // Rhythm off: heavy attacks still land a charged strike.
      charge = 4;
    }
    audio.play('playcard');
    if (card.type !== 'attack') {
      audio.play('skill');
    }
    // brief play animation on the card element
    const cardEl = this.handHolder.querySelector(`.card[data-uid="${card.uid}"]`);
    if (cardEl) { cardEl.classList.add('playing'); }

    if (card.type === 'skill') {
      const pEnt = this.combat.player;
      const eid = eidOf(pEnt);
      this.tempPoses[eid] = true;
      this.setSpritePose(pEnt, (card.block || 0) > 0 ? 'block' : 'skill');
      
      setTimeout(() => {
        delete this.tempPoses[eid];
        if (pEnt.alive) {
          this.setSpritePose(pEnt, pEnt.block > 0 ? 'block' : 'idle');
        }
      }, 855);
    }

    this.combat.playCard(card, target, { rhythmMult, rhythmGrade, charge });
  }

  // 1-3 rhythm marks: blueprint override, else scaled by cost.
  marksFor(card) {
    if (card._bp.qteMarks) return Math.max(1, Math.min(3, card._bp.qteMarks));
    const cost = card.cost === 'X' ? 3 : card.cost;
    return cost >= 3 ? 3 : cost >= 2 ? 2 : 1;
  }

  endTurn() {
    audio.play('endturn');
    this.pendingCard = null;
    this.previewCard = null;
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
    if (!this.fxLayer) return;
    const handler = FX_HANDLERS[type];
    if (handler) handler.call(this, payload, this.fxLayer);
  }

  // Reveal a card an enemy shuffled into the deck (e.g. Dazed from Rivet): show
  // it centre-stage long enough to read, then fly it into the draw pile so the
  // player registers both what was added and where it went.
  injectCardAnim(card) {
    if (!this.scene || !this.drawPileEl || !card) return;
    const node = renderCard(card, { class: 'deck-inject-card' });
    node.style.left = '50%';
    node.style.top = '40%';
    this.scene.appendChild(node);

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Measured after insertion; the base transform centres it on left/top.
    const nodeRect = node.getBoundingClientRect();
    const drawRect = this.drawPileEl.getBoundingClientRect();
    const dx = (drawRect.left + drawRect.width / 2) - (nodeRect.left + nodeRect.width / 2);
    const dy = (drawRect.top + drawRect.height / 2) - (nodeRect.top + nodeRect.height / 2);

    const thump = () => {
      if (!this.drawPileEl) return;
      this.drawPileEl.classList.remove('pile-thump');
      void this.drawPileEl.offsetWidth;
      this.drawPileEl.classList.add('pile-thump');
      setTimeout(() => this.drawPileEl && this.drawPileEl.classList.remove('pile-thump'), 420);
    };

    if (reduce) {
      // No flight under reduced motion: fade in centre, hold to read, fade out.
      const anim = node.animate([
        { transform: 'translate(-50%, -50%) scale(0.96)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.82 },
        { transform: 'translate(-50%, -50%) scale(0.96)', opacity: 0 },
      ], { duration: 1500, easing: 'ease' });
      anim.onfinish = () => { node.remove(); thump(); };
      return;
    }

    const anim = node.animate([
      { transform: 'translate(-50%, -50%) scale(0.4) rotate(-8deg)', opacity: 0, offset: 0 },
      { transform: 'translate(-50%, -50%) scale(1.06) rotate(0deg)', opacity: 1, offset: 0.16 },
      { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.62 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.14) rotate(28deg)`, opacity: 0, offset: 1 },
    ], { duration: 1300, easing: 'cubic-bezier(0.4, 0, 0.25, 1)' });
    anim.onfinish = () => node.remove();

    // Thump the pile and tag it as the card lands.
    setTimeout(thump, 1200);
    setTimeout(() => { if (this.fxLayer && this.drawPileEl) floatText(this.fxLayer, this.drawPileEl, `+${card.name}`, 'debuff'); }, 1170);
  }

  // Relic chips are rebuilt fresh on every topbar re-render, so a relic
  // triggered just before that rebuild needs its pulse re-applied to the
  // new node rather than the (about-to-be-discarded) old one.
  applyRelicPulses() {
    if (!this._pendingRelicPulses || !this._pendingRelicPulses.length) return;
    const ids = this._pendingRelicPulses;
    this._pendingRelicPulses = [];
    for (const id of ids) {
      const node = this.topbarHolder.querySelector(`.relic[data-relic-id="${id}"]`);
      if (!node) continue;
      node.classList.remove('relic-pulse');
      void node.offsetWidth;
      node.classList.add('relic-pulse');
    }
  }

  applyGoldFx() {
    if (!this._pendingGoldFx || !this._pendingGoldFx.length) return;
    const amounts = this._pendingGoldFx;
    this._pendingGoldFx = [];
    const node = this.topbarHolder.querySelector('.tb-gold');
    if (!node) return;
    for (const amount of amounts) {
      floatHTML(this.fxLayer, node, `<i class="pip-ic">${UI.coin}</i>${amount > 0 ? '+' : ''}${amount}`, 'debuff');
      node.classList.remove('gold-flash');
      void node.offsetWidth;
      node.classList.add('gold-flash');
    }
  }

  setSpritePose(ent, pose) {
    const eid = eidOf(ent);
    const p = this.parts[eid];
    if (!p || !p.glyph) return;
    const container = p.glyph.querySelector('.sprite-container');
    if (!container) return; // Fallback SVG does not support pose swapping

    const baseId = ent.isPlayer ? this.combat.run.character.id : ent.id;
    let spriteId = baseId;
    if (pose !== 'idle') {
      const varId = `${baseId}_${pose}`;
      if (hasSprite(varId)) {
        spriteId = varId;
      }
    }
    
    const newSrc = `assets/sprites/${spriteId}.png`;
    const activeImg = container.querySelector('.model-img.active-pose');
    
    if (activeImg) {
      if (activeImg.src.indexOf(newSrc) === -1) {
        // Clean up any remaining fading-out images immediately to avoid leaks
        container.querySelectorAll('.model-img:not(.active-pose)').forEach(el => el.remove());
        
        // Create the new image element
        const newImg = document.createElement('img');
        newImg.className = 'model-img';
        newImg.src = newSrc;
        newImg.alt = '';
        newImg.draggable = false;
        
        container.appendChild(newImg);
        
        // Trigger transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            newImg.classList.add('active-pose');
            activeImg.classList.remove('active-pose');
            
            // Clean up the old image after transition (150ms matching the transition duration)
            setTimeout(() => {
              if (activeImg.parentNode === container) {
                container.removeChild(activeImg);
              }
            }, 150);
          });
        });
      }
    } else {
      const fallbackImg = container.querySelector('.model-img');
      if (fallbackImg) {
        fallbackImg.classList.add('active-pose');
        if (fallbackImg.src.indexOf(newSrc) === -1) {
          fallbackImg.src = newSrc;
        }
      }
    }
  }

}

// How each named impact visual renders, and the sound a player-sourced hit
// makes with it. Cards and enemy moves pick one by declaring `vfx: '<name>'`
// on their blueprint (see data/cards.js and the `atk` helper in
// data/enemies.js); no declaration means the default slash. To add a visual:
// add an entry here and reference its name from the data.
const VFX_PLAYBOOK = {
  slash: { play: (layer, el) => slash(layer, el), sound: 'attack' },
  'skyfall-hammer': { play: (layer, el) => singleFrameAnim(layer, el, 'skyfall-hammer'), sound: 'thunder' },
  'fault-line': { play: (layer, el) => faultLineVFX(layer, el), sound: 'attack' },
  zap: { play: (layer, el) => singleFrameAnim(layer, el, 'zap'), sound: 'zap' },
  spit: { play: (layer, el) => singleFrameAnim(layer, el, 'spit'), sound: 'slime' },
  splash: { play: (layer, el) => singleFrameAnim(layer, el, 'splash'), sound: 'splash' },
};

// The blueprint move an enemy is currently resolving (sfx/vfx live on it).
const currentMove = (enemy) => (enemy && enemy.bp && enemy.bp.moves[enemy.move]) || null;

// One handler per fx type, dispatched by CombatView.onFx with the view as
// `this` and the fx layer as the second argument. Everything content-specific
// (played card, QTE charge, whether the hit is a player swing, the enemy's
// move) arrives in the payload — handlers never reach into engine internals.
const FX_HANDLERS = {
  announce(payload) {
    this.announce(payload.text, { kind: payload.kind });
  },

  enemyMove(payload, layer) {
    const el2 = this.elFor(payload.source);
    if (el2 && payload.name) floatText(layer, el2, payload.name, 'name');
    // Flare the acting enemy's intent pill during the move-name beat, so the
    // player connects "that icon = this action". The class lives on the
    // persistent wrapper (renderIntent only swaps its children).
    const parts = this.parts[eidOf(payload.source)];
    if (parts && parts.intent) {
      parts.intent.classList.remove('intent-telegraph');
      void parts.intent.offsetWidth;
      parts.intent.classList.add('intent-telegraph');
      setTimeout(() => parts.intent.classList.remove('intent-telegraph'), 700);
    }
  },

  phase(payload, layer) {
    // A boss crosses its HP threshold and transforms — the marquee moment.
    this.announce(payload.name || 'Phase', { kind: 'phase', duration: 1500 });
    screenShake(this.scene, true);
    const el2 = this.elFor(payload.target);
    if (el2) {
      el2.classList.add('phased');
      hitFlash(el2, 'damage');
      ring(layer, el2, 'rgba(224,69,123,0.95)');
      burst(layer, el2, '#e0457b', 24);
    }
    const bg = background(); if (bg) bg.pulse('heavy', 2);
    audio.play('reward');
  },

  enrage(payload, layer) {
    this.announce('ENRAGED', { kind: 'enrage', duration: 1050 });
    const el2 = this.elFor(payload.target);
    if (el2) {
      el2.classList.add('enraged');
      floatText(layer, el2, 'ENRAGED', 'debuff');
      hitFlash(el2, 'damage');
      ring(layer, el2, 'rgba(217,79,43,0.95)');
    }
    screenShake(this.scene, false);
  },

  summon(payload, layer) {
    // The combatant node is built on the next tick by update(); flash it once
    // it exists so the burst lands on the newly-appeared foe.
    const t = payload.target;
    setTimeout(() => {
      const el2 = this.elFor(t);
      if (el2) { ring(layer, el2, 'rgba(200,182,255,0.9)'); burst(layer, el2, '#c8b6ff', 14); }
    }, 30);
  },

  attackstart(payload, layer) {
    const src = this.elFor(payload.source);
    const isPlayer = !!(payload.source && payload.source.isPlayer);
    const charged = isPlayer && payload.charge >= 3;
    lunge(src, isPlayer ? 'right' : 'left', charged);
    if (charged) chargeUp(layer, src, payload.charge);

    if (payload.source) {
      const eid = eidOf(payload.source);
      this.tempPoses[eid] = true;
      this.setSpritePose(payload.source, 'attack');

      if (!isPlayer) {
        const move = currentMove(payload.source);
        audio.play((move && move.sfx) || 'attack');
      }

      setTimeout(() => {
        delete this.tempPoses[eid];
        if (payload.source.alive) {
          this.setSpritePose(payload.source, payload.source.block > 0 ? 'block' : 'idle');
        }
      }, 855);
    }
  },

  skillstart(payload, layer) {
    if (!payload.source) return;
    const eid = eidOf(payload.source);
    this.tempPoses[eid] = true;
    this.setSpritePose(payload.source, payload.pose || 'skill');

    const srcEl = this.elFor(payload.source);
    if (srcEl) shine(layer, srcEl);
    if (!payload.source.isPlayer) {
      const move = currentMove(payload.source);
      if (move && move.sfx) audio.play(move.sfx);
    }

    setTimeout(() => {
      delete this.tempPoses[eid];
      if (payload.source.alive) {
        this.setSpritePose(payload.source, payload.source.block > 0 ? 'block' : 'idle');
      }
    }, 855);
  },

  parrymiss(payload, layer) {
    // Missed parry: tell the player why the hit is about to bite through.
    const el2 = this.elFor(payload.entity);
    if (el2) { floatText(layer, el2, 'BLOCK HALVED', 'debuff'); hitFlash(el2, 'damage'); }
  },

  tempobreak(payload, layer) {
    // A missed beat zeroes the Tempo counter — name the loss.
    const el2 = this.elFor(payload.entity);
    if (el2) floatText(layer, el2, 'RHYTHM BROKEN', 'debuff');
  },

  temporelease(payload, layer) {
    // A finisher (Spiral Finish, Whirlwind) consumes all Tempo at once —
    // scale the release flourish with how much was banked.
    const el2 = this.elFor(payload.entity);
    if (!el2) return;
    const big = payload.amount >= 5;
    floatText(layer, el2, `${payload.amount} TEMPO`, 'buff');
    ring(layer, el2, big ? 'rgba(255,224,140,0.95)' : 'rgba(255,209,102,0.9)');
    burst(layer, el2, big ? '#ffe6a0' : '#ffd166', Math.min(10 + payload.amount * 2, 26));
    audio.play('tempo_release');
  },

  powersurge(payload, layer) {
    // An enemy (or ally) gains Resolve from a dedicated buff move — a
    // telegraph that it's about to hit harder, distinct from the plain
    // '+N' power pip float.
    const el2 = this.elFor(payload.target);
    if (!el2) return;
    ring(layer, el2, 'rgba(217,79,43,0.9)');
    burst(layer, el2, '#d94f2b', 16);
    audio.play('power_surge');
  },

  damage(payload, layer) {
    const el2 = this.elFor(payload.target);
    if (!el2) return;
    // A player card swing gets a beat between the attack animation and the
    // impact landing (below); swing/charge/card are echoed by the engine.
    const isDelayedPlayerHit = payload.swing && !payload.target.isPlayer;
    const chLevel = (payload.charge >= 3 && payload.isAttack && !payload.target.isPlayer)
      ? payload.charge : 0;

    // Impact visual: the played card's declared vfx (player swings) or the
    // resolving move's (enemy hits); default slash.
    let vfxName = 'slash';
    if (payload.isAttack && payload.source) {
      if (payload.source.isPlayer) {
        vfxName = (payload.card && payload.card._bp.vfx) || 'slash';
      } else {
        const move = currentMove(payload.source);
        vfxName = (move && move.vfx) || 'slash';
      }
    }
    const vfx = VFX_PLAYBOOK[vfxName] || VFX_PLAYBOOK.slash;

    const applyDamageFx = () => {
      // Ward feedback: pop the badge for any absorbed chunk. If this hit broke
      // the last of it, shatter — the burst fires at the badge now, because the
      // microtask-deferred update() will hide the badge right after this.
      if (payload.blocked > 0) {
        const tparts = this.parts[eidOf(payload.target)];
        const badge = tparts && tparts.block;
        if (badge) {
          badge.classList.remove('block-hit');
          void badge.offsetWidth;
          badge.classList.add('block-hit');
          if (payload.target.block === 0) burst(layer, badge, '#9fc2ff', 10);
        }
      }
      if (payload.hpLost > 0) {
        const size = Math.round(Math.min(60, 26 + payload.hpLost * 1.4));
        floatText(layer, el2, String(payload.hpLost), 'damage', { size });
        hitFlash(el2, 'damage');
        const big = payload.hpLost >= 14 || chLevel > 0;
        if (payload.isAttack) {
          vfx.play(layer, el2);
          if (payload.source && payload.source.isPlayer) audio.play(vfx.sound);
        }
        if (payload.target.isPlayer) audio.play('hit');
        const bg = background();
        // Hit-stop: on big hits the number/flash land instantly but the target
        // freezes for a beat before the shake and follow-through, so the impact
        // reads heavy. Purely a view-side delay — never await in the engine.
        const followThrough = () => {
          shake(el2, big);
          if (payload.target.isPlayer || big) screenShake(this.scene, big);
          if (chLevel > 0) {
            // Charged release: a heavier burst + ring on the strike.
            const gold = chLevel >= 5;
            ring(layer, el2, gold ? 'rgba(255,224,140,0.95)' : 'rgba(255,176,80,0.9)');
            burst(layer, el2, gold ? '#ffe6a0' : '#ffb050', gold ? 22 : 14);
          }
          // Reactive backdrop pulse: red when the player is hurt, amber on big hits.
          if (bg) {
            if (payload.target.isPlayer) bg.pulse('damage', Math.min(2, payload.hpLost / 12));
            else if (big) bg.pulse('heavy', Math.min(2, payload.hpLost / 18));
          }
        };
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (big && !reduceMotion) {
          const stage = el2.querySelector('.stage');
          if (stage) {
            stage.classList.add('hitstop');
            setTimeout(() => stage.classList.remove('hitstop'), 85);
          }
          setTimeout(followThrough, 85);
        } else {
          followThrough();
        }
      } else if (payload.blocked > 0) {
        floatText(layer, el2, payload.target.block === 0 ? 'GUARD BROKEN' : 'BLOCK', 'blocked');
        hitFlash(el2, 'block');
        audio.play('attack-blocked');
      }
    };
    // Delay the impact fx/sfx on the enemy so it lands a beat after the
    // player's attack sprite animation rather than in the same frame.
    if (isDelayedPlayerHit) setTimeout(applyDamageFx, 300);
    else applyDamageFx();
  },

  block(payload, layer) {
    const el2 = this.elFor(payload.entity); if (!el2) return;
    floatText(layer, el2, `+${payload.amount}`, 'block');
    ring(layer, el2, 'rgba(94,169,230,0.9)');
    audio.play('block');
  },

  warded(payload, layer) {
    // Per-turn damage cap reached (e.g. Heart of Static's Invincibility).
    const el2 = this.elFor(payload.target); if (!el2) return;
    floatText(layer, el2, 'WARDED', 'blocked');
    hitFlash(el2, 'block');
    ring(layer, el2, 'rgba(230,180,90,0.9)');
  },

  heal(payload, layer) {
    const el2 = this.elFor(payload.entity); if (!el2) return;
    floatText(layer, el2, `+${payload.amount}`, 'heal');
    hitFlash(el2, 'heal');
  },

  power(payload, layer) {
    const el2 = this.elFor(payload.target); if (!el2) return;
    const def = POWERS[payload.key]; if (!def) return;
    floatHTML(layer, el2, `<i class="pip-ic">${powerIcon(payload.key)}</i>${payload.amount > 0 ? '+' : ''}${payload.amount}`, def.type === 'buff' ? 'buff' : 'debuff');
  },

  powerfade(payload, layer) {
    // A power silently ran out (turn tick / last hit-counted stack consumed) —
    // name the expiry so statuses don't just vanish. Tempo has its own break fx.
    if (payload.key === 'tempo') return;
    const el2 = this.elFor(payload.target); if (!el2) return;
    const def = POWERS[payload.key]; if (!def) return;
    floatHTML(layer, el2, `<i class="pip-ic">${powerIcon(payload.key)}</i> ${def.name} fades`, def.type === 'buff' ? 'buff' : 'debuff');
  },

  reshuffle(payload) {
    // Discard pile shuffles back into the draw pile: fly a few card backs
    // across so the counts don't just silently swap. Pile nodes are persistent
    // scene children, so their rects are safe to read at emit time.
    if (!this.scene || !this.drawPileEl || !this.discardPileEl) return;
    audio.play('cardflip');
    const badges = [this.drawPileEl, this.discardPileEl].map((p) => p.querySelector('.pile-badge'));
    for (const b of badges) {
      if (!b) continue;
      b.classList.remove('pile-flip');
      void b.offsetWidth;
      b.classList.add('pile-flip');
    }
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const sceneRect = this.scene.getBoundingClientRect();
    const from = this.discardPileEl.getBoundingClientRect();
    const to = this.drawPileEl.getBoundingClientRect();
    const n = Math.min(5, Math.max(2, Math.ceil((payload.count || 1) / 4)));
    for (let i = 0; i < n; i++) {
      const fly = el('div', { class: 'mini-card-fly' });
      const sx = from.left - sceneRect.left + from.width / 2;
      const sy = from.top - sceneRect.top + from.height / 2;
      const tx = to.left - sceneRect.left + to.width / 2;
      const ty = to.top - sceneRect.top + to.height / 2;
      fly.style.left = sx + 'px';
      fly.style.top = sy + 'px';
      this.scene.appendChild(fly);
      const anim = fly.animate([
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 0.95 },
        { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${(sy + ty) / 2 - sy - 46}px)) rotate(180deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) rotate(360deg)`, opacity: 0.4 },
      ], { duration: 360, delay: i * 45, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'backwards' });
      anim.onfinish = () => fly.remove();
    }
  },

  death(payload, layer) {
    const el2 = this.elFor(payload.target); if (!el2) return;
    // Give the killing hit a 0.5s beat to land before the death burst and
    // collapse fire (plus the player-swing impact delay above), so the enemy
    // doesn't die in the same instant it's struck. The delay is stashed on
    // the node for update()'s removal path, which runs on a later microtask
    // and must match this timing.
    const delay = (payload.swing && !payload.target.isPlayer ? 300 : 0) + 500;
    el2._deathFxDelay = delay;
    const glyph = this.parts[eidOf(payload.target)] && this.parts[eidOf(payload.target)].glyph;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      burst(layer, el2, '#ffce5c', 18);
      // "Unwritten by the Static": glitch-slice the sprite while the wrapper
      // does its existing collapse — skipped under reduced motion.
      if (glyph && !reduceMotion) glyph.classList.add('death-glitch');
      el2.classList.add('dying');
      const bg = background(); if (bg) bg.pulse('gold', 1.2);
    }, delay);
  },

  useSkill(payload, layer) {
    const el2 = this.elFor(payload.entity); if (!el2) return;
    shine(layer, el2);
  },

  relic(payload) {
    // Queued rather than applied immediately: the topbar (and its relic
    // chips) is rebuilt fresh on the notify() that follows this fx call,
    // so the node to pulse doesn't exist yet — update() drains the queue
    // right after rebuilding it.
    this._pendingRelicPulses = this._pendingRelicPulses || [];
    this._pendingRelicPulses.push(payload.id);
  },

  cardtopile(payload) {
    this.injectCardAnim(payload.card);
  },

  gold(payload) {
    // Topbar (and its .tb-gold node) is rebuilt fresh on the notify() that
    // follows this fx call, so queue it the same way relic pulses are —
    // update() drains the queue right after rebuilding the topbar.
    this._pendingGoldFx = this._pendingGoldFx || [];
    this._pendingGoldFx.push(payload.amount);
    audio.play('coin');
  },
};

function orbTitle(orb, c) {
  const f = c.focus();
  const map = {
    storm: `Storm — passive: ${3 + f} to a random enemy. Evoke: ${8 + f}.`,
    tide: `Tide — passive: gain ${2 + f} Block. Evoke: gain ${5 + f} Block.`,
    shade: `Shade — passive: stores +${4 + f} (now ${orb.value}). Evoke: deal stored.`,
    sun: `Sun — passive: +1 Àṣẹ next turn. Evoke: gain 2 Àṣẹ.`,
  };
  return map[orb.type] || orb.type;
}

const BADGE_SVG = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" class="badge-svg">
  <circle cx="50" cy="50" r="12" fill="currentColor"/>
  <circle cx="50" cy="50" r="24" stroke-width="6"/>
  <path d="M 18,30 A 28,28 0 0,0 18,70" stroke-width="8" stroke-linecap="round"/>
  <path d="M 82,30 A 28,28 0 0,1 82,70" stroke-width="8" stroke-linecap="round"/>
</svg>`;

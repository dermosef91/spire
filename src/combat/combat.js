// The combat engine. Pure-ish logic over a render-on-change UI: callers mutate
// state through methods, then the bound `onUpdate` callback re-renders. Enemy
// turns are async so the view can animate between sub-steps.

import { createCard, upgradeCard, canUpgrade } from '../data/cards.js';
import { ENEMIES } from '../data/enemies.js';
import { POWERS } from '../data/keywords.js';
import { RELICS } from '../data/relics.js';
import { wait } from '../core/util.js';

const BASE_ENERGY = 3;
const HAND_LIMIT = 10;

export class Combat {
  constructor(run, enemyIds, opts = {}) {
    this.run = run;
    this.rng = run.rng;
    this.opts = opts; // { elite, boss, rewards }
    this.onUpdate = () => {};
    this.onLog = () => {};
    this.logs = [];
    this.over = false;
    this.victory = false;
    this.animating = false;

    // Player entity mirrors run state; HP is written back to run on combat end.
    this.player = {
      isPlayer: true,
      name: run.character.name,
      glyph: run.character.glyph,
      hp: run.hp,
      maxHp: run.maxHp,
      block: 0,
      powers: {},
      alive: true,
    };

    this.enemies = enemyIds.map((id, i) => this.makeEnemy(id, i));

    // Piles
    this.hand = [];
    this.drawPile = [];
    this.discardPile = [];
    this.exhaustPile = [];

    // Resources / per-turn flags
    this.energy = 0;
    this.maxEnergy = BASE_ENERGY + this.run.energyBonus();
    this.energyNextTurn = 0;
    this.bonusEnergyTurn1 = 0;
    this.turn = 0;

    // Orbs (Zara)
    this.orbs = [];
    this.orbSlots = run.character.orbSlots || 3;
    this.stormAll = false;

    // Triggers: { event: [ {fn, name, once} ] }
    this.triggers = {};

    // Misc combat-wide flags toggled by cards/relics
    this.firstAttackDouble = false;
    this.echoForm = false;
    this.freePowerEachTurn = false;
    this.bloodBloom = false;
    this.fairyShield = false;

    // counters
    this.cardsThisTurn = 0;
    this.versesThisTurn = 0;
    this.cardsPlayedTotal = 0;
    this.noMoreDraw = false;
    this._extraOpenDraw = 0;
  }

  // ---------------------------------------------------------------- setup
  makeEnemy(id, idx) {
    const bp = ENEMIES[id];
    if (!bp) throw new Error('Unknown enemy ' + id);
    const hp = this.rng.int(bp.hpMin, bp.hpMax);
    return {
      id, bp, idx,
      name: bp.name, glyph: bp.glyph,
      hp, maxHp: hp, block: 0,
      powers: {}, alive: true,
      isPlayer: false,
      turn: 1, history: [], last: null,
      move: null, intent: null,
      run: this.run,
    };
  }

  makeCard(id) { return createCard(id); }

  start() {
    this.log(`A fight begins.`);
    // Relic combat-start hooks
    for (const rid of this.run.relics) {
      const r = RELICS[rid];
      if (r && r.startCombat) r.startCombat(this);
    }
    // Build draw pile from run deck (fresh instances so combat upgrades don't persist)
    const cards = this.run.deck.map((d) => {
      const c = createCard(d.id);
      if (d.upgraded) upgradeCard(c);
      return c;
    });
    this.drawPile = this.rng.shuffle(cards);

    // Innate cards to opening hand
    const innate = this.drawPile.filter((c) => c.innate);
    for (const c of innate) { this.drawPile.splice(this.drawPile.indexOf(c), 1); this.hand.push(c); }

    // Pick initial enemy intents
    for (const e of this.enemies) this.pickEnemyMove(e);

    this.startPlayerTurn(true);
  }

  // ---------------------------------------------------------------- logging / notify
  log(msg) { this.logs.push(msg); if (this.logs.length > 60) this.logs.shift(); this.onLog(msg); }
  notify() { this.onUpdate(); }

  // ---------------------------------------------------------------- triggers
  addTrigger(event, fn, name, once = false) {
    if (!this.triggers[event]) this.triggers[event] = [];
    this.triggers[event].push({ fn, name, once });
  }
  fire(event, payload) {
    const arr = this.triggers[event];
    if (!arr) return;
    for (const t of arr.slice()) {
      t.fn(payload);
      if (t.once) arr.splice(arr.indexOf(t), 1);
    }
  }

  // ---------------------------------------------------------------- helpers
  livingEnemies() { return this.enemies.filter((e) => e.alive); }
  randomEnemy() { const l = this.livingEnemies(); return l.length ? this.rng.pick(l) : null; }
  isOrbUser() { return this.run.character.id === 'zara'; }
  focus() { return this.player.powers.focus || 0; }

  // ---------------------------------------------------------------- damage & block math
  calcAttackDamage(base, source, target) {
    let dmg = base + (source.powers.strength || 0);
    if (source.powers.weak) dmg = Math.floor(dmg * 0.75);
    if (target && target.powers.vulnerable) dmg = Math.floor(dmg * 1.5);
    return Math.max(0, dmg);
  }

  // Apply a chunk of damage to an entity through Ward, returns HP actually lost.
  applyDamage(target, amount, { isAttack = false, source = null } = {}) {
    if (!target.alive) return 0;
    let dmg = amount;
    if (target.powers.intangible && dmg > 1) dmg = 1;
    // Heart of Static caps single-hit damage taken? (only thematic — skip)
    let remaining = dmg;
    if (target.block > 0) {
      const blocked = Math.min(target.block, remaining);
      target.block -= blocked;
      remaining -= blocked;
    }
    let hpLost = 0;
    if (remaining > 0) {
      target.hp -= remaining;
      hpLost = remaining;
      if (target.isPlayer) this.fire('hpLost', { amount: remaining });
    }
    // Backlash (thorns) when attacked
    if (isAttack && source && target.powers.thorns) {
      this.applyDamage(source, target.powers.thorns, { isAttack: false });
    }
    this.checkDeath(target);
    return hpLost;
  }

  checkDeath(entity) {
    if (entity.hp <= 0 && entity.alive) {
      if (entity.isPlayer) {
        if (this.fairyShield) {
          this.fairyShield = false;
          entity.hp = Math.max(1, Math.floor(entity.maxHp * 0.3));
          this.log("Ancestor's Breath pulls you back from death!");
          return;
        }
        entity.hp = 0; entity.alive = false; this.lose();
      } else {
        entity.hp = 0; entity.alive = false;
        this.onEnemyDeath(entity);
      }
    }
  }

  onEnemyDeath(enemy) {
    this.log(`${enemy.name} is destroyed.`);
    if (this.bloodBloom && enemy.powers.poison) {
      const dmg = enemy.powers.poison;
      for (const e of this.livingEnemies()) this.applyDamage(e, dmg, { isAttack: false });
      this.log(`Blight Bloom bursts for ${dmg}!`);
    }
    if (this.livingEnemies().length === 0) this.win();
  }

  // Player attack
  deal(target, base, hits = 1) {
    if (!target || !target.alive) { target = this.randomEnemy(); if (!target) return 0; }
    let total = 0;
    const mult = this._cardDamageMult || 1;
    for (let i = 0; i < hits; i++) {
      if (!target.alive) break;
      const dmg = this.calcAttackDamage(base, this.player, target) * mult;
      total += this.applyDamage(target, dmg, { isAttack: true, source: this.player });
    }
    this.notify();
    return total;
  }
  dealAll(base, hits = 1) {
    let total = 0;
    for (let i = 0; i < hits; i++) {
      for (const e of this.livingEnemies()) {
        const dmg = this.calcAttackDamage(base, this.player, e) * (this._cardDamageMult || 1);
        total += this.applyDamage(e, dmg, { isAttack: true, source: this.player });
      }
    }
    this.notify();
    return total;
  }
  dealAllRaw(amount) { for (const e of this.livingEnemies()) this.applyDamage(e, amount, { isAttack: true, source: this.player }); this.notify(); }

  // Orb / non-attack damage (ignores Resolve & Sapped, respects Exposed + Ward)
  orbDamage(target, base) {
    if (!target || !target.alive) return 0;
    let dmg = base;
    if (target.powers.vulnerable) dmg = Math.floor(dmg * 1.5);
    return this.applyDamage(target, dmg, { isAttack: true, source: this.player });
  }

  // Enemy attack on player
  enemyAttack(enemy, base, hits = 1) {
    for (let i = 0; i < hits; i++) {
      if (!this.player.alive) break;
      const dmg = this.calcAttackDamage(base, enemy, this.player);
      this.applyDamage(this.player, dmg, { isAttack: true, source: enemy });
    }
    this.notify();
  }

  gainBlock(amount) {
    // player block from cards: dexterity + frail + noBlock
    if (this.player.powers.noBlock) return;
    let b = amount + (this.player.powers.dexterity || 0);
    if (this.player.powers.frail) b = Math.floor(b * 0.75);
    this.player.block += Math.max(0, b);
    this.notify();
  }
  gainBlockRaw(amount) { if (this.player.powers.noBlock) return; this.player.block += Math.max(0, amount); this.notify(); }
  gainBlockTo(entity, amount, raw = false) {
    if (entity.isPlayer && entity.powers.noBlock) return;
    let b = amount;
    if (!raw && entity.isPlayer) { b += (entity.powers.dexterity || 0); if (entity.powers.frail) b = Math.floor(b * 0.75); }
    entity.block += Math.max(0, b);
    this.notify();
  }

  heal(amount) {
    if (amount <= 0) return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    this.notify();
  }
  loseHp(entity, amount) {
    if (entity.powers.intangible && amount > 1) amount = 1;
    entity.hp -= amount;
    if (entity.isPlayer) this.fire('hpLost', { amount });
    this.checkDeath(entity);
    this.notify();
  }
  raiseMaxHp(n) { this.player.maxHp += n; this.player.hp += n; this.run.maxHp += n; this.notify(); }

  // Powers
  applyPower(target, key, amount, source) {
    if (!target.alive) return;
    const def = POWERS[key];
    // Artifact (Charm) negates incoming debuffs
    if (amount > 0 && def && def.type === 'debuff' && target.powers.artifact > 0) {
      target.powers.artifact -= 1;
      if (target.powers.artifact <= 0) delete target.powers.artifact;
      this.notify();
      return;
    }
    target.powers[key] = (target.powers[key] || 0) + amount;
    // Clamp debuff-style stacks at 0 minimum
    if (['vulnerable', 'weak', 'frail', 'poison', 'regen', 'metallicize', 'thorns', 'dexterity', 'focus', 'intangible', 'artifact'].includes(key)) {
      if (target.powers[key] <= 0) delete target.powers[key];
    } else if (target.powers[key] === 0) {
      delete target.powers[key];
    }
    this.notify();
  }

  // ---------------------------------------------------------------- card piles
  addCardToPile(card, pile) {
    if (pile === 'hand') { if (this.hand.length < HAND_LIMIT) this.hand.push(card); else this.discardPile.push(card); }
    else if (pile === 'draw') { const i = this.rng.int(0, this.drawPile.length); this.drawPile.splice(i, 0, card); }
    else if (pile === 'drawTop') { this.drawPile.push(card); }
    else this.discardPile.push(card);
    this.notify();
  }

  draw(n) {
    for (let i = 0; i < n; i++) {
      if (this.noMoreDraw) break;
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = this.rng.shuffle(this.discardPile);
        this.discardPile = [];
      }
      if (this.hand.length >= HAND_LIMIT) break;
      this.hand.push(this.drawPile.pop());
    }
    this.notify();
  }

  exhaust(card) {
    this.exhaustPile.push(card);
    this.fire('cardExhausted', { card });
  }

  gainEnergy(n) { this.energy += n; this.notify(); }

  upgradeAllInCombat() {
    for (const c of [...this.hand, ...this.drawPile, ...this.discardPile]) if (canUpgrade(c)) upgradeCard(c);
    this.notify();
  }

  // ---------------------------------------------------------------- orbs (Zara)
  channel(type, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.orbs.length >= this.orbSlots && this.orbs.length > 0) {
        const evoked = this.orbs.shift();
        this.evokeOrb(evoked);
      }
      this.orbs.push({ type, value: 0 });
    }
    this.log(`Channel ${type[0].toUpperCase() + type.slice(1)}.`);
    this.notify();
  }
  evoke(times = 1) {
    if (this.orbs.length === 0) return;
    const orb = this.orbs.pop();
    for (let i = 0; i < times; i++) this.evokeOrb(orb);
    this.notify();
  }
  orbPassive(orb) {
    const f = this.focus();
    if (orb.type === 'storm') { if (this.stormAll) { for (const e of this.livingEnemies()) this.orbDamage(e, 3 + f); } else { const e = this.randomEnemy(); if (e) this.orbDamage(e, 3 + f); } }
    else if (orb.type === 'tide') this.gainBlockTo(this.player, 2 + f, false);
    else if (orb.type === 'shade') orb.value += 4 + f;
    else if (orb.type === 'sun') this.energyNextTurn += 1;
  }
  evokeOrb(orb) {
    const f = this.focus();
    if (orb.type === 'storm') { if (this.stormAll) { for (const e of this.livingEnemies()) this.orbDamage(e, 8 + f); } else { const e = this.randomEnemy(); if (e) this.orbDamage(e, 8 + f); } }
    else if (orb.type === 'tide') this.gainBlockTo(this.player, 5 + f, false);
    else if (orb.type === 'shade') { const e = this.randomEnemy(); if (e) this.orbDamage(e, orb.value); }
    else if (orb.type === 'sun') this.gainEnergy(2);
    this.log(`Evoke ${orb.type}.`);
  }

  // ---------------------------------------------------------------- playing cards
  cardCost(card) {
    if (card.cost === 'X') return this.energy;
    let cost = card.cost;
    if (card.type === 'power' && this.freePowerEachTurn && !this._freePowerUsed) cost = 0;
    return cost;
  }
  canPlay(card) {
    if (this.over) return false;
    if (card.unplayable) return false;
    if (card.type === 'attack' && this.player.powers.entangle) return false;
    const cost = this.cardCost(card);
    if (cost === 'X') return true;
    if (this.energy < cost) return false;
    if (card._bp.playable && !card._bp.playable(this.makeCtx(card, null))) return false;
    return true;
  }

  makeCtx(card, target) {
    const self = this;
    return {
      c: card, self: this.player, enemy: target, combat: this, rng: this.rng, run: this.run,
      X: card.cost === 'X' ? this.energy : 0,
      deal: (t, d, h = 1) => self.deal(t, d, h),
      dealAll: (d, h = 1) => self.dealAll(d, h),
      gainBlock: (b) => self.gainBlock(b),
      gainBlockRaw: (b) => self.gainBlockRaw(b),
      applyEnemy: (k, n) => { if (target) self.applyPower(target, k, n, self.player); },
      applyAll: (k, n) => { for (const e of self.livingEnemies()) self.applyPower(e, k, n, self.player); },
      applySelf: (k, n) => self.applyPower(self.player, k, n, self.player),
      draw: (n) => self.draw(n),
      gainEnergy: (n) => self.gainEnergy(n),
      loseHpSelf: (n) => self.loseHp(self.player, n),
      heal: (n) => self.heal(n),
      channel: (t, n = 1) => self.channel(t, n),
      evoke: (n = 1) => self.evoke(n),
      exhaustThis: () => { card._forceExhaust = true; },
    };
  }

  playCard(card, target) {
    if (!this.canPlay(card)) return false;
    const cost = this.cardCost(card);
    const spent = card.cost === 'X' ? this.energy : cost;
    this.energy -= spent;
    if (card.type === 'power' && this.freePowerEachTurn && cost === 0) this._freePowerUsed = true;

    // remove from hand
    const hi = this.hand.indexOf(card);
    if (hi >= 0) this.hand.splice(hi, 1);

    // First-attack-double relic
    this._cardDamageMult = 1;
    if (card.type === 'attack' && this.firstAttackDouble && !this._usedFAD) { this._cardDamageMult = 2; this._usedFAD = true; }

    this.cardsThisTurn += 1;
    this.cardsPlayedTotal += 1;
    if (card.verse) this.versesThisTurn += 1;

    this.log(`You play ${card.name}.`);
    const ctx = this.makeCtx(card, target);
    card._bp.onPlay(ctx);

    // Echo Form: replay first card of the turn once more
    const isFirst = this.cardsThisTurn === 1;
    if (this.echoForm && isFirst && card.type !== 'power') {
      card._bp.onPlay(this.makeCtx(card, target && target.alive ? target : this.randomEnemy()));
    }

    this._cardDamageMult = 1;
    this.fire('cardPlayed', { card });
    if (card.verse) this.fire('versePlayed', { card });

    // Resolve card's resting place
    if (card._forceExhaust || card.exhaust || card.type === 'power') {
      if (card.type === 'power' && !card.exhaust && !card._forceExhaust) {
        // powers vanish into the ether (not exhaust pile, but removed from play)
      } else {
        this.exhaust(card);
      }
    } else {
      this.discardPile.push(card);
    }
    card._forceExhaust = false;

    this.notify();
    return true;
  }

  // ---------------------------------------------------------------- potions
  usePotion(potion, target) {
    potion.use({ combat: this, run: this.run, target });
    this.notify();
  }

  // ---------------------------------------------------------------- turn flow
  startPlayerTurn(first = false) {
    this.turn += 1;
    this.player.block = 0;
    this._freePowerUsed = false;
    this._usedFAD = false;
    this.cardsThisTurn = 0;
    this.versesThisTurn = 0;
    this.noMoreDraw = false;

    // start-of-turn poison on player
    this.tickPoison(this.player);

    // energy
    this.energy = this.maxEnergy + this.energyNextTurn + (first ? this.bonusEnergyTurn1 : 0);
    this.energyNextTurn = 0;

    this.fire('turnStart');

    // draw
    const drawCount = 5 + (first ? this._extraOpenDraw : 0);
    this.draw(drawCount);

    if (!this.over) this.log(`— Your turn ${this.turn} —`);
    this.notify();
  }

  tickPoison(entity) {
    if (entity.powers.poison) {
      const p = entity.powers.poison;
      this.loseHp(entity, p);
      entity.powers.poison = p - 1;
      if (entity.powers.poison <= 0) delete entity.powers.poison;
    }
  }

  tickTurnDebuffs(entity) {
    for (const key of ['vulnerable', 'weak', 'frail', 'intangible']) {
      if (entity.powers[key]) {
        entity.powers[key] -= 1;
        if (entity.powers[key] <= 0) delete entity.powers[key];
      }
    }
  }

  async endTurn() {
    if (this.over || this.animating) return;
    this.animating = true;

    // In-hand end-of-turn effects (curses), ethereal exhaust, discard
    for (const card of this.hand.slice()) {
      if (card._bp.inHandTurnEnd) card._bp.inHandTurnEnd(this.makeCtx(card, null));
    }
    for (const card of this.hand.slice()) {
      if (card.ethereal) { this.hand.splice(this.hand.indexOf(card), 1); this.exhaust(card); }
    }
    // discard remaining (respect retain)
    const retained = [];
    for (const card of this.hand) { if (card.retain) retained.push(card); else this.discardPile.push(card); }
    this.hand = retained;

    // end-of-turn powers
    this.fire('turnEnd');
    if (this.player.powers.regen) { this.heal(this.player.powers.regen); this.player.powers.regen -= 1; if (this.player.powers.regen <= 0) delete this.player.powers.regen; }
    if (this.player.powers.metallicize) this.gainBlockTo(this.player, this.player.powers.metallicize, true);

    // orb passives
    if (this.orbs.length) { for (const orb of this.orbs) this.orbPassive(orb); this.notify(); }

    // player turn debuffs tick down at end of player's turn
    this.tickTurnDebuffs(this.player);

    this.notify();
    await wait(250);

    await this.enemyPhase();

    if (!this.over) this.startPlayerTurn(false);
    this.animating = false;
    this.notify();
  }

  async enemyPhase() {
    for (const e of this.enemies) {
      if (!e.alive || this.over) continue;
      e.block = 0;
      this.tickPoison(e);
      if (!e.alive || this.over) continue;
      const move = e.bp.moves[e.move];
      this.log(`${e.name} uses ${move.name}.`);
      move.run(this, e);
      this.notify();
      await wait(420);
      e.history.push(e.move);
      e.last = e.move;
      e.turn += 1;
      this.tickTurnDebuffs(e);
      if (this.over) return;
      this.pickEnemyMove(e); // choose next turn's intent
    }
    this.notify();
  }

  pickEnemyMove(e) {
    const id = e.bp.pick(e, this, this.rng);
    e.move = id;
    e.intent = e.bp.moves[id].intent;
  }

  // After enemies finish acting we pick their next intent at the start of player turn?
  // We pick at enemy-turn end for clarity:
  // (called inside enemyPhase loop above is not — pick here so intent is shown next player turn)

  // ---------------------------------------------------------------- end states
  win() {
    if (this.over) return;
    this.over = true; this.victory = true;
    this.log('Victory!');
    this.notify();
  }
  lose() {
    if (this.over) return;
    this.over = true; this.victory = false;
    this.log('You have fallen...');
    this.notify();
  }
}

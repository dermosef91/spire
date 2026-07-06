// The combat engine. Pure-ish logic over a render-on-change UI: callers mutate
// state through methods, then the bound `onUpdate` callback re-renders. Enemy
// turns are async so the view can animate between sub-steps.

import { createCard, upgradeCard } from '../data/cards.js';
import { ENEMIES } from '../data/enemies.js';
import { POWERS } from '../data/keywords.js';
import { RELICS } from '../data/relics.js';
import { wait } from '../core/util.js';

const BASE_ENERGY = 3;
const HAND_LIMIT = 10;
const TEMPO_CAP = 10;

export class Combat {
  constructor(run, enemyIds, opts = {}) {
    this.run = run;
    this.rng = run.rng;
    this.opts = opts; // { elite, boss, rewards }
    this.onUpdate = () => {};
    this.onLog = () => {};
    this.fx = () => {}; // visual-effect hook set by the view: fx(type, payload)
    this.logs = [];
    this.over = false;
    this.victory = false;
    this.animating = false;
    this._notifyScheduled = false; // coalesces same-tick notify() calls, see notify()

    // Rhythm QTE seams. The view sets `_rhythmMult` and `_rhythmGrade` (from
    // the attack QTE) before playCard, and injects `parryPrompt` — an async fn
    // resolving { success } — awaited during the enemy phase. All default to
    // inert so the engine runs unchanged without a view or with Rhythm Mode
    // off: a null grade counts as a clean ('good') strike, so Tempo still
    // builds for non-rhythm players.
    this._rhythmMult = 1;
    this._rhythmGrade = null;
    this.parryPrompt = null;
    this._parried = false;
    this._qtePrompted = false;

    // Player entity mirrors run state; HP is written back to run on combat end.
    this.player = {
      isPlayer: true,
      name: run.character.name,
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
    this.consumePile = [];

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
    this.mirrorChannel = false; // Mirrorcast: Spirits channel twice
    this.freePowerEachTurn = false;
    this.bloodBloom = false;
    this.fairyShield = false;

    // counters
    this.cardsThisTurn = 0;
    this.versesThisTurn = 0;
    this.versesThisCombat = 0;
    this.cardsPlayedTotal = 0;
    this.noMoreDraw = false;
    // Call & Response (alternation): the type of the last card played THIS
    // TURN, and a snapshot of it taken at the top of playCard so a card's own
    // onPlay can read "what came before me" via ctx.combat._prevPlayedType.
    this.lastPlayedType = null;
    this._prevPlayedType = null;
    this._extraOpenDraw = 0;
    // The Spire's bargains: a card borrows against next turn's energy/HP/draw.
    // Collected once in startPlayerTurn, then zeroed — these never persist
    // past the turn they come due.
    this.debt = { energy: 0, hp: 0, draw: 0 };
  }

  // ---------------------------------------------------------------- setup
  makeEnemy(id, idx) {
    const bp = ENEMIES[id];
    if (!bp) throw new Error('Unknown enemy ' + id);
    let hp = this.rng.int(bp.hpMin, bp.hpMax);
    hp = Math.round(hp * this.run.enemyHpMult(bp)); // ascension HP scaling
    const block = bp.startBlock || 0;
    return {
      id, bp, idx,
      name: bp.name,
      hp, maxHp: hp, block,
      powers: {}, alive: true,
      isPlayer: false,
      dmgCapPerTurn: bp.dmgCapPerTurn || 0, // per-player-turn damage cap (0 = uncapped)
      dmgTakenThisTurn: 0,
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

    // Ascension 11 (Crowned in Wrath): bosses begin combat with 2 Resolve.
    if (this.run.ascension >= 11) {
      for (const e of this.enemies) if (e.bp.boss) this.applyPower(e, 'strength', 2, e);
    }

    // Display the per-turn damage cap as an Invincibility pip (informational).
    for (const e of this.enemies) if (e.dmgCapPerTurn > 0) e.powers.invincibility = e.dmgCapPerTurn;

    // Pick initial enemy intents
    for (const e of this.enemies) this.pickEnemyMove(e);

    // From here on, deck insertions are player-visible and should animate.
    this._deckFxReady = true;
    this.startPlayerTurn(true);
  }

  // ---------------------------------------------------------------- logging / notify
  log(msg) { this.logs.push(msg); if (this.logs.length > 60) this.logs.shift(); this.onLog(msg); }
  // Coalesce multiple synchronous notify() calls (e.g. draw() firing one,
  // then a caller firing another right after to refresh the log) into a
  // single deferred onUpdate(). Without this, a second same-tick render tears
  // down and rebuilds the hand's DOM nodes before the first render's
  // requestAnimationFrame-scheduled draw-in animation gets to run on them,
  // silently killing the card-fly-in-from-draw-pile animation.
  notify() {
    if (this._notifyScheduled) return;
    this._notifyScheduled = true;
    Promise.resolve().then(() => {
      this._notifyScheduled = false;
      this.onUpdate();
    });
  }

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

  // ---------------------------------------------------------------- Tempo
  // The rhythm layer made visible to the card game. Tempo is a player-only
  // power (so it rides the generic pip/tooltip/float rendering): clean strikes
  // build it (+1, +2 on a Perfect), a successful parry adds +1, and a missed
  // beat — a missed strike QTE or a missed parry — breaks it back to 0. With
  // Rhythm Mode off every attack registers as 'good', so Tempo still builds
  // (steadily, without the Perfect upside or the miss risk). Cards read it via
  // ctx.tempo() or consume it via ctx.spendAllTempo(); relics listen on the
  // 'tempoGained' trigger.
  tempo() { return this.player.powers.tempo || 0; }
  gainTempo(n) {
    const add = Math.min(n, TEMPO_CAP - this.tempo());
    if (add <= 0) return;
    this.applyPower(this.player, 'tempo', add, this.player);
    this.fire('tempoGained', { amount: add, total: this.tempo() });
    // Fires once per crossing into the cap: a gain while already at 10
    // computes add <= 0 above and returns before reaching here, so this
    // can't refire until Tempo dips below the cap and climbs back to it.
    if (this.tempo() >= TEMPO_CAP) this.fire('tempoCapped');
  }
  breakTempo() {
    if (this.tempo() <= 0) return;
    delete this.player.powers.tempo;
    this.log('Your rhythm breaks.');
    this.fx('tempobreak', { entity: this.player });
    this.notify();
  }
  // Deliberate spend (finisher cards): no falter fx, returns the amount spent.
  spendAllTempo() {
    const t = this.tempo();
    if (t > 0) {
      delete this.player.powers.tempo;
      this.fx('temporelease', { entity: this.player, amount: t });
      this.notify();
    }
    return t;
  }
  registerStrikeGrade(grade) {
    if (grade === 'miss') this.breakTempo();
    else this.gainTempo(grade === 'perfect' ? 2 : 1);
  }

  // ---------------------------------------------------------------- damage & block math
  // Sapped (weak) and Exposed (vulnerable) are HIT-COUNTED, not turn-timed:
  // each attack hit consumes one stack (in applyDamage) and gets the modifier.
  // This reads current stacks without consuming, so it doubles as the
  // "what would the next hit do" preview math.
  calcAttackDamage(base, source, target) {
    let dmg = base + (source.powers.strength || 0);
    if (source.powers.weak) dmg = Math.floor(dmg * 0.75);
    if (target && target.powers.vulnerable) dmg = Math.floor(dmg * 1.5);
    // Challenged (the Duel mark): a flat, unmultiplied bonus — added last, on
    // top of any Exposed multiplier, not inside it — only when the PLAYER is
    // the attacker (the mark only ever sits on enemies).
    if (source.isPlayer && target && target.powers.challenged) dmg += target.powers.challenged;
    return Math.max(0, dmg);
  }
  // Consume one stack of a hit-counted power (see keywords.js: no ticksDown on
  // vulnerable/weak/frail — they expire by being used, not by the clock).
  consumeStack(entity, key) {
    if (!entity || !entity.powers[key]) return;
    entity.powers[key] -= 1;
    if (entity.powers[key] <= 0) delete entity.powers[key];
  }

  // Apply a chunk of damage to an entity through Block, returns HP actually lost.
  applyDamage(target, amount, { isAttack = false, source = null } = {}) {
    if (!target.alive) return 0;
    let dmg = amount;
    if (target.powers.intangible && dmg > 1) dmg = 1;
    // Per-turn damage cap (Heart of Static's Invincibility): clamp what this
    // enemy can take across a single player turn, then bank it. Resets each
    // player turn in startPlayerTurn.
    if (target.dmgCapPerTurn > 0) {
      const allowance = Math.max(0, target.dmgCapPerTurn - target.dmgTakenThisTurn);
      if (dmg > allowance) { dmg = allowance; this.fx('warded', { target }); }
      target.dmgTakenThisTurn += dmg;
    }
    let remaining = dmg;
    if (target.block > 0) {
      const blocked = Math.min(target.block, remaining);
      target.block -= blocked;
      remaining -= blocked;
    }
    let hpLost = 0;
    const blocked = dmg - remaining;
    if (remaining > 0) {
      target.hp -= remaining;
      hpLost = remaining;
      if (target.isPlayer) this.fire('hpLost', { amount: remaining });
    }
    this.fx('damage', { target, dmg, hpLost, blocked, isAttack, source });
    // Hit-counted debuffs: this hit used up one Exposed on the target and one
    // Sapped on the attacker (blocked hits still consume — the window was
    // spent on this swing either way). The multipliers were already applied
    // by calcAttackDamage/orbDamage before the hit landed.
    if (isAttack) {
      this.consumeStack(target, 'vulnerable');
      this.consumeStack(source, 'weak');
    }
    // Backlash (thorns) when attacked (deactivated)
    // if (isAttack && source && target.powers.thorns) {
    //   this.applyDamage(source, target.powers.thorns, { isAttack: false });
    // }
    // Riposte: a finite, telegraphed answer to being hit — the transparent
    // replacement for the removed Backlash. Unlike Exposed/Sapped/Brittle
    // above, its value is a damage AMOUNT, not a hit-count, so it is spent in
    // full (not consumeStack's decrement-by-1) on the first attack hit taken,
    // blocked or not.
    if (isAttack && target.isPlayer && source && target.powers.riposte) {
      const back = target.powers.riposte;
      delete target.powers.riposte;
      this.applyDamage(source, back, { isAttack: false });
    }
    this.checkDeath(target);
    if (!target.isPlayer) this.checkPhase(target);
    return hpLost;
  }

  // Boss/enemy phase transition: when a blueprint declares a `phase` and the
  // enemy's HP first crosses the threshold, it transforms once — logs, plays a
  // dramatic fx, runs onEnter, and re-picks its intent so the telegraph reflects
  // the new phase. `pick()` reads `s._phased` to branch its move table.
  checkPhase(e) {
    if (!e || e.isPlayer || !e.alive || e._phased) return;
    const ph = e.bp.phase;
    if (!ph || e.hp > e.maxHp * (ph.at ?? 0.5)) return;
    e._phased = true;
    this.log(ph.log || `${e.name} transforms!`);
    this.fx('phase', { target: e, name: ph.name || 'Second Phase' });
    if (ph.onEnter) ph.onEnter(this, e);
    if (e.alive && !this.over) this.pickEnemyMove(e);
    this.notify();
  }

  // Spawn a fresh enemy mid-combat (summoners). It waits one enemy phase before
  // acting (its intent is telegraphed during the player's turn first) and the
  // board is capped so summon-spam can't overwhelm the layout or the player.
  summonEnemy(id, { max = 4 } = {}) {
    if (this.livingEnemies().length >= max) return null;
    const e = this.makeEnemy(id, this.enemies.length);
    if (e.dmgCapPerTurn > 0) e.powers.invincibility = e.dmgCapPerTurn;
    e._justSummoned = true;
    this.enemies.push(e);
    this.pickEnemyMove(e);
    this.log(`${e.name} answers the call!`);
    this.fx('summon', { target: e });
    this.notify();
    return e;
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
        this.fx('death', { target: entity });
        this.onEnemyDeath(entity);
      }
    }
  }

  onEnemyDeath(enemy) {
    this.log(`${enemy.name} is destroyed.`);
    this.run.foesSlain += 1;
    this.fire('enemyDeath', { enemy });
    // The Duel: killing your Challenged foe claims what the Spire would have
    // taken — a windfall of momentum. Baked in here (not a registered
    // trigger), same as Blight's spread below, so replaying Call the Duel on
    // a fresh target this combat can never double-fire the payoff.
    if (enemy.powers.challenged) this.draw(3);
    // Blight outlives its host: baseline, a dead foe's remaining Blight leaps
    // to a random living enemy. Blight Bloom (rare power) upgrades that into
    // an instant burst on ALL others and replaces the spread.
    if (enemy.powers.poison) {
      const p = enemy.powers.poison;
      if (this.bloodBloom) {
        for (const e of this.livingEnemies()) this.applyDamage(e, p, { isAttack: false });
        this.log(`Blight Bloom bursts for ${p}!`);
      } else {
        const host = this.randomEnemy();
        if (host) {
          this.applyPower(host, 'poison', p, this.player);
          this.log(`The Blight leaps to ${host.name}!`);
        }
      }
    }
    if (this.livingEnemies().length === 0) this.win();
  }

  // An enemy leaves combat without dying (e.g. the Market Thief's Flee). No
  // on-death effects fire, but the fight must still end if no one remains.
  enemyFlee(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.fled = true;
    this.log(`${enemy.name} flees!`);
    this.fx('death', { target: enemy });
    if (this.livingEnemies().length === 0) this.win();
    this.notify();
  }

  // Player attack
  deal(target, base, hits = 1) {
    if (!target || !target.alive) { target = this.randomEnemy(); if (!target) return 0; }
    let total = 0;
    const mult = (this._cardDamageMult || 1) * (this._rhythmMult || 1);
    this.fx('attackstart', { source: this.player, target });
    for (let i = 0; i < hits; i++) {
      if (!target.alive) break;
      const dmg = Math.floor(this.calcAttackDamage(base, this.player, target) * mult);
      total += this.applyDamage(target, dmg, { isAttack: true, source: this.player });
    }
    this.notify();
    return total;
  }
  dealAll(base, hits = 1) {
    let total = 0;
    this.fx('attackstart', { source: this.player });
    const mult = (this._cardDamageMult || 1) * (this._rhythmMult || 1);
    for (let i = 0; i < hits; i++) {
      for (const e of this.livingEnemies()) {
        const dmg = Math.floor(this.calcAttackDamage(base, this.player, e) * mult);
        total += this.applyDamage(e, dmg, { isAttack: true, source: this.player });
      }
    }
    this.notify();
    return total;
  }
  dealAllRaw(amount) { for (const e of this.livingEnemies()) this.applyDamage(e, amount, { isAttack: true, source: this.player }); this.notify(); }

  // Orb / non-attack damage (ignores Resolve & Sapped, respects Exposed + Block)
  orbDamage(target, base) {
    if (!target || !target.alive) return 0;
    let dmg = base;
    if (target.powers.vulnerable) dmg = Math.floor(dmg * 1.5);
    return this.applyDamage(target, dmg, { isAttack: true, source: this.player });
  }

  // Enemy attack on player
  enemyAttack(enemy, base, hits = 1) {
    this.fx('attackstart', { source: enemy, target: this.player });
    // Flow: a true dodge — the whole attack action whiffs before block, the
    // parry prompt, or any of it. Distinct from Block/Phase, which absorb or
    // reduce damage that still "lands".
    if (this.player.powers.flow) {
      this.consumeStack(this.player, 'flow');
      this.fx('dodge', { entity: this.player, source: enemy });
      this.log(`${enemy.name}'s attack finds nothing but air.`);
      this.notify();
      return;
    }
    const realBlock = this.player.block;
    const qtePrompted = this._qtePrompted;
    const parried = this._parried;

    this._qtePrompted = false;
    this._parried = false;

    if (qtePrompted && !parried) {
      // Missed parry: half the block shatters, the rest still absorbs and is
      // consumed as normal. (Was: block fully bypassed — too punishing.)
      // A missed beat also breaks Tempo.
      this.player.block = Math.floor(realBlock / 2);
      this.fx('parrymiss', { entity: this.player, lost: realBlock - this.player.block });
      this.log(`Parry missed — ${enemy.name}'s hit shatters half your Block.`);
      this.breakTempo();
    } else if (qtePrompted && parried) {
      // A clean parry keeps the dance going.
      this.gainTempo(1);
    }

    let totalDmg = 0;
    for (let i = 0; i < hits; i++) {
      if (!this.player.alive) break;
      const dmg = Math.round(this.calcAttackDamage(base, enemy, this.player) * this.run.enemyDamageMult());
      totalDmg += dmg;
      this.applyDamage(this.player, dmg, { isAttack: true, source: enemy });
    }

    // Fired after the hit resolves, not before: a Sapped/etc. reaction to a
    // successful parry must land on the *attacker's future* hits, not get
    // silently applied-then-consumed by discounting the very attack it's
    // answering. Reflect uses the damage actually dealt (totalDmg, captured
    // above) rather than recomputing calcAttackDamage here, so it can't drift
    // from what the hit loop already consumed hit-counted stacks to produce.
    if (qtePrompted && !parried) {
      this.fire('parryMissed', { enemy });
    } else if (qtePrompted && parried) {
      this.fire('parrySuccess', { enemy });
      if (this._parryReflect && totalDmg > 0) {
        this.applyDamage(enemy, totalDmg, { isAttack: false });
        this.fx('reflect', { source: this.player, target: enemy });
      }
    }
    this.notify();
  }

  gainBlock(amount) {
    // player block from cards: dexterity + frail + noBlock
    if (this.player.powers.noBlock) return;
    let b = amount + (this.player.powers.dexterity || 0);
    // Brittle is hit-counted like the other debuffs: each card Block gain
    // consumes one stack for its 25% reduction (no turn tick).
    if (this.player.powers.frail) { b = Math.floor(b * 0.75); this.consumeStack(this.player, 'frail'); }
    b = Math.max(0, b);
    this.player.block += b;
    if (b > 0) this.fx('block', { entity: this.player, amount: b });
    this.notify();
  }
  gainBlockRaw(amount) {
    if (this.player.powers.noBlock) return;
    const b = Math.max(0, amount);
    this.player.block += b;
    if (b > 0) this.fx('block', { entity: this.player, amount: b });
    this.notify();
  }
  gainBlockTo(entity, amount, raw = false) {
    if (entity.isPlayer && entity.powers.noBlock) return;
    let b = amount;
    if (!raw && entity.isPlayer) {
      b += (entity.powers.dexterity || 0);
      if (entity.powers.frail) { b = Math.floor(b * 0.75); this.consumeStack(entity, 'frail'); }
    }
    b = Math.max(0, b);
    entity.block += b;
    if (b > 0) this.fx('block', { entity, amount: b });
    this.notify();
  }

  heal(amount) {
    if (amount <= 0) return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    this.fx('heal', { entity: this.player, amount });
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
    // 'signed' powers (e.g. Resolve) may hold a negative value and are removed
    // only at exactly 0; everything else clamps away at <= 0. (See POWERS.)
    if (def && def.signed) {
      if (target.powers[key] === 0) delete target.powers[key];
    } else if (target.powers[key] <= 0) {
      delete target.powers[key];
    }
    if (amount !== 0) this.fx('power', { target, key, amount });
    this.notify();
  }

  // ---------------------------------------------------------------- card piles
  addCardToPile(card, pile) {
    if (pile === 'hand') { if (this.hand.length < HAND_LIMIT) this.hand.push(card); else this.discardPile.push(card); }
    else if (pile === 'draw') { const i = this.rng.int(0, this.drawPile.length); this.drawPile.splice(i, 0, card); }
    else if (pile === 'drawTop') { this.drawPile.push(card); }
    else this.discardPile.push(card);
    // Cosmetic: reveal cards shuffled into the deck mid-combat (e.g. enemy-inflicted
    // statuses like Dazed) so the player sees what was added and where it landed.
    if (this._deckFxReady && (pile === 'draw' || pile === 'drawTop')) this.fx('cardtopile', { card, pile });
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

  consume(card) {
    this.consumePile.push(card);
    if (card._bp.onConsume) card._bp.onConsume(this.makeCtx(card, null));
    this.fire('cardConsumed', { card });
  }

  gainEnergy(n) { this.energy += n; this.notify(); }

  // ---------------------------------------------------------------- orbs (Zara)
  channel(type, n = 1) {
    // Mirrorcast: every Channel arrives twice.
    if (this.mirrorChannel) n *= 2;
    for (let i = 0; i < n; i++) {
      if (this.orbs.length >= this.orbSlots && this.orbs.length > 0) {
        const evoked = this.orbs.shift();
        this.evokeOrb(evoked);
      }
      this.orbs.push({ type, value: 0 });
    }
    this.log(`Channel ${type[0].toUpperCase() + type.slice(1)}${n > 1 ? ` ×${n}` : ''}.`);
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
      tempo: () => self.tempo(),
      gainTempo: (n) => self.gainTempo(n),
      spendAllTempo: () => self.spendAllTempo(),
      consumeThis: () => { card._forceConsume = true; },
    };
  }

  playCard(card, target) {
    if (!this.canPlay(card)) return false;
    const cost = this.cardCost(card);
    const spent = card.cost === 'X' ? this.energy : cost;
    this.energy -= spent;
    if (card.type === 'power' && this.freePowerEachTurn && cost === 0) { this._freePowerUsed = true; this.fx('relic', { id: 'cosmic_egg' }); }

    // remove from hand
    const hi = this.hand.indexOf(card);
    if (hi >= 0) this.hand.splice(hi, 1);

    // First-attack-double relic
    this._cardDamageMult = 1;
    if (card.type === 'attack' && this.firstAttackDouble && !this._usedFAD) { this._cardDamageMult = 2; this._usedFAD = true; this.fx('relic', { id: 'ancestor_idol' }); }

    this.cardsThisTurn += 1;
    this.cardsPlayedTotal += 1;
    if (card.verse) { this.versesThisTurn += 1; this.versesThisCombat += 1; }

    // Tempo registers BEFORE onPlay: the QTE already resolved, so this strike
    // is part of the flow it creates — a Tempo-scaling card counts its own
    // clean strike, and a missed finisher fizzles (breaks Tempo, then deals
    // its now-bonusless damage at the miss multiplier). Deliberate design:
    // misses hurt twice, that tension is the point of the rhythm layer.
    if (card.type === 'attack') {
      this.registerStrikeGrade(this._rhythmGrade || 'good');
      this._rhythmGrade = null;
    }

    this.log(`You play ${card.name}.`);
    if (card.type === 'skill') {
      this.fx('useSkill', { entity: this.player });
    }
    this._prevPlayedType = this.lastPlayedType;
    const ctx = this.makeCtx(card, target);
    card._bp.onPlay(ctx);

    this._cardDamageMult = 1;
    this._rhythmMult = 1;
    this.fire('cardPlayed', { card, prevType: this._prevPlayedType });
    if (card.verse) this.fire('versePlayed', { card });
    this.lastPlayedType = card.type;

    // Resolve card's resting place
    if (card._forceConsume || card.consume || card.type === 'power') {
      if (card.type === 'power' && !card.consume && !card._forceConsume) {
        // powers vanish into the ether (not consume pile, but removed from play)
      } else {
        this.consume(card);
      }
    } else {
      this.discardPile.push(card);
    }
    card._forceConsume = false;

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
    if (!first) this.player.block = 0;
    this._freePowerUsed = false;
    this._usedFAD = false;
    this.cardsThisTurn = 0;
    this.versesThisTurn = 0;
    this.lastPlayedType = null;
    this.noMoreDraw = false;

    // reset per-turn damage caps (e.g. Heart of Static's Invincibility)
    for (const e of this.enemies) e.dmgTakenThisTurn = 0;

    // start-of-turn poison on player
    this.tickPoison(this.player);

    // energy
    this.energy = this.maxEnergy + this.energyNextTurn + (first ? this.bonusEnergyTurn1 : 0);
    this.energyNextTurn = 0;

    // The Spire's bargains come due: a card that borrowed against next turn
    // collects here. Winning the fight before this ever runs voids the bill
    // entirely — racing the ledger is the whole point of the archetype.
    if (this.debt.energy > 0) { this.energy = Math.max(0, this.energy - this.debt.energy); this.debt.energy = 0; }
    if (this.debt.hp > 0) { this.loseHp(this.player, this.debt.hp); this.debt.hp = 0; }
    const debtDraw = this.debt.draw;
    this.debt.draw = 0;

    this.fire('turnStart');

    // Announce the handoff back to the player. The first turn is covered by the
    // Battle Start popup, so skip the banner there.
    if (!first) this.fx('announce', { text: 'Your Turn', kind: 'player' });

    // draw
    const drawCount = Math.max(0, 5 + (first ? this._extraOpenDraw : 0) - debtDraw);
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
    // Decrement every active power flagged ticksDown at the owner's turn boundary.
    for (const key of Object.keys(entity.powers)) {
      if (POWERS[key]?.ticksDown) {
        entity.powers[key] -= 1;
        if (entity.powers[key] <= 0) delete entity.powers[key];
      }
    }
    // Resolve Down: at end of turn, sap Strength/Resolve by the stacked amount, then clear.
    if (entity.powers.strengthDown) {
      this.applyPower(entity, 'strength', -entity.powers.strengthDown, entity);
      delete entity.powers.strengthDown;
    }
  }

  async endTurn() {
    if (this.over || this.animating) return;
    this.animating = true;

    // In-hand end-of-turn effects (curses), ethereal consume, discard
    for (const card of this.hand.slice()) {
      if (card._bp.inHandTurnEnd) card._bp.inHandTurnEnd(this.makeCtx(card, null));
    }
    for (const card of this.hand.slice()) {
      if (card.ethereal) { this.hand.splice(this.hand.indexOf(card), 1); this.consume(card); }
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

    if (!this.over) {
      // Brief pause after the enemy phase settles so "Your Turn" doesn't fire
      // in the same instant the last enemy's hit lands.
      await wait(600);
      this.startPlayerTurn(false);
    }
    this.animating = false;
    this.notify();
  }

  async enemyPhase() {
    // Announce the enemy turn and let the banner read before any foe acts, so
    // the first strike doesn't land in the same instant the phase begins.
    this.fx('announce', { text: 'Enemy Turn', kind: 'enemy' });
    await wait(850);
    for (const e of this.enemies) {
      if (!e.alive || this.over) continue;
      // A foe summoned during this same phase waits until the next one to act
      // (its intent is already telegraphed for the player's turn in between).
      if (e._justSummoned) { e._justSummoned = false; continue; }
      e.block = 0;
      this.tickPoison(e);
      if (!e.alive || this.over) continue;
      // Enrage: a guaranteed escalation clock. On/after the blueprint's turn it
      // gains Resolve once, punishing decks that try to stall the fight out.
      const en = e.bp.enrage;
      if (en && !e._enraged && e.turn >= en.turn) {
        e._enraged = true;
        this.log(`${e.name} enrages!`);
        this.fx('enrage', { target: e });
        this.applyPower(e, 'strength', en.strength, e);
      }
      // Stagger: the action itself is skipped (no move runs, nothing to
      // telegraph or parry), but everything else about the enemy's turn —
      // block reset above, poison/enrage, its own turn/history bookkeeping —
      // proceeds normally. Skipping pickEnemyMove is what makes the intent
      // carry over unchanged into the following phase.
      if (e._skipNext) {
        e._skipNext = false;
        this.log(`${e.name} is staggered and skips its turn.`);
        this.fx('stagger', { target: e });
        e.history.push(e.move);
        e.last = e.move;
        e.turn += 1;
        this.tickTurnDebuffs(e);
        continue;
      }
      const move = e.bp.moves[e.move];
      this.log(`${e.name} uses ${move.name}.`);
      const isAttack = e.intent && e.intent.type && e.intent.type.startsWith('attack');
      // Float the move name over the enemy, then give it a beat before the
      // action resolves so the attack/skill reads as a consequence of the name.
      this.fx('enemyMove', { source: e, name: move.name, isAttack });
      await wait(750);
      if (this.over || !e.alive) continue;
      if (!isAttack) {
        const isBlock = e.intent && e.intent.type && e.intent.type.includes('block');
        this.fx('skillstart', { source: e, pose: isBlock ? 'block' : 'skill' });
      }
      // Flow makes the whole attack whiff regardless of the parry outcome, so
      // skip the prompt entirely rather than asking the player to parry a hit
      // that was never going to land.
      if (this.parryPrompt && isAttack && this.player.block > 0 && this.player.alive && !this.player.powers.flow) {
        let res = null;
        try { res = await this.parryPrompt(e); } catch (_) { res = null; }
        this._parried = !!(res && res.success);
        this._qtePrompted = true;
      }
      move.run(this, e);
      this._qtePrompted = false;
      this._parried = false;
      this.notify();
      await wait(550);
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
    // Merge the move's name in so the intent icon's native hover title (see
    // renderIntent in combatView.js) reads the move's flavor name instead of
    // being blank.
    e.intent = { ...e.bp.moves[id].intent, name: e.bp.moves[id].name };
  }

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

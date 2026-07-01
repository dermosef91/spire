// Game controller: the scene state machine that ties together the title screen,
// character select, the act map, combat, rewards, shops, rest sites and events.
import { el, clear, wait } from './core/util.js';
import { RunState } from './core/state.js';
import { saveRun, loadRun, clearSave, hasSave, loadMeta, saveMeta } from './core/save.js';
import { CHARACTERS, COLORLESS_POOL } from './data/characters.js';
import { CARDS, createCard, upgradeCard, cardDesc, canUpgrade } from './data/cards.js';
import { RELICS } from './data/relics.js';
import { POTIONS } from './data/potions.js';
import { ENEMIES } from './data/enemies.js';
import { ENCOUNTERS, ACT_NAMES, ACT_BLURB } from './data/encounters.js';
import { eventsForAct } from './data/events.js';
import { generateMap, nextNodes, nodeAt } from './map/mapgen.js';
import { Combat } from './combat/combat.js';
import { CombatView } from './ui/combatView.js';
import { renderCard, topBar, relicChip, button } from './ui/components.js';
import { POWERS } from './data/keywords.js';
import { UI, NODE, relicIcon, potionIcon, characterModel } from './ui/icons.js';
import { spriteOrSvg } from './ui/sprites.js';
import { updateBackground } from './ui/backgrounds.js';
import { audio } from './audio.js';
import { fullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange, isTouchDevice } from './core/fullscreen.js';

const MAX_ACT = 3;

export class Game {
  constructor(root) {
    this.root = root;
    this.run = null;
    this.touch = isTouchDevice();
    this.tip = el('div', { class: 'tooltip', id: 'tooltip' });
    document.body.appendChild(this.tip);
    this.meta = loadMeta();
    this.setupMobile();
  }

  isTouch() { return this.touch; }

  // ----------------------------------------------------------- mobile / fullscreen
  setupMobile() {
    // (Fullscreen toggle lives in the top bar in-run, and on the title screen.)
    // Non-blocking "rotate to landscape" hint (CSS decides when to show it).
    this.rotateHint = el('div', { class: 'rotate-hint', html: '<span class="rot-ic">⟳</span> Rotate to landscape for the best view' });
    document.body.appendChild(this.rotateHint);

    if (this.touch) document.body.classList.add('is-touch');

    // A tap/click anywhere that is not an inspectable chip/card/tooltip dismisses the tooltip.
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.relic, .potion, .card, .tooltip')) {
        this.tooltip(null, null, false);
      }
    }, true);
  }

  // A small yes/no confirm overlay (used for irreversible touch actions like potions).
  confirm(title, desc, onYes) {
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box confirm-box' });
    box.appendChild(el('h3', { text: title }));
    if (desc) box.appendChild(el('p', { class: 'event-text', html: desc }));
    const row = el('div', { class: 'confirm-row' });
    row.appendChild(button('Use', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      onYes();
    }, 'primary'));
    row.appendChild(button('Cancel', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
    }));
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ----------------------------------------------------------- scene helpers
  setScene(node, sceneClass = '') {
    this.tooltip(null, null, false);
    clear(this.root);
    // Remove previous scene classes from body and add the current one
    document.body.className = document.body.className.replace(/\bscene-\S+/g, '');
    if (sceneClass) document.body.classList.add(`scene-${sceneClass}`);

    const wrap = el('div', { class: `scene ${sceneClass}` }, [node]);
    this.root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    
    // Update dynamic background image based on active scene and act
    const actNum = this.run ? this.run.act : null;
    updateBackground(sceneClass, actNum);
  }

  tooltip(obj, node, on, kind) {
    if (!on) { this.tip.style.display = 'none'; return; }
    let html = '';
    if (kind === 'card') {
      html = `<b>${obj.name}</b> · ${obj.cost === 'X' ? 'X' : obj.cost} Àṣẹ · ${obj.type}<br>${cardDesc(obj)}`;
    } else if (obj.desc !== undefined && obj.rarity !== undefined && POTIONS[obj.id]) {
      html = `<b>${obj.name}</b><br>${obj.desc}`;
    } else if (obj.desc !== undefined) {
      html = `<b>${obj.name}</b><br>${obj.desc}`;
    } else return;
    this.tip.innerHTML = html;
    this.tip.style.display = 'block';
    const r = node.getBoundingClientRect();
    const tw = 240;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
    this.tip.style.left = left + 'px';
    this.tip.style.width = tw + 'px';
    let top = r.top - this.tip.offsetHeight - 10;
    if (top < 8) top = r.bottom + 10;
    this.tip.style.top = top + 'px';
  }

  // ----------------------------------------------------------- title
  showTitle() {
    audio.setMusicMode('title');
    audio.play('select');
    const panel = el('div', { class: 'title-screen' });
    panel.appendChild(el('h1', { class: 'game-title', html: 'ÀṢẸ' }));
    
    // Title ornament divider matching reference
    const ornament = el('div', { class: 'title-ornament' });
    ornament.appendChild(el('span', { class: 'orn-diamond', text: '❖' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-dot', text: '●' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-bar', text: '❘' }));
    ornament.appendChild(el('span', { class: 'orn-diamond', text: '❖' }));
    panel.appendChild(ornament);

    panel.appendChild(el('div', { class: 'game-subtitle', text: 'Ascend the Obsidian Spire' }));
    const btns = el('div', { class: 'title-buttons' });
    if (hasSave()) {
      btns.appendChild(button('Continue Climb', () => { const r = loadRun(); if (r) { this.run = r; this.showMap(); } }, 'primary'));
    }
    btns.appendChild(button('New Run', () => this.showCharSelect(), hasSave() ? '' : 'primary'));
    btns.appendChild(button(audio.musicOn ? 'Music: On' : 'Music: Off', (e) => {
      const on = audio.toggleMusic();
      const txt = e.currentTarget.querySelector('.btn-content');
      if (txt) txt.textContent = on ? 'Music: On' : 'Music: Off';
      else e.target.textContent = on ? 'Music: On' : 'Music: Off';
    }));
    if (fullscreenSupported()) {
      btns.appendChild(button(isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen', async (e) => {
        const on = await toggleFullscreen(document.documentElement);
        const txt = e.currentTarget.querySelector('.btn-content');
        if (txt) txt.textContent = on ? 'Exit Fullscreen' : 'Fullscreen';
        else e.target.textContent = on ? 'Exit Fullscreen' : 'Fullscreen';
      }));
    }
    panel.appendChild(btns);
    panel.appendChild(el('div', { class: 'title-meta', text: `Runs: ${this.meta.runs}  ·  Victories: ${this.meta.wins}  ·  Best Floor: ${this.meta.bestFloor}` }));
    this.setScene(panel, 'title');
  }

  // ----------------------------------------------------------- character select
  showCharSelect() {
    audio.play('select');
    const panel = el('div', { class: 'charselect' });
    panel.appendChild(el('h2', { text: 'Choose Your Champion' }));
    const grid = el('div', { class: 'char-grid' });
    for (const id of Object.keys(CHARACTERS)) {
      const ch = CHARACTERS[id];
      const card = el('div', { class: 'char-card', style: { '--cc': ch.color, '--ca': ch.accent } });
      const charGlyph = el('div', { class: 'char-glyph imodel' }, [spriteOrSvg(id, characterModel(id))]);
      card.appendChild(charGlyph);
      card.appendChild(el('div', { class: 'char-name', text: ch.name }));
      card.appendChild(el('div', { class: 'char-title', text: ch.title }));
      card.appendChild(el('div', { class: 'char-hp', html: `<i class="tb-ic">${UI.heart}</i> ${ch.maxHp} HP` }));
      card.appendChild(el('div', { class: 'char-blurb', text: ch.blurb }));
      const starter = RELICS[ch.relic];
      card.appendChild(el('div', { class: 'char-relic', html: `Starter: <b>${starter.name}</b> — ${starter.desc}` }));
      card.appendChild(button('Begin', () => this.startRun(id), 'primary'));
      grid.appendChild(card);
    }
    panel.appendChild(grid);
    panel.appendChild(button('← Back', () => this.showTitle()));
    this.setScene(panel, 'charselect');
  }

  startRun(charId) {
    this.run = new RunState(charId);
    this.meta.runs += 1; saveMeta(this.meta);
    saveRun(this.run);
    this.showActIntro();
  }

  showActIntro() {
    const run = this.run;
    const panel = el('div', { class: 'act-intro' });
    panel.appendChild(el('div', { class: 'act-num', text: `ACT ${run.act}` }));
    panel.appendChild(el('h2', { text: ACT_NAMES[run.act] }));
    panel.appendChild(el('p', { class: 'act-blurb', text: ACT_BLURB[run.act] }));
    panel.appendChild(button('Enter', () => this.showMap(), 'primary'));
    this.setScene(panel, 'act-intro');
  }

  // ----------------------------------------------------------- map
  showMap() {
    audio.setMusicMode('ambient');
    saveRun(this.run);
    const run = this.run;
    const map = run.map;
    const COLS = map.cols, ROWS = map.rows;
    const colW = 64, rowH = 66, bossSpace = 80, pad = 28;
    const width = COLS * colW;
    const height = ROWS * rowH + bossSpace + pad;

    const panel = el('div', { class: 'map-scene' });
    panel.appendChild(topBar(run, {
      onPotion: (p, i) => this.usePotionOnMap(p, i),
      onHover: (o, n, on) => this.tooltip(o, n, on),
    }));
    panel.appendChild(el('div', { class: 'map-header', html: `<b>${ACT_NAMES[run.act]}</b> — choose your path upward` }));

    const scroller = el('div', { class: 'map-scroller' });
    const board = el('div', { class: 'map-board', style: { width: width + 'px', height: height + 'px' } });

    const X = (col) => col * colW + colW / 2;
    const Y = (row) => (ROWS - 1 - row) * rowH + rowH / 2 + bossSpace;

    // edges (SVG)
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'map-edges');
    svg.setAttribute('width', width); svg.setAttribute('height', height);
    const reachable = nextNodes(map, run.position);
    const reachKey = new Set(reachable.map((n) => n.boss ? 'boss' : `${n.row}-${n.col}`));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const node = map.grid[r][c];
        if (!node) continue;
        const targets = r === ROWS - 1 ? [{ boss: true }] : node.next.map((nc) => ({ row: r + 1, col: nc }));
        for (const t of targets) {
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', X(c)); line.setAttribute('y1', Y(r));
          line.setAttribute('x2', t.boss ? width / 2 : X(t.col));
          line.setAttribute('y2', t.boss ? bossSpace / 2 : Y(t.row));
          line.setAttribute('class', 'edge');
          svg.appendChild(line);
        }
      }
    }
    board.appendChild(svg);

    // nodes
    let currentNodeEl = null;
    const placeNode = (type, x, y, key, posObj) => {
      const isReach = reachKey.has(key);
      const isCurrent = run.position && !posObj.boss && run.position.row === posObj.row && run.position.col === posObj.col;
      const n = el('div', {
        class: `map-node node-${type} ${isReach ? 'reachable' : ''} ${isCurrent ? 'current' : ''}`,
        style: { left: x + 'px', top: y + 'px' },
        html: NODE_ICON[type] || '',
        title: NODE_LABEL[type] || type,
      });
      if (isReach) n.addEventListener('click', () => this.enterNode(posObj));
      if (isCurrent) currentNodeEl = n;
      board.appendChild(n);
    };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const node = map.grid[r][c];
        if (!node) continue;
        placeNode(node.type, X(c), Y(r), `${r}-${c}`, { row: r, col: c });
      }
    }
    placeNode('boss', width / 2, bossSpace / 2, 'boss', { boss: true });

    scroller.appendChild(board);
    panel.appendChild(scroller);
    panel.appendChild(el('div', { class: 'map-legend', html: legendHtml() }));
    this.setScene(panel, 'map');

    // Scroll to center the player's position if it's off-screen, otherwise scroll to the bottom
    const adjustScroll = () => {
      const viewportHeight = scroller.clientHeight;
      if (currentNodeEl && viewportHeight > 0) {
        const nodeY = currentNodeEl.offsetTop;
        const defaultScrollTop = scroller.scrollHeight - viewportHeight;
        // Check if the node is off-screen (above the visible area when scrolled to bottom)
        const isOffScreen = (nodeY - 22 < defaultScrollTop);
        if (isOffScreen) {
          scroller.scrollTop = nodeY - (viewportHeight / 2);
        } else {
          scroller.scrollTop = scroller.scrollHeight;
        }
      } else {
        scroller.scrollTop = scroller.scrollHeight;
      }
    };

    requestAnimationFrame(() => {
      adjustScroll();
      // Second check in next event loop tick to ensure DOM layouts are fully computed
      setTimeout(adjustScroll, 0);
    });
  }

  enterNode(pos) {
    audio.play('select');
    this.run.position = pos;
    const node = nodeAt(this.run.map, pos);
    const type = pos.boss ? 'boss' : node.type;
    switch (type) {
      case 'monster': this.startMonster(); break;
      case 'elite': this.startElite(); break;
      case 'boss': this.startBoss(); break;
      case 'event': this.showEvent(); break;
      case 'shop': this.showShop(); break;
      case 'rest': this.showRest(); break;
      case 'treasure': this.showTreasure(); break;
      default: this.showMap();
    }
    saveRun(this.run);
  }

  // ----------------------------------------------------------- combat entry
  pickEncounter(tier) {
    const table = ENCOUNTERS[this.run.act];
    const list = table[tier] || table.normal;
    return this.run.rng.pick(list);
  }

  startMonster() {
    this.run._actMonster = (this.run._actMonster || 0) + 1;
    const tier = this.run._actMonster <= 2 ? 'weak' : 'normal';
    this.beginCombat(this.pickEncounter(tier), 'monster');
  }
  startElite() { this.beginCombat(this.pickEncounter('elite'), 'elite'); }
  startBoss() { this.beginCombat(this.pickEncounter('boss'), 'boss'); }

  beginCombat(enemyIds, kind) {
    audio.setCombat(true, kind === 'boss');
    const combat = new Combat(this.run, enemyIds, { kind });
    const view = new CombatView(this, combat);
    view.onEnd = (c) => this.afterCombat(c, kind);
    const holder = el('div', { class: 'combat-holder' });
    this.setScene(holder, 'combat');
    view.mount(holder);
  }

  afterCombat(combat, kind) {
    audio.setCombat(false);
    // Write HP back
    this.run.hp = Math.max(0, combat.player.hp);
    if (!combat.victory) { this.gameOver(false); return; }
    audio.play('reward');
    // combat-end relic hooks
    for (const rid of this.run.relics) {
      const r = RELICS[rid];
      if (r && r.combatEnd) r.combatEnd(this.run);
    }
    if (this.run.act > this.meta.bestFloor) {} // floor tracking below
    this.showRewards(kind);
  }

  // ----------------------------------------------------------- rewards
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
    // relic for elite/boss
    if (kind === 'elite' || kind === 'boss') {
      rewards.push({ type: 'relic', taken: false });
    }
    // card reward
    rewards.push({ type: 'card', options: this.cardRewardOptions(kind), taken: false });

    this.renderRewards(rewards, kind);
  }

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
        const row = el('div', { class: 'reward-row' });
        if (rw.type === 'gold') {
          row.appendChild(el('div', { class: 'reward-icon', html: UI.coin }));
          row.appendChild(el('div', { class: 'reward-label', text: `${rw.amount} gold` }));
          row.addEventListener('click', () => { run.gold += rw.amount; rw.taken = true; audio.play('select'); rebuild(); });
        } else if (rw.type === 'potion') {
          const p = POTIONS[rw.id];
          row.appendChild(el('div', { class: 'reward-icon', style: { '--pcolor': p.color }, html: potionIcon() }));
          row.appendChild(el('div', { class: 'reward-label', html: `<b>${p.name}</b> — ${p.desc}` }));
          row.addEventListener('click', () => {
            if (run.addPotion(rw.id)) { rw.taken = true; audio.play('select'); rebuild(); }
          });
        } else if (rw.type === 'relic') {
          row.appendChild(el('div', { class: 'reward-icon', html: relicIcon('default') }));
          row.appendChild(el('div', { class: 'reward-label', text: 'Ancestral Relic' }));
          row.addEventListener('click', () => {
            const name = run.grantRandomRelic();
            rw.taken = true; audio.play('reward'); rebuild();
          });
        } else if (rw.type === 'card') {
          row.appendChild(el('div', { class: 'reward-icon', html: UI.draw }));
          row.appendChild(el('div', { class: 'reward-label', text: 'Add a card to your deck' }));
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
  }

  cardChoiceOverlay(options, onDone) {
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box' });
    box.appendChild(el('h3', { text: 'Choose a card' }));
    const row = el('div', { class: 'card-row' });
    for (const c of options) {
      row.appendChild(renderCard(c, {
        onClick: () => {
          this.tooltip(null, null, false);
          audio.play('select');
          document.body.removeChild(overlay);
          onDone(c);
        },
        onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card'),
      }));
    }
    box.appendChild(row);
    box.appendChild(button('Skip', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
      onDone(null);
    }));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

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
  }

  randomPotion() {
    const pool = Object.values(POTIONS);
    const weights = pool.map((p) => ({ value: p.id, weight: p.rarity === 'common' ? 65 : p.rarity === 'uncommon' ? 27 : 8 }));
    return this.run.rng.weighted(weights);
  }

  afterNode(kind) {
    const run = this.run;
    if (kind === 'monster') run.encountersCleared += 1;
    if (kind === 'elite') run.eliteCleared += 1;
    if (kind === 'boss') {
      run.bossesDefeated += 1;
      this.meta.bestFloor = Math.max(this.meta.bestFloor, run.act);
      saveMeta(this.meta);
      this.nextAct();
      return;
    }
    saveRun(run);
    this.showMap();
  }

  nextAct() {
    const run = this.run;
    if (run.act >= MAX_ACT) { this.victory(); return; }
    run.act += 1;
    run._actMonster = 0;
    run.map = generateMap(run.rng, run.act);
    run.position = null;
    saveRun(run);
    this.showActIntro();
  }

  // ----------------------------------------------------------- treasure
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
  }

  // ----------------------------------------------------------- rest site
  showRest() {
    const run = this.run;
    const panel = el('div', { class: 'rest-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(el('div', { class: 'rest-fire', html: NODE.rest }));
    panel.appendChild(el('h2', { text: 'An Ancestor Fire' }));
    panel.appendChild(el('p', { class: 'event-text', text: 'Warmth in the cold throat of the Spire. You may tend your wounds or sharpen your craft.' }));
    const choices = el('div', { class: 'choices' });
    if (run.canRestHeal()) {
      const amt = Math.floor(run.maxHp * 0.3) + run.restHealBonus();
      choices.appendChild(button(`Rest — heal ${amt} HP`, () => {
        run.heal(amt); audio.play('reward'); this.resultThenMap(`You rest and recover ${amt} HP.`);
      }, 'primary'));
    }
    choices.appendChild(button('Smith — upgrade a card', () => {
      this.deckOverlay((c) => canUpgrade(c), (entry) => {
        run.deck[entry._i].upgraded = true; audio.play('reward'); this.resultThenMap('Your card is reforged, keener than before.');
      }, 'Upgrade which card?');
    }));
    panel.appendChild(choices);
    this.setScene(panel, 'rest');
  }

  // ----------------------------------------------------------- events
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
  }

  resolveEventChoice(ev, ch) {
    const run = this.run;
    if (ch.flow === 'upgrade') {
      this.deckOverlay((c) => canUpgrade(c), (entry) => {
        run.deck[entry._i].upgraded = true;
        this.resultThenMap(ch.effect(run));
      }, 'Upgrade which card?');
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
  }

  resultThenMap(text) {
    const run = this.run;
    saveRun(run);
    const panel = el('div', { class: 'event-scene result' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(el('div', { class: 'event-art', text: '…' }));
    panel.appendChild(el('p', { class: 'event-text', html: text }));
    panel.appendChild(button('Continue →', () => { if (run.isDead()) this.gameOver(false); else this.showMap(); }, 'primary'));
    this.setScene(panel, 'event');
  }

  // ----------------------------------------------------------- shop
  showShop() {
    const run = this.run;
    if (!run._shop) run._shop = this.generateShop();
    const shop = run._shop;
    const panel = el('div', { class: 'shop-scene' });
    panel.appendChild(topBar(run, { onHover: (o, n, on) => this.tooltip(o, n, on) }));
    panel.appendChild(el('h2', { text: 'The Brass Bazaar' }));
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
      holder.addEventListener('click', () => this.buy(shop, 'relics', i));
      otherSec.appendChild(holder);
    });
    // potions
    shop.potions.forEach((item, i) => {
      if (item.sold) return;
      const p = POTIONS[item.id];
      const holder = el('div', { class: 'shop-mini' });
      holder.appendChild(el('div', { class: 'potion', style: { '--pcolor': p.color }, html: potionIcon(), title: p.desc }));
      holder.appendChild(el('div', { class: 'mini-label', text: p.name }));
      holder.appendChild(el('div', { class: `price ${run.gold < item.price ? 'cant' : ''}`, html: `<i class="tb-ic">${UI.coin}</i> ${item.price}` }));
      holder.addEventListener('click', () => this.buy(shop, 'potions', i));
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
          audio.play('select'); this.showShop();
        }, 'Remove which card?');
      }));
    } else removeRow.appendChild(el('div', { class: 'event-text', text: 'The smith has unmade one card for you already.' }));
    panel.appendChild(removeRow);

    panel.appendChild(button('Leave the bazaar →', () => { run._shop = null; this.showMap(); }, 'primary'));
    this.setScene(panel, 'shop');
  }

  generateShop() {
    const run = this.run;
    const pool = run.character.cardPool.slice();
    const cardIds = run.rng.sample(pool, Math.min(4, pool.length));
    cardIds.push(run.rng.pick(COLORLESS_POOL));
    const priceFor = (rar) => ({ common: run.rng.int(45, 60), uncommon: run.rng.int(70, 90), rare: run.rng.int(120, 160), special: run.rng.int(70, 100), basic: 50 }[rar] || 60);
    const cards = cardIds.map((id) => ({ card: createCard(id), price: priceFor(CARDS[id].rarity), sold: false }));

    const ownedSafe = Object.values(RELICS).filter((r) => !run.relics.includes(r.id) && r.rarity !== 'starter' && r.rarity !== 'boss');
    const relicPick = run.rng.sample(ownedSafe, Math.min(2, ownedSafe.length));
    const relics = relicPick.map((r) => ({ id: r.id, price: run.rng.int(130, 200), sold: false }));

    const potionPick = [this.randomPotion(), this.randomPotion()];
    const potions = potionPick.map((id) => ({ id, price: run.rng.int(50, 75), sold: false }));

    return { cards, relics, potions, removeUsed: false, removePrice: 75 };
  }

  buy(shop, kind, i) {
    const run = this.run;
    const item = shop[kind][i];
    if (item.sold) return;
    if (run.gold < item.price) { audio.play('error'); return; }
    if (kind === 'cards') { run.addCardById(item.card.id, item.card.upgraded); }
    else if (kind === 'relics') { run.addRelic(item.id); }
    else if (kind === 'potions') { if (!run.addPotion(item.id)) { audio.play('error'); return; } }
    run.gold -= item.price; item.sold = true;
    this.tooltip(null, null, false);
    audio.play('reward');
    this.showShop();
  }

  // ----------------------------------------------------------- deck overlay (for upgrade/remove)
  deckOverlay(filterFn, onPick, title) {
    const run = this.run;
    const overlay = el('div', { class: 'overlay' });
    const box = el('div', { class: 'overlay-box deck-overlay' });
    box.appendChild(el('h3', { text: title }));
    const grid = el('div', { class: 'deck-grid' });
    run.deck.forEach((entry, i) => {
      const inst = run.instance(entry);
      inst._i = i; entry._i = i;
      const ok = filterFn(inst);
      const node = renderCard(inst, {
        disabled: !ok,
        onClick: ok ? () => {
          this.tooltip(null, null, false);
          document.body.removeChild(overlay);
          onPick(entry);
        } : null,
        onHover: (cd, n, on) => this.tooltip(cd, n, on, 'card'),
      });
      grid.appendChild(node);
    });
    box.appendChild(grid);
    box.appendChild(button('Cancel', () => {
      this.tooltip(null, null, false);
      document.body.removeChild(overlay);
    }));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  usePotionOnMap(potion, idx) {
    const run = this.run;
    if (potion.combatOnly) { audio.play('error'); return; }
    const doUse = () => {
      potion.use({ run, combat: null, target: null });
      run.removePotionAt(idx);
      audio.play('select');
      this.showMap();
    };
    if (this.touch) this.confirm(`Use ${potion.name}?`, potion.desc, doUse);
    else doUse();
  }

  // ----------------------------------------------------------- end states
  gameOver(victory) {
    const run = this.run;
    clearSave();
    audio.play(victory ? 'victory' : 'defeat');
    const panel = el('div', { class: 'end-scene' });
    panel.appendChild(el('h1', { class: victory ? 'end-win' : 'end-lose', text: victory ? 'THE SPIRE IS CLEANSED' : 'YOU HAVE FALLEN' }));
    panel.appendChild(el('p', {
      class: 'end-text',
      text: victory
        ? 'The Static unravels into song. The Ancestors welcome you home, champion of Nyumbani.'
        : `The ${run.character.name} is unwritten by the Static, lost on Act ${run.act}.`,
    }));
    panel.appendChild(el('div', { class: 'end-stats', html: `Act reached: <b>${run.act}</b> · Cards: <b>${run.deck.length}</b> · Relics: <b>${run.relics.length}</b> · Gold: <b>${run.gold}</b>` }));
    panel.appendChild(button('Return to Title', () => this.showTitle(), 'primary'));
    this.setScene(panel, 'end');
  }
  victory() {
    this.meta.wins += 1; saveMeta(this.meta);
    this.gameOver(true);
  }
}

const NODE_ICON = { monster: NODE.monster, elite: NODE.elite, boss: NODE.boss, event: NODE.event, shop: NODE.shop, rest: NODE.rest, treasure: NODE.treasure };
const NODE_LABEL = { monster: 'Combat', elite: 'Elite (hard fight, relic)', boss: 'Boss', event: 'Unknown event', shop: 'Bazaar', rest: 'Ancestor Fire', treasure: 'Treasure' };
function legendHtml() {
  return Object.entries(NODE_LABEL).map(([k, v]) => `<span class="leg"><span class="leg-ic node-${k}">${NODE_ICON[k]}</span>${v}</span>`).join('');
}

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

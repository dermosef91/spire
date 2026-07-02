// Act-map scene: renders the branching node map, handles node entry and the
// routing dispatch, plus act progression and using potions from the map.
//
// Mixed onto Game.prototype (see game.js).

import { el } from '../core/util.js';
import { saveRun, saveMeta } from '../core/save.js';
import { topBar } from '../ui/components.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { generateMap, nextNodes, nodeAt } from '../map/mapgen.js';
import { NODE } from '../ui/icons.js';
import { audio } from '../audio.js';

const MAX_ACT = 3;

const NODE_ICON = { monster: NODE.monster, elite: NODE.elite, boss: NODE.boss, event: NODE.event, shop: NODE.shop, rest: NODE.rest, treasure: NODE.treasure };
const NODE_LABEL = { monster: 'Combat', elite: 'Elite (hard fight, relic)', boss: 'Boss', event: 'Unknown event', shop: 'Bazaar', rest: 'Ancestor Fire', treasure: 'Treasure' };
function legendHtml() {
  return Object.entries(NODE_LABEL).map(([k, v]) => `<span class="leg"><span class="leg-ic node-${k}">${NODE_ICON[k]}</span>${v}</span>`).join('');
}

export const MapScene = {
  // ----------------------------------------------------------- map
  showMap() {
    audio.setMusicMode('title');
    saveRun(this.run);
    const run = this.run;
    const map = run.map;
    const COLS = map.cols, ROWS = map.rows;
    const colW = 72, rowH = 74, bossSpace = 86, pad = 30;
    const width = COLS * colW;
    const height = ROWS * rowH + bossSpace + pad;

    const panel = el('div', { class: 'map-scene' });
    panel.appendChild(topBar(run, {
      onPotion: (p, i) => this.usePotionOnMap(p, i),
      onHover: (o, n, on) => this.tooltip(o, n, on),
    }));

    // Board + an always-on legend panel side by side (legend pinned right).
    const body = el('div', { class: 'map-body' });
    const scroller = el('div', { class: 'map-scroller' });
    const legend = el('aside', { class: 'map-legend' }, [
      el('div', { class: 'map-legend-head', text: 'Legend' }),
      el('div', { class: 'map-legend-list', html: legendHtml() }),
    ]);
    const board = el('div', { class: 'map-board', style: { width: width + 'px', height: height + 'px' } });

    const X = (col) => col * colW + colW / 2;
    const Y = (row) => (ROWS - 1 - row) * rowH + rowH / 2 + bossSpace;
    // Deterministic per-node offset so the layout reads as hand-drawn rather
    // than gridded, while staying stable across re-renders (edges line up
    // with the icons they connect) — no seed/RNG state to persist.
    const JITTER_X = 13, JITTER_Y = 11;
    const jitter = (row, col) => {
      const h = ((row * 73856093) ^ (col * 19349663)) >>> 0;
      return {
        x: ((h % 1000) / 1000 - 0.5) * JITTER_X,
        y: (((h >> 10) % 1000) / 1000 - 0.5) * JITTER_Y,
      };
    };
    const posOf = (row, col) => {
      const j = jitter(row, col);
      return { x: X(col) + j.x, y: Y(row) + j.y };
    };

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
        const from = posOf(r, c);
        const targets = r === ROWS - 1 ? [{ boss: true }] : node.next.map((nc) => ({ row: r + 1, col: nc }));
        for (const t of targets) {
          const to = t.boss ? { x: width / 2, y: bossSpace / 2 } : posOf(t.row, t.col);
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
          line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
          line.setAttribute('class', 'edge');
          svg.appendChild(line);
          // Subtle connector ornaments: a small diamond waypoint near the
          // middle and a directional chevron pointing up the spire (toward
          // the target). Kept small + faint via .edge-dot / .edge-arrow.
          const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
          const s = 2.6;
          const dot = document.createElementNS(NS, 'path');
          dot.setAttribute('d', `M ${mid.x} ${mid.y - s} L ${mid.x + s} ${mid.y} L ${mid.x} ${mid.y + s} L ${mid.x - s} ${mid.y} Z`);
          dot.setAttribute('class', 'edge-dot');
          svg.appendChild(dot);
          const ax = from.x + (to.x - from.x) * 0.72;
          const ay = from.y + (to.y - from.y) * 0.72;
          const deg = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
          const arrow = document.createElementNS(NS, 'path');
          arrow.setAttribute('d', 'M -2.6 -2.6 L 2 0 L -2.6 2.6');
          arrow.setAttribute('transform', `translate(${ax} ${ay}) rotate(${deg})`);
          arrow.setAttribute('class', 'edge-arrow');
          svg.appendChild(arrow);
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
        const p = posOf(r, c);
        placeNode(node.type, p.x, p.y, `${r}-${c}`, { row: r, col: c });
      }
    }
    placeNode('boss', width / 2, bossSpace / 2, 'boss', { boss: true });

    scroller.appendChild(board);
    body.appendChild(scroller);
    body.appendChild(legend);
    panel.appendChild(body);
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
  },

  enterNode(pos) {
    audio.play('select');
    this.run.position = pos;
    const node = nodeAt(this.run.map, pos);
    const type = pos.boss ? 'boss' : node.type;
    saveRun(this.run);
    // Ease into the node behind a fade veil so combat/events don't snap in.
    this.veilTransition(() => {
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
    });
  },

  pickEncounter(tier) {
    const table = ENCOUNTERS[this.run.act];
    const list = table[tier] || table.normal;
    return this.run.rng.pick(list);
  },

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
  },

  nextAct() {
    const run = this.run;
    if (run.act >= MAX_ACT) { this.victory(); return; }
    run.act += 1;
    run._actMonster = 0;
    run.map = generateMap(run.rng, run.act);
    run.position = null;
    saveRun(run);
    this.showActIntro();
  },

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
  },
};

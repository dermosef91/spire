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
    const colW = 120, rowH = 124, bossSpace = 320, pad = 30;
    const width = COLS * colW;
    const height = ROWS * rowH + bossSpace + pad;

    const panel = el('div', { class: `map-scene map-act-${run.act}` });
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

    // Atmosphere belongs to the board so it scrolls with the climb. Motes are
    // deterministic DOM particles; act-specific CSS turns them into rain,
    // sand/embers, or static without advancing the run RNG.
    const atmosphere = el('div', { class: `map-atmosphere atmosphere-act-${run.act}`, attrs: { 'aria-hidden': 'true' } });
    for (let i = 0; i < 14; i++) {
      atmosphere.appendChild(el('i', {
        class: 'map-weather-mote',
        style: {
          left: `${(i * 37 + run.act * 11) % 100}%`,
          top: `${(i * 53 + 17) % 100}%`,
          '--drift': `${((i * 19) % 70) - 35}px`,
          '--delay': `${-(i % 7) * 0.73}s`,
          '--duration': `${4.8 + (i % 5) * 0.8}s`,
        },
      }));
    }
    board.appendChild(atmosphere);

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
    const discoveredBefore = new Set(run.mapDiscovered || []);
    const newlyDiscovered = new Set();
    for (const key of reachKey) {
      if (!discoveredBefore.has(key)) newlyDiscovered.add(key);
      discoveredBefore.add(key);
    }
    run.mapDiscovered = [...discoveredBefore];
    saveRun(run);
    // Path memory: nodes already entered this act, and the edges walked
    // between consecutive entries (keys match the edge loop's from>to shape).
    const pathTaken = run.pathTaken || [];
    const visitedKey = new Set(pathTaken.map((p) => (p === 'boss' ? 'boss' : `${p.row}-${p.col}`)));
    const traveledEdge = new Set();
    for (let i = 1; i < pathTaken.length; i++) {
      const a = pathTaken[i - 1], b = pathTaken[i];
      if (a === 'boss') continue;
      traveledEdge.add(`${a.row}-${a.col}>${b === 'boss' ? 'boss' : `${b.row}-${b.col}`}`);
    }

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
          const walked = traveledEdge.has(`${r}-${c}>${t.boss ? 'boss' : `${t.row}-${t.col}`}`);
          line.setAttribute('class', walked ? 'edge edge-traveled' : 'edge');
          line.dataset.edge = `${r}-${c}>${t.boss ? 'boss' : `${t.row}-${t.col}`}`;
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
    const placeNode = (type, x, y, key, posObj) => {
      const isReach = reachKey.has(key);
      const isCurrent = run.position && !posObj.boss && run.position.row === posObj.row && run.position.col === posObj.col;
      const isVisited = visitedKey.has(key) && !isCurrent;
      const discovered = discoveredBefore.has(key) || isCurrent || isVisited;
      const n = el('div', {
        class: `map-node node-${type} ${isReach ? 'reachable' : ''} ${isCurrent ? 'current' : ''} ${isVisited ? 'visited' : ''} ${discovered ? 'discovered' : 'unexplored'} ${newlyDiscovered.has(key) ? 'discovering' : ''}`,
        style: { left: x + 'px', top: y + 'px' },
        html: NODE_ICON[type] || '',
        title: NODE_LABEL[type] || type,
      });
      n.dataset.key = key;
      if (isReach) n.addEventListener('click', () => this.enterNode(posObj));
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

    const scrollHint = el('div', { class: 'map-scroll-hint hidden' });
    panel.appendChild(scrollHint);

    const checkScrollHint = () => {
      const scrollTop = scroller.scrollTop;
      const offscreenAbove = [];
      for (const rn of reachable) {
        const key = rn.boss ? 'boss' : `${rn.row}-${rn.col}`;
        const nodeEl = board.querySelector(`[data-key="${key}"]`);
        if (nodeEl) {
          if (nodeEl.offsetTop + 30 < scrollTop) {
            offscreenAbove.push(rn);
          }
        }
      }

      if (offscreenAbove.length > 0) {
        scrollHint.classList.remove('hidden');
        scrollHint.innerHTML = '';
        scrollHint.appendChild(el('span', { text: 'Reachable: ' }));
        offscreenAbove.forEach(rn => {
          const type = rn.type;
          const chip = el('span', { class: `map-hint-chip node-${type}`, html: NODE_ICON[type] || '' });
          chip.title = NODE_LABEL[type] || type;
          scrollHint.appendChild(chip);
        });
        scrollHint.appendChild(el('span', { class: 'hint-arrow', text: ' ⇧' }));

        scrollHint.onclick = () => {
          let minTop = height;
          for (const rn of offscreenAbove) {
            const key = rn.boss ? 'boss' : `${rn.row}-${rn.col}`;
            const nodeEl = board.querySelector(`[data-key="${key}"]`);
            if (nodeEl && nodeEl.offsetTop < minTop) {
              minTop = nodeEl.offsetTop;
            }
          }
          scroller.scrollTo({
            top: Math.max(0, minTop - scroller.clientHeight / 3),
            behavior: 'smooth'
          });
        };
      } else {
        scrollHint.classList.add('hidden');
      }
    };

    scroller.addEventListener('scroll', checkScrollHint);

    this.setScene(panel, 'map');

    // Scroll straight to the currently-selectable (reachable) nodes on entry —
    // that's what the player needs to act on, not the node they just left.
    const adjustScroll = () => {
      const viewportHeight = scroller.clientHeight;
      if (viewportHeight <= 0) { scroller.scrollTop = scroller.scrollHeight; checkScrollHint(); return; }

      const reachTops = reachable
        .map((rn) => {
          const key = rn.boss ? 'boss' : `${rn.row}-${rn.col}`;
          return board.querySelector(`[data-key="${key}"]`);
        })
        .filter(Boolean)
        .map((nodeEl) => nodeEl.offsetTop);

      if (reachTops.length) {
        const center = (Math.min(...reachTops) + Math.max(...reachTops)) / 2;
        const maxScrollTop = scroller.scrollHeight - viewportHeight;
        scroller.scrollTop = Math.max(0, Math.min(maxScrollTop, center - viewportHeight / 2));
      } else {
        scroller.scrollTop = scroller.scrollHeight;
      }
      checkScrollHint();
    };

    requestAnimationFrame(() => {
      adjustScroll();
      // Second check in next event loop tick to ensure DOM layouts are fully computed
      setTimeout(adjustScroll, 0);
    });
  },

  enterNode(pos) {
    if (this._mapTraveling) return;
    this._mapTraveling = true;
    audio.play('click_heavy');
    const arrive = () => {
      this.run.position = pos;
    // Path memory: remember every node entered this act (guard covers runs
    // loaded from legacy saves that predate pathTaken).
      this.run.pathTaken = this.run.pathTaken || [];
      this.run.pathTaken.push(pos.boss ? 'boss' : { row: pos.row, col: pos.col });
      const node = nodeAt(this.run.map, pos);
      const type = pos.boss ? 'boss' : node.type;
      saveRun(this.run);
      // Ease into the node behind a fade veil so combat/events don't snap in.
      this.veilTransition(() => {
        this._mapTraveling = false;
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
    };

    const board = document.querySelector('.map-board');
    const targetKey = pos.boss ? 'boss' : `${pos.row}-${pos.col}`;
    const target = board && board.querySelector(`[data-key="${targetKey}"]`);
    if (!board || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { arrive(); return; }

    board.classList.add('journey-traveling');
    target.classList.add('journey-destination');
    const current = board.querySelector('.map-node.current');
    const fromKey = current && current.dataset.key;
    const edge = fromKey && board.querySelector(`[data-edge="${fromKey}>${targetKey}"]`);
    if (edge) edge.classList.add('edge-selected');
    const traveler = el('div', { class: 'map-traveler', html: '<span></span>', attrs: { 'aria-hidden': 'true' } });
    const start = current
      ? { x: current.offsetLeft, y: current.offsetTop }
      : { x: target.offsetLeft, y: Math.min(board.clientHeight - 18, target.offsetTop + 96) };
    const end = { x: target.offsetLeft, y: target.offsetTop };
    traveler.style.left = `${start.x}px`;
    traveler.style.top = `${start.y}px`;
    board.appendChild(traveler);
    const dx = end.x - start.x, dy = end.y - start.y;
    const anim = traveler.animate([
      { transform: 'translate(-50%, -50%) scale(0.72)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.14 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.08)`, opacity: 1, offset: 0.88 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.45)`, opacity: 0 },
    ], { duration: 680, easing: 'cubic-bezier(.2,.72,.22,1)' });
    anim.onfinish = arrive;
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
    run.heal(run.maxHp);
    run._actMonster = 0;
    run.actFlags = {}; // reactive-map flags are per-act (#18)
    run.map = generateMap(run.rng, run.act);
    run.position = null;
    run.pathTaken = [];
    run.mapDiscovered = [];
    saveRun(run);
    this.showActIntro();
  },

  usePotionOnMap(potion, idx) {
    const run = this.run;
    if (potion.combatOnly) { audio.play('error'); return; }
    const doUse = () => {
      potion.use({ run, combat: null, target: null });
      run.removePotionAt(idx);
      audio.play('click');
      this.showMap();
    };
    if (this.touch) this.confirm(`Use ${potion.name}?`, potion.desc, doUse);
    else doUse();
  },
};

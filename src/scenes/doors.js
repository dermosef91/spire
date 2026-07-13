// The Descent-Vote scene — "The Spire Offers".
//
// Replaces the branching node map for climb-mode runs (see map/climbgen.js).
// After every room the Spire presents 2-3 prose-first *doors* whose room type
// is only partially telegraphed by an omen. The player reads the omens, weighs
// the Spire's curator voice, and commits — there is no going back.
//
// Mixed onto Game.prototype (see game.js). Reuses the same room-dispatch as the
// legacy map's enterNode, plus MapScene's afterNode/nextAct/usePotionOnMap.

import { el } from '../core/util.js';
import { saveRun } from '../core/save.js';
import { topBar, button, sceneHeading } from '../ui/components.js';
import { NODE, OMEN } from '../ui/icons.js';
import { FLOORS, directorUpdate, generateOffer, recordPick, curatorLine } from '../map/climbgen.js';
import { audio } from '../audio.js';

const TYPE_LABEL = {
  monster: 'Combat', elite: 'Elite', shop: 'Bazaar',
  rest: 'Ancestor Fire', treasure: 'Treasure', event: 'Unknown', boss: 'Boss',
};
const HINT_LABEL = { danger: 'Danger', comfort: 'Refuge' };

// Room types that can hurt you — used for the blood-warm "this can bite" tell.
const DANGER_TYPES = new Set(['monster', 'elite', 'boss']);

// The glyph a door shows given its omen tier: plain reveals the room icon,
// veiled shows only danger/comfort, sealed shows the blank seam.
function omenGlyph(door) {
  if (door.tier === 'plain') return NODE[door.type] || OMEN.door;
  if (door.tier === 'veiled') return OMEN[door.hint] || OMEN.sealed;
  return OMEN.sealed;
}

// The one-word portent under a door.
function omenLabel(door) {
  if (door.tier === 'plain') return TYPE_LABEL[door.type] || door.type;
  if (door.tier === 'veiled') return HINT_LABEL[door.hint] || 'Unknown';
  return 'Unknown';
}

// Whether a door should wear the danger tell (leaks that it *can* hurt). Sealed
// doors deliberately give nothing away — that's the point of a sealed door.
function looksDangerous(door) {
  if (door.tier === 'plain') return DANGER_TYPES.has(door.type);
  if (door.tier === 'veiled') return door.hint === 'danger';
  return false;
}

export const DoorScene = {
  showDoors() {
    const run = this.run;
    const c = run.climb;
    audio.setMusicMode('act', run.act);

    const floor = c.floor + 1;
    // Generate (once per floor) and cache the offer + curator line, so a
    // re-render — using a potion, resizing — never re-rolls or advances the RNG.
    if (!c.offer || c.offerFloor !== floor) {
      directorUpdate(c.director, run);
      c.offer = generateOffer(run.rng, run.act, floor, c.director);
      c.curator = curatorLine(run.rng, c.director.appetite);
      c.offerFloor = floor;
      saveRun(run);
    }

    const panel = el('div', { class: 'doors-scene' });
    panel.appendChild(topBar(run, {
      onPotion: (p, i) => this.usePotionOnMap(p, i),
      onHover: (o, n, on) => this.tooltip(o, n, on),
    }));

    const body = el('div', { class: 'doors-body' });

    // ---- the offer ----
    const main = el('div', { class: 'doors-main' });
    main.appendChild(el('p', { class: 'doors-curator', text: c.curator || 'The Spire watches you choose.' }));

    const isBoss = c.offer.length === 1 && c.offer[0].type === 'boss';
    main.appendChild(sceneHeading(isBoss ? 'The Summit' : 'The Spire Offers'));

    const row = el('div', { class: `doors-row doors-count-${c.offer.length}` });
    c.offer.forEach((door, i) => {
      const card = el('button', {
        class: `door-card tier-${door.tier} ${looksDangerous(door) ? 'door-danger' : ''}`,
        attrs: { type: 'button', 'aria-label': `${omenLabel(door)} door` },
      });
      card.appendChild(el('div', { class: 'door-omen', html: omenGlyph(door) }));
      card.appendChild(el('p', { class: 'door-prose', text: door.prose }));
      const foot = el('div', { class: 'door-foot' });
      foot.appendChild(el('span', { class: `door-tag tag-${door.tier === 'plain' ? door.type : door.tier}`, text: omenLabel(door) }));
      foot.appendChild(el('span', { class: 'door-num', text: String(i + 1) }));
      card.appendChild(foot);
      card.addEventListener('click', () => this.enterRoom(door));
      row.appendChild(card);
    });
    main.appendChild(row);
    body.appendChild(main);

    // ---- ascent gauge (right rail; reflows below on narrow/portrait) ----
    body.appendChild(this.ascentGauge(run));

    panel.appendChild(body);
    this.setScene(panel, 'doors');
  },

  // A vertical spire silhouette of the act: a notch per floor, filled with the
  // icon of each room already taken, the boss crown at the top. Replaces the
  // node map's path-memory as the "how far to the boss / when's the treasure
  // band" planning read.
  ascentGauge(run) {
    const c = run.climb;
    const aside = el('aside', { class: 'ascent-gauge' });
    aside.appendChild(el('div', { class: 'ascent-head', text: `Act ${run.act}` }));
    const track = el('div', { class: 'ascent-track' });

    // Boss crown at the summit.
    track.appendChild(el('div', {
      class: `ascent-notch ascent-boss ${c.floor >= FLOORS ? 'here' : ''}`,
      html: NODE.boss, title: 'The summit boss',
    }));

    // Floors top (15) down to bottom (1) so the climb reads upward.
    for (let f = FLOORS; f >= 1; f--) {
      const doneType = c.history[f - 1];        // type entered on that floor, if any
      const current = f === c.floor + 1;         // the floor now being offered
      const notch = el('div', {
        class: `ascent-notch ${doneType ? 'done' : ''} ${current ? 'here' : ''} ${f === FLOORS ? 'pre-boss' : ''}`,
        html: doneType ? (NODE[doneType] || '') : '',
        title: doneType ? `Floor ${f}` : (current ? `Floor ${f} — choose` : `Floor ${f}`),
      });
      track.appendChild(notch);
    }
    aside.appendChild(track);
    return aside;
  },

  // Commit to a door: advance the floor, remember the choice, and dispatch to
  // the room behind it behind the veil fade (shared with the legacy map).
  enterRoom(door) {
    if (this._mapTraveling) return;
    this._mapTraveling = true;
    audio.play('click_heavy');
    const run = this.run, c = run.climb;
    c.floor += 1;
    c.history[c.floor - 1] = door.type;
    recordPick(c.director, door.type);
    c.offer = null; c.curator = '';
    saveRun(run);
    this.veilTransition(() => {
      this._mapTraveling = false;
      switch (door.type) {
        case 'monster': this.startMonster(); break;
        case 'elite': this.startElite(); break;
        case 'boss': this.startBoss(); break;
        case 'event': this.showEvent(); break;
        case 'shop': this.showShop(); break;
        case 'rest': this.showRest(); break;
        case 'treasure': this.showTreasure(); break;
        default: this.showDoors();
      }
    });
  },
};

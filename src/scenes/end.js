// End states: game over (defeat or victory screen) and the victory bookkeeping,
// including Ascension unlocks.
//
// Mixed onto Game.prototype (see game.js).

import { el } from '../core/util.js';
import { clearSave, saveMeta } from '../core/save.js';
import { button, relicChip, renderCard } from '../ui/components.js';
import { ASCENSION_LEVELS, MAX_ASCENSION } from '../core/state.js';
import { newlyUnlockedChars } from '../core/unlocks.js';
import { checkNewCardUnlocks } from '../core/cardUnlocks.js';
import { CHARACTERS } from '../data/characters.js';
import { audio } from '../audio.js';

// mm:ss (or h:mm:ss) from the run's elapsed seconds.
function fmtTime(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  const m = Math.floor(s / 60), r = s % 60, h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`
           : `${m}:${String(r).padStart(2, '0')}`;
}

// Trophy case shared by the defeat and both victory screens: the run's relic
// row (with tooltips) and the final deck in a scrollable grid.
function runSummary(game, run) {
  const wrap = el('div', { class: 'end-summary' });
  if (run.relics.length) {
    const row = el('div', { class: 'end-relics' });
    for (const rid of run.relics) row.appendChild(relicChip(rid, (o, n, on) => game.tooltip(o, n, on)));
    wrap.appendChild(row);
  }
  if (run.deck.length) {
    const holder = el('div', { class: 'end-deck' });
    const grid = el('div', { class: 'deck-grid' });
    for (const entry of run.deck) {
      grid.appendChild(renderCard(run.instance(entry), { onHover: (cd, n, on) => game.tooltip(cd, n, on, 'card') }));
    }
    holder.appendChild(grid);
    wrap.appendChild(holder);
  }
  return wrap;
}

// Appends a "✦ New card unlocked — <Name> ✦" line per card in
// game._cardsJustUnlocked, then clears it (mirrors the Ascension/character
// unlock reveals below).
function appendCardUnlocks(game, panel) {
  if (!game._cardsJustUnlocked || !game._cardsJustUnlocked.length) return;
  for (const bp of game._cardsJustUnlocked) {
    panel.appendChild(el('div', { class: 'end-unlock', html: `✦ New card unlocked — <b>${bp.name}</b> ✦` }));
  }
  game._cardsJustUnlocked = [];
}

export const EndScene = {
  gameOver(victory, info = {}) {
    const run = this.run;
    clearSave();
    this._cardsJustUnlocked = checkNewCardUnlocks(this.meta, run);
    if (this._cardsJustUnlocked.length) saveMeta(this.meta);
    audio.play(victory ? 'victory' : 'defeat');
    const panel = el('div', { class: 'end-scene' });
    panel.appendChild(el('h1', { class: victory ? 'end-win' : 'end-lose', text: victory ? 'THE SPIRE IS CLEANSED' : 'YOU HAVE FALLEN' }));
    panel.appendChild(el('p', {
      class: 'end-text',
      text: victory
        ? 'The Static unravels into song. The Ancestors welcome you home, champion of Nyumbani.'
        : `The ${run.character.name} is unwritten by the Static, lost on Act ${run.act}.`,
    }));
    if (!victory) {
      if (info.slainBy) panel.appendChild(el('div', { class: 'end-cause', text: `Slain by ${info.slainBy}` }));
      else if (info.event) panel.appendChild(el('div', { class: 'end-cause', text: `Undone by "${info.event}"` }));
    }
    run.updateElapsedTime();
    const ascStat = (run.ascension || 0) > 0 ? ` · Ascension <b>${run.ascension}</b>` : '';
    panel.appendChild(el('div', { class: 'end-stats', html: `Act reached: <b>${run.act}</b> · Cards: <b>${run.deck.length}</b> · Relics: <b>${run.relics.length}</b> · Gold: <b>${run.gold}</b> · Time: <b>${fmtTime(run.elapsedTime)}</b>${ascStat}` }));
    panel.appendChild(runSummary(this, run));
    if (this._ascJustUnlocked) {
      const lv = ASCENSION_LEVELS[this._ascJustUnlocked - 1];
      panel.appendChild(el('div', { class: 'end-unlock', html: `✦ Ascension ${this._ascJustUnlocked} unlocked — <b>${lv.name}</b> ✦` }));
      this._ascJustUnlocked = 0;
    }
    if (this._charsJustUnlocked && this._charsJustUnlocked.length) {
      for (const cid of this._charsJustUnlocked) {
        const ch = CHARACTERS[cid];
        panel.appendChild(el('div', { class: 'end-unlock', html: `✦ <b>${ch.name}</b> — ${ch.title} — is now available ✦` }));
      }
      this._charsJustUnlocked = [];
    }
    appendCardUnlocks(this, panel);
    panel.appendChild(button('Return to Title', () => this.showTitle(), 'primary'));
    this.setScene(panel, 'end');
  },
  victory() {
    this.meta.wins += 1;
    // Check if any characters just became unlocked at this win count.
    this._charsJustUnlocked = newlyUnlockedChars(this.meta.wins);
    this._cardsJustUnlocked = checkNewCardUnlocks(this.meta, this.run);
    // Winning at the highest unlocked Ascension unlocks the next level.
    const beat = this.run ? this.run.ascension : 0;
    let unlocked = false;
    if (beat >= (this.meta.maxAscension || 0) && this.meta.maxAscension < MAX_ASCENSION) {
      this.meta.maxAscension = (this.meta.maxAscension || 0) + 1;
      this.meta.ascension = this.meta.maxAscension;
      this.selectedAscension = this.meta.maxAscension;
      unlocked = true;
    }
    const firstAscent = !this.meta.ascendedOnce;
    this.meta.ascendedOnce = true;
    this.meta.timesAscended = (this.meta.timesAscended || 0) + 1;
    if (this.run) {
      this.run.updateElapsedTime();
      const runTime = this.run.elapsedTime;
      if (runTime > 0) {
        if (!this.meta.bestTime || runTime < this.meta.bestTime) {
          this.meta.bestTime = runTime;
        }
      }
    }
    saveMeta(this.meta);
    this._ascJustUnlocked = unlocked ? this.meta.maxAscension : 0;
    // The first climb to the Heart is always the complicit one — you cannot
    // refuse a welcome you do not yet understand. Only after you have been
    // taken up once, and only on a climb where you refused the Crown's claim,
    // does the Heart lay itself open to be unwritten.
    if (!firstAscent && this.run && !this.run.hasRelic('ascendant_crown')) {
      this.showEndChoice();
    } else {
      this.endVictory('ascend');
    }
  },

  // Offered only on a second-or-later ascent made without the Ascendant Crown:
  // now that you know what the summit is, you choose what to do with the Heart.
  showEndChoice() {
    const panel = el('div', { class: 'end-scene' });
    panel.appendChild(el('h1', { class: 'end-win', text: 'THE HEART LIES OPEN' }));
    panel.appendChild(el('p', {
      class: 'end-text',
      text: 'The Static parts. Above waits the Crown, and the welcome of the Ancestors that took every climber before you. Below turns the Heart that renders them into song. You have climbed into that welcome once already. This time you know what it is made of.',
    }));
    const choices = el('div', { class: 'choices' });
    choices.appendChild(button('Ascend — take your place among the kept', () => this.endVictory('ascend'), 'primary'));
    choices.appendChild(button('Unwrite the engine — set the climbed free', () => this.endVictory('unwrite')));
    panel.appendChild(choices);
    this.setScene(panel, 'end');
  },

  endVictory(mode) {
    const run = this.run;
    clearSave();
    audio.play('victory');
    const unwrite = mode === 'unwrite';
    if (unwrite && !this.meta.spireUnwritten) { this.meta.spireUnwritten = true; saveMeta(this.meta); }
    const panel = el('div', { class: 'end-scene' });
    panel.appendChild(el('h1', { class: 'end-win', text: unwrite ? 'THE SPIRE FALLS SILENT' : 'YOU ASCEND THE SPIRE' }));
    panel.appendChild(el('p', {
      class: 'end-text',
      text: unwrite
        ? 'You break the Heart instead of climbing into it. The Static unwinds, and the catalogued dead — every champion the Spire kept as a warden, a wraith, a wall — come loose from the brass and walk down into the light. No one is welcomed home today. No one is filed. The tower stands empty, and quiet, at last.'
        : 'The Crown settles and the Ancestors open to receive you — warmth, welcome, home, and the slow kind pressure of being written down. Far below, a new climber sets foot in the Sunken Market, and a fresh brass sentinel lifts a visor that wears your face.',
    }));
    run.updateElapsedTime();
    const ascStat = (run.ascension || 0) > 0 ? ` · Ascension <b>${run.ascension}</b>` : '';
    panel.appendChild(el('div', { class: 'end-stats', html: `Act reached: <b>${run.act}</b> · Cards: <b>${run.deck.length}</b> · Relics: <b>${run.relics.length}</b> · Gold: <b>${run.gold}</b> · Time: <b>${fmtTime(run.elapsedTime)}</b>${ascStat}` }));
    panel.appendChild(runSummary(this, run));
    if (this._ascJustUnlocked) {
      const lv = ASCENSION_LEVELS[this._ascJustUnlocked - 1];
      panel.appendChild(el('div', { class: 'end-unlock', html: `✦ Ascension ${this._ascJustUnlocked} unlocked — <b>${lv.name}</b> ✦` }));
      this._ascJustUnlocked = 0;
    }
    if (this._charsJustUnlocked && this._charsJustUnlocked.length) {
      for (const cid of this._charsJustUnlocked) {
        const ch = CHARACTERS[cid];
        panel.appendChild(el('div', { class: 'end-unlock', html: `✦ <b>${ch.name}</b> — ${ch.title} — is now available ✦` }));
      }
      this._charsJustUnlocked = [];
    }
    appendCardUnlocks(this, panel);
    panel.appendChild(button('Return to Title', () => this.showTitle(), 'primary'));
    this.setScene(panel, 'end');
  },
};

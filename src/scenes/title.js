// Title, character select (incl. the Ascension stepper) and act-intro scenes.
//
// These are mixed onto Game.prototype (see game.js). Methods use `this` (the
// Game instance) exactly as before the split — no behavior change.

import { el } from '../core/util.js';
import { RunState, ASCENSION_LEVELS, MAX_ASCENSION } from '../core/state.js';
import { saveRun, loadRun, hasSave, saveMeta } from '../core/save.js';
import { CHARACTERS } from '../data/characters.js';
import { RELICS } from '../data/relics.js';
import { button } from '../ui/components.js';
import { UI, characterModel } from '../ui/icons.js';
import { isCharUnlocked, charUnlockReq } from '../core/unlocks.js';
import { spriteOrSvg } from '../ui/sprites.js';
import { ACT_NAMES, ACT_BLURB } from '../data/encounters.js';
import { audio } from '../audio.js';
import { fullscreenSupported, isFullscreen, toggleFullscreen, enterFullscreen } from '../core/fullscreen.js';

export const TitleScene = {
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
      btns.appendChild(button('Continue Climb', async () => {
        if (fullscreenSupported() && !isFullscreen()) {
          await enterFullscreen(document.documentElement);
        }
        const r = loadRun();
        if (r) {
          this.run = r;
          this.showMap();
        }
      }, 'primary'));
    }
    btns.appendChild(button('New Run', async () => {
      if (fullscreenSupported() && !isFullscreen()) {
        await enterFullscreen(document.documentElement);
      }
      this.showCharSelect();
    }, hasSave() ? '' : 'primary'));
    panel.appendChild(btns);

    // Less prominent settings toggles for Rhythm and Music
    const settings = el('div', { class: 'title-settings' });
    const rhythmBtn = el('button', {
      class: 'title-setting-btn',
      html: `Rhythm: <b>${this.rhythmOn() ? 'On' : 'Off'}</b>`,
      on: {
        click: () => {
          this.meta.rhythm = !this.rhythmOn();
          saveMeta(this.meta);
          rhythmBtn.innerHTML = `Rhythm: <b>${this.rhythmOn() ? 'On' : 'Off'}</b>`;
          audio.play('select');
        }
      }
    });
    settings.appendChild(rhythmBtn);

    const musicBtn = el('button', {
      class: 'title-setting-btn',
      html: `Music: <b>${audio.musicOn ? 'On' : 'Off'}</b>`,
      on: {
        click: () => {
          const on = audio.toggleMusic();
          musicBtn.innerHTML = `Music: <b>${on ? 'On' : 'Off'}</b>`;
          audio.play('select');
        }
      }
    });
    settings.appendChild(musicBtn);
    panel.appendChild(settings);

    // Fullscreen toggle positioned in the top-right corner of the title scene
    const topActions = el('div', { class: 'title-top-actions' });
    if (fullscreenSupported()) {
      topActions.appendChild(el('button', {
        class: 'tb-fs',
        html: UI.fullscreen,
        attrs: { 'aria-label': 'Toggle fullscreen', title: 'Fullscreen' },
        on: { click: () => toggleFullscreen(document.documentElement) }
      }));
    }
    panel.appendChild(topActions);

    const ascLabel = this.meta.maxAscension >= MAX_ASCENSION ? 'Ascension MAX' : `Ascension ${this.meta.maxAscension}`;
    panel.appendChild(el('div', { class: 'title-meta', text: `Runs: ${this.meta.runs}  ·  Victories: ${this.meta.wins}  ·  Best Act: ${this.meta.bestFloor}  ·  ${ascLabel} unlocked` }));
    this.setScene(panel, 'title');
  },

  // ----------------------------------------------------------- character select
  showCharSelect() {
    audio.play('select');
    const panel = el('div', { class: 'charselect' });
    panel.appendChild(el('h2', { text: 'Choose Your Champion' }));
    const grid = el('div', { class: 'char-grid' });
    for (const id of Object.keys(CHARACTERS)) {
      const ch = CHARACTERS[id];
      const unlocked = isCharUnlocked(id, this.meta);
      const card = el('div', { class: `char-card${unlocked ? '' : ' char-locked'}`, style: { '--cc': ch.color, '--ca': ch.accent } });
      const charGlyph = el('div', { class: 'char-glyph imodel' }, [spriteOrSvg(id, characterModel(id))]);
      card.appendChild(charGlyph);
      card.appendChild(el('div', { class: 'char-name', text: ch.name }));
      card.appendChild(el('div', { class: 'char-title', text: ch.title }));
      if (unlocked) {
        card.appendChild(el('div', { class: 'char-hp', html: `<i class="tb-ic">${UI.heart}</i> ${ch.maxHp} HP` }));
        card.appendChild(el('div', { class: 'char-blurb', text: ch.blurb }));
        const starter = RELICS[ch.relic];
        card.appendChild(el('div', { class: 'char-relic', html: `Starter: <b>${starter.name}</b> — ${starter.desc}` }));
        card.appendChild(button('Begin', () => this.startRun(id), 'primary'));
      } else {
        const lockOverlay = el('div', { class: 'char-lock-overlay' });
        lockOverlay.appendChild(el('i', { class: 'char-lock-ic', html: UI.lock }));
        lockOverlay.appendChild(el('div', { class: 'char-lock-req', text: charUnlockReq(id) }));
        card.appendChild(lockOverlay);
      }
      grid.appendChild(card);
    }
    panel.appendChild(grid);
    if ((this.meta.maxAscension || 0) > 0) {
      panel.appendChild(this.ascensionSelector());
    }
    panel.appendChild(button('← Back', () => this.showTitle()));
    this.setScene(panel, 'charselect');
  },

  // A stepper for choosing the Ascension level, capped at what the player has
  // unlocked. At level 0 there are no modifiers; higher levels stack them.
  ascensionSelector() {
    const wrap = el('div', { class: 'asc-select' });
    const maxUnlocked = this.meta.maxAscension || 0;
    this.selectedAscension = Math.min(this.selectedAscension, maxUnlocked);

    const row = el('div', { class: 'asc-row' });
    const dec = button('◀', () => this.setAscension(this.selectedAscension - 1));
    const inc = button('▶', () => this.setAscension(this.selectedAscension + 1));
    const label = el('div', { class: 'asc-label' });
    row.appendChild(dec);
    row.appendChild(label);
    row.appendChild(inc);
    wrap.appendChild(row);

    const desc = el('div', { class: 'asc-desc' });
    wrap.appendChild(desc);

    this._ascRefs = { label, desc, dec, inc, maxUnlocked };
    this.renderAscension();
    return wrap;
  },

  setAscension(n) {
    const maxUnlocked = this.meta.maxAscension || 0;
    this.selectedAscension = Math.max(0, Math.min(maxUnlocked, n));
    this.meta.ascension = this.selectedAscension; saveMeta(this.meta);
    audio.play('select');
    this.renderAscension();
  },

  renderAscension() {
    const r = this._ascRefs;
    if (!r) return;
    const a = this.selectedAscension;
    r.label.textContent = a === 0 ? '' : `Ascension ${a}`;
    if (a === 0) {
      r.desc.innerHTML = '<span class="asc-base">Base difficulty — no modifiers.</span>';
    } else {
      // Show the modifiers active at this level (cumulative).
      const active = ASCENSION_LEVELS.filter((l) => l.lvl <= a);
      r.desc.innerHTML = active.map((l) => `<span class="asc-mod"><b>A${l.lvl} ${l.name}:</b> ${l.desc}</span>`).join('');
    }
    r.dec.classList.toggle('asc-off', a <= 0);
    r.inc.classList.toggle('asc-off', a >= r.maxUnlocked);
    if (r.maxUnlocked === 0) r.inc.title = 'Win a run to unlock Ascension 1';
  },

  startRun(charId) {
    this.run = new RunState(charId, undefined, this.selectedAscension);
    this.meta.runs += 1; saveMeta(this.meta);
    saveRun(this.run);
    this.showActIntro();
  },

  showActIntro() {
    const run = this.run;
    const panel = el('div', { class: 'act-intro' });
    panel.appendChild(el('div', { class: 'act-num', text: `ACT ${run.act}` }));
    panel.appendChild(el('h2', { text: ACT_NAMES[run.act] }));
    panel.appendChild(el('p', { class: 'act-blurb', text: ACT_BLURB[run.act] }));
    panel.appendChild(button('Enter', () => this.showMap(), 'primary'));
    this.setScene(panel, 'act-intro');
  },
};

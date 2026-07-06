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
          audio.play('click');
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
          audio.play('click');
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

    const formatTime = (sec) => {
      if (!sec || isNaN(sec) || sec <= 0) return '--:--';
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    const ascLabel = this.meta.maxAscension >= MAX_ASCENSION ? 'ASCENSION MAX' : `ASCENSION ${this.meta.maxAscension}`;
    const bestTimeStr = formatTime(this.meta.bestTime);
    panel.appendChild(el('div', {
      class: 'title-meta',
      text: `RUNS: ${this.meta.runs}   ·   VICTORIES: ${this.meta.wins}   ·   BEST TIME: ${bestTimeStr}   ·   ${ascLabel} UNLOCKED`
    }));
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
        card.appendChild(el('div', { class: 'char-relic' }, [
          el('div', { class: 'char-relic-label', text: `Starter: ${starter.name}` }),
          el('div', { class: 'char-relic-desc', text: starter.desc })
        ]));
        card.appendChild(button('Begin', () => { audio.play('click_heavy'); this.startRun(id); }, 'primary'));
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
    panel.appendChild(button('← Back', () => { audio.play('click'); this.showTitle(); }));
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
    audio.play('click');
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
    this.narrator.resetRun();
    this.showActIntro();
  },

  showActIntro() {
    const run = this.run;
    this.narrator.say(`act_intro_${run.act}`);
    const panel = el('div', { class: 'act-intro' });

    // ---------- orange floating particles ----------
    const colors = [[255, 120, 20], [255, 160, 45], [255, 85, 10], [230, 95, 20]];
    const cvs = document.createElement('canvas');
    cvs.className = 'act-particles';
    const pCtx = cvs.getContext('2d');
    const particles = [];
    let pW = 0, pH = 0, pDpr = 1, pRaf = null;

    function pResize() {
      pDpr = Math.min(window.devicePixelRatio || 1, 2);
      pW = window.innerWidth; pH = window.innerHeight;
      cvs.width = pW * pDpr; cvs.height = pH * pDpr;
      cvs.style.width = pW + 'px'; cvs.style.height = pH + 'px';
      pCtx.setTransform(pDpr, 0, 0, pDpr, 0, 0);
    }

    function spawnParticle(initialY = null) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      const yVal = initialY !== null ? initialY : pH + 10 + Math.random() * 40;
      const lifeVal = initialY !== null ? Math.random() : 1;
      particles.push({
        x: Math.random() * pW,
        y: yVal,
        vy: -(8 + Math.random() * 18),
        vx: (Math.random() - 0.5) * 8,
        r: Math.random() * 2.2 + 0.8,
        life: lifeVal,
        decay: 0.08 + Math.random() * 0.1,
        c,
        phase: Math.random() * Math.PI * 2,
        sway: 0.2 + Math.random() * 0.5,
      });
    }

    let pLast = performance.now();
    function pFrame(now) {
      const dt = Math.min(50, now - pLast) / 1000; pLast = now;
      pCtx.clearRect(0, 0, pW, pH);

      // Spawn with decreased frequency
      if (particles.length < 25 && Math.random() < 0.08) {
        spawnParticle();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.phase += dt * 1.8;
        p.x += (p.vx + Math.sin(p.phase) * p.sway * 12) * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0 || p.y < -10) { particles.splice(i, 1); continue; }
        const a = Math.min(0.7, p.life * 0.8);
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a})`;
        pCtx.shadowColor = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a * 0.7})`;
        pCtx.shadowBlur = 10;
        pCtx.fill();
        pCtx.shadowBlur = 0;
      }
      pRaf = requestAnimationFrame(pFrame);
    }

    panel.appendChild(cvs);
    // Observe mount to start & unmount to stop
    requestAnimationFrame(() => {
      pResize();
      // Pre-populate particles immediately across screen heights
      for (let i = 0; i < 18; i++) {
        spawnParticle(Math.random() * pH);
      }
      pRaf = requestAnimationFrame(pFrame);
    });
    const rObs = new ResizeObserver(() => pResize());
    rObs.observe(cvs);
    // Cleanup when scene changes (panel is removed from DOM)
    const mObs = new MutationObserver(() => {
      if (!document.body.contains(panel)) {
        if (pRaf) cancelAnimationFrame(pRaf);
        rObs.disconnect(); mObs.disconnect();
      }
    });
    mObs.observe(document.getElementById('game-root'), { childList: true, subtree: true });

    panel.appendChild(el('div', { class: 'act-num', text: `ACT ${run.act}` }));
    panel.appendChild(el('h2', { text: ACT_NAMES[run.act] }));
    panel.appendChild(el('p', { class: 'act-blurb', text: ACT_BLURB[run.act] }));
    panel.appendChild(button('Enter', () => { audio.play('click_heavy'); this.showMap(); }, 'primary'));
    this.setScene(panel, 'act-intro');
  },
};

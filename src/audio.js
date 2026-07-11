// Per-act overworld ambience (map/shop/rest/event/treasure) — matches
// ACT_NAMES in data/encounters.js and the ACT_PALETTES mood in fx/background.js.
const ACT_MUSIC = {
  1: 'assets/music/SunkenMarket.mp3',
  2: 'assets/music/BrassArchive.mp3',
  3: 'assets/music/StaticCrown.mp3',
};

const SOUNDS = {
  select: 'assets/sounds/click.wav',
  reward: 'assets/sounds/reward.wav',
  attack: 'assets/sounds/attack.wav',
  skill: 'assets/sounds/skill.mp3',
  coin: 'assets/sounds/coin.wav',
  hit: 'assets/sounds/hit.mp3.flac',
  click: 'assets/sounds/click.wav',
  click_heavy: 'assets/sounds/click.wav',
  pickcard: 'assets/sounds/pickcard.mp3',
  draw: 'assets/sounds/pickcard.mp3',
  playcard: 'assets/sounds/playcards.mp3',
  'attack-blocked': 'assets/sounds/attack-blocked.mp3',
  thunder: 'assets/sounds/thunder.mp3',
  slime: 'assets/sounds/slime.wav',
  zap: 'assets/sounds/zap.mp3',
  splash: 'assets/sounds/splash.mp3',
  growl: 'assets/sounds/growl.mp3',
  block: 'assets/sounds/block.wav',
  summon: 'assets/sounds/summon.wav',
  phase: 'assets/sounds/phase.wav',
  tempo_release: 'assets/sounds/tempo_release.wav',
  power_surge: 'assets/sounds/power_surge.wav',
};

// Tiny procedural sound + ambient pad using WebAudio — no asset files required.
class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    // Music defaults to on; it actually starts on the first user gesture
    // (browser autoplay policy) via the unlock handler in main.js.
    this.musicOn = true;
    this.muted = false;
    this._music = null;
    this.musicMode = 'title'; // 'title', 'ambient', 'combat', 'boss', 'act'
    this.musicAct = null; // which act's ambience 'act' mode should play
    this.titleMusic = null;
    this.combatMusic = null;
    this.bossMusic = null;
    this.actMusic = null;
    this.actMusicAct = null;
    this.buffers = {};
    this.loadingBuffers = {};
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.enabled = false;
      }
    }
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      // Load user assets
      for (const [name, url] of Object.entries(SOUNDS)) {
        this.loadSound(name, url);
      }
    }
  }
  async loadSound(name, url) {
    if (this.buffers[name] || this.loadingBuffers[name]) return;
    this.loadingBuffers[name] = true;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[name] = audioBuffer;
    } catch (e) {
      console.warn(`Failed to load sound "${name}" from ${url}:`, e);
    } finally {
      this.loadingBuffers[name] = false;
    }
  }
  playBuffer(name, gainVal = 0.4) {
    if (!this.ctx || !this.buffers[name]) return false;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffers[name];
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      source.start(0);
      return true;
    } catch (e) {
      console.warn(`Error playing buffer "${name}":`, e);
      return false;
    }
  }
  ensureTitleMusic() {
    if (!this.titleMusic) {
      this.titleMusic = new window.Audio('assets/music/titletheme.mp3');
      this.titleMusic.loop = true;
      this.titleMusic.volume = 0.08;
    }
  }
  ensureCombatMusic() {
    if (!this.combatMusic) {
      this.combatMusic = new window.Audio('assets/music/combattheme1.mp3');
      this.combatMusic.loop = true;
      this.combatMusic.volume = 0.08;
    }
  }
  ensureBossMusic() {
    if (!this.bossMusic) {
      this.bossMusic = new window.Audio('assets/music/combattheme3.mp3');
      this.bossMusic.loop = true;
      this.bossMusic.volume = 0.08;
    }
  }
  ensureActMusic(act) {
    const src = ACT_MUSIC[act];
    if (!src) return null;
    if (!this.actMusic || this.actMusicAct !== act) {
      if (this.actMusic) this.actMusic.pause();
      this.actMusic = new window.Audio(src);
      this.actMusic.loop = true;
      this.actMusic.volume = 0.08;
      this.actMusicAct = act;
    }
    return this.actMusic;
  }
  tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
    if (this.muted || !this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  play(name) {
    if (this.muted || !this.enabled) return;
    this.ensure();
    
    // Choose appropriate defaults for each user sound's volume
    let gain = 0.4;
    if (name === 'select') gain = 0.35;
    if (name === 'reward') gain = 0.45;
    if (name === 'attack') gain = 0.45;
    if (name === 'skill') gain = 0.45;
    if (name === 'coin') gain = 0.5;
    if (name === 'hit') gain = 0.4;
    if (name === 'click') gain = 0.3;
    if (name === 'click_heavy') gain = 0.35;
    if (name === 'pickcard') gain = 0.2;
    if (name === 'draw') gain = 0.4;
    if (name === 'playcard') gain = 0.45;
    if (name === 'attack-blocked') gain = 0.45;
    if (name === 'thunder') gain = 0.45;
    if (name === 'slime') gain = 0.45;
    if (name === 'zap') gain = 0.45;
    if (name === 'splash') gain = 0.45;
    if (name === 'growl') gain = 0.45;
    if (name === 'block') gain = 0.42;
    if (name === 'summon') gain = 0.46;
  if (name === 'phase') gain = 0.5;
    if (name === 'tempo_release') gain = 0.4;
    if (name === 'power_surge') gain = 0.4;
    if (name === 'cardcommit') gain = 0.28;
    if (name === 'guardbreak') gain = 0.42;
    if (name === 'buff' || name === 'debuff') gain = 0.24;
    if (name === 'heal') gain = 0.32;
    if (name === 'dodge' || name === 'reflect' || name === 'stagger') gain = 0.34;
    if (name === 'negated' || name === 'lethal') gain = 0.4;
    if (name === 'impact_apex') gain = 0.46;
    
    // Try to play from user WAV/MP3 asset files first
    const played = this.playBuffer(name, gain);
    if (played) return;
    
    // Procedural Fallback / Placeholder tones
    switch (name) {
      case 'attack': this.tone(180, 0.12, 'sawtooth', 0.14); this.tone(90, 0.16, 'square', 0.08, 0.02); break;
      case 'skill': this.tone(440, 0.12, 'triangle', 0.1); this.tone(660, 0.1, 'sine', 0.07, 0.05); break;
      case 'endturn': this.tone(330, 0.1, 'sine', 0.09); this.tone(220, 0.14, 'sine', 0.07, 0.06); break;
      case 'error': this.tone(120, 0.12, 'square', 0.08); break;
      case 'reward': this.tone(523, 0.12, 'triangle', 0.12); this.tone(659, 0.12, 'triangle', 0.12, 0.1); this.tone(784, 0.18, 'triangle', 0.12, 0.2); break;
      case 'relic': {
        // Grand ancestral fanfare: rising fifths, a shimmer of harmonics, a low swell.
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.34, 'triangle', 0.13, i * 0.09));
        this.tone(196, 0.7, 'sine', 0.1, 0.02);
        this.tone(1568, 0.5, 'sine', 0.05, 0.42);
        this.tone(1318, 0.6, 'sine', 0.06, 0.5);
        break;
      }
      case 'relicland': this.tone(880, 0.09, 'triangle', 0.11); this.tone(1318, 0.14, 'sine', 0.09, 0.04); break;
      case 'phase': this.tone(98, 0.5, 'sawtooth', 0.12); this.tone(392, 0.38, 'triangle', 0.08, 0.12); break;
      case 'impact_apex': this.tone(72, 0.34, 'sawtooth', 0.14); this.tone(144, 0.2, 'square', 0.09, 0.025); this.tone(880, 0.18, 'triangle', 0.08, 0.07); break;
      case 'hit': this.tone(140, 0.1, 'square', 0.1); break;
      case 'block': this.tone(440, 0.15, 'sine', 0.1); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.12)); break;
      case 'defeat': [330, 247, 196, 147].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.14)); break;
      case 'select': this.tone(587, 0.08, 'sine', 0.1); break;
      case 'cardflip': this.tone(720, 0.05, 'triangle', 0.09); this.tone(280, 0.07, 'triangle', 0.06, 0.035); break;
      case 'coin': this.tone(988, 0.08, 'sine', 0.1); this.tone(1318, 0.12, 'sine', 0.08, 0.05); break;
      case 'click': this.tone(800, 0.03, 'sine', 0.08); break;
      case 'click_heavy': this.tone(300, 0.06, 'triangle', 0.1); break;
      case 'pickcard': this.tone(600, 0.06, 'triangle', 0.04); break;
      case 'draw': this.tone(600, 0.06, 'triangle', 0.04); break;
      case 'playcard': this.tone(400, 0.08, 'sine', 0.08); break;
      case 'attack-blocked': this.tone(220, 0.12, 'triangle', 0.12); this.tone(180, 0.15, 'sine', 0.08, 0.04); break;
      case 'thunder': this.tone(90, 0.4, 'sawtooth', 0.15); this.tone(45, 0.6, 'square', 0.1, 0.05); break;
      case 'zap': this.tone(880, 0.08, 'sawtooth', 0.12); this.tone(1200, 0.05, 'sine', 0.08, 0.02); break;
      case 'slime': this.tone(150, 0.15, 'triangle', 0.12); this.tone(100, 0.2, 'sine', 0.08, 0.05); break;
      case 'splash': this.tone(300, 0.2, 'triangle', 0.12); this.tone(450, 0.15, 'sine', 0.08, 0.04); break;
      case 'growl': this.tone(110, 0.28, 'sawtooth', 0.12); this.tone(70, 0.32, 'square', 0.09, 0.04); break;
      case 'tempo_release': [523, 659, 784, 988].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.12, i * 0.05)); break;
      case 'power_surge': this.tone(80, 0.3, 'sawtooth', 0.13); this.tone(300, 0.15, 'sawtooth', 0.08, 0.15); break;
      case 'cardcommit': this.tone(360, 0.07, 'triangle', 0.07); this.tone(620, 0.08, 'sine', 0.05, 0.035); break;
      case 'guardbreak': this.tone(190, 0.09, 'square', 0.1); this.tone(92, 0.22, 'sawtooth', 0.1, 0.045); this.tone(720, 0.04, 'triangle', 0.05, 0.02); break;
      case 'buff': this.tone(520, 0.1, 'triangle', 0.055); this.tone(780, 0.14, 'sine', 0.05, 0.05); break;
      case 'debuff': this.tone(300, 0.12, 'sawtooth', 0.05); this.tone(190, 0.18, 'triangle', 0.05, 0.05); break;
      case 'heal': this.tone(392, 0.16, 'sine', 0.06); this.tone(523, 0.2, 'triangle', 0.065, 0.08); this.tone(659, 0.22, 'sine', 0.045, 0.16); break;
      case 'dodge': this.tone(760, 0.08, 'sine', 0.055); this.tone(1120, 0.12, 'triangle', 0.045, 0.04); break;
      case 'reflect': this.tone(880, 0.08, 'triangle', 0.07); this.tone(440, 0.16, 'sine', 0.065, 0.04); break;
      case 'stagger': this.tone(160, 0.16, 'square', 0.075); this.tone(115, 0.18, 'sawtooth', 0.055, 0.04); break;
      case 'negated': this.tone(620, 0.1, 'triangle', 0.065); this.tone(930, 0.13, 'sine', 0.05, 0.04); break;
      case 'lethal': this.tone(72, 0.38, 'sawtooth', 0.12); this.tone(48, 0.48, 'square', 0.07, 0.035); break;
      default: break;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else {
      if (this.musicOn) {
        this.startMusic();
      }
    }
    return this.muted;
  }
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic(); else this.stopMusic();
    return this.musicOn;
  }
  startMusic() {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    if (this.musicMode === 'title') {
      this.ensureTitleMusic();
      if (this.titleMusic.paused) {
        this.stopMusic();
        this.titleMusic.currentTime = 0;
        this.titleMusic.play().catch(e => console.warn("Title music autoplay blocked:", e));
      }
    } else if (this.musicMode === 'combat') {
      this.ensureCombatMusic();
      if (this.combatMusic.paused) {
        this.stopMusic();
        this.combatMusic.currentTime = 0;
        this.combatMusic.play().catch(e => console.warn("Combat music autoplay blocked:", e));
      }
    } else if (this.musicMode === 'boss') {
      this.ensureBossMusic();
      if (this.bossMusic.paused) {
        this.stopMusic();
        this.bossMusic.currentTime = 0;
        this.bossMusic.play().catch(e => console.warn("Boss music autoplay blocked:", e));
      }
    } else if (this.musicMode === 'act') {
      const track = this.ensureActMusic(this.musicAct);
      if (track && track.paused) {
        this.stopMusic();
        track.currentTime = 0;
        track.play().catch(e => console.warn("Act music autoplay blocked:", e));
      }
    } else {
      if (!this._music) {
        this.stopMusic();
        const ctx = this.ctx;
        const master = ctx.createGain();
        master.gain.value = 0.05;
        master.connect(ctx.destination);
        // slow afro-pentatonic drone arpeggio
        const scale = [196, 220, 261.6, 293.7, 329.6];
        let i = 0;
        const step = () => {
          if (!this.musicOn || this.musicMode !== 'ambient') return;
          const f = scale[i % scale.length] * (i % 8 < 4 ? 1 : 0.5);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.6, t + 0.2);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
          osc.connect(g); g.connect(master);
          osc.start(t); osc.stop(t + 1.2);
          i++;
          this._music = setTimeout(step, 620);
        };
        this._masterGain = master;
        step();
      }
    }
  }
  stopMusic() {
    if (this._music) { clearTimeout(this._music); this._music = null; }
    if (this._masterGain) { try { this._masterGain.disconnect(); } catch (e) {} this._masterGain = null; }
    if (this.titleMusic) {
      this.titleMusic.pause();
    }
    if (this.combatMusic) {
      this.combatMusic.pause();
    }
    if (this.bossMusic) {
      this.bossMusic.pause();
    }
    if (this.actMusic) {
      this.actMusic.pause();
    }
  }
  setMusicMode(mode, act) {
    const actChanged = mode === 'act' && act !== this.musicAct;
    if (this.musicMode === mode && !actChanged) return;
    this.musicMode = mode;
    if (mode === 'act') this.musicAct = act;
    if (this.musicOn) {
      this.startMusic();
    }
  }
  setCombat(isCombat, isBoss = false, act) {
    if (isCombat) {
      this.setMusicMode(isBoss ? 'boss' : 'combat');
    } else if (act != null) {
      this.setMusicMode('act', act);
    } else {
      this.setMusicMode('title');
    }
  }
}
export const audio = new Audio();

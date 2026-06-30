const SOUNDS = {
  select: 'assets/sounds/select.wav',
  reward: 'assets/sounds/reward.wav',
  attack: 'assets/sounds/attack.wav',
};

// Tiny procedural sound + ambient pad using WebAudio — no asset files required.
class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    this.muted = false;
    this._music = null;
    this.musicMode = 'title'; // 'title', 'ambient', 'combat'
    this.titleMusic = null;
    this.combatMusic = null;
    this.bossMusic = null;
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
      case 'hit': this.tone(140, 0.1, 'square', 0.1); break;
      case 'block': this.tone(440, 0.15, 'sine', 0.1); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.12)); break;
      case 'defeat': [330, 247, 196, 147].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.14)); break;
      case 'select': this.tone(587, 0.08, 'sine', 0.1); break;
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
  }
  setMusicMode(mode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (this.musicOn) {
      this.startMusic();
    }
  }
  setCombat(isCombat, isBoss = false) {
    if (isCombat) {
      this.setMusicMode(isBoss ? 'boss' : 'combat');
    } else {
      this.setMusicMode('ambient');
    }
  }
}
export const audio = new Audio();

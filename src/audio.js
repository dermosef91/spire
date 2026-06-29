// Tiny procedural sound + ambient pad using WebAudio — no asset files required.
class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = false;
    this._music = null;
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
    if (!this.enabled) return;
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
    if (!this.enabled) return;
    switch (name) {
      case 'attack': this.tone(180, 0.12, 'sawtooth', 0.14); this.tone(90, 0.16, 'square', 0.08, 0.02); break;
      case 'skill': this.tone(440, 0.12, 'triangle', 0.1); this.tone(660, 0.1, 'sine', 0.07, 0.05); break;
      case 'endturn': this.tone(330, 0.1, 'sine', 0.09); this.tone(220, 0.14, 'sine', 0.07, 0.06); break;
      case 'error': this.tone(120, 0.12, 'square', 0.08); break;
      case 'reward': this.tone(523, 0.12, 'triangle', 0.12); this.tone(659, 0.12, 'triangle', 0.12, 0.1); this.tone(784, 0.18, 'triangle', 0.12, 0.2); break;
      case 'hit': this.tone(140, 0.1, 'square', 0.1); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.12)); break;
      case 'defeat': [330, 247, 196, 147].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.14)); break;
      case 'select': this.tone(587, 0.08, 'sine', 0.1); break;
      default: break;
    }
  }
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic(); else this.stopMusic();
    return this.musicOn;
  }
  startMusic() {
    this.ensure();
    if (!this.ctx) return;
    this.stopMusic();
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.05;
    master.connect(ctx.destination);
    // slow afro-pentatonic drone arpeggio
    const scale = [196, 220, 261.6, 293.7, 329.6];
    let i = 0;
    const step = () => {
      if (!this.musicOn) return;
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
  stopMusic() {
    if (this._music) { clearTimeout(this._music); this._music = null; }
    if (this._masterGain) { try { this._masterGain.disconnect(); } catch (e) {} this._masterGain = null; }
  }
}
export const audio = new Audio();

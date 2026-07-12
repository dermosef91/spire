// Entry point: preload assets, boot the game, and unlock audio + fullscreen
// on the first user interaction.
import { Game } from './game.js';
import { audio } from './audio.js';
import { mountBackground } from './fx/background.js';
import { preloadAssets } from './core/preload.js';
import { el } from './core/util.js';
import { enterFullscreen, fullscreenSupported, isFullscreen } from './core/fullscreen.js';
import { hasSave, loadRun } from './core/save.js';

mountBackground();

const root = document.getElementById('game-root');
const game = new Game(root);

// Preload every asset (sprites, card art, event art, backgrounds, sounds,
// music) behind a brief loading screen so nothing pops in later. showTitle()
// (or the in-progress run, see boot() below) replaces it.
const bar = el('div', { class: 'boot-bar' }, [el('div', { class: 'boot-bar-fill' })]);
const loading = el('div', { class: 'boot-loading' }, [
  el('div', { class: 'boot-title', text: 'ÀṢẸ' }),
  bar,
]);
root.appendChild(loading);
const fill = bar.firstChild;

// Resume an in-progress run straight away instead of forcing a detour through
// the title screen. Browsers (especially mobile) can discard and reload a
// backgrounded tab, which would otherwise look like the whole run got wiped
// back to character select.
function boot() {
  if (hasSave()) {
    const r = loadRun();
    if (r) { game.run = r; game.showMap(); return; }
  }
  game.showTitle();
}

preloadAssets((done, total) => { fill.style.width = `${Math.round((done / total) * 100)}%`; })
  .then(boot);

// Try starting music immediately if allowed by browser policy.
if (audio.musicOn) {
  audio.startMusic();
}

// Browsers require a user gesture for audio and fullscreen. On the first
// pointer/keyboard input: resume the AudioContext, start the music (on by
// default), and enter fullscreen with landscape lock. All best-effort.
const unlock = () => {
  audio.ensure();
  if (audio.musicOn) {
    audio.startMusic();
  }
  if (fullscreenSupported() && !isFullscreen()) enterFullscreen();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Expose for debugging in the console.
window.__ase = game;

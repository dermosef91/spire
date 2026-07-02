// Entry point: preload assets, boot the game, and unlock audio + fullscreen
// on the first user interaction.
import { Game } from './game.js';
import { audio } from './audio.js';
import { mountBackground } from './fx/background.js';
import { preloadAssets } from './core/preload.js';
import { el } from './core/util.js';
import { enterFullscreen, fullscreenSupported, isFullscreen } from './core/fullscreen.js';

mountBackground();

const root = document.getElementById('game-root');
const game = new Game(root);

// Preload every generated asset (sprites, card art, backgrounds) behind a
// brief loading screen so nothing pops in later. showTitle() replaces it.
const bar = el('div', { class: 'boot-bar' }, [el('div', { class: 'boot-bar-fill' })]);
const loading = el('div', { class: 'boot-loading' }, [
  el('div', { class: 'boot-title', text: 'ÀṢẸ' }),
  el('div', { class: 'boot-status', text: 'Summoning the Spire…' }),
  bar,
]);
root.appendChild(loading);
const fill = bar.firstChild;
preloadAssets((done, total) => { fill.style.width = `${Math.round((done / total) * 100)}%`; })
  .then(() => game.showTitle());

// Browsers require a user gesture for audio and fullscreen. On the first
// pointer/keyboard input: resume the AudioContext, start the music (on by
// default), and enter fullscreen with landscape lock. All best-effort.
const unlock = () => {
  audio.ensure();
  audio.resumeMusic();
  if (fullscreenSupported() && !isFullscreen()) enterFullscreen();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Expose for debugging in the console.
window.__ase = game;

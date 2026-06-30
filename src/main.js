// Entry point: boot the game and unlock audio on first interaction.
import { Game } from './game.js';
import { audio } from './audio.js';
import { mountBackground } from './fx/background.js';

mountBackground();

const root = document.getElementById('game-root');
const game = new Game(root);
game.showTitle();

// Try starting music immediately if allowed by browser policy.
if (audio.musicOn) {
  audio.startMusic();
}

// Resume the AudioContext on first user gesture (browser autoplay policy).
const unlock = () => {
  audio.ensure();
  if (audio.musicOn) {
    audio.startMusic();
  }
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Expose for debugging in the console.
window.__ase = game;

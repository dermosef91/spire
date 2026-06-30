// Background image manager — dynamically manages the #bg-image backdrop.
// Updates background image based on the active scene and current act,
// blending it smoothly with the moving starfield canvas.
//
// This module has ZERO runtime dependencies — it's pure DOM.

let bgEl = null;
let currentBg = null;

// Initialize the background image element
function init() {
  if (bgEl) return;
  bgEl = document.getElementById('bg-image');
  if (!bgEl) {
    bgEl = document.createElement('div');
    bgEl.id = 'bg-image';
    
    // Insert after the canvas starfield (#bg-canvas) if it exists,
    // so it sits between the stars and the game UI.
    const canvas = document.getElementById('bg-canvas');
    if (canvas && canvas.nextSibling) {
      document.body.insertBefore(bgEl, canvas.nextSibling);
    } else {
      document.body.insertBefore(bgEl, document.body.firstChild);
    }
  }
}

/**
 * Updates the background image based on the active scene class and current run act.
 * @param {string} sceneClass - The class of the active scene (e.g., 'title', 'combat', 'map')
 * @param {number|null} [actNum] - The current act number (1, 2, 3) from the run state
 */
export function updateBackground(sceneClass, actNum = null) {
  init();
  
  let bgId = null;

  if (sceneClass === 'title' || sceneClass === 'charselect') {
    bgId = 'title'; // Master title screen
  } else if (actNum === 1) {
    bgId = 'sunken_market';
  } else if (actNum === 2) {
    bgId = 'brass_archive';
  } else if (actNum === 3) {
    bgId = 'static_crown';
  }

  if (bgId === currentBg) return;
  currentBg = bgId;

  if (!bgId) {
    bgEl.classList.remove('show');
    return;
  }

  const newUrl = `assets/title screen and backgrounds/${bgId}.png`;

  // If there's no background set yet, transition it in immediately
  if (!bgEl.style.backgroundImage) {
    bgEl.style.backgroundImage = `url('${newUrl}')`;
    // Force layout reflow before adding the 'show' class to trigger transition
    bgEl.offsetHeight;
    bgEl.classList.add('show');
  } else {
    // Fade out old background, swap image, fade new one in
    bgEl.classList.remove('show');
    setTimeout(() => {
      // Prevent race condition if transition target changed during fade-out
      if (currentBg !== bgId) return;
      bgEl.style.backgroundImage = `url('${newUrl}')`;
      bgEl.classList.add('show');
    }, 400); // Matches the CSS opacity transition duration
  }
}

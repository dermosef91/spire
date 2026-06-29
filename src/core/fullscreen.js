// Fullscreen + orientation helpers. All best-effort: APIs vary across browsers
// and several only work inside a user gesture, so every call swallows errors.

export function fullscreenSupported() {
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen || d.msRequestFullscreen);
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

export async function enterFullscreen(el = document.documentElement) {
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
    await lockLandscape();
  } catch (e) { /* user denied or unsupported */ }
}

export async function exitFullscreen() {
  try {
    unlockOrientation();
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } catch (e) {}
}

export async function toggleFullscreen(el) {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen(el);
  return isFullscreen();
}

export async function lockLandscape() {
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (e) { /* orientation lock not allowed on this device/browser */ }
}

export function unlockOrientation() {
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
}

export function onFullscreenChange(fn) {
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange']) {
    document.addEventListener(ev, fn);
  }
}

// Coarse pointer (touch) detection.
export function isTouchDevice() {
  return window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

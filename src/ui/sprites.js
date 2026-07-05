// Sprite loader — returns an <img> element for PNG sprites when available,
// falling back to the existing inline SVG models. The manifest is loaded once
// on first use from assets/sprites/manifest.json (a static file committed to
// the repo by the dev-only gen-sprites.js tool).
//
// This module has ZERO runtime dependencies — it's pure DOM.

let _manifest = null;   // { ids: string[] } | null
let _loading = false;
let _loaded = false;
const _waiters = [];

/** Lazily fetch the sprite manifest (once). */
function ensureManifest() {
  if (_loaded) return Promise.resolve(_manifest);
  if (_loading) return new Promise(r => _waiters.push(r));
  _loading = true;
  return fetch('assets/sprites/manifest.json')
    .then(res => {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then(data => {
      _manifest = data;
      _loaded = true;
      _waiters.forEach(fn => fn(_manifest));
      _waiters.length = 0;
      return _manifest;
    })
    .catch(() => {
      // No manifest = no sprites; every call falls back to SVG
      _manifest = { ids: [] };
      _loaded = true;
      _waiters.forEach(fn => fn(_manifest));
      _waiters.length = 0;
      return _manifest;
    });
}

// Kick off loading immediately on import so it's ready by the time combat starts
ensureManifest();

/**
 * Returns true if a sprite exists for the given entity id.
 * SYNCHRONOUS — returns false until the manifest is loaded,
 * which is fine: the first render uses SVG, and sprites upgrade later.
 */
export function hasSprite(id) {
  return _manifest?.ids?.includes(id) ?? false;
}

/**
 * Build a sprite <img> element with onerror fallback to SVG.
 * @param {string} id - Entity id (e.g. 'amara', 'husk_drone')
 * @param {string} svgFallbackHtml - The inline SVG markup to use as fallback
 * @param {string} [extraClass] - Additional CSS class(es)
 * @returns {HTMLElement} - Either an <img> or a <div> with SVG
 */
export function spriteOrSvg(id, svgFallbackHtml, extraClass = '') {
  if (hasSprite(id)) {
    const container = document.createElement('div');
    container.className = `sprite-container ${extraClass}`.trim();
    
    const img = document.createElement('img');
    img.className = 'model-img active-pose';
    img.src = `assets/sprites/${id}.png`;
    img.alt = '';
    img.draggable = false;
    
    img.onerror = () => {
      const fallback = document.createElement('div');
      fallback.className = extraClass;
      fallback.innerHTML = svgFallbackHtml;
      container.replaceWith(fallback);
    };
    
    container.appendChild(img);
    return container;
  }
  // No sprite available — return SVG directly
  const wrapper = document.createElement('div');
  wrapper.className = extraClass;
  wrapper.innerHTML = svgFallbackHtml;
  return wrapper;
}

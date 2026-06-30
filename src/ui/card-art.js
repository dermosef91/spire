// Card art loader — checks if a custom generated PNG card art is available,
// falling back to the inline SVG models. The manifest is loaded once on first use
// from assets/card-art/manifest.json.
//
// This module has ZERO runtime dependencies — it's pure DOM.

let _manifest = null;   // { ids: string[] } | null
let _loading = false;
let _loaded = false;
const _waiters = [];

/** Lazily fetch the card art manifest (once). */
function ensureManifest() {
  if (_loaded) return Promise.resolve(_manifest);
  if (_loading) return new Promise(r => _waiters.push(r));
  _loading = true;
  return fetch('assets/card-art/manifest.json')
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
      // No manifest = no card art; every call falls back to SVG
      _manifest = { ids: [] };
      _loaded = true;
      _waiters.forEach(fn => fn(_manifest));
      _waiters.length = 0;
      return _manifest;
    });
}

// Kick off loading immediately on import
ensureManifest();

/**
 * Returns true if a custom card art PNG exists for the given card id.
 * SYNCHRONOUS — returns false until the manifest is loaded.
 */
export function hasCardArt(id) {
  return _manifest?.ids?.includes(id) ?? false;
}

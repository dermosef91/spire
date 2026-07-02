// Asset preloader — warms the browser cache for every generated PNG asset
// (sprites, card art, scene backgrounds) so nothing pops in mid-run.
// Manifest-driven: each asset folder ships a manifest.json listing its ids.
// Everything is best-effort: a missing file or manifest never blocks the game.

const SOURCES = [
  { manifest: 'assets/sprites/manifest.json', dir: 'assets/sprites' },
  { manifest: 'assets/card-art/manifest.json', dir: 'assets/card-art' },
  { manifest: 'assets/title screen and backgrounds/manifest.json', dir: 'assets/title screen and backgrounds' },
];

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

async function idsFrom(manifestUrl) {
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.ids) ? data.ids : [];
  } catch (e) {
    return [];
  }
}

/**
 * Preload all PNG assets listed in the manifests. Resolves when every image
 * has loaded (or errored), or after `timeoutMs` — whichever comes first —
 * so a slow connection can never lock the player out of the game.
 * @param {(done: number, total: number) => void} [onProgress]
 * @param {number} [timeoutMs]
 */
export async function preloadAssets(onProgress, timeoutMs = 10000) {
  const lists = await Promise.all(SOURCES.map((s) => idsFrom(s.manifest)));
  const urls = [];
  lists.forEach((ids, i) => ids.forEach((id) => urls.push(`${SOURCES[i].dir}/${id}.png`)));
  if (!urls.length) return;
  let done = 0;
  const all = Promise.all(urls.map((u) => loadImage(u).then(() => {
    done += 1;
    if (onProgress) onProgress(done, urls.length);
  })));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
}

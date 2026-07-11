// Asset preloader — warms the browser cache for every static asset the game
// uses (sprites, card art, relic art, potion art, event art, scene
// backgrounds, map icons, sound effects, music) so nothing pops in or stalls
// mid-run.
// Image folders are manifest-driven: each ships a manifest.json listing its
// ids. Sound/music files and the (manifest-less) map icons are a fixed set,
// listed here.
// Everything is best-effort: a missing file or manifest never blocks the game.

const MANIFEST_SOURCES = [
  { manifest: 'assets/sprites/manifest.json', dir: 'assets/sprites' },
  { manifest: 'assets/card-art/manifest.json', dir: 'assets/card-art' },
  { manifest: 'assets/relic-art/manifest.json', dir: 'assets/relic-art' },
  { manifest: 'assets/potion-art/manifest.json', dir: 'assets/potion-art' },
  { manifest: 'assets/event-art/manifest.json', dir: 'assets/event-art' },
  { manifest: 'assets/title screen and backgrounds/manifest.json', dir: 'assets/title screen and backgrounds' },
];

// Fixed, non-manifest assets (see src/audio.js SOUNDS + ensure*Music, the
// map-node/combat icons in assets/icons, and the fx spritesheets in
// "assets/animation sprites" — src/ui/fx.js spriteAnim() callers — none of
// which ship a manifest.json). spritesheet-template.png in that folder is an
// unused dev template, deliberately not listed.
const STATIC_ASSETS = [
  'assets/icons/combat.png',
  'assets/icons/coin.png',
  'assets/icons/bazaar.png',
  'assets/icons/boss.png',
  'assets/icons/elite.png',
  'assets/icons/event.png',
  'assets/icons/rest.png',
  'assets/icons/treasure.png',
  'assets/animation sprites/slash.png',
  'assets/animation sprites/zap.png',
  'assets/animation sprites/spit.png',
  'assets/animation sprites/splash.png',
  'assets/animation sprites/fault-line.png',
  'assets/animation sprites/skyfall-hammer.png',
  'assets/sounds/click.wav',
  'assets/sounds/reward.wav',
  'assets/sounds/attack.wav',
  'assets/sounds/skill.mp3',
  'assets/sounds/coin.wav',
  'assets/sounds/hit.mp3.flac',
  'assets/sounds/pickcard.mp3',
  'assets/sounds/playcards.mp3',
  'assets/sounds/attack-blocked.mp3',
  'assets/sounds/block.wav',
  'assets/sounds/summon.wav',
  'assets/music/titletheme.mp3',
  'assets/music/combattheme1.mp3',
  'assets/music/combattheme2.mp3',
  'assets/music/combattheme3.mp3',
  'assets/music/combattheme4.mp3',
];

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

// For audio files a plain fetch warms the HTTP cache, which the later
// HTMLAudio elements / decodeAudioData fetches then hit.
function loadFile(url) {
  return fetch(url).then((r) => { if (r.ok) return r.arrayBuffer(); }).catch(() => {});
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
 * Preload all game assets. Resolves when everything has loaded (or errored),
 * or after `timeoutMs` — whichever comes first — so a slow connection can
 * never lock the player out of the game.
 * @param {(done: number, total: number) => void} [onProgress]
 * @param {number} [timeoutMs]
 */
export async function preloadAssets(onProgress, timeoutMs = 10000) {
  const lists = await Promise.all(MANIFEST_SOURCES.map((s) => idsFrom(s.manifest)));
  const jobs = [];
  lists.forEach((ids, i) => ids.forEach((id) => jobs.push({ url: `${MANIFEST_SOURCES[i].dir}/${id}.png`, image: true })));
  for (const url of STATIC_ASSETS) jobs.push({ url, image: url.endsWith('.png') });
  if (!jobs.length) return;
  let done = 0;
  const all = Promise.all(jobs.map((j) => (j.image ? loadImage(j.url) : loadFile(j.url)).then(() => {
    done += 1;
    if (onProgress) onProgress(done, jobs.length);
  })));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
}

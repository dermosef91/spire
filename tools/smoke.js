// End-to-end smoke test: launches the real static site and drives the core
// flow (title → New Run → character → map → combat) in a headless browser,
// asserting the game boots and reaches combat with no uncaught JS errors.
//
// Run with `npm run smoke`. Exits non-zero on any failure. This is the reusable
// UI check to run after touching game.js / scenes / combat view, instead of
// reconstructing the click-through by hand each time.
//
// Playwright is used only as an ambient dev tool from the environment — it is
// NOT a project dependency, so the shipped site stays zero-dependency. The
// pre-installed Chromium is found automatically (PLAYWRIGHT_BROWSERS_PATH).

import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync } from 'node:fs';

const CHROMIUM = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const require = createRequire(import.meta.url);

// Resolve the globally-installed Playwright without adding it to package.json.
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  try {
    const globalRoot = execSync('npm root -g').toString().trim();
    ({ chromium } = require(require.resolve('playwright', { paths: [globalRoot] })));
  } catch (err) {
    console.error('Playwright is not available in this environment:', err.message);
    process.exit(2);
  }
}

const PORT = process.env.SMOKE_PORT || 8099;
const BASE = `http://localhost:${PORT}`;

const server = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
let browser;

async function cleanup(code) {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGKILL');
  process.exit(code);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('static server did not come up on ' + BASE);
}

// Genuine JS errors matter; asset 404s (missing sprite/art files) are not logic
// regressions, so filter them out to avoid spurious smoke failures.
const IGNORE = /Failed to load resource|status of \d{3}|favicon/i;
const errors = [];

try {
  await waitForServer();
  const launchOptions = { headless: true };
  if (existsSync(CHROMIUM)) {
    launchOptions.executablePath = CHROMIUM;
    launchOptions.args = ['--no-sandbox'];
  }
  browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text());
    if (m.type() === 'warning' && /Unhandled combat FX:/.test(m.text())) errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // Mark the tutorial done so the first-play coaching overlay doesn't interfere.
  await page.addInitScript(() => {
    try { localStorage.setItem('spire_of_ase_meta_v1', JSON.stringify({ tutorialDone: true, rhythm: false, runs: 0, wins: 0, bestFloor: 0, ascension: 0, maxAscension: 0 })); } catch {}
  });

  // NB: never wait on 'networkidle' here — the looping music/animation keeps the
  // network "busy" forever. Use domcontentloaded plus explicit element waits.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Title → character select
  await page.getByText('New Run', { exact: false }).first().click();
  // Character select → act intro
  await page.getByText('Begin', { exact: false }).first().click();
  // Act intro → map
  await page.getByText('Enter', { exact: true }).first().click();

  // Map → enter the first reachable node (row 0 is always a monster fight).
  // Reachable nodes carry a perpetual twinkle/pulse animation, so Playwright's
  // click-stability check never settles — force the click (node is visible and
  // enabled; only the infinite animation blocks the actionability wait).
  await page.waitForSelector('.map-node.reachable', { timeout: 5000 });
  if (await page.locator('.map-landmark').count() !== 3) throw new Error('map did not render all three act landmarks');
  if (await page.locator('.map-atmosphere .map-weather-mote').count() < 10) throw new Error('map atmosphere motes are missing');
  if (await page.locator('.map-node.reachable.discovered').count() < 1) throw new Error('reachable rooms were not discovered');
  if (await page.locator('.map-node.unexplored').count() < 1) throw new Error('future rooms have no discovery haze');
  await page.locator('.map-node.reachable').first().click({ force: true });
  await page.waitForSelector('.map-traveler', { timeout: 800 });

  // Combat must mount with a hand and an enemy present
  await page.waitForSelector('.battlefield', { timeout: 8000 });
  await page.waitForSelector('.hand .card', { timeout: 8000 });
  const handCount = await page.locator('.hand .card').count();
  const enemySides = await page.locator('.enemy-side').count();
  if (handCount < 1) throw new Error('combat mounted but no cards in hand');
  if (enemySides < 1) throw new Error('combat mounted but no enemy side rendered');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.hand .card')).every((card) => getComputedStyle(card).pointerEvents !== 'none'), null, { timeout: 2500 });

  // Intent communicates exact damage + post-Block consequence through its
  // accessible label, not only colored icons.
  const intentLabel = await page.locator('.enemy .intent').getAttribute('aria-label');
  if (!intentLabel || intentLabel === 'Enemy intent') throw new Error('enemy intent has no accessible move description');
  if (/Attack for \d+/.test(intentLabel) && !/(reaches HP|absorbs all)/.test(intentLabel)) {
    throw new Error(`attacking intent is missing its post-Block consequence: ${intentLabel}`);
  }

  // First tap previews; second tap commits one sequence-owned ghost. Input is
  // locked through resolution, the hand updates once, and the ghost always
  // cleans itself up after reaching discard/consume.
  const playable = page.locator('.hand .card.affordable').first();
  const uid = await playable.getAttribute('data-uid');
  if (!uid) throw new Error('playable card has no stable uid');
  await playable.click({ force: true });
  await page.waitForSelector(`.hand .card.previewing[data-uid="${uid}"]`, { timeout: 1000 });
  await page.locator(`.hand .card[data-uid="${uid}"]`).click({ force: true });
  await page.waitForSelector('.card-cast-ghost', { timeout: 1000 });
  const ghostCount = await page.locator('.card-cast-ghost').count();
  if (ghostCount !== 1) throw new Error(`expected one card-play ghost, saw ${ghostCount}`);
  if (!(await page.locator('.end-turn').isDisabled())) throw new Error('End Turn stayed enabled during card resolution');
  await page.waitForFunction((playedUid) => !document.querySelector(`.hand .card[data-uid="${playedUid}"]`), uid, { timeout: 2500 });
  await page.waitForSelector('.card-cast-ghost', { state: 'detached', timeout: 2500 });
  if (await page.locator('.end-turn').isDisabled()) throw new Error('End Turn stayed disabled after card resolution');

  // Hilt Crack is not in the starter deck, so inject one through the exposed
  // combat debug seam and exercise its real view-owned play sequence. This
  // catches a missing preload/playbook key or malformed spritesheet path that
  // DOM-free card tests cannot see.
  const hiltUid = await page.evaluate(() => {
    const combat = window.__combat;
    const card = combat.makeCard('pommel');
    combat.energy = Math.max(combat.energy, 1);
    combat.hand.unshift(card);
    combat.notify();
    return card.uid;
  });
  await page.waitForSelector(`.hand .card[data-uid="${hiltUid}"]`, { timeout: 1000 });
  await page.evaluate((playedUid) => {
    const combat = window.__combat;
    const card = combat.hand.find((c) => c.uid === playedUid);
    window.__ase.combatView.playCard(card, combat.livingEnemies()[0]);
  }, hiltUid);
  await page.waitForSelector('.sprite-vfx-hilt-crack', { timeout: 1500 });
  const hiltSheet = await page.locator('.sprite-vfx-hilt-crack').first().evaluate((node) => getComputedStyle(node).backgroundImage);
  if (!hiltSheet.includes('hilt-crack.png')) throw new Error(`Hilt Crack used the wrong VFX sheet: ${hiltSheet}`);
  await page.waitForSelector('.sprite-vfx-hilt-crack', { state: 'detached', timeout: 1800 });

  // The fixed enemy-turn cadence should visibly hand focus to exactly one foe,
  // quiet the hand, then restore both when the player turn returns.
  await page.evaluate(() => {
    window.__combat.parryPrompt = null;
    window.__combat.player.block = 0;
    window.__combat.endTurn();
  });
  await page.waitForSelector('.enemy-acting', { timeout: 2200 });
  const actingCount = await page.locator('.enemy-acting').count();
  if (actingCount !== 1) throw new Error(`enemy phase spotlighted ${actingCount} foes instead of one`);
  const enemyPhaseHandOpacity = Number(await page.locator('.hand').evaluate((node) => getComputedStyle(node).opacity));
  if (enemyPhaseHandOpacity > 0.7) throw new Error(`hand did not quiet during enemy phase (opacity ${enemyPhaseHandOpacity})`);
  await page.waitForFunction(() => !document.querySelector('.combat-scene.enemy-phase'), null, { timeout: 3500 });
  if (await page.locator('.enemy-acting').count()) throw new Error('enemy spotlight survived the player-turn handoff');

  // Bosses enter with their own marquee/rank treatment, and phase thresholds
  // are visible on the HP bar before any card is played.
  await page.evaluate(() => window.__ase.startBoss());
  await page.waitForSelector('.combat-scene.encounter-boss .announce-boss', { timeout: 1200 });
  await page.waitForSelector('.enemy-boss .hp-phase-marker', { timeout: 1200 });
  const bossSubtitle = await page.locator('.enemy-boss .combatant-subtitle').textContent();
  if (!bossSubtitle || !bossSubtitle.includes('BOSS · PHASE I')) throw new Error(`boss rank subtitle missing: ${bossSubtitle}`);
  await page.waitForSelector('.combat-scene.encounter-boss .hand .card', { timeout: 3500 });

  // Persistent statuses must inhabit the combatants, not exist only as pips.
  await page.evaluate(() => {
    const combat = window.__combat;
    const boss = combat.livingEnemies()[0];
    combat.applyPower(combat.player, 'tempo', 5, combat.player);
    combat.applyPower(combat.player, 'metallicize', 3, combat.player);
    combat.applyPower(combat.player, 'flow', 1, combat.player);
    combat.applyPower(boss, 'poison', 4, combat.player);
    combat.applyPower(boss, 'challenged', 3, combat.player);
  });
  await page.waitForSelector('.player .status-presence.has-tempo.has-armor.has-spirit', { timeout: 1200 });
  await page.waitForSelector('.enemy-boss .status-presence.has-blight.has-mark', { timeout: 1200 });
  const tempoAngle = await page.locator('.player .status-presence').evaluate((node) => node.style.getPropertyValue('--tempo-angle'));
  if (tempoAngle !== '180deg') throw new Error(`Tempo presence did not reflect five stacks: ${tempoAngle}`);
  await page.evaluate(() => window.__combat.applyPower(window.__combat.player, 'flow', -1, window.__combat.player));
  await page.waitForSelector('.player .status-presence.status-expiring[data-moment="flow"]', { timeout: 800 });

  if (errors.length) throw new Error('uncaught JS errors during the flow:\n  ' + errors.join('\n  '));

  console.log(`smoke ok — reached combat with ${handCount} cards in hand, no JS errors`);
  await cleanup(0);
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  if (errors.length) console.error('errors seen:\n  ' + errors.join('\n  '));
  await cleanup(1);
}

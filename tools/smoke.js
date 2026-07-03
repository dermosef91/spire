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

const require = createRequire(import.meta.url);

// Resolve the globally-installed Playwright without adding it to package.json.
let chromium;
try {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(require.resolve('playwright', { paths: [globalRoot] })));
} catch (err) {
  console.error('Playwright is not available in this environment:', err.message);
  process.exit(2);
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
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // Mark the tutorial done so the first-play coaching overlay doesn't interfere.
  await page.addInitScript(() => {
    try { localStorage.setItem('spire_of_ase_meta_v1', JSON.stringify({ tutorialDone: true, runs: 0, wins: 0, bestFloor: 0, ascension: 0, maxAscension: 0 })); } catch {}
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
  await page.locator('.map-node.reachable').first().click({ force: true });

  // Combat must mount with a hand and an enemy present
  await page.waitForSelector('.battlefield', { timeout: 8000 });
  await page.waitForSelector('.hand .card', { timeout: 8000 });
  const handCount = await page.locator('.hand .card').count();
  const enemySides = await page.locator('.enemy-side').count();
  if (handCount < 1) throw new Error('combat mounted but no cards in hand');
  if (enemySides < 1) throw new Error('combat mounted but no enemy side rendered');

  if (errors.length) throw new Error('uncaught JS errors during the flow:\n  ' + errors.join('\n  '));

  console.log(`smoke ok — reached combat with ${handCount} cards in hand, no JS errors`);
  await cleanup(0);
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  if (errors.length) console.error('errors seen:\n  ' + errors.join('\n  '));
  await cleanup(1);
}

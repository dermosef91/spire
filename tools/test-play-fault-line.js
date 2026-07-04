import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync, mkdirSync } from 'node:fs';

const CHROMIUM = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  try {
    const globalRoot = execSync('npm root -g').toString().trim();
    ({ chromium } = require(require.resolve('playwright', { paths: [globalRoot] })));
  } catch (err) {
    console.error('Playwright is not available:', err.message);
    process.exit(2);
  }
}

const PORT = 8097;
const BASE = `http://localhost:${PORT}`;
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });

async function cleanup() {
  server.kill('SIGKILL');
}

async function main() {
  console.log('Starting server...');
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE); if (r.ok) break; } catch {}
    await sleep(200);
  }

  const launchOptions = { headless: true };
  if (existsSync(CHROMIUM)) {
    launchOptions.executablePath = CHROMIUM;
    launchOptions.args = ['--no-sandbox'];
  }
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();

  // console logs
  page.on('console', (m) => console.log('BROWSER CONSOLE:', m.text()));
  page.on('pageerror', (e) => console.error('BROWSER ERROR:', e.message));

  await page.addInitScript(() => {
    localStorage.setItem('spire_of_ase_meta_v1', JSON.stringify({ tutorialDone: true }));
  });

  console.log('Navigating to game...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(1000);

  console.log('Starting run as Amara...');
  await page.evaluate(() => {
    window.__ase.startRun('amara');
  });
  await sleep(1000);

  console.log('Starting monster combat...');
  await page.evaluate(() => {
    window.__ase.startMonster();
  });
  await sleep(1500); // let combat load and hand draw

  // Check what cards are in hand
  const cards = await page.evaluate(() => {
    return window.__ase.run.combat.hand.map(c => ({ id: c.id, uid: c.uid, name: c.name }));
  });
  console.log('Cards in hand:', cards);

  // Find the 'sunder' (Fault Line) card
  let sunderCard = cards.find(c => c.id === 'sunder');
  if (!sunderCard) {
    console.log('Fault Line card (sunder) not found in hand. Force-drawing it...');
    await page.evaluate(() => {
      const combat = window.__ase.run.combat;
      const sunder = window.__ase.run.createCard('sunder');
      combat.hand.push(sunder);
      combat.notify();
    });
    await sleep(500);
  }

  // Play Fault Line on the enemy
  console.log('Playing Fault Line card...');
  await page.evaluate(() => {
    const combat = window.__ase.run.combat;
    const sunder = combat.hand.find(c => c.id === 'sunder');
    const enemy = combat.enemies[0];
    window.__ase.view.playCard(sunder, enemy);
  });

  mkdirSync('docs/qa/fault-line-debug', { recursive: true });
  
  await sleep(100);
  await page.screenshot({ path: 'docs/qa/fault-line-debug/frame-100ms.png' });
  console.log('Captured 100ms screenshot');

  await sleep(200); // 300ms total
  await page.screenshot({ path: 'docs/qa/fault-line-debug/frame-300ms.png' });
  console.log('Captured 300ms screenshot');

  await sleep(200); // 500ms total
  await page.screenshot({ path: 'docs/qa/fault-line-debug/frame-500ms.png' });
  console.log('Captured 500ms screenshot');

  await sleep(300); // 800ms total
  await page.screenshot({ path: 'docs/qa/fault-line-debug/frame-800ms.png' });
  console.log('Captured 800ms screenshot');

  await browser.close();
  await cleanup();
}

main().catch(err => {
  console.error(err);
  cleanup();
});

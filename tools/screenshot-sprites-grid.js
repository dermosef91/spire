import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROMIUM = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright-core');

  if (!existsSync(CHROMIUM)) {
    throw new Error(`Chromium not found at ${CHROMIUM}`);
  }

  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  // Set a large viewport to see all grid items
  await page.setViewportSize({ width: 1400, height: 2400 });

  console.log('Navigating to sprite checker...');
  await page.goto('http://localhost:8091/check-sprites.html', { waitUntil: 'domcontentloaded' });
  
  // Wait for the elements to be populated and images to load
  await page.waitForTimeout(4000);

  const outPath = join(ROOT, 'docs', 'qa', 'all_sprites_grid.jpg');
  console.log(`Taking screenshot: ${outPath}...`);
  await page.screenshot({ path: outPath, fullPage: true, type: 'jpeg', quality: 90 });

  await browser.close();
  console.log('Done!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

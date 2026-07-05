import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 8099;
const BASE = `http://localhost:${PORT}`;
const CHROMIUM = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

  const measurements = await page.evaluate(async () => {
    window.__ase.startRun('amara');
    window.__ase.showMap();
  });

  await page.waitForSelector('.map-node', { timeout: 8000 });
  
  const measurements2 = await page.evaluate(async () => {
    const data = {};
    const nodes = document.querySelectorAll('.map-node');
    for (const n of nodes) {
      const type = Array.from(n.classList).find(c => c.startsWith('node-'))?.replace('node-', '');
      const isReachable = n.classList.contains('reachable');
      const isCurrent = n.classList.contains('current');
      const imgOrSvg = n.querySelector('.svg-ic');
      if (imgOrSvg) {
        const r = imgOrSvg.getBoundingClientRect();
        const nr = n.getBoundingClientRect();
        const key = `${type}${isReachable ? '_reachable' : ''}${isCurrent ? '_current' : ''}`;
        data[key] = {
          type,
          isReachable,
          isCurrent,
          nodeRect: { width: nr.width, height: nr.height },
          innerRect: { width: r.width, height: r.height }
        };
      }
    }
    return data;
  });

  console.log(JSON.stringify(measurements2, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

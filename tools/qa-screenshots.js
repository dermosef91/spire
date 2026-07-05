// QA screenshot + responsiveness audit for ÀṢẸ.
//
// Boots the real game in Chromium at two viewports — a landscape phone and a
// regular desktop screen — drives it through the four key scenes (title,
// character select, map, combat) via the live `window.__ase` Game instance,
// screenshots each, and runs an in-page layout audit that flags horizontal
// overflow, elements spilling past the viewport, off-screen interactive
// controls, and key combat controls overlapping the hand.
//
// Usage:
//   node tools/qa-screenshots.js            # run audit, write shots + report
//   node tools/qa-screenshots.js --open     # keep browser open (headful) *
//
//   (* headful needs a display; in CI/headless envs just omit it.)
//
// Output lands in docs/qa/:  <viewport>-<scene>.png  +  report.json / report.md
//
// Requires playwright-core (installed on demand, --no-save) and the bundled
// Chromium.  Never waits on networkidle — the looping music/rAF keeps the
// network busy forever; uses domcontentloaded + explicit waits instead.

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'docs', 'qa');
const PORT = process.env.QA_PORT || 8091;
const BASE = `http://localhost:${PORT}`;

// Chromium shipped in this environment (see CLAUDE.md browser-test notes).
const CHROMIUM = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The two shapes we care about: a short landscape phone (trips the
// `max-height: 560px` breakpoint) and a roomy desktop screen (trips the
// `min-width:1024px and min-height:650px` breakpoint).
const VIEWPORTS = [
  {
    key: 'mobile-landscape',
    label: 'Mobile landscape (812×375)',
    width: 812,
    height: 375,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    key: 'desktop',
    label: 'Desktop (1366×850)',
    width: 1366,
    height: 850,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
];

// The scenes we screenshot, in play order. `drive` runs in the page against
// the live Game instance (window.__ase) to reach the scene; `settle` is how
// long to let animations/draw settle before the shot.
const SCENES = [
  {
    key: 'title',
    label: 'Title',
    settle: 700,
    drive: () => window.__ase.showTitle(),
  },
  {
    key: 'charselect',
    label: 'Character select',
    settle: 700,
    drive: () => window.__ase.showCharSelect(),
  },
  {
    key: 'map',
    label: 'Act map',
    settle: 700,
    // startRun lands on the act-intro; jump straight to the map.
    drive: () => { window.__ase.startRun('amara'); window.__ase.showMap(); },
  },
  {
    key: 'combat',
    label: 'Combat',
    // Opening draw is deferred ~650ms behind the Battle Start popup, then the
    // 5-card fly-in stagger itself takes up to ~830ms to fully land (a
    // notify()-coalescing fix made this animation actually run instead of
    // silently no-op'ing) — 1100ms caught it mid-flight. 1800ms clears it.
    settle: 1800,
    // A run must exist first (map scene sets it up). Start a normal fight.
    drive: () => { window.__ase.startMonster(); },
  },
];

// ----------------------------------------------------------- in-page audit
// Serialized into the page. Returns a list of layout problems for the current
// scene at the current viewport. Kept dependency-free and defensive.
function auditPage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const SLOP = 2; // sub-pixel rounding tolerance

  const doc = document.documentElement;
  if (doc.scrollWidth > vw + SLOP) {
    issues.push({
      type: 'horizontal-overflow',
      severity: 'high',
      detail: `Document scrollWidth ${doc.scrollWidth}px exceeds viewport width ${vw}px (horizontal scrollbar).`,
    });
  }

  const describe = (elm) => {
    const cls = (elm.className && elm.className.baseVal !== undefined)
      ? elm.className.baseVal // SVG elements
      : (typeof elm.className === 'string' ? elm.className : '');
    const id = elm.id ? `#${elm.id}` : '';
    const clsStr = cls ? '.' + cls.trim().split(/\s+/).join('.') : '';
    return `${elm.tagName.toLowerCase()}${id}${clsStr}`.slice(0, 120);
  };

  const visible = (elm) => {
    const s = getComputedStyle(elm);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = elm.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  // Interactive controls that must sit fully inside the viewport to be usable.
  const controls = Array.from(document.querySelectorAll(
    'button, .btn, .char-card, .map-node.reachable, .card.in-hand, .energy-orb, .end-turn, .screen-pile'
  )).filter(visible);

  for (const c of controls) {
    const r = c.getBoundingClientRect();
    // Off the right/left/bottom/top edge (partially or fully clipped).
    const offRight = r.right > vw + SLOP;
    const offLeft = r.left < -SLOP;
    const offBottom = r.bottom > vh + SLOP;
    const offTop = r.top < -SLOP;
    if (offRight || offLeft || offBottom || offTop) {
      const edges = [];
      if (offLeft) edges.push(`left ${Math.round(r.left)}`);
      if (offRight) edges.push(`right ${Math.round(r.right)}>${vw}`);
      if (offTop) edges.push(`top ${Math.round(r.top)}`);
      if (offBottom) edges.push(`bottom ${Math.round(r.bottom)}>${vh}`);
      // Fully off-screen is worse than a few px of bleed.
      const fully = r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh;
      issues.push({
        type: fully ? 'control-offscreen' : 'control-clipped',
        severity: fully ? 'high' : 'medium',
        detail: `${describe(c)} extends past viewport (${edges.join(', ')}).`,
      });
    }
  }

  // Combat-specific: the fanned hand must not slide under the pinned, *visible*
  // energy orb / End Turn controls (see the landscape-phone note in CLAUDE.md).
  // We compare against the concrete controls, not the full-width
  // `.combat-controls` bar — the bar spans the whole width but its children
  // sit only at the corners, so testing the bar itself flags harmless overlap
  // with centered cards.
  const hand = document.querySelector('.hand');
  const pinned = Array.from(document.querySelectorAll('.combat-controls .energy-orb, .combat-controls .end-turn, .combat-controls button'))
    .filter(visible);
  if (hand && pinned.length && visible(hand)) {
    const cards = Array.from(hand.querySelectorAll('.card.in-hand')).filter(visible);
    let flagged = false;
    for (const ctrl of pinned) {
      if (flagged) break;
      const cr = ctrl.getBoundingClientRect();
      for (const card of cards) {
        const r = card.getBoundingClientRect();
        const overlapX = Math.min(r.right, cr.right) - Math.max(r.left, cr.left);
        const overlapY = Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top);
        if (overlapX > 8 && overlapY > 8) {
          issues.push({
            type: 'hand-under-controls',
            severity: 'medium',
            detail: `A hand card overlaps the ${describe(ctrl)} by ${Math.round(overlapX)}×${Math.round(overlapY)}px.`,
          });
          flagged = true;
          break;
        }
      }
    }
  }

  // De-dupe identical detail strings (many buttons can share one bug).
  const seen = new Set();
  return issues.filter((i) => {
    const k = i.type + '|' + i.detail;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ----------------------------------------------------------- server helpers
function startServer() {
  const proc = spawn('node', [join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('server start timeout')), 8000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes('running at')) { clearTimeout(to); resolve(proc); }
    });
    proc.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
    proc.on('error', reject);
  });
}

async function main() {
  const headful = process.argv.includes('--open');

  // Resolve playwright-core, installing on demand if needed.
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require('playwright-core'));
  } catch (e) {
    console.log('playwright-core not found — installing (--no-save)…');
    await new Promise((res, rej) => {
      const p = spawn('npm', ['install', 'playwright-core', '--no-save'], { cwd: ROOT, stdio: 'inherit' });
      p.on('exit', (code) => (code === 0 ? res() : rej(new Error('npm install failed'))));
    });
    ({ chromium } = require('playwright-core'));
  }

  if (!existsSync(CHROMIUM)) {
    throw new Error(`Chromium not found at ${CHROMIUM}. Update CHROMIUM in tools/qa-screenshots.js.`);
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Starting static server on ${BASE} …`);
  const server = await startServer();

  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: !headful,
    args: ['--no-sandbox'],
  });

  const report = { generatedAt: new Date().toISOString(), viewports: [] };

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n▶ ${vp.label}`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
      });
      // Skip the first-play tutorial so combat renders unobstructed.
      await context.addInitScript(() => {
        try {
          const k = 'spire_of_ase_meta_v1';
          const m = JSON.parse(localStorage.getItem(k) || '{}');
          m.tutorialDone = true;
          localStorage.setItem(k, JSON.stringify(m));
        } catch (e) {}
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__ase, null, { timeout: 8000 });

      const vpEntry = { key: vp.key, label: vp.label, scenes: [] };

      for (const scene of SCENES) {
        await page.evaluate(scene.drive);
        await page.waitForTimeout(scene.settle);
        const file = `${vp.key}-${scene.key}.jpg`;
        await page.screenshot({ path: join(OUT_DIR, file), fullPage: false, type: 'jpeg', quality: 82 });
        const issues = await page.evaluate(auditPage);
        vpEntry.scenes.push({ key: scene.key, label: scene.label, screenshot: file, issues });
        const tag = issues.length ? `⚠ ${issues.length} issue(s)` : '✓ clean';
        console.log(`  ${scene.label.padEnd(18)} → ${file}  ${tag}`);
        for (const i of issues) console.log(`      [${i.severity}] ${i.type}: ${i.detail}`);
      }

      report.viewports.push(vpEntry);
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }

  await writeFile(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(join(OUT_DIR, 'report.md'), toMarkdown(report));

  const total = report.viewports.reduce(
    (n, v) => n + v.scenes.reduce((m, s) => m + s.issues.length, 0), 0);
  console.log(`\nReport written to docs/qa/report.md — ${total} issue(s) flagged.`);
  process.exitCode = 0;
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# ÀṢẸ — QA screenshot & responsiveness audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('Run with `node tools/qa-screenshots.js`. Screenshots and this report');
  lines.push('are written to `docs/qa/`.');
  lines.push('');
  for (const vp of report.viewports) {
    lines.push(`## ${vp.label}`);
    lines.push('');
    for (const s of vp.scenes) {
      const tag = s.issues.length ? `⚠ ${s.issues.length} issue(s)` : '✓ clean';
      lines.push(`### ${s.label} — ${tag}`);
      lines.push('');
      lines.push(`![${vp.key} ${s.key}](./${s.screenshot})`);
      lines.push('');
      if (s.issues.length) {
        for (const i of s.issues) lines.push(`- **[${i.severity}] ${i.type}** — ${i.detail}`);
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

main().catch((e) => { console.error(e); process.exit(1); });

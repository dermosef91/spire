#!/usr/bin/env node
// gen-event-art.js — Dev-only "?" event illustration generator for ÀṢẸ.
// Reads tools/events.manifest.json, generates consistent on-theme PNG event
// illustrations via the OpenAI image API, post-processes with sharp, writes to
// assets/event-art/.
//
// Usage:
//   node tools/gen-event-art.js                     # generate missing event art
//   node tools/gen-event-art.js --force              # regenerate all
//   node tools/gen-event-art.js --dry-run            # SVG placeholders, ZERO deps
//   node tools/gen-event-art.js --ids drowned_griot  # only specific ids
//   OPENAI_API_KEY=sk-... node tools/gen-event-art.js
//
// NOTE: --dry-run writes lightweight SVG placeholders and needs no npm packages,
// so the game always has *some* per-event art. Live PNG generation needs the
// dev deps (openai, sharp) — see tools/package.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const ART_DIR = join(ROOT, 'assets', 'event-art');
const MANIFEST_IN = join(__dirname, 'events.manifest.json');
const MANIFEST_OUT = join(ART_DIR, 'manifest.json');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const idsFlag = args.find(a => a.startsWith('--ids'));
const ID_FILTER = idsFlag
  ? (args[args.indexOf(idsFlag) + 1] || '').split(',').filter(Boolean)
  : args.find(a => a.startsWith('--ids='))
    ? args.find(a => a.startsWith('--ids=')).slice(6).split(',').filter(Boolean)
    : null;

// ── Style bible (embedded in every live prompt) ─────────────────────────────
const STYLE_BIBLE = `Afrofuturist dark graphic illustration for a roguelike event card. Bold clean composition framed for a landscape banner. Pure black backgrounds and deep shadows, high contrast, limited palette of ember orange #ff6a1a, deep ember #e8431a, amber #ffab47, cream #f3e8d8. Single evocative scene, no text, no border, no UI chrome.`;

// ── SVG placeholder (dry-run — no deps) ─────────────────────────────────────
function placeholderSvg(id, name, act) {
  const W = 960, H = 400, cx = W / 2, cy = H / 2;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0a0604"/>
  <circle cx="${cx}" cy="${cy}" r="150" fill="none" stroke="#ff6a1a" stroke-width="3" opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="96" fill="none" stroke="#ffab47" stroke-width="2" opacity="0.28"/>
  <circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="#e8431a" stroke-width="2" opacity="0.5"/>
  <text x="${cx}" y="${cy - 118}" text-anchor="middle" fill="#ff6a1a" font-family="Georgia, serif" font-size="86" opacity="0.55">?</text>
  <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#f3e8d8" font-family="Georgia, serif" font-size="40" font-weight="bold">${esc(name)}</text>
  <text x="${cx}" y="${cy + 44}" text-anchor="middle" fill="#ffab47" font-family="monospace" font-size="18" opacity="0.8">Act ${act}</text>
  <text x="${cx}" y="${H - 26}" text-anchor="middle" fill="#ff6a1a" font-family="monospace" font-size="15" opacity="0.6">[ placeholder event art · ${esc(id)} ]</text>
</svg>`;
}

// ── Retry helper (live) ─────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, baseDelay = 2000) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries) throw err;
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.warn(`  ⚠ Retry ${i + 1}/${retries} after ${Math.round(delay)}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function postProcess(sharp, buf) {
  return sharp(buf)
    .resize(1152, 480, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 85, colours: 32 })
    .toBuffer();
}

async function generateEvent(openai, sharp, ev) {
  const { id, name, act, prompt } = ev;
  const outPath = join(ART_DIR, `${id}.png`);
  if (!FORCE && existsSync(outPath)) {
    console.log(`  ⏭ ${id} — already exists, skipping (use --force)`);
    return;
  }
  console.log(`  🖌 ${id} (Act ${act}: ${name})...`);
  const result = await withRetry(() => openai.images.generate({
    model: 'gpt-image-2',
    prompt: `${STYLE_BIBLE} Subject: ${prompt}`,
    n: 1,
    size: '1536x1024',
  }));
  const rawBuf = Buffer.from(result.data[0].b64_json, 'base64');
  writeFileSync(outPath, await postProcess(sharp, rawBuf));
  console.log(`    ✓ saved`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ÀṢẸ — Event Art Generator                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (SVG placeholders)' : '🎨 LIVE (API calls)'}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  let events = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  if (ID_FILTER) events = events.filter(e => ID_FILTER.includes(e.id));
  mkdirSync(ART_DIR, { recursive: true });

  if (DRY_RUN) {
    for (const ev of events) {
      const outPath = join(ART_DIR, `${ev.id}.svg`);
      if (!FORCE && existsSync(outPath)) { console.log(`  ⏭ ${ev.id} — placeholder exists`); continue; }
      writeFileSync(outPath, placeholderSvg(ev.id, ev.name, ev.act));
      console.log(`  ✓ ${ev.id}.svg placeholder written`);
    }
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) { console.error('❌ OPENAI_API_KEY not set. Use --dry-run for placeholders.'); process.exit(1); }
    let sharp, openai;
    try { sharp = (await import('sharp')).default; }
    catch { console.error('❌ sharp not installed. Run: npm install (in tools/).'); process.exit(1); }
    try { const { default: OpenAI } = await import('openai'); openai = new OpenAI({ apiKey }); }
    catch { console.error('❌ openai SDK not installed. Run: npm install (in tools/).'); process.exit(1); }
    console.log('━━━ Generating event art ━━━');
    for (const ev of events) {
      try { await generateEvent(openai, sharp, ev); }
      catch (err) { console.error(`  ❌ ${ev.id} failed: ${err.message}`); }
    }
  }
  console.log();

  // Output manifest: every id we have art for (png preferred, else svg placeholder).
  const files = readdirSync(ART_DIR).filter(f => /\.(png|svg)$/.test(f) && f !== 'manifest.json');
  const ids = [...new Set(files.map(f => f.replace(/\.(png|svg)$/, '')))];
  writeFileSync(MANIFEST_OUT, JSON.stringify({ generated: new Date().toISOString(), dryRun: DRY_RUN, ids }, null, 2));
  console.log(`📋 Manifest written: ${ids.length} events → assets/event-art/manifest.json`);
  console.log('✅ Done!');
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });

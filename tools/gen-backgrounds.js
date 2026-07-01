#!/usr/bin/env node
// gen-backgrounds.js — Dev-only background generator for ÀṢẸ: Ascend the Obsidian Spire
// Reads tools/backgrounds.manifest.json, generates consistent on-theme PNG backgrounds
// via the OpenAI image API, post-processes with sharp, writes to assets/title screen and backgrounds/.
//
// Usage:
//   node tools/gen-backgrounds.js                          # generate missing backgrounds
//   node tools/gen-backgrounds.js --force                  # regenerate all
//   node tools/gen-backgrounds.js --dry-run                # placeholder PNGs, no API calls
//   node tools/gen-backgrounds.js --ids sunken_market      # only specific ids
//   OPENAI_API_KEY=sk-... node tools/gen-backgrounds.js
//
// Dependencies (dev-only, NOT used by the game):
//   npm install openai sharp   (inside tools/ or project root)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import './proxy-bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const BGS_DIR = join(ROOT, 'assets', 'title screen and backgrounds');
const MANIFEST_IN = join(__dirname, 'backgrounds.manifest.json');
const MANIFEST_OUT = join(BGS_DIR, 'manifest.json');
const STYLE_KEY_PATH = join(BGS_DIR, 'style-key-bg.png');

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

// ── Style bible (embedded in every prompt) ──────────────────────────────────
const STYLE_BIBLE = `Afrofuturist dark graphic illustration of a scene or environment. Wide landscape scene with a composition structured for a 3:2 aspect ratio. Pure black backgrounds and deep shadows, high contrast, limited palette of ember orange #ff6a1a, deep ember #e8431a, amber #ffab47, cream #f3e8d8. Background environment, no foreground characters, no text, no border, no UI chrome.`;

const STYLE_KEY_PROMPT = `${STYLE_BIBLE} Subject: A vast, empty ceremonial hall inside the Obsidian Spire. Giant concentric circular arches of carved black stone recede into a cosmic background, glowing amber soundwaves running along the floor. Tall stone pillars on the sides, high contrast, bold ember-orange highlights on the edges. Empty hall, no people. This is a style calibration reference image.`;

// ── Cost tracking ───────────────────────────────────────────────────────────
let totalCost = 0;
const costLog = [];

function logCost(id, endpoint, model) {
  const cost = 0.04; // Approximate cost for 1024x1024 generation / edit
  totalCost += cost;
  costLog.push({ id, endpoint, model, estimatedCost: `$${cost.toFixed(3)}` });
}

// ── Placeholder generator (for --dry-run) ───────────────────────────────────
async function createPlaceholderWithSharp(sharp, id, name, act) {
  const width = 1536;
  const height = 1024;
  const bgColor = '#0b0403';
  const accentColor = '#ff6a1a';
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${bgColor}"/>
    <circle cx="${width/2}" cy="${height/2}" r="300" fill="none" stroke="${accentColor}" stroke-width="4" opacity="0.3"/>
    <circle cx="${width/2}" cy="${height/2}" r="150" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.15"/>
    <path d="M 0 ${height/2} L ${width} ${height/2}" stroke="${accentColor}" stroke-width="2" opacity="0.2"/>
    <text x="${width/2}" y="${height/2 - 40}" text-anchor="middle" fill="#ffab47" font-size="48" font-family="monospace" font-weight="bold">${name}</text>
    <text x="${width/2}" y="${height/2 + 20}" text-anchor="middle" fill="#f3e8d8" font-size="28" font-family="monospace">Act ${act}</text>
    <text x="${width/2}" y="${height/2 + 70}" text-anchor="middle" fill="${accentColor}" font-size="20" font-family="monospace">[placeholder background: ${id}]</text>
  </svg>`;
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

// ── Retry helper ────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, baseDelay = 2000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.warn(`  ⚠ Retry ${i + 1}/${retries} after ${Math.round(delay)}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── Image generation helpers ────────────────────────────────────────────────
async function generateStyleKey(openai, sharp) {
  console.log('🎨 Generating background style-key reference image...');

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, 'style-key-bg', 'Style Calibration Reference', '0');
    writeFileSync(STYLE_KEY_PATH, buf);
    console.log('  ✓ Style-key placeholder written');
    return;
  }

  const result = await withRetry(async () => {
    return openai.images.generate({
      model: 'gpt-image-2',
      prompt: STYLE_KEY_PROMPT,
      n: 1,
      size: '1024x1024',
    });
  });

  logCost('style-key-bg', 'generate', 'gpt-image-2');

  const b64 = result.data[0].b64_json;
  const rawBuf = Buffer.from(b64, 'base64');

  // Post-process with sharp
  const processed = await postProcess(sharp, rawBuf);
  writeFileSync(STYLE_KEY_PATH, processed);
  console.log('  ✓ Style-key saved');
}

async function generateBackground(openai, OpenAI, sharp, bg) {
  const { id, name, act, prompt } = bg;
  const outPath = join(BGS_DIR, `${id}.png`);

  if (!FORCE && existsSync(outPath)) {
    console.log(`  ⏭ ${id} — already exists, skipping (use --force to regenerate)`);
    return id;
  }

  console.log(`  🖌 ${id} (Act ${act}: ${name})...`);

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, id, name, act);
    writeFileSync(outPath, buf);
    console.log(`    ✓ placeholder written`);
    return id;
  }

  const fullPrompt = `${STYLE_BIBLE} Subject: ${prompt}`;

  // Read style-key as image input for consistency
  let styleKeyBuf = readFileSync(STYLE_KEY_PATH);
  // Since style-key-bg.png is post-processed to 1536x1024, we must resize it back to a square (1024x1024)
  // for OpenAI's images.edit API which strictly requires square PNGs.
  // We also make the image semi-transparent (10% opacity) so the edit API has full freedom to draw
  // the new environment details while maintaining the color scheme and texture style from the style key.
  const rawStyleKey = await sharp(styleKeyBuf)
    .resize(1024, 1024, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelData = rawStyleKey.data;
  for (let i = 3; i < pixelData.length; i += 4) {
    pixelData[i] = 25; // ~10% opacity
  }

  styleKeyBuf = await sharp(pixelData, {
    raw: {
      width: rawStyleKey.info.width,
      height: rawStyleKey.info.height,
      channels: 4
    }
  }).png().toBuffer();

  const styleKeyFile = await OpenAI.toFile(styleKeyBuf, 'style-key-bg.png', { type: 'image/png' });

  const result = await withRetry(async () => {
    return openai.images.edit({
      model: 'gpt-image-2',
      image: styleKeyFile,
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
    });
  });

  logCost(id, 'edit', 'gpt-image-2');

  const b64 = result.data[0].b64_json;
  const rawBuf = Buffer.from(b64, 'base64');

  // Post-process
  const processed = await postProcess(sharp, rawBuf);
  writeFileSync(outPath, processed);
  console.log(`    ✓ saved (${Math.round(processed.length / 1024)}KB)`);
  return id;
}

// ── Post-processing ─────────────────────────────────────────────────────────
async function postProcess(sharp, buf) {
  let img = sharp(buf);

  // Resize/crop to exactly 1536x1024 using cover fit
  img = img.resize(1536, 1024, {
    fit: 'cover',
    position: 'center'
  });

  // Palette quantize toward our theme palette for color consistency
  img = img.png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: true,  // Enable palette-based quantization
    quality: 85,
    colours: 32,    // Limit colors for woodcut/risograph feel
  });

  return img.toBuffer();
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ÀṢẸ — Background Generator                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (placeholders)' : '🎨 LIVE (API calls)'}`);
  console.log(`  Force: ${FORCE}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  // Load manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  let bgs = manifest;
  if (ID_FILTER) {
    bgs = bgs.filter(b => ID_FILTER.includes(b.id));
  }

  console.log(`  Found ${bgs.length} backgrounds to process`);
  console.log();

  // Ensure output directory
  mkdirSync(BGS_DIR, { recursive: true });

  // Load sharp (dev dependency)
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.error('❌ sharp not installed. Run: npm install sharp inside tools/');
    process.exit(1);
  }

  // Load OpenAI SDK (only if not dry-run)
  let openai = null;
  let OpenAIClass = null;
  if (!DRY_RUN) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not set.');
      console.error('   export OPENAI_API_KEY=sk-... or use --dry-run');
      process.exit(1);
    }
    try {
      const { default: OpenAI } = await import('openai');
      openai = new OpenAI({ apiKey });
      OpenAIClass = OpenAI;
    } catch (err) {
      console.error('❌ openai SDK not installed. Run: npm install openai inside tools/');
      process.exit(1);
    }
  }

  // Step 1: Generate style-key reference
  if (!existsSync(STYLE_KEY_PATH)) {
    await generateStyleKey(openai, sharp);
  } else {
    console.log('🎨 Background style-key exists, reusing');
  }
  console.log();

  // Step 2: Generate each background
  console.log('━━━ Generating backgrounds ━━━');
  const generated = [];
  for (const bg of bgs) {
    try {
      const id = await generateBackground(openai, OpenAIClass, sharp, bg);
      if (id) generated.push(id);
    } catch (err) {
      console.error(`  ❌ ${bg.id} failed: ${err.message}`);
    }
  }
  console.log();

  // Step 3: Write output manifest (list of all available background ids)
  const { readdirSync } = await import('node:fs');
  const allPngs = readdirSync(BGS_DIR)
    .filter(f => f.endsWith('.png') && f !== 'style-key-bg.png')
    .map(f => f.replace('.png', ''));

  const outputManifest = {
    generated: new Date().toISOString(),
    dryRun: DRY_RUN,
    ids: allPngs,
  };
  writeFileSync(MANIFEST_OUT, JSON.stringify(outputManifest, null, 2));
  console.log(`📋 Manifest written: ${allPngs.length} backgrounds → assets/title screen and backgrounds/manifest.json`);

  // Cost summary
  if (!DRY_RUN && costLog.length > 0) {
    console.log();
    console.log('━━━ Cost Summary ━━━');
    for (const entry of costLog) {
      console.log(`  ${entry.id}: ${entry.endpoint} (${entry.model}) ~${entry.estimatedCost}`);
    }
    console.log(`  Total estimated: $${totalCost.toFixed(3)}`);
  }

  console.log();
  console.log('✅ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

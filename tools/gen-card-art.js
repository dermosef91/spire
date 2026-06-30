#!/usr/bin/env node
// gen-card-art.js — Dev-only card art generator for ÀṢẸ: Ascend the Obsidian Spire
// Reads tools/cards.manifest.json, generates consistent on-theme PNG card artworks
// via the OpenAI image API, post-processes with sharp, writes to assets/card-art/.
//
// Usage:
//   node tools/gen-card-art.js                  # generate missing card art
//   node tools/gen-card-art.js --force           # regenerate all
//   node tools/gen-card-art.js --dry-run         # placeholder PNGs, no API calls
//   node tools/gen-card-art.js --ids slash,crescendo # only specific ids
//   OPENAI_API_KEY=sk-... node tools/gen-card-art.js
//
// Dependencies (dev-only, NOT used by the game):
//   npm install openai sharp   (inside tools/ or project root)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CARD_ART_DIR = join(ROOT, 'assets', 'card-art');
const MANIFEST_IN = join(__dirname, 'cards.manifest.json');
const MANIFEST_OUT = join(CARD_ART_DIR, 'manifest.json');
const STYLE_KEY_PATH = join(CARD_ART_DIR, 'style-key.png');

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
const STYLE_BIBLE = `Afrofuturist dark card illustration mirroring the visual style of the reference image. High contrast clean graphic layout, minimal halftone shading. Color palette limited to black, deep ember #e8431a, ember orange #ff6a1a, amber #ffab47, and cream #f3e8d8. No text.`;

const STYLE_KEY_PROMPT = `${STYLE_BIBLE} Subject: A neutral template icon showing a single bold glowing orbital energy orb at the center with radiating clean sun-ray lines. Very clean composition, low complexity, minimal detail. This is a style calibration template image.`;

// ── Cost tracking ───────────────────────────────────────────────────────────
let totalCost = 0;
const costLog = [];

function logCost(id, endpoint, model) {
  const cost = 0.04; // Approximate cost for DALL-E 2 / 3 edit/generate at 1024x1024
  totalCost += cost;
  costLog.push({ id, endpoint, model, estimatedCost: `$${cost.toFixed(3)}` });
}

// ── Placeholder generator (for --dry-run) ───────────────────────────────────
async function createPlaceholderWithSharp(sharp, id, name) {
  const size = 512;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#0a0604"/>
    <!-- Concentric rings -->
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="none" stroke="#e8431a" stroke-width="4" opacity="0.3"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.3}" fill="none" stroke="#ff6a1a" stroke-width="2" stroke-dasharray="10 10"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.2}" fill="none" stroke="#ffab47" stroke-width="6"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.1}" fill="#e8431a"/>
    <text x="${size/2}" y="${size/2 + 10}" text-anchor="middle" fill="#f3e8d8" font-size="28" font-family="monospace" font-weight="bold">${name || id}</text>
    <text x="${size/2}" y="${size/2 + 50}" text-anchor="middle" fill="#ffab47" font-size="16" font-family="monospace">[card art placeholder]</text>
  </svg>`;
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
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
  console.log('🎨 Generating card art style-key reference image...');

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, 'style-key', 'Style Calibration');
    writeFileSync(STYLE_KEY_PATH, buf);
    console.log('  ✓ Card art style-key placeholder written');
    return;
  }

  const result = await withRetry(async () => {
    return openai.images.generate({
      model: 'gpt-image-2',
      prompt: STYLE_KEY_PROMPT,
      n: 1,
      size: '1024x768',
    });
  });

  logCost('style-key', 'generate', 'gpt-image-2');

  const b64 = result.data[0].b64_json;
  const rawBuf = Buffer.from(b64, 'base64');

  const processed = await postProcess(sharp, rawBuf);
  writeFileSync(STYLE_KEY_PATH, processed);
  console.log('  ✓ Card art style-key saved');
}

async function generateCardArt(openai, OpenAI, sharp, card) {
  const { id, name, prompt } = card;
  const outPath = join(CARD_ART_DIR, `${id}.png`);

  if (!FORCE && existsSync(outPath)) {
    console.log(`  ⏭ ${id} — already exists, skipping (use --force to regenerate)`);
    return id;
  }

  console.log(`  🖌 ${id} (${name})...`);

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, id, name);
    writeFileSync(outPath, buf);
    console.log(`    ✓ placeholder written`);
    return id;
  }

  const fullPrompt = `${STYLE_BIBLE} Subject: ${prompt}`;

  // Read style-key as image input for consistency
  const styleKeyBuf = readFileSync(STYLE_KEY_PATH);
  const styleKeyFile = await OpenAI.toFile(styleKeyBuf, 'style-key.png', { type: 'image/png' });

  const result = await withRetry(async () => {
    return openai.images.edit({
      model: 'gpt-image-2',
      image: styleKeyFile,
      prompt: fullPrompt,
      n: 1,
      size: '1024x768',
    });
  });

  logCost(id, 'edit', 'gpt-image-2');

  const b64 = result.data[0].b64_json;
  const rawBuf = Buffer.from(b64, 'base64');

  const processed = await postProcess(sharp, rawBuf);
  writeFileSync(outPath, processed);
  console.log(`    ✓ saved (${Math.round(processed.length / 1024)}KB)`);
  return id;
}

// ── Post-processing ─────────────────────────────────────────────────────────
async function postProcess(sharp, buf) {
  // Load raw image with sharp
  let img = sharp(buf);

  // Resize/crop to 512x384 (4:3 aspect ratio) with fit: 'cover'
  img = img.resize(512, 384, {
    fit: 'cover',
  });

  // Palette quantize for woodcut/risograph visual style
  img = img.png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: true,
    quality: 85,
    colours: 32, // Limit colors to replicate risograph print
  });

  return img.toBuffer();
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ÀṢẸ — Card Art Generator                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (placeholders)' : '🎨 LIVE (API calls)'}`);
  console.log(`  Force: ${FORCE}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  // Load manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  let cards = manifest;
  if (ID_FILTER) {
    cards = cards.filter(c => ID_FILTER.includes(c.id));
  }

  console.log(`  Found ${cards.length} cards to process`);
  console.log();

  // Ensure output directory
  mkdirSync(CARD_ART_DIR, { recursive: true });

  // Load sharp
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.error('❌ sharp not installed. Run: npm install sharp');
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
      console.error('❌ openai SDK not installed. Run: npm install openai');
      process.exit(1);
    }
  }

  // Step 1: Generate style-key reference
  if (!existsSync(STYLE_KEY_PATH) || FORCE) {
    await generateStyleKey(openai, sharp);
  } else {
    console.log('🎨 Card art style-key exists, reusing');
  }
  console.log();

  // Step 2: Generate each card art
  console.log('━━━ Generating card art ━━━');
  const generated = [];
  for (const card of cards) {
    try {
      const id = await generateCardArt(openai, OpenAIClass, sharp, card);
      if (id) generated.push(id);
    } catch (err) {
      console.error(`  ❌ ${card.id} failed: ${err.message}`);
    }
  }
  console.log();

  // Step 3: Write output manifest (list of all available card art ids)
  const { readdirSync } = await import('node:fs');
  const allPngs = readdirSync(CARD_ART_DIR)
    .filter(f => f.endsWith('.png') && f !== 'style-key.png')
    .map(f => f.replace('.png', ''));

  const outputManifest = {
    generated: new Date().toISOString(),
    dryRun: DRY_RUN,
    ids: allPngs,
  };
  writeFileSync(MANIFEST_OUT, JSON.stringify(outputManifest, null, 2));
  console.log(`📋 Manifest written: ${allPngs.length} card arts → assets/card-art/manifest.json`);

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

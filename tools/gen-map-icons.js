#!/usr/bin/env node
// gen-map-icons.js — Dev-only map icon generator for ÀṢẸ: Ascend the Obsidian Spire
// Reads tools/map-icons.manifest.json, generates consistent on-theme PNG map icons
// via the OpenAI image API, post-processes with sharp, writes to assets/icons/.
//
// Usage:
//   node tools/gen-map-icons.js                  # generate missing map icons
//   node tools/gen-map-icons.js --force           # regenerate all
//   node tools/gen-map-icons.js --dry-run         # placeholder PNGs, no API calls
//   node tools/gen-map-icons.js --ids combat       # only specific ids
//   OPENAI_API_KEY=sk-... node tools/gen-map-icons.js
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
const ICONS_DIR = join(ROOT, 'assets', 'icons');
const RELIC_ART_DIR = join(ROOT, 'assets', 'relic-art');
const MANIFEST_IN = join(__dirname, 'map-icons.manifest.json');
const STYLE_KEY_PATH = join(RELIC_ART_DIR, 'style-key.png');

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
const STYLE_BIBLE = `Afrofuturist dark graphic illustration of a single object icon in a bold woodcut / risograph screen-print style. Bold black ink linework, very high contrast, strictly limited palette of ember orange #ff6a1a, deep ember #e8431a, amber #ffab47, cream #f3e8d8 — absolutely no other hues. Focus on a clean, distinct silhouette with simple bold shapes, optimized for readability at a very small icon scale. Geometric African-inspired ornamental patterns. No glowing halos, no concentric floating circle sigils, no background star fields, no ground shadow, no text, no border, no UI chrome. Transparent background.`;

// ── Cost tracking ───────────────────────────────────────────────────────────
let totalCost = 0;
const costLog = [];

function logCost(id, endpoint, model) {
  const cost = 0.04;
  totalCost += cost;
  costLog.push({ id, endpoint, model, estimatedCost: `$${cost.toFixed(3)}` });
}

// ── Placeholder generator (for --dry-run) ───────────────────────────────────
async function createPlaceholderWithSharp(sharp, id, filename) {
  const size = 512;
  const bgColor = '#0b0403';
  const accentColor = '#ff6a1a';
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="${bgColor}" stroke="${accentColor}" stroke-width="4"/>
    <text x="${size/2}" y="${size/2 - 10}" text-anchor="middle" fill="#ffab47" font-size="24" font-family="monospace" font-weight="bold">${id}</text>
    <text x="${size/2}" y="${size/2 + 20}" text-anchor="middle" fill="#f3e8d8" font-size="14" font-family="monospace">${filename}</text>
    <text x="${size/2}" y="${size/2 + 45}" text-anchor="middle" fill="${accentColor}" font-size="10" font-family="monospace">[placeholder]</text>
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
async function generateIcon(openai, OpenAI, sharp, icon) {
  const { id, filename, prompt } = icon;
  const outPath = join(ICONS_DIR, filename);

  if (!FORCE && existsSync(outPath)) {
    console.log(`  ⏭ ${id} (${filename}) — already exists, skipping (use --force to regenerate)`);
    return id;
  }

  console.log(`  🖌 ${id} (${filename})...`);

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, id, filename);
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
  const baseImg = sharp(buf);
  const { data, info } = await baseImg.raw().toBuffer({ resolveWithObject: true });
  
  const outputBuffer = Buffer.alloc(info.width * info.height * 4);
  const channels = info.channels;
  
  for (let i = 0; i < info.width * info.height; i++) {
    const srcIdx = i * channels;
    const destIdx = i * 4;
    
    const r = data[srcIdx];
    const g = data[srcIdx + 1];
    const b = data[srcIdx + 2];
    
    // Check if pixel is neutral-bright (part of checkerboard background)
    const isNeutralBright = 
      r > 150 && 
      Math.abs(r - g) < 12 && 
      Math.abs(r - b) < 12 && 
      Math.abs(g - b) < 12;
      
    if (isNeutralBright) {
      // Key out! Set alpha to 0
      outputBuffer[destIdx] = 0;
      outputBuffer[destIdx + 1] = 0;
      outputBuffer[destIdx + 2] = 0;
      outputBuffer[destIdx + 3] = 0;
    } else {
      outputBuffer[destIdx] = r;
      outputBuffer[destIdx + 1] = g;
      outputBuffer[destIdx + 2] = b;
      outputBuffer[destIdx + 3] = channels === 4 ? data[srcIdx + 3] : 255;
    }
  }
  
  let img = sharp(outputBuffer, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  });

  try {
    img = img.trim();
  } catch {
    // trim can fail on some images, continue without
  }

  // Resize to 512x512 maintaining aspect ratio (saving memory for map rendering), pad with transparent
  img = img.resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
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
  console.log('║  ÀṢẸ — Map Icon Generator                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (placeholders)' : '🎨 LIVE (API calls)'}`);
  console.log(`  Force: ${FORCE}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  if (!existsSync(STYLE_KEY_PATH)) {
    console.error(`❌ Style key not found at ${STYLE_KEY_PATH}. Make sure to generate relic art first!`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  let icons = manifest;
  if (ID_FILTER) {
    icons = icons.filter(e => ID_FILTER.includes(e.id));
  }

  console.log(`  Found ${icons.length} map icons to process`);
  console.log();

  mkdirSync(ICONS_DIR, { recursive: true });

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.error('❌ sharp not installed. Run: npm install sharp');
    process.exit(1);
  }

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

  // Step 2: Generate each map icon
  console.log('━━━ Generating map icons ━━━');
  const generated = [];
  for (const icon of icons) {
    try {
      const id = await generateIcon(openai, OpenAIClass, sharp, icon);
      if (id) generated.push(id);
    } catch (err) {
      console.error(`  ❌ ${icon.id} failed: ${err.message}`);
    }
  }
  console.log();

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

#!/usr/bin/env node
// gen-relic-art.js — Dev-only relic art generator for ÀṢẸ: Ascend the Obsidian Spire
// Reads tools/relics.manifest.json, generates consistent on-theme PNG relic artworks
// via the OpenAI image API, post-processes with sharp, writes to assets/relic-art/.
//
// Usage:
//   node tools/gen-relic-art.js                  # generate missing relic art
//   node tools/gen-relic-art.js --force           # regenerate all
//   node tools/gen-relic-art.js --dry-run         # placeholder PNGs, no API calls
//   node tools/gen-relic-art.js --ids brass_anklet # only specific ids
//   OPENAI_API_KEY=sk-... node tools/gen-relic-art.js
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
const RELIC_ART_DIR = join(ROOT, 'assets', 'relic-art');
const MANIFEST_IN = join(__dirname, 'relics.manifest.json');
const MANIFEST_OUT = join(RELIC_ART_DIR, 'manifest.json');
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
const STYLE_BIBLE = `Afrofuturist dark graphic illustration of a single relic object in a bold woodcut / risograph screen-print style. Pure black background, bold black ink linework, very high contrast, strictly limited palette of ember orange #ff6a1a, deep ember #e8431a, amber #ffab47, cream #f3e8d8 — absolutely no other hues. Focus on a clean, distinct silhouette with simple bold shapes, optimized for readability at a very small icon scale. Geometric African-inspired ornamental patterns. No glowing halos, no concentric floating circle sigils, no background star fields, no ground shadow, no text, no border, no UI chrome.`;

const STYLE_KEY_PROMPT = `${STYLE_BIBLE} Subject: a neutral ceremonial brass vessel, centered in the exact afrofuturist dark graphic style. Geometric African-inspired trim bands, catching bold ember-orange rim lighting on pure black. Clean outline and silhouette. This is a style calibration reference image.`;

// ── Cost tracking ───────────────────────────────────────────────────────────
let totalCost = 0;
const costLog = [];

function logCost(id, endpoint, model) {
  // Approximate costs (gpt-image-2 1024x1024)
  const cost = endpoint === 'generate' ? 0.04 : 0.04;
  totalCost += cost;
  costLog.push({ id, endpoint, model, estimatedCost: `$${cost.toFixed(3)}` });
}

// ── Placeholder generator (for --dry-run) ───────────────────────────────────
async function createPlaceholderWithSharp(sharp, id, rarity) {
  const size = 1024;
  const isBoss = rarity === 'boss';
  const bgColor = isBoss ? '#1c0f06' : '#0b0403';
  const accentColor = isBoss ? '#ff6a1a' : '#e8431a';
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.38}" fill="${bgColor}" stroke="${accentColor}" stroke-width="6"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.28}" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.5"/>
    <text x="${size/2}" y="${size/2 - 20}" text-anchor="middle" fill="#ffab47" font-size="28" font-family="monospace" font-weight="bold">${id}</text>
    <text x="${size/2}" y="${size/2 + 20}" text-anchor="middle" fill="#f3e8d8" font-size="18" font-family="monospace">${rarity}</text>
    <text x="${size/2}" y="${size/2 + 50}" text-anchor="middle" fill="${accentColor}" font-size="14" font-family="monospace">[placeholder]</text>
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
  console.log('🎨 Generating relic style-key reference image...');

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, 'style-key', 'reference');
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

  logCost('style-key', 'generate', 'gpt-image-2');

  const b64 = result.data[0].b64_json;
  const rawBuf = Buffer.from(b64, 'base64');

  // Post-process with sharp
  const processed = await postProcess(sharp, rawBuf);
  writeFileSync(STYLE_KEY_PATH, processed);
  console.log('  ✓ Style-key saved');
}

async function generateRelic(openai, OpenAI, sharp, relic) {
  const { id, rarity, prompt } = relic;
  const outPath = join(RELIC_ART_DIR, `${id}.png`);

  if (!FORCE && existsSync(outPath)) {
    console.log(`  ⏭ ${id} — already exists, skipping (use --force to regenerate)`);
    return id;
  }

  console.log(`  🖌 ${id} (${rarity})...`);

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, id, rarity);
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
  
  const channels = info.channels;
  const visited = new Uint8Array(info.width * info.height);
  const queue = [];
  
  // Helper to add pixel index to flood-fill queue
  function enqueue(x, y) {
    if (x < 0 || x >= info.width || y < 0 || y >= info.height) return;
    const idx = y * info.width + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      queue.push(idx);
    }
  }
  
  // Initialize queue with all border pixels
  for (let x = 0; x < info.width; x++) {
    enqueue(x, 0);
    enqueue(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y++) {
    enqueue(0, y);
    enqueue(info.width - 1, y);
  }
  
  // Create output buffer (RGBA, default to opaque copy of src)
  const outputBuffer = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const srcIdx = i * channels;
    const destIdx = i * 4;
    outputBuffer[destIdx] = data[srcIdx];
    outputBuffer[destIdx + 1] = data[srcIdx + 1];
    outputBuffer[destIdx + 2] = data[srcIdx + 2];
    outputBuffer[destIdx + 3] = channels === 4 ? data[srcIdx + 3] : 255;
  }
  
  // Run flood-fill from borders
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const destIdx = idx * 4;
    const r = outputBuffer[destIdx];
    const g = outputBuffer[destIdx + 1];
    const b = outputBuffer[destIdx + 2];
    
    // Determine if background-like (very dark/black OR bright neutral checkerboard)
    const isDark = r < 50 && g < 50 && b < 50;
    const isBrightChecker = 
      r > 150 && 
      Math.abs(r - g) < 12 && 
      Math.abs(r - b) < 12 && 
      Math.abs(g - b) < 12;
      
    if (isDark || isBrightChecker) {
      // Key out! Set alpha to 0 (fully transparent)
      outputBuffer[destIdx] = 0;
      outputBuffer[destIdx + 1] = 0;
      outputBuffer[destIdx + 2] = 0;
      outputBuffer[destIdx + 3] = 0;
      
      const x = idx % info.width;
      const y = Math.floor(idx / info.width);
      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
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
    // trim can fail if everything is transparent or on error
  }

  // Pad back to 1024x1024
  img = img.resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  img = img.png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: true,
    quality: 85,
    colours: 32,
  });

  return img.toBuffer();
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ÀṢẸ — Relic Art Generator                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (placeholders)' : '🎨 LIVE (API calls)'}`);
  console.log(`  Force: ${FORCE}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  const manifest = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  let relics = manifest;
  if (ID_FILTER) {
    relics = relics.filter(e => ID_FILTER.includes(e.id));
  }

  console.log(`  Found ${relics.length} relics to process`);
  console.log();

  mkdirSync(RELIC_ART_DIR, { recursive: true });

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

  // Step 1: Generate style-key reference
  if (!existsSync(STYLE_KEY_PATH) || (FORCE && ID_FILTER && ID_FILTER.includes('style-key'))) {
    await generateStyleKey(openai, sharp);
  } else {
    console.log('🎨 Relic style-key exists, reusing');
  }
  console.log();

  // Step 2: Generate each relic
  console.log('━━━ Generating relics ━━━');
  const generated = [];
  for (const relic of relics) {
    try {
      const id = await generateRelic(openai, OpenAIClass, sharp, relic);
      if (id) generated.push(id);
    } catch (err) {
      console.error(`  ❌ ${relic.id} failed: ${err.message}`);
    }
  }
  console.log();

  // Step 3: Write output manifest
  const { readdirSync } = await import('node:fs');
  const allPngs = readdirSync(RELIC_ART_DIR)
    .filter(f => f.endsWith('.png') && f !== 'style-key.png')
    .map(f => f.replace('.png', ''));

  const outputManifest = {
    generated: new Date().toISOString(),
    dryRun: DRY_RUN,
    ids: allPngs,
  };
  writeFileSync(MANIFEST_OUT, JSON.stringify(outputManifest, null, 2));
  console.log(`📋 Manifest written: ${allPngs.length} relics → assets/relic-art/manifest.json`);

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

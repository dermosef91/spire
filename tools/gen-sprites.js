#!/usr/bin/env node
// gen-sprites.js — Dev-only sprite generator for ÀṢẸ: Ascend the Obsidian Spire
// Reads tools/sprites.manifest.json, generates consistent on-theme PNG sprites
// via the OpenAI image API, post-processes with sharp, writes to assets/sprites/.
//
// Usage:
//   node tools/gen-sprites.js                  # generate missing sprites
//   node tools/gen-sprites.js --force           # regenerate all
//   node tools/gen-sprites.js --dry-run         # placeholder PNGs, no API calls
//   node tools/gen-sprites.js --ids amara,kofi  # only specific ids
//   OPENAI_API_KEY=sk-... node tools/gen-sprites.js
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
const SPRITES_DIR = join(ROOT, 'assets', 'sprites');
const MANIFEST_IN = join(__dirname, 'sprites.manifest.json');
const MANIFEST_OUT = join(SPRITES_DIR, 'manifest.json');
const STYLE_KEY_PATH = join(SPRITES_DIR, 'style-key.png');

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
const STYLE_BIBLE = `Afrofuturist dark graphic illustration in a bold woodcut / risograph screen-print style. Pure black background, bold black ink linework, halftone dot shading, very high contrast, strictly limited palette of ember orange #ff6a1a, deep ember #e8431a, amber #ffab47, cream #f3e8d8 — absolutely no other hues. Concentric orbital circle sigils and geometric African-inspired ornamental patterns as decorative elements. Ember-orange rim lighting on figures. Grain and halftone texture throughout. Single full-figure character, centered, front or three-quarter view, standing heroic, head-to-feet inside frame with generous margin. Transparent background, no ground shadow, no text, no border, no UI chrome.`;

const STYLE_KEY_PROMPT = `${STYLE_BIBLE} Subject: a neutral robed figure standing centered in the exact afrofuturist dark graphic style. Featureless smooth face, long flowing ceremonial robe with geometric African-inspired trim bands, concentric orbital ring sigils floating behind the figure. Bold ember-orange rim lighting on pure black. This is a style calibration reference image.`;

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
function createPlaceholder(id, kind) {
  // Create a tiny valid PNG (1x1 orange pixel, then sharp will resize)
  // Actually create a recognizable placeholder using sharp if available,
  // otherwise a minimal PNG
  try {
    return null; // will be handled below with sharp
  } catch {
    return null;
  }
}

async function createPlaceholderWithSharp(sharp, id, kind) {
  const size = 1024;
  const isChamp = kind === 'champion';
  // Create a simple colored rectangle with text overlay using raw SVG
  const bgColor = isChamp ? '#1c0f06' : '#0b0403';
  const accentColor = isChamp ? '#ff6a1a' : '#e8431a';
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.38}" fill="${bgColor}" stroke="${accentColor}" stroke-width="6"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.28}" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.5"/>
    <text x="${size/2}" y="${size/2 - 20}" text-anchor="middle" fill="#ffab47" font-size="28" font-family="monospace" font-weight="bold">${id}</text>
    <text x="${size/2}" y="${size/2 + 20}" text-anchor="middle" fill="#f3e8d8" font-size="18" font-family="monospace">${kind}</text>
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
  console.log('🎨 Generating style-key reference image...');

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

async function generateEntity(openai, OpenAI, sharp, entity) {
  const { id, kind, prompt } = entity;
  const outPath = join(SPRITES_DIR, `${id}.png`);

  if (!FORCE && existsSync(outPath)) {
    console.log(`  ⏭ ${id} — already exists, skipping (use --force to regenerate)`);
    return id;
  }

  console.log(`  🖌 ${id} (${kind})...`);

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, id, kind);
    writeFileSync(outPath, buf);
    console.log(`    ✓ placeholder written`);
    return id;
  }

  const fullPrompt = `${STYLE_BIBLE} Subject: ${prompt}`;

  // Read style-key as image input for consistency
  const styleKeyBuf = readFileSync(STYLE_KEY_PATH);
  // Prepare style key file for OpenAI API with correct mimetype
  const styleKeyFile = await OpenAI.toFile(styleKeyBuf, 'style-key.png', { type: 'image/png' });

  const result = await withRetry(async () => {
    // Use images.edit with the style-key as the base image for consistency
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
  // 1. Load raw pixel data
  const baseImg = sharp(buf);
  const { data, info } = await baseImg.raw().toBuffer({ resolveWithObject: true });
  
  // 2. Scan and key out neutral-bright background (checkerboard squares)
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
  
  // 3. Rebuild sharp image from the keyed buffer
  let img = sharp(outputBuffer, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  });

  // Trim transparent border
  try {
    img = img.trim();
  } catch {
    // trim can fail on some images, continue without
  }

  // Resize to 1024x1024 maintaining aspect ratio, pad with transparent
  img = img.resize(1024, 1024, {
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
  console.log('║  ÀṢẸ — Sprite Generator                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (placeholders)' : '🎨 LIVE (API calls)'}`);
  console.log(`  Force: ${FORCE}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  // Load manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  let entities = manifest;
  if (ID_FILTER) {
    entities = entities.filter(e => ID_FILTER.includes(e.id));
  }

  console.log(`  Found ${entities.length} entities to process`);
  console.log();

  // Ensure output directory
  mkdirSync(SPRITES_DIR, { recursive: true });

  // Load sharp (dev dependency)
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.error('❌ sharp not installed. Run: npm install sharp');
    console.error('   (This is a dev-only dependency, not used by the game)');
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
  if (!existsSync(STYLE_KEY_PATH)) {
    await generateStyleKey(openai, sharp);
  } else {
    console.log('🎨 Style-key exists, reusing');
  }
  console.log();

  // Step 2: Generate each entity
  console.log('━━━ Generating entities ━━━');
  const generated = [];
  for (const entity of entities) {
    try {
      const id = await generateEntity(openai, OpenAIClass, sharp, entity);
      if (id) generated.push(id);
    } catch (err) {
      console.error(`  ❌ ${entity.id} failed: ${err.message}`);
    }
  }
  console.log();

  // Step 3: Write output manifest (list of all available sprite ids)
  // Scan directory for all .png files (not just this run's output)
  const { readdirSync } = await import('node:fs');
  const allPngs = readdirSync(SPRITES_DIR)
    .filter(f => f.endsWith('.png') && f !== 'style-key.png')
    .map(f => f.replace('.png', ''));

  const outputManifest = {
    generated: new Date().toISOString(),
    dryRun: DRY_RUN,
    ids: allPngs,
  };
  writeFileSync(MANIFEST_OUT, JSON.stringify(outputManifest, null, 2));
  console.log(`📋 Manifest written: ${allPngs.length} sprites → assets/sprites/manifest.json`);

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

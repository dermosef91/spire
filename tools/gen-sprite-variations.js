#!/usr/bin/env node
// gen-sprite-variations.js — Dev-only sprite variations generator for ÀṢẸ
// Reads tools/sprites.manifest.json, generates attack, block, and idle2 variations for champions
// via OpenAI's image edit API, using the base champion sprites as inputs.
//
// Usage:
//   node tools/gen-sprite-variations.js                  # generate missing variations
//   node tools/gen-sprite-variations.js --force           # regenerate all variations
//   node tools/gen-sprite-variations.js --dry-run         # placeholder PNGs, no API calls
//   node tools/gen-sprite-variations.js --ids amara,kofi  # only specific champion ids
//   OPENAI_API_KEY=sk-... node tools/gen-sprite-variations.js
//

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

// ── Cost tracking ───────────────────────────────────────────────────────────
let totalCost = 0;
const costLog = [];

function logCost(id, pose, endpoint, model) {
  const cost = 0.04; // DALL-E edit 1024x1024 cost approximation
  totalCost += cost;
  costLog.push({ id: `${id}_${pose}`, endpoint, model, estimatedCost: `$${cost.toFixed(3)}` });
}

// ── Variation prompt generator ──────────────────────────────────────────────
function getVariationPrompt(id, basePrompt, pose) {
  if (pose === 'attack') {
    if (id === 'amara') {
      return basePrompt
        .replace('in heroic standing pose', 'in dynamic attacking pose, lunging forward and slashing')
        .replace('Two crossed star-iron blades held at her sides', 'Two star-iron blades raised and striking in mid-air');
    }
    if (id === 'kofi') {
      return basePrompt
        .replace('standing centered, cradling', 'in dynamic attacking pose, actively playing chords on')
        .replace('Calm wise expression', 'Focused passionate expression')
        .replace('Musical note wisps', 'Energetic glowing musical note waves and sonic blasts');
    }
    if (id === 'zara') {
      return basePrompt
        .replace('standing centered with both hands raised', 'in dynamic attacking pose, thrusting both hands forward')
        .replace('glowing spirit orbs floating between her fingers', 'projecting glowing spirit orbs and beams of star-fire');
    }
    return basePrompt.replace('standing pose', 'dynamic attacking pose, lunging and striking');
  }

  if (pose === 'block') {
    if (id === 'amara') {
      return basePrompt
        .replace('in heroic standing pose', 'in defensive blocking pose, crossing blades to form a shield')
        .replace('Two crossed star-iron blades held at her sides', 'Two crossed star-iron blades held protectively in front of her chest');
    }
    if (id === 'kofi') {
      return basePrompt
        .replace('standing centered, cradling', 'in defensive blocking pose, holding defensively')
        .replace('Musical note wisps', 'A protective barrier of glowing amber sound-waves and shielding concentric rings');
    }
    if (id === 'zara') {
      return basePrompt
        .replace('standing centered with both hands raised', 'in defensive blocking pose, hands held out to form a barrier')
        .replace('Orbiting energy rings around her torso', 'A dense glowing sphere of orbiting celestial shield rings protecting her');
    }
    return basePrompt.replace('standing pose', 'defensive blocking pose, shielding and guarding');
  }

  if (pose === 'skill') {
    if (id === 'amara') {
      return basePrompt
        .replace('in heroic standing pose', 'in dynamic casting pose, raising one hand high crackling with orange energy as geometric sigils float around her')
        .replace('Two crossed star-iron blades held at her sides', 'Her star-iron blades sheathed, hands channeling spiritual magic');
    }
    if (id === 'kofi') {
      return basePrompt
        .replace('standing centered, cradling', 'in dynamic casting pose, strumming his kora with intensity as glowing sound-wave rings and concentric light circles expand outward')
        .replace('Calm wise expression', 'Concentrated powerful expression');
    }
    if (id === 'zara') {
      return basePrompt
        .replace('standing centered with both hands raised', 'in dynamic casting pose, floating slightly, both arms extended and weaving a web of glowing orange star-fire and celestial threads')
        .replace('glowing spirit orbs floating between her fingers', 'glowing spirit orbs orbiting rapidly like a solar storm');
    }
    return basePrompt.replace('standing pose', 'dynamic casting pose, channeling energy with geometric sigils floating around');
  }

  return basePrompt;
}

// ── Placeholder generator (for --dry-run) ───────────────────────────────────
async function createPlaceholderWithSharp(sharp, id, pose, kind) {
  const size = 1024;
  const isChamp = kind === 'champion';
  const bgColor = isChamp ? '#1c0f06' : '#0b0403';
  const accentColor = isChamp ? '#ff6a1a' : '#e8431a';
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.38}" fill="${bgColor}" stroke="${accentColor}" stroke-width="6"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.28}" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.5"/>
    <text x="${size/2}" y="${size/2 - 40}" text-anchor="middle" fill="#ffab47" font-size="28" font-family="monospace" font-weight="bold">${id}</text>
    <text x="${size/2}" y="${size/2}" text-anchor="middle" fill="#ffd9a0" font-size="24" font-family="monospace" font-weight="bold">${pose.toUpperCase()}</text>
    <text x="${size/2}" y="${size/2 + 40}" text-anchor="middle" fill="#f3e8d8" font-size="18" font-family="monospace">${kind}</text>
    <text x="${size/2}" y="${size/2 + 70}" text-anchor="middle" fill="${accentColor}" font-size="14" font-family="monospace">[placeholder]</text>
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
    // trim fails on completely empty images or minor edge cases
  }

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

// ── Generate single variation ───────────────────────────────────────────────
async function generateVariation(openai, OpenAI, sharp, entity, pose) {
  const { id: baseId, kind, prompt: basePrompt } = entity;
  const variationId = `${baseId}_${pose}`;
  const outPath = join(SPRITES_DIR, `${variationId}.png`);
  const baseSpritePath = join(SPRITES_DIR, `${baseId}.png`);

  if (!FORCE && existsSync(outPath)) {
    console.log(`    ⏭ ${variationId} — already exists, skipping`);
    return variationId;
  }

  // Ensure base sprite exists
  if (!existsSync(baseSpritePath)) {
    throw new Error(`Base sprite '${baseId}.png' not found in assets/sprites/. Run 'npm run sprites' first!`);
  }

  console.log(`    🖌 Generating ${variationId}...`);

  if (DRY_RUN) {
    const buf = await createPlaceholderWithSharp(sharp, baseId, pose, kind);
    writeFileSync(outPath, buf);
    console.log(`      ✓ placeholder written`);
    return variationId;
  }

  const variationPrompt = getVariationPrompt(baseId, basePrompt, pose);
  const fullPrompt = `${STYLE_BIBLE} Subject: ${variationPrompt}`;

  // Read base sprite as input image
  const baseBuf = readFileSync(baseSpritePath);
  const baseFile = await OpenAI.toFile(baseBuf, `${baseId}.png`, { type: 'image/png' });

  const result = await withRetry(async () => {
    return openai.images.edit({
      model: 'gpt-image-2',
      image: baseFile,
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
    });
  });

  logCost(baseId, pose, 'edit', 'gpt-image-2');

  const b64 = result.data[0].b64_json;
  const rawBuf = Buffer.from(b64, 'base64');

  const processed = await postProcess(sharp, rawBuf);
  writeFileSync(outPath, processed);
  console.log(`      ✓ saved (${Math.round(processed.length / 1024)}KB)`);
  return variationId;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ÀṢẸ — Sprite Variation Generator                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${DRY_RUN ? '🧪 DRY RUN (placeholders)' : '🎨 LIVE (API calls)'}`);
  console.log(`  Force: ${FORCE}`);
  if (ID_FILTER) console.log(`  Filter: ${ID_FILTER.join(', ')}`);
  console.log();

  // Load manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_IN, 'utf8'));
  
  // Filter for champions only, and optionally apply ID filter
  let champions = manifest.filter(e => e.kind === 'champion');
  if (ID_FILTER) {
    champions = champions.filter(e => ID_FILTER.includes(e.id));
  }

  if (champions.length === 0) {
    console.log('❌ No champions found matching criteria.');
    process.exit(0);
  }

  console.log(`  Found ${champions.length} champions to process: ${champions.map(c => c.id).join(', ')}`);
  console.log();

  // Ensure output directory
  mkdirSync(SPRITES_DIR, { recursive: true });

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
      openai = new OpenAI({ apiKey, timeout: 120 * 1000 }); // 2 minutes timeout to prevent hangs
      OpenAIClass = OpenAI;
    } catch (err) {
      console.error('❌ openai SDK not installed. Run: npm install openai');
      process.exit(1);
    }
  }

  const poses = ['attack', 'block', 'skill'];

  console.log('━━━ Processing Champions ━━━');
  for (const champion of champions) {
    console.log(`• Champion: ${champion.id}`);
    for (const pose of poses) {
      try {
        await generateVariation(openai, OpenAIClass, sharp, champion, pose);
      } catch (err) {
        console.error(`      ❌ Pose '${pose}' failed: ${err.message}`);
      }
    }
    console.log();
  }

  // Write/Update output manifest
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
  console.log(`📋 Manifest updated: ${allPngs.length} total sprites → assets/sprites/manifest.json`);

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

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import './proxy-bootstrap.js';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Manually parse .env if present
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (key && value) {
      process.env[key] = value;
    }
  }
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in process.env or .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

const SPRITES_DIR = join(ROOT, 'assets', 'sprites');
const MANIFEST_PATH = join(SPRITES_DIR, 'manifest.json');
const SPRITES_MANIFEST_IN = join(__dirname, 'sprites.manifest.json');

async function main() {
  const spriteManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const manifestIn = JSON.parse(readFileSync(SPRITES_MANIFEST_IN, 'utf8'));

  const infoMap = new Map();
  for (const item of manifestIn) {
    infoMap.set(item.id, item.kind);
  }

  const ids = spriteManifest.ids;
  console.log(`Checking ${ids.length} sprites...`);

  const results = [];

  for (const id of ids) {
    const imgPath = join(SPRITES_DIR, `${id}.png`);
    if (!existsSync(imgPath)) {
      console.warn(`⚠ Image not found: ${imgPath}`);
      continue;
    }
    const imgBuffer = readFileSync(imgPath);
    const base64Image = imgBuffer.toString('base64');
    
    let baseId = id;
    for (const suffix of ['_attack', '_block', '_skill']) {
      if (id.endsWith(suffix)) {
        baseId = id.slice(0, -suffix.length);
        break;
      }
    }
    
    const kind = infoMap.get(baseId) || 'unknown';

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: "Analyze the direction this entity/character sprite is facing. It is in a bold woodcut/risograph style with transparent background. Respond with exactly one word: 'left' (if they face left, e.g. their head/torso/gaze is oriented towards the left), 'right' (if they face right, e.g. oriented towards the right), or 'center' (if they are completely symmetrical, face straight forward, or have no distinct direction)."
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 10,
        temperature: 0
      });

      const direction = response.choices[0].message.content.trim().toLowerCase().replace(/[^a-z]/g, '');
      console.log(`Sprite: ${id.padEnd(25)} | Kind: ${kind.padEnd(8)} | Facing: ${direction}`);
      
      // Determine if wrong
      let isWrong = false;
      if (kind === 'champion') {
        // Champions should face right (or center)
        if (direction === 'left') {
          isWrong = true;
        }
      } else if (kind === 'enemy') {
        // Enemies should face left (or center)
        if (direction === 'right') {
          isWrong = true;
        }
      }

      results.push({ id, kind, direction, isWrong });
    } catch (err) {
      console.error(`Error checking ${id}: ${err.message}`);
      results.push({ id, kind, direction: 'error', isWrong: false });
    }

    // Wait a tiny bit to avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  // Write results json
  writeFileSync(join(__dirname, 'facing-audit.json'), JSON.stringify(results, null, 2));

  console.log('\n=== WRONG FACING DIRECTION ===');
  const wrong = results.filter(r => r.isWrong);
  if (wrong.length === 0) {
    console.log('None! All sprites face the correct direction.');
  } else {
    for (const item of wrong) {
      console.log(`❌ ${item.id} (${item.kind}) is facing ${item.direction} (WRONG)`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

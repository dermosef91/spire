# Sprite Generator — ÀṢẸ: Ascend the Obsidian Spire

Dev-only tooling for generating consistent, on-theme PNG sprites using the
OpenAI image API.

## Overview

The generator reads `sprites.manifest.json` (entity IDs + per-entity prompts),
generates sprites conditioned on a shared "style-key" reference image for visual
consistency, then post-processes each output (trim, resize to 512×512, palette
quantize) and writes the results to `assets/sprites/`.

The game's `src/ui/sprites.js` checks `assets/sprites/manifest.json` at runtime
and swaps PNG sprites into the existing medallion / character-select glyphs.
When a sprite is missing or fails to load, it silently falls back to the original
inline SVG models.

## Quick Start

```bash
# Install dev-only dependencies (NOT used by the game)
cd tools && npm install && cd ..

# Dry-run: generates placeholder PNGs, no API key needed
node tools/gen-sprites.js --dry-run

# Live generation (requires OpenAI API key)
export OPENAI_API_KEY=sk-...
node tools/gen-sprites.js

# Regenerate everything (ignores cache)
node tools/gen-sprites.js --force

# Generate specific entities only
node tools/gen-sprites.js --ids amara,kofi,husk_drone
```

## Files

| File | Description |
|------|-------------|
| `sprites.manifest.json` | Input: entity IDs, kinds, and art-direction prompts |
| `gen-sprites.js` | The generator script (Node ESM) |
| `package.json` | Dev dependencies: `openai`, `sharp` |

## Output

Generated files go to `assets/sprites/`:

| File | Description |
|------|-------------|
| `style-key.png` | Style reference image (used for conditioning) |
| `<id>.png` | Per-entity sprite (512×512, transparent BG) |
| `manifest.json` | Runtime manifest listing available sprite IDs |

## GitHub Action

The generator can also run via GitHub Actions:

1. Add `OPENAI_API_KEY` as a repository secret
2. Go to **Actions → Generate Sprites → Run workflow**
3. The action generates sprites and commits PNGs to the branch

See `.github/workflows/sprites.yml`.

## Art Direction

All sprites follow the "Incandescent" style bible:

- **Medium**: Afrofuturist woodcut / risograph illustration
- **Palette**: Black, ember orange `#ff6a1a`, deep ember `#e8431a`, amber `#ffab47`, cream `#f3e8d8`
- **Subject**: Single full-figure character, centered, transparent background
- **Output**: 512×512 PNG, palette-quantized for consistency

## Consistency Strategy

1. A "style-key" reference image is generated first (neutral robed figure)
2. Every entity is generated via `images.edit` conditioned on the style-key
3. Post-processing quantizes colors back toward the theme palette
4. Future multi-pose sprites will be conditioned on each entity's master image

## Cost

Approximate costs per generation (gpt-image-2 at 1024×1024):
- Style key: ~$0.04
- Each entity: ~$0.04
- Full run (18 entities + key): ~$0.76

The generator prints a cost summary after each run.

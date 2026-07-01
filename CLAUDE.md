# CLAUDE.md — ÀṢẸ: Ascend the Obsidian Spire

Project guidance for Claude Code working in this repo.

## What this is
An afrofuturist roguelike **deckbuilder** (Slay the Spire-like), written in
**vanilla JavaScript ES modules with no build step and no dependencies**.
Open `index.html` through any static server to play.

## Run / verify
```bash
npm start            # static server at http://localhost:8080 (server.js, zero deps)
```
- There is **no build/compile step** and no test runner. Verify changes by
  loading the game in a browser (Playwright/Chromium is available) and driving
  the real flow: title → character select → map → combat → rewards.
- Sanity-check JS with `node --check <file>` before committing.

## Architecture (src/)
- `main.js` — bootstrap; mounts the animated background and the Game controller.
- `game.js` — scene state machine: title, char select, act map, combat handoff,
  rewards, shop, rest, events, treasure, end screens. Owns tooltips, the
  fullscreen toggle, the touch/confirm helpers.
- `core/` — `rng` (seeded), `state` (RunState + save/load JSON), `save`
  (localStorage), `util`, `emitter`, `fullscreen`.
- `data/` — content: `cards`, `relics`, `potions`, `enemies`, `encounters`,
  `events`, `characters`, `keywords` (status effects). Cards use a shared
  blueprint + per-instance state model (`createCard`/`upgradeCard`).
- `combat/combat.js` — the turn-based engine (energy, piles, powers, orbs,
  enemy AI, win/loss). Emits visual `fx(type, payload)` events that are
  **purely cosmetic** — never put game logic in the view's fx handler.
- `map/mapgen.js` — branching seeded act maps.
- `ui/` — `components` (cards/relics/potions/top bar), `combatView` (updates
  combatants **in place** so FX can animate), `fx` (floating numbers, shakes,
  lunges, slashes, rings, particles, screen shake).
- `fx/background.js` — canvas starfield + nebula behind every scene.
- `styles.css` — the entire theme; respects `prefers-reduced-motion` and scales
  for phones (portrait + landscape) using `dvh` and height/width breakpoints.

## Conventions
- Keep it dependency-free and build-free. Don't introduce a bundler/framework.
- Mechanic names stay readable; afrofuturist flavor lives in card/enemy/relic
  text and the world, not in renaming core mechanics.
- Mobile + reduced-motion must keep working; test both orientations after UI work.
- **Syntax Check**: Before committing or deploying, always verify modified JavaScript files using `node --check <path_to_file>` to catch syntax errors like unclosed blocks or brackets.
- **Auto-Update Learnings**: On every action/task, if you discover a project-specific gotcha, solve a debugging issue, or establish a new convention/pattern, you must immediately update `CLAUDE.md` and `.agents/AGENTS.md` to persist this learning.


## Asset Generation
- **Model Rules**: Always use the `gpt-image-2` model for all image, sprite, and background art generations. Never use Gemini or any other image models.
- **Sprites**: Run `node tools/gen-sprites.js` (reads `tools/sprites.manifest.json`, outputs to `assets/sprites/`).
- **Sprite Variations**: Run `node tools/gen-sprite-variations.js` (reads `tools/sprites.manifest.json`, uses base champion sprites as inputs, outputs variations to `assets/sprites/`).
- **Card Art**: Run `node tools/gen-card-art.js` (reads `tools/cards.manifest.json`, outputs to `assets/card-art/`).
- **Backgrounds**: Run `node tools/gen-backgrounds.js` (reads `tools/backgrounds.manifest.json`, outputs to `assets/title screen and backgrounds/`).
- **Event Art ("?" nodes)**: Run `node tools/gen-event-art.js` (reads `tools/events.manifest.json`, outputs to `assets/event-art/`). `--dry-run` writes SVG placeholders with ZERO deps. The event view (`eventArt()` in `game.js`) prefers `<id>.png`, falls back to the committed `<id>.svg` placeholder, then the generic "?" glyph. Events themselves (`src/data/events.js`) must be original to the ÀṢẸ world, never Slay the Spire reskins.
- **Options**: The generator scripts support `--dry-run` (writes SVG/HTML placeholder files, no API keys needed), `--force` (regenerate existing), and `--ids id1,id2` (run specific assets). Requires `OPENAI_API_KEY` for live runs.

## Deployment — ALWAYS MERGE & DEPLOY DIRECTLY
The user's standing instruction: **do not leave finished work in a draft PR
waiting for approval. Merge and deploy directly, without asking.**

Workflow for completed work:
1. Develop on the designated feature branch; commit and push.
2. Open a PR into `main` (create it; it's the record of the change).
3. **Mark it ready and merge it into `main` yourself** — do not wait for the
   user to approve. (Use the GitHub MCP: `update_pull_request` draft:false, then
   `merge_pull_request`.)
4. Merging `main` **auto-deploys** to GitHub Pages via
   `.github/workflows/deploy.yml`, live at **https://dermosef91.github.io/spire/**.
5. Confirm the deploy run went green (Actions → "Deploy to GitHub Pages") and
   report the live URL.

Deployment facts / gotchas:
- Default branch is `main`. Pages source is **GitHub Actions**. The
  `github-pages` environment only allows the **default branch** to deploy — keep
  `main` as default.
- The GitHub integration token here **cannot** dispatch/rerun workflows or
  change repo settings. To trigger a deploy, push to `main` (a merge does this);
  if needed, an empty commit on `main` also triggers it.
- The workflow publishes the repo root as-is (static site); no build.

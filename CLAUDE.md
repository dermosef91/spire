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
- **Browser-test gotcha**: `playwright-core` can be installed on demand
  (`npm install playwright-core --no-save`) and launched with
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`,
  `args: ['--no-sandbox']`. Do **not** wait on `networkidle` — the looping
  music/animation keeps the network "busy" forever; use `domcontentloaded` plus
  explicit `waitForTimeout`. `window.__ase` exposes the live Game for asserting
  run state (e.g. `__ase.run.ascension`) **and for driving scenes directly** —
  `__ase.showTitle()`, `__ase.showCharSelect()`, `__ase.startRun('amara')`
  (lands on the act-intro), `__ase.showMap()`, `__ase.startMonster()` — far more
  reliable than clicking through the UI. Set `localStorage`'s
  `spire_of_ase_meta_v1` `tutorialDone:true` (via `addInitScript`) before combat
  so the first-play tutorial overlay doesn't block the shot.
- **QA screenshot / responsiveness audit**: `npm run qa`
  (`node tools/qa-screenshots.js`) boots the game, drives title → char select →
  map → combat at a landscape phone (812×375) **and** a desktop (1366×850)
  viewport, screenshots each (JPEG, into `docs/qa/`), and flags layout problems
  (horizontal overflow, controls clipped/off-screen, hand cards overlapping the
  pinned energy orb / End Turn). A clean run reports `0 issue(s)`; the committed
  `docs/qa/*.jpg` are the baseline. Regenerate + eyeball after any layout change.

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
  lunges, slashes, rings, particles, screen shake), `tutorial` (first-play
  coaching banner — see below).
- `fx/background.js` — canvas starfield + nebula behind every scene.
- `styles.css` — the entire theme; respects `prefers-reduced-motion` and scales
  for phones (portrait + landscape) using `dvh` and height/width breakpoints.

## First-play tutorial
- `src/ui/tutorial.js` (`CombatTutorial`) is a single **coaching banner** pinned
  to the top of the screen, shown once on the **first-ever combat**, gated by
  `meta.tutorialDone` (persisted via `save.js`; set `true` when it finishes **or**
  is skipped). `game.js`'s `beginCombat` kicks it off ~800ms after `view.mount`
  (letting the opening draw settle) when `!meta.tutorialDone && kind==='monster'`.
- It never touches game logic and never blocks the board — the banner is small
  and the rest of the screen stays fully playable. It reads live combat state
  (`energy`, `hand`, `turn`, `over`) by **chaining** `combat.onUpdate` (restores
  the original on finish). Steps are a short array: text plus either a `button`
  (advance on click) or `await: 'play' | 'endturn'` (auto-advance when the
  snapshotted energy/hand/turn changes). No spotlight, positioning math, or
  click-catchers — deliberately minimal.
- To re-test it, clear `localStorage` (or just the `spire_of_ase_meta_v1` key).
  Styles live under the "first-play tutorial" block in `styles.css` and honor
  `prefers-reduced-motion`.

## Conventions
- Keep it dependency-free and build-free. Don't introduce a bundler/framework.
- Mechanic names stay readable; afrofuturist flavor lives in card/enemy/relic
  text and the world, not in renaming core mechanics.
- Mobile + reduced-motion must keep working; test both orientations after UI work.
- **No emoji, anywhere in-game**: all iconography (enemy/character art, status
  effects, intents, UI chrome) is custom line-art SVG from `src/ui/icons.js`
  (`UI`, `INTENT`, `NODE`, `POWER_SVG`/`powerIcon()`, `RELIC_SVG`/`relicIcon()`,
  `CARD_MOTIF`/`cardArt()`, `CHAR`/`characterModel()`, `ENE`/`enemyModel()`) or
  a real sprite (`src/ui/sprites.js`). Data files (`enemies.js`, `characters.js`,
  `keywords.js`) must **not** carry emoji fields (e.g. a `glyph: '👹'` or
  `icon: '💪'`) even if nothing currently renders them — dead emoji data has a
  way of getting wired up again by accident. When adding a floating combat
  effect that needs an icon, use `floatHTML()` (fx.js) with a `<i
  class="pip-ic">${powerIcon(key)}</i>` payload, not `floatText()` with a raw
  icon character — `floatText` is for plain numbers/words only. This does not
  apply to the handful of monochrome typographic dividers (`❖`, `❘`, `✦` in
  `game.js`), which are dingbat punctuation, not pictographic emoji, and to
  emoji used only in dev-tooling console logs (`tools/gen-*.js`), which never
  reach the player.
- **Card-choice ("pick a card") popup** (`Game.cardChoiceOverlay` in `game.js`,
  `.card-picker` in `styles.css`) shows options at a fixed w:h card aspect
  ratio (`--card-h: clamp(232px, 25vw, 320px)`, `--card-w: calc(var(--card-h) *
  0.7)`) rather than the shop/deck overlays' `height:auto; min-height:`
  grow-to-fit-text trick — that trick stretches every card in the row to match
  the tallest via `align-items:stretch`, which looks fine for the shop's
  shorter cards but reads as an odd tall slab with dead space for the picker's
  three big cards. The floor (232px) is sized so even the longest card
  description in the game (`the_long_song`, ~106 chars) fits without clipping
  on a narrow phone; `.card-desc` is top-aligned there (not the usual
  vertically-centered) so if some future longer text *does* overflow, it trims
  cleanly off the bottom instead of a centered clip eating both the start and
  end of the sentence. Selection is two-tap: first tap adds `.selected`
  (bigger + glowing) and — since touch never fires `mouseenter` — also calls
  `this.tooltip(c, node, true, 'card')` straight from the click handler so the
  full text is always reachable even if it's visually truncated; tapping the
  *same* card again confirms and closes the overlay, tapping a *different*
  card switches the selection instead. The popup still relies on
  `.overlay-box`'s existing `overflow-y:auto`/`max-height:88vh` to stay usable
  on short landscape phones (812×375), where the fixed card height leaves no
  room for the hint + Skip row — confirmed by driving `box.scrollTop` in a
  Playwright check, not a new mechanism.
- **Syntax Check**: Before committing or deploying, always verify modified JavaScript files using `node --check <path_to_file>` to catch syntax errors like unclosed blocks or brackets.
- **Auto-Update Learnings**: On every action/task, if you discover a project-specific gotcha, solve a debugging issue, or establish a new convention/pattern, you must immediately update `CLAUDE.md` and `.agents/AGENTS.md` to persist this learning.
- **Landscape-phone breakpoint (`@media (max-height: 560px)`)**: this is the
  single hook for short viewports. `.title` and `.charselect` are plain
  vertically-centered/stacked layouts sized for tall screens — on a short
  landscape phone their content (title + up to 4 buttons; 3 full char cards)
  overflows the fold, so compact overrides for them live in a **second**
  `@media (max-height: 560px)` block placed after `.char-glyph`'s base rule
  (styles.css, near the "character-select portrait" section) — a rule inside
  a media query does **not** out-rank a later non-media rule of equal
  specificity, so an override must be placed after what it overrides in
  source order regardless of the media query. In `.combat-scene`, only
  `.battlefield` is absolutely positioned; `.combat-topbar`/`.combat-log`/
  `.hand` are normal flex-column children and `.combat-log`'s
  `margin-top: auto` shoves the log+hand flush to the bottom, so `.hand`'s
  bottom edge sits right at the viewport edge — the fanned card dip
  (`--shift`/`--angle` from combatView.js, rotate+translateY) needs generous
  `padding-bottom` on `.hand` or it gets cropped by `.combat-scene`'s
  `overflow: hidden`. `.combat-controls` (energy orb + End Turn) is
  absolutely positioned and pinned to fixed screen-relative spots regardless
  of hand width, so a wide fanned hand can slide underneath it — give `.hand`
  `margin-left`/`margin-right` (not `max-width` + `margin: auto`, which
  centers instead of tracking the asymmetric energy-orb/End-Turn insets)
  computed with the **same `%`-based `calc()`** pattern as
  `.combat-controls` (e.g. `calc(max(0px, (100% - 780px) / 2) + Npx)`) so the
  safe zone tracks exactly; using `100vw` instead of `100%` is wrong here
  because `.combat-scene` is itself inset from the viewport by a few px, so
  `100vw`-based math drifts from `.combat-controls`' real position. **The same
  crop + overlap bites the *desktop* combat too** (the base `.hand` rule, used
  by the `@media (min-width:1024px) and (min-height:650px)` block, originally
  had only `6px` bottom padding and an uncapped dip): the fanned hand got
  cropped at the bottom and its edge cards slid under the energy orb / End Turn.
  Fixed by (a) bumping the base `.hand` `padding-bottom` to `30px` and capping
  the base `.card.in-hand` resting dip at `translateY(min(var(--shift),18px))`,
  and (b) in the desktop breakpoint, adding the same `%`-based `calc()`
  safe-zone margins **plus** a slightly smaller `--card-h` cap (176px vs 194px).
  The card-size cap is essential because `.hand` uses `justify-content:center`:
  margins alone can't push a too-wide fanned hand off a corner control (the
  overflow just re-centers) — the whole rotated hand bbox must actually *fit*
  the band between the controls. `qa-screenshots.js` regression-tests all four
  of these (bottom crop + both control overlaps) at both viewports.


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

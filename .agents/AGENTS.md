# Rules for ÀṢẸ Development

- Always use the `gpt-image-2` model for all image, sprite, and background art generations.
- Never use Gemini or any other image models for generating assets.
- **Syntax Check**: Before committing or deploying, always verify modified JavaScript files using `node --check <path_to_file>` to catch syntax errors like unclosed blocks or brackets.
- **Events ("?" nodes)**: Story events live in `src/data/events.js` and must be original to the ÀṢẸ world (Sunken Market / Brass Archive / Static Crown) — never reskins of Slay the Spire events. Each event has an `art` id; the view (`eventArt()` in `game.js`) shows `assets/event-art/<art>.png`, falling back to a committed `.svg` placeholder, then the generic "?" glyph. Generate art with `node tools/gen-event-art.js` (reads `tools/events.manifest.json`); `--dry-run` writes SVG placeholders with ZERO deps.
- **Auto-Update Learnings**: On every action/task, if you discover a project-specific gotcha, solve a debugging issue, or establish a new convention/pattern, you must immediately update `CLAUDE.md` and `.agents/AGENTS.md` to persist this learning.
- **Landscape-phone breakpoint (`@media (max-height: 560px)`)** is the single hook for short viewports; see the detailed note in `CLAUDE.md` before touching `.title`, `.charselect`, or `.hand`/`.combat-controls` layout — CSS cascade order (not media-query nesting) decides which override wins, and `.combat-controls` uses fixed screen-relative positions that `.hand` must track with matching `%`-based `calc()` math, not `100vw`.
- **Browser testing**: install `playwright-core --no-save`, launch Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with `--no-sandbox`. Never wait on `networkidle` (looping audio/rAF never idles) — use `domcontentloaded` + `waitForTimeout`. `window.__ase` is the live Game instance for asserting run state.
- **Animated background** (`src/fx/background.js`) exports a `background()` singleton controller: `setAct(act)`, `setCombat(on)`, `pulse(kind, power)`. It's act-themed (palette per act) and reacts to combat FX; keep new pulses reduced-motion-safe.
- **Ascension** lives in `core/state.js` (`ASCENSION_LEVELS`, `MAX_ASCENSION`, `run.enemyHpMult`, `run.restHealFraction`). Levels are cumulative; unlocked one at a time by winning at the current max. Meta keys: `maxAscension` (unlocked) and `ascension` (last selected).



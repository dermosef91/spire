# Rules for ÀṢẸ Development

- Always use the `gpt-image-2` model for all image, sprite, and background art generations.
- Never use Gemini or any other image models for generating assets.
- **Syntax Check**: Before committing or deploying, always verify modified JavaScript files using `node --check <path_to_file>` to catch syntax errors like unclosed blocks or brackets.
- **Events ("?" nodes)**: Story events live in `src/data/events.js` and must be original to the ÀṢẸ world (Sunken Market / Brass Archive / Static Crown) — never reskins of Slay the Spire events. Each event has an `art` id; the view (`eventArt()` in `game.js`) shows `assets/event-art/<art>.png`, falling back to a committed `.svg` placeholder, then the generic "?" glyph. Generate art with `node tools/gen-event-art.js` (reads `tools/events.manifest.json`); `--dry-run` writes SVG placeholders with ZERO deps.
- **Auto-Update Learnings**: On every action/task, if you discover a project-specific gotcha, solve a debugging issue, or establish a new convention/pattern, you must immediately update `CLAUDE.md` and `.agents/AGENTS.md` to persist this learning.



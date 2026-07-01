# QA — screenshot & responsiveness audit

Automated visual QA for the four key scenes (title, character select, act map,
combat) at two viewports:

- **Mobile landscape** — 812×375 (trips the `@media (max-height: 560px)` breakpoint)
- **Desktop** — 1366×850 (trips the `@media (min-width:1024px) and (min-height:650px)` breakpoint)

## Run

```bash
npm run qa            # or: node tools/qa-screenshots.js
```

It boots the real game in Chromium (via `playwright-core`, installed on demand),
drives it through each scene using the live `window.__ase` Game instance,
screenshots each, and runs an in-page layout audit. Output — the screenshots
plus `report.md` / `report.json` — is (re)written to this folder.

## What the audit flags

- **horizontal-overflow** — the document scrolls sideways (content wider than the viewport).
- **control-clipped / control-offscreen** — a button, card, map node, energy orb,
  End Turn, or pile extends past (or fully off) the viewport edge.
- **hand-under-controls** — a fanned hand card overlaps the pinned energy orb or
  End Turn button (compared against the *visible* controls, not the full-width
  `.combat-controls` bar).

A clean run reports `0 issue(s)`. The committed screenshots are the current
baseline; regenerate and eyeball them after any layout/CSS change.

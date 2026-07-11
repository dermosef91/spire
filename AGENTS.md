# AGENTS.md — ÀṢẸ: Ascend the Obsidian Spire

Project guidance for Codex working in this repo.

## What this is
An afrofuturist roguelike **deckbuilder** (Slay the Spire-like), written in
**vanilla JavaScript ES modules with no build step and no dependencies**.
Open `index.html` through any static server to play.

## Run / verify
```bash
npm start            # static server at http://localhost:8080 (server.js, zero deps)
```
- There is **no build/compile step**. Two test suites exist (plain Node, the
  game itself stays zero-dependency):
  - `npm test` (`tools/test.js`) — fast headless **logic** tests for the
    DOM-free core (rng, run-state, mapgen, cards, combat). Run this after any
    engine/data change.
  - `npm run smoke` (`tools/smoke.js`) — headless-browser **end-to-end** smoke
    that boots the real site and drives title → New Run → character → map →
    combat, failing on any uncaught JS/console error. Run this after touching
    `game.js` / `scenes/` / `ui/`. Uses the ambient Playwright/Chromium; it is
    **not** a project dependency.
  - Both run in CI on every push/PR via `.github/workflows/check.yml` — keep
    them green (and confirm the check run passed) before self-merging to `main`.
- Beyond the suites, still eyeball the real flow in a browser for anything
  visual, and sanity-check JS with `node --check <file>` before committing.
- **Browser-test gotcha**: `playwright-core` can be installed on demand
  (`npm install playwright-core --no-save`) and launched with
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` (which falls back to the default macOS Google Chrome location on Darwin),
  `args: ['--no-sandbox']`. Do **not** wait on `networkidle` — the looping
  music/animation keeps the network "busy" forever; use `domcontentloaded` plus
  explicit `waitForTimeout`. `window.__ase` exposes the live Game for asserting
  run state (e.g. `__ase.run.ascension`) **and for driving scenes directly** —
  `__ase.showTitle()`, `__ase.showCharSelect()`, `__ase.startRun('amara')`
  (lands on the act-intro), `__ase.showMap()`, `__ase.startMonster()` — far more
  reliable than clicking through the UI. Set `localStorage`'s
  `spire_of_ase_meta_v1` `tutorialDone:true` (via `addInitScript`) before combat
  so the first-play tutorial overlay doesn't block the shot. Also, when selecting cards
  dynamically via Playwright (e.g., during tutorial coaching steps), avoid chaining dynamic
  styling classes like `.tut-highlight` directly in click locators. Because the hand is
  cleared and rebuilt in the DOM on changes, these classes can be temporarily missing
  until next-tick updates reapply them. Instead, fetch the card's `data-uid` attribute first
  and target the element specifically using `[data-uid="..."]`.
- **QA screenshot / responsiveness audit**: `npm run qa`
  (`node tools/qa-screenshots.js`) boots the game, drives title → char select →
  map → combat at a landscape phone (812×375) **and** a desktop (1366×850)
  viewport, screenshots each (JPEG, into `docs/qa/`), and flags layout problems
  (horizontal overflow, controls clipped/off-screen, hand cards overlapping the
  pinned energy orb / End Turn). A clean run reports `0 issue(s)`; the committed
  `docs/qa/*.jpg` are the baseline. Regenerate + eyeball after any layout change.
  **Gotcha**: the qa run wipes/recreates `docs/qa/`, which deletes the committed
  `docs/qa/README.md` — `git checkout -- docs/qa/README.md` to restore it before
  committing. Also, because combat now opens deferred (Battle Start banner, then
  `combat.start()` ~650ms later) and the opening 5-card draw itself takes up to
  ~830ms more to fully fan in (see the `notify()` coalescing note below), the
  `combat` scene's `settle` in `tools/qa-screenshots.js` needs ~1800ms total —
  if you touch either of those timings, re-check the combat shot for a card
  still mid-flight overlapping the End Turn button.

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
  Cosmetic-pacing events: `announce` (`{text,kind,subtext}` →
  `CombatView.announce()`), `enemyPhaseStart`/`enemyPhaseEnd` (quiet/restore the
  player UI), and `enemyActing`/`enemyActed` (spotlight one foe at a time).
  `enemyMove` renders the move-name callout. `enemyMovePacing()` in
  `combat/presentation.js` owns the one fixed cadence: utility 480/390ms,
  attacks 560/440ms, heavy attacks 680–720/560ms (read/settle). Keep those
  anticipation and recovery waits; they make the action name read before the
  consequence without adding a fast-mode branch. `endTurn` also `await`s
  a further 460ms after `enemyPhase()` returns, before calling
  `startPlayerTurn(false)`, so "Your Turn" doesn't fire in the same instant the
  last enemy's hit lands; skipped when `this.over` (no point pausing before a
  win/loss screen).
  Combat also **opens deferred**: monster/elite/boss marquees call
  `combat.start()` after 650/1250/1500ms, so the opening draw plays *after* the
  popup; `beginCombat`'s monster-tutorial kickoff (~1700ms) is timed to that.
  Elite/boss identity is view-only: `.encounter-elite`/`.encounter-boss`, rank
  subtitles, enrage countdowns, and `hp-phase-marker` must not drive logic.
  Because combat start is deferred, `build()` initializes every combatant via
  `updateCombatant()` immediately; otherwise intro nameplates stay blank until
  the first engine `notify()` beneath the marquee.
  `Combat.notify()` **coalesces same-tick calls** via a microtask
  (`Promise.resolve().then(...)`, guarded by `_notifyScheduled`) into one
  deferred `onUpdate()` — added because several call sites (e.g.
  `startPlayerTurn`: `draw()` fires a `notify()` internally, then the method
  fires another right after to refresh the log) used to trigger **two**
  synchronous `renderHand()` calls in the same tick. `renderHand()` fully
  tears down and rebuilds the hand's DOM on every call, so the second render
  destroyed the first render's newly-hidden card nodes before their
  `requestAnimationFrame`-scheduled draw-pile-fly-in animation (`combatView.js`
  `renderHand`) could run — the cards still ended up in the right place, just
  silently teleported instead of animated, on *every* draw (opening hand
  included) since the fly-in was added. If you ever see a new cosmetic
  per-card animation silently not play despite the state change definitely
  happening, suspect a same-tick double-render racing an `requestAnimationFrame`
  callback before reaching for a bigger fix.
  Tap-to-play is **two-tap**: first tap sets `previewCard` (card straightens +
  enlarges via `.previewing`, `--angle/--shift` zeroed), second tap commits;
  drag-to-play bypasses the preview. Always compare `previewCard` / `pendingCard` against hand card items using `.uid` (not strict reference inequality/equality), as reference mismatches will break keyboard selectors and trigger redundant highlights. Node entry runs through `Game.veilTransition`
  (a `.scene-veil` fade) so combat/events don't snap in.
  **Touch drag-and-drop gotcha — don't call `setPointerCapture()` for touch
  pointers from a `pointermove` handler.** `dragMove`'s drag-vs-swipe
  disambiguation only knows a gesture is a deliberate drag once it has
  already moved ≥8px, so the `setPointerCapture()` call that locks the
  dragged card to receive further events necessarily happens from inside
  `pointermove`, not `pointerdown`. Verified against real touch input (via
  CDP `Input.dispatchTouchEvent`, not just synthetic `PointerEvent`s or
  Playwright mouse emulation — those don't reproduce this) that calling
  `setPointerCapture()` there fires a **spurious immediate
  `lostpointercapture`**, which `_dragCancel`/`cancelDrag()` treats as "the
  user let go" and tears the whole drag down (calls `update()`, which
  destroys and rebuilds the hand's DOM) before the drag ever really starts —
  so touch-dragging a card onto an enemy silently fails on real devices even
  though it works fine in every mouse/synthetic-event test. Fix: skip the
  explicit capture for `pointerType === 'touch'` entirely — touch pointers
  already get *implicit* capture to their initial target per the Pointer
  Events spec (confirmed: `pointermove` keeps landing on the card node with
  capture skipped), so nothing is lost; mouse/pen still need the explicit
  call since they have no implicit capture and would otherwise stop
  receiving events once the cursor strays off the (now-`position:fixed`,
  shrunk) card. Also set `touch-action: none` on the card once `d.moved`
  flips true and call `e.preventDefault()` in the touch branch of
  `dragMove`, so the browser's native `pan-x` scroll recognizer (the base
  `.hand .card { touch-action: pan-x }` rule that lets a horizontal swipe
  scroll the hand) can't compete with an in-progress drag as the finger
  drifts sideways toward an enemy; reset `node.style.touchAction = ''` in
  both `dragEnd` and `cancelDrag` (including the `preserveLayout` path,
  which reuses the same node) so a plain tap/swipe on the next touch keeps
  the native scroll-friendly behavior. When testing any touch-drag change,
  Playwright mouse-emulation and JS-dispatched `PointerEvent`s are **not
  sufficient** — they don't exercise the browser's real touch-action/capture
  pipeline; use `context.newCDPSession(page)` +
  `Input.dispatchTouchEvent('touchStart'/'touchMove'/'touchEnd', {
  touchPoints: [{x,y}] })` against a `hasTouch:true, isMobile:true` context.
  **Touch drag smoothness — use `transform`, not `left`/`top`, for per-frame
  positioning.** `dragMove` originally repositioned the lifted card every
  `pointermove` by writing `style.left`/`style.top`; those mutate the box's
  layout position and force a synchronous reflow on *every single event*,
  which is imperceptible in a headless per-call timing trace (each `dragMove`
  call still executes in <3ms) but visibly stutters on real phone hardware,
  where layout thrash competes with paint/composite for the frame budget.
  Fixed by anchoring `left`/`top` once, at the moment `d.moved` flips true
  (`d.baseX`/`d.baseY` capture the cursor position then), and driving every
  subsequent frame via `style.transform =
  translate3d(dx,dy,0) scale(1.06)` instead — compositor-only, no reflow.
  `.card.dragging` also gets `will-change: transform` so the browser
  promotes it to its own layer proactively. Reset `style.transform = ''`
  alongside the existing `style.touchAction = ''` reset in both `dragEnd`
  and `cancelDrag`. **Testing gotcha**: an automated drag-to-enemy check can
  look like a random regression if the dragged card is an `attack` and
  Rhythm mode is on (`meta.rhythm !== false`, the default) — `playCard()`
  then `await`s `runAttackQTE(...)`, which hangs waiting for timed QTE input
  the test never provides, so the hand length never updates. Not a real
  bug: either set `rhythm: false` in the seeded `spire_of_ase_meta_v1`
  localStorage before combat, or only assert on `type==='skill'` cards, when
  writing this kind of check.
  Enemies choose moves via `bp.pick(s, c, rng)`; prefer `rng.weighted(...)` +
  the player-state helpers in `enemies.js` (`playerLowHp`/`playerBlocked`/
  `playerLacks`/`selfLowHp`) over fixed `turn % n` cycles. A blueprint
  dmgCapPerTurn` field caps damage taken per player turn (Heart of Static's Invincibility) — enforced in `applyDamage`, reset in `startPlayerTurn`, shown as a display-only `invincibility` pip. Ascension per-hit damage scaling flows through `run.enemyDamageMult()` applied in `enemyAttack`. The thorns (Backlash) damage mechanic when attacked has been deactivated entirely to reduce intransparency, and all enemy-move references to `thorns` have been removed.
- `map/mapgen.js` — branching seeded act maps.
- `ui/` — `components` (cards/relics/potions/top bar), `combatView` (updates
  combatants **in place** so FX can animate), `fx` (floating numbers, shakes,
  lunges, slashes, rings, particles, screen shake), `tutorial` (first-play
  coaching banner — see below).
- `fx/background.js` — canvas starfield + nebula behind every scene.
- **Reactive combat environment (2026-07):** `CombatView.syncEnvironment()`
  derives presentation-only pressure, enemy advantage, phase, Blight, Tempo,
  and boss values from live combat state. It toggles `.env-*` classes/CSS
  variables on `.combat-scene` and calls `background().setCombatState()`; never
  feed these values back into mechanics. The stable `.combat-environment` layer
  owns vignette/haze/rhythm/crackle CSS, while `fx/background.js` eases matching
  canvas mood and draws expanding shockwaves for existing `pulse()` calls.
  `setCombat(false)` must zero every mood target so scenes after combat do not
  inherit it. Keep persistent mood separate from one-shot hit pulses and honor
  reduced motion in both layers.
- `styles.css` — the entire theme; respects `prefers-reduced-motion` and scales
  for phones (portrait + landscape) using `dvh` and height/width breakpoints.
- **Persistent status presence (2026-07):** every combatant owns one stable
  `.status-presence` layer built with its node. `updateStatusPresence()` maps
  live power state into seven orthogonal channels: armor plates, orbiting
  spirits, Blight corrosion, the 0–10 Tempo dial, Resolve rays, affliction
  static, and the Challenged mark. Do not rebuild the aura DOM during updates;
  toggle its `has-*` classes and CSS variables. `statusMoment()` owns awaken /
  expiry beats. Any mechanic that deletes a power outside `applyPower()` must
  emit `powerfade` (or its dedicated Tempo event) so presence never vanishes
  silently. All loops/flicker have reduced-motion fallbacks.

## First-play tutorial
- `src/ui/tutorial.js` (`CombatTutorial`) is a single **coaching banner** pinned
  to the top of the screen, shown once on the **first-ever combat**, gated by
  `meta.tutorialDone` (persisted via `save.js`; set `true` when it finishes **or**
  is skipped). `game.js`'s `beginCombat` kicks it off ~1700ms after `view.mount`
  (letting the deferred Battle-Start popup + opening draw settle) when
  `!meta.tutorialDone && kind==='monster'`.
- It never touches game logic and never blocks the board — the banner is small
  and the rest of the screen stays fully playable. It reads live combat state
  (`energy`, `hand`, `turn`, `over`) by **chaining** `combat.onUpdate` (restores
  the original on finish). Steps are a short array: text plus either a `button`
  (advance on click) or `await: 'block' | 'attack' | 'endturn'` (auto-advance
  when the right thing happens — see below). No full-screen spotlight or
  click-catchers — deliberately minimal.
- Six steps: (1) hand + Àṣẹ orb intro, (2) enemy intent, (3) play a Block
  skill, (4) play an Attack card, (5) end turn, (6) wrap-up. Steps 1–5 point at
  the relevant element(s) with a `.tut-highlight` class applied directly to
  the live DOM node(s) by selector (`applyHighlight()` uses
  `querySelectorAll`, so a selector matching several elements — e.g. step 1's
  `.hand .card`, one glow per card rather than a single box around the whole
  hand — highlights all of them) — no manual position math, so it works on
  any shape: `.hand .card`, `.energy-orb`, an enemy's `.intent` pill, a
  specific `.card[data-uid]`, `.end-turn`. `.tut-highlight` is a bright
  pulsing shine (`filter: brightness()/saturate()` + a soft glow `box-shadow`,
  `@keyframes tutShine`) — deliberately **not** a static outline/border, so it
  reads as "look here" rather than boxing the element in. `applyHighlight()`
  re-runs on every chained `onUpdate()` since combatView rebuilds the
  hand/controls/intent nodes from scratch each render.
- Step 2 (enemy intent) sets `align: 'left'` on its step config, which
  toggles `.tut-banner.tut-left` — the banner anchors to the left edge
  instead of centering, so it doesn't sit on top of the very intent pill
  it's pointing at on narrow/landscape-phone widths (verified: no bounding-box
  overlap at 812×375, 700×780, and 390×780). Any future step that highlights
  something near top-center should consider the same flag.
- Steps 3/4 snapshot the hand at render time, find the first card matching
  `isBlockCard`/`isAttackCard` (`type==='skill'&&block>0` / `type==='attack'`),
  and highlight it by `uid`; the step advances when that specific uid leaves
  the hand (i.e. it got played — playing a different card first doesn't
  advance early). If no matching card exists in that hand (rare, ~2-3% on a
  5-card starter draw), it falls back to advancing on any card played so the
  tutorial can't soft-lock.
- `game.js`'s `startMonster()` pins the run's very first monster fight (when
  `!meta.tutorialDone`) to `['husk_drone']` — a single enemy whose `pick()`
  guarantees an attack (`zap`) on turn 1 — so step 3's "the foe is about to
  strike" is always literally true, instead of depending on the normal
  weighted encounter table.
- To re-test it, clear `localStorage` (or just the `spire_of_ase_meta_v1` key).
  Styles live under the "first-play tutorial" block in `styles.css` and honor
  `prefers-reduced-motion`.

## Act map
- Restyled (2026-07) to read closer to Slay the Spire's own map: `showMap()`
  in `game.js` + the "map" block in `styles.css`. Nodes are **plain line-art
  glyphs, no circular badge** — `NODE`/`NODE_ICON` (`src/ui/icons.js`) render
  straight onto the board; all sizing lives on the `.map-node` wrapper div
  (`.map-node .svg-ic` just fills a percentage of it), so a bigger node is
  simply a bigger wrapper. `.map-node.current` and `.node-boss` get larger
  `width`/`height` rather than a `transform: scale()`, since scale is already
  used by the `:hover`/pulse animations on the *reachable* state and the two
  would fight.
- **Bottom row constraint**: The bottom row (row 0) must never contain more than 3 starting options. This is enforced during map generation in `src/map/mapgen.js` by sampling at most 3 starting columns (`Math.min(COLS, 3)`) using `rng.sample`, ensuring all carved paths start from one of these sampled columns.
- Each node gets a small **deterministic pixel jitter** — `jitter(row, col)`
  in `showMap()`, a hash of row/col (not `Math.random()`, so it's stable
  across re-renders) — so the grid reads hand-drawn instead of gridded. Both
  the node placement and the SVG `<line>` edges read positions through the
  same `posOf()` helper, so edges always terminate exactly on the (jittered)
  icon center they connect to.
- The scene is a **fixed-height flex column** that fills the viewport and
  scrolls internally: `.scene.map { height: 100dvh; overflow: hidden }` →
  `.map-scene` (`flex: 1`) → `.map-scroller` (`flex: 1`, its own
  `overflow-y: auto`). Use `height`, not `min-height`, on `.scene.map` — with
  `min-height` the flex item is free to grow taller than the container
  instead of scrolling internally, so the whole *page* scrolls (topbar and
  header included) instead of just the map board.
- **Art-direction pass (2026-07):** the map now leans into the painted act
  backdrop and reads like the reference concept art. There is **no headline**
  anymore (the old "The Sunken Market — choose your path upward" and the whole
  `.map-header`/`.map-title` are gone); the act name lives only in the top bar.
  The scene backdrop (`body.scene-map #bg-image`) shows at `opacity: 0.2` (up
  from 0.08) and `.map-scroller`'s gradient was made more translucent so the
  painting shows through behind the board while nodes keep contrast.
- The legend is an **always-on framed panel** (`.map-legend`, built as an
  `<aside>` in `showMap()`), pinned to the **right** of the board inside a
  `.map-body` flex row (`.map-scroller` flex:1, legend fixed width). It has a
  `.map-legend-head` "LEGEND" title + `.map-legend-list` of simple icon+label
  rows (no long descriptions) and an ornamental double-border/corner-tick frame
  (inset box-shadows + `::before`/`::after` corner ticks). On narrow portrait
  (`max-width: 760px`) `.map-body` stacks to a column and the legend reflows
  into a compact horizontal chip strip **below** the board; on landscape phones
  (`max-height: 560px`) it stays a right column, just trimmed.
- **Connector ornaments** are drawn per-edge in `showMap()`'s edge loop: a small
  diamond waypoint (`.edge-dot`) near the midpoint and a directional chevron
  (`.edge-arrow`, rotated toward the target) at ~72% — both deliberately faint.
- **Node accents:** `.map-node.current` and `.node-boss` get a subtle concentric
  ring halo via `::before`; reachable nodes and the boss get a tiny twinkling
  four-point sparkle via `::after` (`sparkTwinkle`, disabled under reduced
  motion). Keep these subtle — they're accents, not badges.
- **Map journey presentation (2026-07):** `RunState.mapDiscovered` persists node
  keys revealed this act and defaults to `[]` for legacy saves; reset it in
  `nextAct()` beside `pathTaken`. `showMap()` reveals the next reachable keys,
  renders unrevealed future rooms with `.unexplored` haze, and adds exactly
  three act-specific `.map-landmark` labels plus deterministic CSS weather
  motes (never advance the run RNG). `enterNode()` is guarded by
  `_mapTraveling`, highlights the selected SVG edge via its `data-edge`, and
  runs a 680ms `.map-traveler` animation before mutating `run.position` and
  entering the room. Reduced motion skips the travel delay and weather.
- The top-bar utility buttons (`.tb-fs`, `.tb-mute`) are **circular** with a
  faint inset ornamental ring (they show on every scene's top bar, so this is a
  global chrome tweak, not map-only — QA covers combat to catch regressions).

## Story framing & endings (the Spire's lie)
The world runs on one reveal: **the Spire "welcomes climbers home" by rendering
winners into the enemies the next climber fights.** Ascension is extraction
dressed as apotheosis. Keep new content consistent with this — enemies are
former champions, the Archive catalogues/erases, "home" is the furnace.
- **Two victory endings, gated across runs** (in `game.js`): `victory()` routes
  the Act-3 boss kill. The **first ever** ascent (persisted `meta.ascendedOnce`)
  is always the *complicit* ending (`endVictory('ascend')`) — you can't refuse a
  welcome you don't yet understand. On any **later** clear reached **without**
  the `ascendant_crown` relic, `showEndChoice()` offers *Ascend* vs *Unwrite the
  engine* (`endVictory('unwrite')`, sets `meta.spireUnwritten`). Wearing the
  Crown = already claimed = no choice. Meta flags live in `save.js` `defaultMeta`.
- The **Ascendant Crown is the "weld"**: it's now a real boss reward
  (`RunState.pickBossRelicId()` + the `bossrelic` reward row in `game.js`). Boss
  relics were previously unobtainable — don't re-exclude them.
- **Enemy backstory is baked into the sprite art, not icons/tooltips.** The
  "former champion" tells (Agojie cowrie/star-iron on brass_sentinel &
  gilded_warden; griot kora/brass-throat on hollow_cantor & void_chanter;
  star-weaver diadem/dead orbs on sand_wraith, mirror_shade, echo_wraith) live
  in `tools/sprites.manifest.json` prompts. Editing a prompt only takes effect
  after a live `node tools/gen-sprites.js --ids <id>` run (needs `OPENAI_API_KEY`,
  gpt-image-2); the committed PNGs do not update on their own.
- Scratchpad browser-test gotcha: `playwright-core` installs into the **project**
  `node_modules`, and ESM ignores `NODE_PATH`, so a script under the scratchpad
  dir must `import pkg from '/home/user/spire/node_modules/playwright-core/index.js'; const { chromium } = pkg;` (CommonJS default export, absolute path).

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
  `.card-picker` in `styles.css`) has no boxed panel — `.overlay-box.card-picker`
  strips the shared `.overlay-box` background/border/border-radius/box-shadow
  back to `none`, so the title, cards, hint and Skip button sit directly on the
  dimmed/blurred `.overlay` backdrop instead of inside a sub-panel. It shows
  options at a fixed w:h card aspect ratio (`--card-h: clamp(232px, 25vw,
  320px)`, `--card-w: calc(var(--card-h) * 0.7)`) rather than the shop/deck
  overlays' `height:auto; min-height:`
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
- **CSS comment gotcha — never put `*` and `/` adjacent inside a `/* ... */` comment**
  (e.g. writing `--card-*/--med` to reference two custom properties). The `*/`
  closes the comment right there; every token from that point up to the *next*
  `{` — including a real `@media (...) {` that follows the comment — gets
  consumed as the prelude of one bogus selector, and the whole rule (comment
  remainder + the entire next block) is silently discarded by the parser. No
  console error, no visual crash, `node --check` can't catch it (it's CSS, not
  JS) — the styles just silently do nothing. This exact typo dropped the whole
  `@media (max-width: 760px)` narrow-portrait-phone block for a long time
  before it was caught. If a breakpoint's rules seem to have zero effect even
  though the media condition matches, suspect this first: check in a live page
  via `[...document.styleSheets].flatMap(s => [...s.cssRules])` and look for
  `CSSMediaRule`s with the expected `conditionText` — if the block you edited
  is missing from that list entirely, walk backward through the preceding
  comments for a stray `*/`.
- **Holographic / Iridescent Sheen**: Cards and customized clipped buttons (`.btn` and `.end-turn`) feature a dynamic iridescent sweep on hover. This is implemented via an absolute `::after` overlay utilizing a screen blending radial-gradient (bent sphere reflection) and a smooth position tracking transition linked to the mouse cursor position. For custom button shapes with non-rectangular bounds (polygons), the `::after` overlay must match the exact parent `clip-path` polygon. Disable these hover animations in the `@media (prefers-reduced-motion: reduce)` block.
- **Auto-Update Learnings**: On every action/task, if you discover a project-specific gotcha, solve a debugging issue, or establish a new convention/pattern, you must immediately update `AGENTS.md` and `.agents/AGENTS.md` to persist this learning.
- **Lost Pointer Capture**: When card nodes (or any nodes capturing pointer events) are removed from the DOM or rebuilt during a state update while pointer capture is active, the browser fires a `lostpointercapture` event. Since `pointerup` or `pointercancel` may not fire on the node after it's removed, you must always listen to `lostpointercapture` to cleanly reset drag/gesture state (e.g., `this.drag = null`) and prevent permanent input locks.
- **Keyboard Navigation**: Global keyboard navigation is managed by `KeyboardController` in `src/core/keyboard.js`, instantiated in the `Game` constructor as `this.keyboard`. Interactive elements are queried dynamically, supporting Tab/Shift+Tab, Arrow keys, WASD to navigate, Enter/Space to click, Escape to cancel/go back, and numbers `1`-`9` as direct shortcuts. Visual highlight class is `.kb-focus` in `styles.css`. Keyboard focus is automatically cleared when the mouse moves or clicks. Hover/tooltip synchronization is handled by dispatching synthetic `mouseenter` and `mouseleave` events to the active element. For combat integration, `beginCombat()` stores the `CombatView` instance as `this.combatView` on the `Game` instance to coordinate hand selection and enemy targeting. If a QTE is active (`.qte-layer` exists), the global controller completely bypasses interception so WASD/Arrow controls reach the rhythm game.
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
- **Port conflicts (`EADDRINUSE`) during QA audit**: If the static server fails to bind to port 8091 because of lingering/zombie processes, run the audit specifying a different port prefix, e.g., `QA_PORT=8095 npm run qa`.
- **Text contrast on title/scenic backgrounds**: Any overlay text or toggle buttons rendered over scenic background art (such as the bright lines on the title screen) must have a dark semi-transparent backing card/pill background (like `rgba(8, 5, 3, 0.85)`) to block out light lines and ensure contrast.
- **Smooth Enemy Repositioning**: When an enemy is defeated, their `.dying` transition collapses their `min-width`, `max-width`, `width`, and `margin-left`/`margin-right` to `0` over `0.62s`. This allows the remaining flex children in `.enemy-side` to slide smoothly into their centered positions rather than hopping abruptly. The negative margins are sized to half of `--enemy-gap` to offset the flex container's gaps exactly.
- **Event scene audio dependency**: `src/scenes/event.js` calls `audio.play()` while resolving choices that change gold/remove cards. Keep `import { audio } from '../audio.js';` in that scene and cover gold-changing event choices in `tools/test.js`; otherwise a choice can mutate run state, throw before `resultThenMap()`, and stay clickable for repeated rewards/costs.
- **Marquee impact tiers**: Big-play feedback is classified by the DOM-free `impactProfile()` helper in `src/combat/presentation.js`. The engine snapshots `rhythmGrade` and whether an attack consumed Exposed/Challenged setup into `_play`, then echoes those facts through damage FX; keep new hit-stop, camera, particle, callout, and audio treatment cosmetic and driven from that payload. `standard`, `heavy`, and `apex` are the shared tiers, with lethal blows, perfect charged synergies, and boss phase breaks receiving apex treatment. Do not infer setup from live powers in the view because hit-counted powers may already have been consumed.
- **Combat spatial-depth layers**: `CombatView.build()` mounts two non-interactive `.combat-depth` layers around the battlefield: back architecture/light/floor below combatants and foreground ledge/props above combatants but below the hand and controls. Pointer parallax is intentionally tiny, skipped for touch and reduced motion, and resets on `pointerleave`; drive lighting from the existing `--env-*` combat mood variables rather than creating a second state model. Props must remain CSS-only, `aria-hidden`, and `pointer-events:none` so depth never changes hit targets.
- **Delayed combat FX must use immutable snapshots**: combat state mutates
  synchronously, while the view deliberately delays and staggers impacts. Any
  value read inside a delayed callback (`Block`, HP, guard-break state, hit
  index) must come from the engine FX payload, not the live entity object,
  otherwise an earlier hit is rendered using the final state of a multi-hit or
  a later card. `applyDamage()` snapshots `hpBefore/After`,
  `blockBefore/After`, `guardBroken`, `hitIndex/hitCount`, and outcome fields;
  extend that contract when adding another delayed result.
- **Combat animation channels must not compete for `.stage`**: `.stage` owns
  displacement (`lunge`, `shake`, hit-stop). Color flashes animate `.glyph` and
  card/beam overlays live on their own nodes. Two CSS classes that both assign
  `animation:` to `.stage` silently override one another by source order, so a
  hit can lose either its flash or recoil with no console error.
- **Card-play choreography has one owner**: `CombatView.activePlay` creates one
  persistent card ghost for commit → resolve → discard/consume and locks all
  other combat input until the readable impact beat. `renderHand()` must skip
  its legacy departing-card clone for UIDs in `_choreographedCards`. Pose holds
  are generation-tokened; never restore a pose from an unowned timer. Intent
  forecasts live in DOM-free `combat/presentation.js` and must not consume or
  mutate hit-counted status stacks.
- **Web Animation cleanup needs a timer fallback**: backgrounded/hidden browser
  tabs may throttle `Element.animate()` enough that `.finished`/`onfinish`
  arrives very late. Choreography may await the animation for presentation, but
  race that wait against a bounded timer and give transient DOM nodes an
  idempotent `setTimeout(remove, duration + slack)` fallback so a card ghost can
  never retain UI state indefinitely.
- **Intent-icon clicks are intercepted in capture phase**:
  `Game.setupGlossaryPopups()` stops propagation on `.intent-*` icons before
  the parent `.intent` handler can run. Any whole-intent click behavior must be
  forwarded explicitly from that capture handler (currently the custom
  `intentinspect` event), or clicking the visible icon works differently from
  clicking the pill's name/padding.

## Asset Generation
- **Model Rules**: Always use the `gpt-image-2` model for all image, sprite, and background art generations. Never use Gemini or any other image models.
- **Setup**: the generators have dev-only deps not used by the game — run
  `cd tools && npm install` once (installs `openai`, `sharp`, `undici`). Live
  runs need `OPENAI_API_KEY`; `--dry-run` needs neither install nor key.
- **Sprites**: Run `node tools/gen-sprites.js` (reads `tools/sprites.manifest.json`, outputs to `assets/sprites/`).
- **Sprite Variations**: Run `node tools/gen-sprite-variations.js` (reads `tools/sprites.manifest.json`, uses base champion sprites as inputs, outputs variations to `assets/sprites/`).
- **Card Art**: Run `node tools/gen-card-art.js` (reads `tools/cards.manifest.json`, outputs to `assets/card-art/`).
- **Backgrounds**: Run `node tools/gen-backgrounds.js` (reads `tools/backgrounds.manifest.json`, outputs to `assets/title screen and backgrounds/`).
- **Event Art ("?" nodes)**: Run `node tools/gen-event-art.js` (reads `tools/events.manifest.json`, outputs to `assets/event-art/`). `--dry-run` writes SVG placeholders with ZERO deps. The event view (`eventArt()` in `game.js`) prefers `<id>.png`, falls back to the committed `<id>.svg` placeholder, then the generic "?" glyph. Events themselves (`src/data/events.js`) must be original to the ÀṢẸ world, never Slay the Spire reskins.
- **Relic Art**: Run `node tools/gen-relic-art.js` (reads `tools/relics.manifest.json`, outputs to `assets/relic-art/`). Image-based relics are rendered larger (`44px` on desktop, `34px` on mobile landscape) with no borders/backgrounds, utilizing rarity-specific `drop-shadow` glows (and an intensified orange glow on hover).
- **Potion Art**: Run `node tools/gen-potion-art.js` (reads `tools/potions.manifest.json`, outputs to `assets/potion-art/`). Image-based potions are styled with no borders/backgrounds, and glow orange on hover (`transform: scale(1.16)`).
- **Map Icon Art**: Run `node tools/gen-map-icons.js` (reads `tools/map-icons.manifest.json`, outputs to `assets/icons/`). Image-based map icons are styled without borders/backgrounds and scaled uniformly on the map.
- **Transparency Gotcha**: For clean transparency masking on woodcut assets, always prompt with "Transparent background" and avoid contradictory "Pure black background" tags. The model will produce a bright checkerboard background that is safely keyed out by the default `isNeutralBright` filter (checking RGB balance above `150`). Do not use flood-fill or dark key-outs as they destroy the black linework inside the assets.
- **Options**: The generator scripts support `--dry-run` (writes SVG/HTML placeholder files, no API keys needed), `--force` (regenerate existing), and `--ids id1,id2` (run specific assets). Requires `OPENAI_API_KEY` for live runs.
- **Sprite Facing Direction Gotcha**: In combat, player characters (champions) stand on the left and must face **right** (towards enemies). Enemies stand on the right and must face **left** (towards player). Generated sprites that face the wrong direction can be mirrored horizontally using `sharp`'s `.flop()`. Prompt generation and variation prompt rules in `tools/sprites.manifest.json` and `tools/gen-sprite-variations.js` should explicitly specify facing direction to guide DALL-E.
- **Attack-VFX spritesheets**: `spriteAnim()` expects one 1536×1024 RGBA PNG
  containing exactly 24 contiguous 256×256 frames in a 6×4 grid, read left
  to right and then top to bottom. Register every sheet in `STATIC_ASSETS`
  (`src/core/preload.js`), its recipe in `VFX_PLAYBOOK` (`combatView.js`), and
  the recipe key as the card blueprint's `vfx`. A sheet whose contact frame
  should land on the 300ms player-impact beat can use `timing: 'windup'` so it
  starts from `attackstart`; do not also replay it from the damage handler.
  Custom screen shake must target `.combat-scene` (the selector owning the
  shake animation), not merely the nearest generic `.scene` wrapper.
- **Generated VFX sheets**: When generating a new 6×4 combat sheet with the built-in image workflow, use a flat magenta chroma-key background and run `remove_chroma_key.py --auto-key border --soft-matte --despill` before committing. Inspect the alpha sheet after removal; the full canvas must remain 1536×1024 and the transparent cells must not retain a colored backing.
- **GitHub workflow (preferred for live runs)**: the **Generate Assets**
  workflow (`.github/workflows/sprites.yml`, `workflow_dispatch`) runs the
  generators on an open-egress runner with the repo's `OPENAI_API_KEY` secret
  and commits the PNGs back — no local key or `tools/` install needed. **Caveat**
  (same as deploys below): this session's GitHub token cannot dispatch/rerun
  workflows, so a human clicks **Actions → Generate Assets → Run workflow**.

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

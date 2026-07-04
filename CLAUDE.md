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
- **Interactive preview-tool gotcha (`mcp__Claude_Preview__*`, distinct from the
  Playwright scripts above)**: every scene mounts via `Game.setScene()` with a
  `.scene{opacity:0;transform:translateY(14px)} .scene.show{...}` fade-in
  (styles.css). Calling a scene method through `preview_eval` (e.g.
  `__ase.showCharSelect()`) and then immediately measuring with
  `getBoundingClientRect()` — even after an in-page `await new
  Promise(r=>setTimeout(r,600))` — can still read the element mid-transition
  (translateY not yet settled to 0), because `requestAnimationFrame` appears to
  get throttled on these automation-driven tabs; a real `setTimeout` fires but
  the rAF that adds the `.show` class, or the CSS transition it triggers, may
  not have progressed. This showed up as an unexplained ~8-10px vertical offset
  when verifying a char-select layout change. Fix: before measuring/
  screenshotting for a real layout check, force the settle directly —
  `el.style.transition='none'; el.style.opacity='1'; el.style.transform='none'`
  — rather than trusting a timed wait.
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
  Monster encounters escalate **within** an act via three tiers picked by the
  per-act fight counter `run._actMonster` (persisted in the save as
  `actMonster`) in `scenes/combat.js` `startMonster()`: fights 1–2 draw from
  `weak`, 3–4 from `normal`, 5+ from `hard`; `pickEncounter()` falls back to
  `normal` for acts that define no `hard` pool (currently only Act 1 has one —
  it's the fix for Act 1 going flat once the deck outgrew its many low-HP
  normals). When retuning Act 1 numbers, keep each tier's total-HP band in
  mind (weak ≲ 30, normal ~30–65, hard ~45–85) and keep new packs to **two**
  enemies — nothing has ever shipped a 3-pack, so the enemy-side layout at
  landscape-phone widths is unproven for it.
- `combat/combat.js` — the turn-based engine (energy, piles, powers, orbs,
  enemy AI, win/loss). Emits visual `fx(type, payload)` events that are
  **purely cosmetic** — never put game logic in the view's fx handler.
  Cosmetic-pacing events: `announce` (`{text,kind}` → `CombatView.announce()`
  centered banner: `battle`/`player`/`enemy` kinds for Battle Start / Your Turn /
  Enemy Turn) and `enemyMove` (`{source,name}` → move name floated over the enemy
  via `floatText(...,'name')`). `enemyPhase` deliberately `await`s after the
  Enemy-Turn banner (850ms), after each move-name float (750ms), and after each
  action resolves (550ms) so the strike never lands in the same instant it's
  announced — keep those waits when editing the loop. `endTurn` also `await`s
  a further 600ms after `enemyPhase()` returns, before calling
  `startPlayerTurn(false)`, so "Your Turn" doesn't fire in the same instant the
  last enemy's hit lands; skipped when `this.over` (no point pausing before a
  win/loss screen).
  Combat also **opens deferred**: `CombatView.mount` shows the Battle Start banner
  and calls `combat.start()` ~650ms later, so the opening draw plays *after* the
  popup; `beginCombat`'s tutorial kickoff (game.js, ~1700ms) is timed to that.
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
  Enemies choose moves via `bp.pick(s, c, rng)`; prefer `rng.weighted(...)` +
  the player-state helpers in `enemies.js` (`playerLowHp`/`playerBlocked`/
  `playerLacks`/`selfLowHp`) over fixed `turn % n` cycles. A blueprint
  dmgCapPerTurn` field caps damage taken per player turn (Heart of Static's Invincibility) — enforced in `applyDamage`, reset in `startPlayerTurn`, shown as a display-only `invincibility` pip. Ascension per-hit damage scaling flows through `run.enemyDamageMult()` applied in `enemyAttack`. The thorns (Backlash) damage mechanic when attacked has been deactivated entirely to reduce intransparency, and all enemy-move references to `thorns` have been removed.
  **Smarter-enemy hooks (all data-driven, one-shot):**
  (1) **Boss phase transitions** — a blueprint `phase: { at: 0.5, name, log, onEnter(c,s) }`. `Combat.checkPhase(e)` runs inside `applyDamage` (covers every damage source: cards, orbs, poison); when HP first crosses `at`, it sets `e._phased`, logs, fires `fx('phase')`, runs `onEnter`, and **re-picks the intent** so the telegraph updates immediately. The blueprint's `pick()` branches on `s._phased` for its phase-2 move table. All three bosses have phases. Note `onEnter` block granted mid-*player*-turn is wiped by `enemyPhase`'s `e.block = 0`, so it only walls the rest of the current player turn (a deliberate "shields up on transform" beat).
  (2) **Summoning** — `Combat.summonEnemy(id, {max=4})` pushes a fresh enemy mid-combat, board-capped, and sets `e._justSummoned` so `enemyPhase` skips it for one phase (its intent is telegraphed during the player's turn first). The view builds the new combatant node **lazily in `update()`** (any living enemy with no `els[id]` node gets one, with a `.summoning` entrance class) — `fx('summon')` fires *before* that node exists (notify is a microtask), so its burst is deferred with a small `setTimeout`. Summoner + minion: `choir_master` / `echo_mote` (Act 3).
  (3) **Enrage** — a blueprint `enrage: { turn, strength }`; `enemyPhase` grants the Resolve once on/after that enemy's own `turn`, with `fx('enrage')`. Applied to `brass_colossus` and `chrome_archon` (walls that could otherwise be stalled out).
  `_phased`/`_enraged` drive persistent `.phased`/`.enraged` auras toggled in `updateCombatant` (they survive in-place re-renders). **Crowded-board layout:** the enemy side is only ~half the screen, so 3+ foes wrapped into the hand; `combatView.update()` toggles `.enemies-3`/`.enemies-4` on `.enemy-side`, and CSS shrinks the `--med` token (which drives every combatant sub-size) so they fit one row at both desktop and landscape-phone widths.
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
- The top-bar utility buttons (`.tb-fs`, `.tb-mute`) are **circular** with a
  faint inset ornamental ring (they show on every scene's top bar, so this is a
  global chrome tweak, not map-only — QA covers combat to catch regressions).

## Parallel Claude sessions — one worktree each
Multiple interactive Claude/agent sessions must **never share this checkout**:
branch, index and stash are global per working tree, so one session's
`git reset` / `git stash` / branch switch silently clobbers another session's
staged work mid-commit (this really happened — two sessions on this folder
produced mixed-scope commits and a mid-commit index reset). Give every session
its own worktree instead:
- `tools/worktree.sh new <topic>` → creates `../spire-wt-<topic>` on branch
  `claude/<topic>` off a freshly fetched `origin/main`, symlinks the primary
  checkout's `node_modules` into it (the game is dependency-free; the symlink
  is only for `npm run smoke` / `npm run qa`'s ambient playwright), and prints
  a stable per-topic dev port (8100–8199) plus `QA_PORT` (+100) so parallel
  `npm start` / `npm run qa` runs don't collide — 8080/8091 stay reserved for
  the primary checkout.
- Open the printed folder in the new Claude session and work normally there
  (commit, push, PR into `main`, self-merge; deploys still only trigger from
  `main`).
- After the merge: `tools/worktree.sh done <topic>` removes the worktree and
  deletes the branch if merged. It drops the `node_modules` symlink first —
  git refuses to remove a worktree containing untracked files otherwise.
- `git worktree list` will also show IDE-managed worktrees
  (`.claude/worktrees/...`, Antigravity's `~/.gemini/antigravity/worktrees/...`);
  they belong to those tools — leave them alone.
- The primary checkout should sit on `main` and mostly just `git pull`. If a
  session must run directly on it, treat it as read-only for git state.
- Gotcha: `.gitignore` must contain `node_modules` **without** a trailing
  slash — `node_modules/` only matches real directories, so the worktree's
  symlink would show up as untracked noise in `git status`.

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
- **Relic acquisition is celebrated** via `Game.relicAcquired(relicId, onClaim)`
  + `Game.flyRelicToSlot(relicId, fromRect)` (shared plumbing in `game.js`, so
  every scene mixin can call `this.relicAcquired(...)`). It shows a large
  `.relic-reveal-overlay` (icon + rarity + name + desc) with the `relic`
  fanfare SFX; on tap it runs `onClaim` (which must **re-render the scene so
  the new relic chip exists in `.tb-relics`** — the flight targets the *last*
  chip there) then animates a `.relic-fly` clone into the top-bar slot, landing
  with the `relicland` chime. Wired into all five grant paths: the `relic` and
  `bossrelic` reward rows (`scenes/rewards.js`), treasure (`scenes/treasure.js`),
  the shop `buy()` relic branch (`scenes/shop.js`), and — generically, by
  diffing `run.relics.length` before/after `ch.effect(run)` — relic-granting
  events (`scenes/event.js`). Because of this, **`RunState.grantRandomRelic()`
  now returns the relic *object*** (not its name string); callers use `r.id`
  and `r.name` (the relic-granting event texts and the `tools/test.js` event
  mock — which must stub `relicAcquired(id, onClaim){ onClaim(); }` — depend on
  this). Respects `prefers-reduced-motion` (reveal still shown, flight skipped).
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
- **Auto-Update Learnings**: On every action/task, if you discover a project-specific gotcha, solve a debugging issue, or establish a new convention/pattern, you must immediately update `CLAUDE.md` and `.agents/AGENTS.md` to persist this learning.
- **Keyboard Navigation**: Global keyboard navigation is managed by `KeyboardController` in `src/core/keyboard.js`, instantiated in the `Game` constructor as `this.keyboard`. Interactive elements are queried dynamically, supporting Tab/Shift+Tab, Arrow keys, WASD to navigate, Enter/Space to click, Escape to cancel/go back, and numbers `1`-`9` as direct shortcuts. Visual highlight class is `.kb-focus` in `styles.css`. Keyboard focus is automatically cleared when the mouse moves or clicks. Hover/tooltip synchronization is handled by dispatching synthetic `mouseenter` and `mouseleave` events to the active element. For combat integration, `beginCombat()` stores the `CombatView` instance as `this.combatView` on the `Game` instance to coordinate hand selection and enemy targeting. If a QTE is active (`.qte-layer` exists), the global controller completely bypasses interception so WASD/Arrow controls reach the rhythm game.
- **Landscape-phone breakpoint (`@media (max-height: 560px)`)**: this is the
  single hook for short viewports. `.title` is a plain vertically-centered/
  stacked layout sized for tall screens — on a short landscape phone its
  content (title + up to 4 buttons) overflows the fold, so compact overrides
  live in a **second** `@media (max-height: 560px)` block placed after
  `.char-glyph`'s base rule (styles.css, near the "character-select portrait"
  section) — a rule inside a media query does **not** out-rank a later
  non-media rule of equal specificity, so an override must be placed after
  what it overrides in source order regardless of the media query.
  `.charselect` in this breakpoint is a **CSS grid**, not a centered flex
  column: row 1 overlaps the heading and the Back button in the *same*
  `grid-row: 1; grid-column: 1` cell (`justify-self: center` vs `start`) so
  the button pins top-left "next to the headline" with no fixed header height
  or `position: absolute`; row 2 (the card grid) is `minmax(0, 1fr)` so it
  stretches to fill all leftover height instead of shrink-wrapping and then
  centering with dead space above/below; row 3 is the optional Ascension
  selector. Two gotchas worth knowing before touching this again: (1) **grid
  auto-placement doesn't overlap items unless *both* axes are explicit** —
  giving the heading and Back button only `grid-row: 1` (column left `auto`)
  makes the browser bump the second one into a *new implicit column* instead
  of stacking it on the first (auto-placement's job is finding a
  non-overlapping slot; it doesn't know the overlap is intentional), so both
  need `grid-column: 1` too. (2) **don't size per-card content in `vh`** when
  the card's row height depends on optional sibling content (row 3 here) —
  a `vh`-based glyph reads "more room" from the viewport alone, grows, then
  gets silently squashed back down by `flex-shrink` once row 3 actually
  appears and eats into row 2, and without `flex-shrink: 0` that same squeeze
  hits the text blocks too, shrinking a `-webkit-line-clamp` box *below* its
  line height and clipping mid-word instead of eliding cleanly. Fixed by
  sizing `.char-glyph` as a `%` of the (height-independent) card width via
  `aspect-ratio` instead of `vh`, giving every text block `flex-shrink: 0` so
  line-clamp always resolves to a clean N (or fewer) lines, and adding a
  `.charselect:has(.asc-select) …` compact preset (same `:has()` pattern as
  the relic/potion art rules) so card content itself runs smaller specifically
  when row 3 exists, rather than picking one size that compromises both. In
  `.combat-scene`, only
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
- **QA map-scroll flake**: the desktop Act-map QA shot can occasionally catch `.map-scroller` before its initial `scrollTop` lands (the reachable bottom-row nodes then read as "extends past viewport" control-offscreen issues). If the map is the only screen flagged and only with `control-offscreen` on `.map-node.reachable`, re-run `npm run qa` before suspecting a real regression.
- **Rhythm QTE rules (src/ui/rhythm.js + combat.js)**: attack QTEs grade perfect/good/miss (×1.25/×1.0/×0.5 damage). The enemy-attack parry is only prompted when the player has block; a **missed parry halves the player's block** (`Math.floor(realBlock/2)`, then the hit consumes it normally — it must NOT void/restore block, that made Block cards worthless on a miss; regression tests in tools/test.js). The view floats `BLOCK HALVED` via the `parrymiss` fx. Desktop mice can now also answer directional marks by **clicking on the chevron's side of the QTE ring** (stationary click ≥26px off ring-center in `onPUp`; near-center clicks stay 'tap'). The rhythm toggle lives on the title screen **and** as a `.tb-rhythm` button in the run top bar (components.js, reads the Game via `window.__ase`, calls `Game.setRhythm`); attack QTEs read `rhythmOn()` per card play, but the parry prompt is bound once per combat, so `setRhythm` must call `combatView.bindParryPrompt()` to apply mid-fight. Husk Drone `startBlock` is 6 (was 12 — the tutorial's coached first attack did no visible HP damage). **QTE-result banner must not delay the strike's SFX/VFX**: `runAttackQTE` used to `await showResult(...)` (a 700ms banner hold) before resolving, so the actual attack's sound/particles — fired by `combat.playCard` right after `combatView.playCard` awaits the QTE — landed ~700ms after the player's timed input. Fixed by resolving `runAttackQTE` as soon as the grade is computed (adding a `qte-clear` class that instantly fades the dimming scrim + stage via CSS transition) and letting the result banner + `ui.destroy()` play out in the background via a detached `.then(...)` instead of being awaited.
- **Tempo (rhythm layer → card game, combat.js)**: a player-only counter stored as the `tempo` **power** (so pips/tooltips/`fx('power')` floats come free — no bespoke UI). Clean strikes build it (+1, +2 on Perfect), a successful parry adds +1, any missed beat (strike QTE or parry) **breaks it to 0** (`breakTempo()`, `RHYTHM BROKEN` float via the `tempobreak` fx); capped at 10 (`TEMPO_CAP`). The view sets `combat._rhythmGrade` next to `_rhythmMult` after the attack QTE; `Combat.playCard` consumes it for attacks via `registerStrikeGrade()` — **a null grade counts as 'good'**, so headless/Rhythm-off play still builds 1 Tempo per attack and Tempo cards never go dead. Registration happens **before** `onPlay`, so a Tempo-scaling card counts its own strike and a missed finisher fizzles (breaks first, then deals ×0.5) — deliberate risk/reward, don't "fix" it. Cards use `ctx.tempo()` / `ctx.gainTempo(n)` / `ctx.spendAllTempo()`; relics listen on the `tempoGained` trigger (`{ amount, total }`). Amara is the specialist (flowing_edge, dancers_poise, spiral_finish, war_drum_cadence, unbroken_dance in her pool) but the system is game-wide (pulse_stone / drummers_bangle relics work for any champion). Logic tests live in the "Tempo" group of `tools/test.js`.
- **Smooth Enemy Repositioning**: When an enemy is defeated, their `.dying` transition collapses their `min-width`, `max-width`, `width`, and `margin-left`/`margin-right` to `0` over `0.62s`. This allows the remaining flex children in `.enemy-side` to slide smoothly into their centered positions rather than hopping abruptly. The negative margins are sized to half of `--enemy-gap` to offset the flex container's gaps exactly.
- **Event scene audio dependency**: `src/scenes/event.js` calls `audio.play()` while resolving choices that change gold/remove cards. Keep `import { audio } from '../audio.js';` in that scene and cover gold-changing event choices in `tools/test.js`; otherwise a choice can mutate run state, throw before `resultThenMap()`, and stay clickable for repeated rewards/costs.

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

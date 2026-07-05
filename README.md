# ÀṢẸ — Ascend the Obsidian Spire

An ambitious, afrofuturist roguelike **deckbuilder** in the spirit of *Slay the Spire*,
built from scratch in vanilla JavaScript (ES modules) — **no build step, no dependencies**.

> The Static crept down from the heavens and twisted the guardians of the Spire.
> Channel the **Àṣẹ** of the Ancestors. Climb. Cleanse the Heart — or be unwritten.

*Àṣẹ (Yoruba) — the power to make things be.* The world draws on the diaspora:
the Agojie warriors of Dahomey, the griot tradition, Orisha cosmology, kente
geometry and cowrie-shell shrines, reimagined as cosmic science-fantasy.

## Play

```bash
npm start          # serves at http://localhost:8080
```

Any static file server works — there is no compilation. You can also just open
`index.html` through a local server (ES modules require `http://`, not `file://`).

## How to play

1. **Choose a champion**, each with a unique deck and play style.
2. **Climb the act map** — a branching path of rooms. Pick your route upward.
3. **Win card battles** by spending **Àṣẹ** (energy) to play cards: deal damage,
   raise **Block**, and stack buffs/debuffs. Read each enemy's **intent**
   above its head and plan the turn. Click a card, then click a target.
4. **Spend rewards** — add cards, collect relics & potions, shop at the bazaar,
   rest at Ancestor Fires (heal or upgrade), and gamble on events.
5. **Defeat the act boss** to ascend. Survive all three acts to cleanse the
   **Heart of Static**.

Progress auto-saves to your browser (`localStorage`); pick **Continue Climb**
from the title to resume.

## Champions

| Champion | Title | Identity |
|---|---|---|
| **Amara** ⚔️ | The Agojie Bladedancer | Resolve (strength), heavy Block, ancestral fury |
| **Kofi** 🎶 | The Griot of the Cosmos | Verses, Blight (poison), relentless tempo & draw |
| **Zara** ✨ | The Star-Weaver | Channels Spirits — Storm, Tide, Shade, Sun — amplified by Focus |

## Features

- Three distinct, fully playable classes with ~16 unique cards each (60+ cards total),
  plus colorless cards, statuses and curses — each upgradable.
- Turn-based combat engine with Block, Resolve, Exposed/Sapped/Brittle, Blight,
  Backlash, Phase, channeled **orb Spirits**, enemy intents and scripted AI.
- 24 relics and 11 potions with real combat/run hooks.
- Branching, seeded act maps with monsters, elites, bosses, events, shops,
  rest sites and treasure.
- Three acts, each with its own enemy roster and a unique boss, ending at the
  **Heart of Static**.
- Story events with meaningful choices, a bazaar economy, and a smithing/rest system.
- Hand-tuned afrofuturist visual theme and a procedural WebAudio score & SFX
  (no asset files required).
- Save/continue, run statistics, and full keyboard-free mouse/touch play.

## Project layout

```
index.html            # shell + Google Fonts (graceful fallback)
styles.css            # the entire afrofuturist theme
server.js             # zero-dependency static server
src/
  main.js             # bootstrap
  game.js             # scene state machine (title, map, rewards, shop, rest, events…)
  audio.js            # procedural WebAudio music + SFX
  core/               # rng, util, emitter, run state, save/load
  data/               # cards, relics, potions, enemies, encounters, events, characters, keywords
  combat/combat.js    # the combat engine
  map/mapgen.js       # branching act-map generator
  ui/                 # components, combat view
```

## Credits

Design and code original. Built as a love letter to deckbuilding roguelikes and
to afrofuturism. Mechanic names are kept readable; the flavor lives in the world.

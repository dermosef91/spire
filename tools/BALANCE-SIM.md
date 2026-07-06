# Balance Simulator

Play ÀṢẸ thousands of times, headlessly, to tune balance without clicking through
runs by hand. It drives the game's **real** combat engine and **real** content
modules, so it stays correct as you rebalance — there is nothing to keep in sync.

```bash
node tools/balance-sim.mjs                     # full climbs, all champions
node tools/balance-sim.mjs --mode encounters   # isolated per-fight tuning
node tools/balance-sim.mjs --char amara -n 500 # more samples, one champion
node tools/balance-sim.mjs --path aggressive   # bias the route choice
node tools/balance-sim.mjs --json > out.json   # machine-readable output
```

## Why it auto-adjusts with the game

The simulator **imports the game's own code**:

| Concern | Source of truth (imported, never copied) |
| --- | --- |
| Combat rules, powers, energy, orbs, triggers | `src/combat/combat.js` |
| Cards (stats, `onPlay`, upgrades) | `src/data/cards.js` |
| Enemies (HP, moves, AI) | `src/data/enemies.js` |
| Relics, potions, keywords | `src/data/{relics,potions,keywords}.js` |
| Encounter tables & tiering | `src/data/encounters.js` |
| Map generation & routing | `src/map/mapgen.js` |
| Run state, deck, gold, relics | `src/core/state.js` |

Add a card, retune an enemy's HP, add a relic, change an encounter table — rerun
the script and the new numbers are reflected automatically. No shadow copy of the
rules exists to drift out of date.

The reward/rest/act flow in `tools/sim/run.mjs` mirrors `game.js` (encounter
selection, gold/potion/relic rolls, card-reward weighting, healing, act
progression) and re-uses `RunState`'s own methods, so economy changes flow
through too.

## The two modes

- **`runs`** (default) — full climbs from title to Act 3 boss along procedurally
  generated maps. Best for *overall difficulty, attrition, and where runs die.*
- **`encounters`** — pit a controlled deck against every fight in the encounter
  tables, many times each. Best for *tuning individual fights in isolation.*
  (Uses the starter deck by default, so it's most meaningful for early fights;
  add `--upgraded` to see the ceiling. For mid/late fights, `runs` mode gives a
  realistic deck.)

## Options

| Flag | Meaning | Default |
| --- | --- | --- |
| `--mode` | `runs` \| `encounters` \| `both` | `runs` |
| `--char` | `amara` \| `kofi` \| `zara` \| `all` \| CSV | `all` |
| `-n`, `--n` | samples per champion | 300 (runs) / 200 (per encounter) |
| `--seed` | base RNG seed (runs use `seed+i`) | `12345` |
| `--act` | encounters mode: which act's fights | all |
| `--path` | `random` \| `aggressive` \| `cautious` | `random` |
| `-a`, `--ascension` | ascension level 0–12 (scales enemy HP/damage, rest healing, etc.) | `0` |
| `--upgraded` | encounters mode: fully-upgraded starter deck | off |
| `--json` | emit JSON instead of a text report | off |

Ascension is applied by the engine/`RunState` itself, so `--ascension 6` faithfully
reproduces every modifier of that level. Sweep it to see where a champion's win
rate falls off:

```bash
for a in 0 1 2 3 4; do node tools/balance-sim.mjs --char amara -a $a -n 200 --json; done
```

## What's faithful vs. modelled

**Faithful (the game's own code):** all of combat, every card/enemy/relic/potion
effect, powers, orbs, triggers, enemy AI, map generation, encounter selection and
tiering (`weak`/`normal`/`hard` escalation, elites, bosses), ascension modifiers,
reward rolls (incl. boss-tier relics), rest healing, treasure, full heal between
acts, act progression.

**Modelled (decisions the game leaves to a human — in `tools/sim/policies.mjs`):**

- **Player** — which card to play and when to end the turn. A greedy heuristic:
  powers first, block when a hit would break through Ward, then race damage
  (securing kills), then utility; spends potions in elite/boss fights and
  emergencies.
- **Path** — which node to walk to (`random` / `aggressive` / `cautious`).
- **Deck** — which card reward to draft; which card to smith at a fire.
- **Rest** — heal vs. upgrade.

These are a deliberately simple *"reasonable player,"* not an expert. **The
reported numbers are only as strong as this policy** — tune the policies to model
a weaker or stronger pilot. Everything else is the real game.

**Not modelled by default:** shop purchases and random events are no-ops (they're
content-heavy and outcome-random). Hooks exist — pass `event`/`shop` functions in
`simulateRun`'s opts to plug in your own models. The one-time first-fight tutorial
pin (guaranteeing `husk_drone` as the very first monster) is treated as already
done, so run 1 isn't biased.

## Reading the output

- **Encounters mode** flags fights `⚠ HARD` (<60% win) or `· trivial`
  (~always win, ~no HP lost), with average turns and HP lost.
- **Runs mode** reports win rate, average act reached, where runs end, and a
  *"toughest fights"* table (appearances, deaths, average HP drained) that points
  straight at the difficulty spikes.

Even when the headline win rate is low, the graded metrics (act reached, per-fight
HP loss, death locations) move with balance changes — nerf a boss's HP and you'll
see runs push deeper and HP loss on that fight drop, so it works for A/B tuning.

## Customising the AI

Everything decision-related lives in `tools/sim/policies.mjs`. Export your own
policy object and pass it in, e.g.:

```js
import { simulateRun } from './tools/sim/run.mjs';
const res = await simulateRun('amara', 123, { player: myPolicy, pathStrategy: 'cautious' });
```

A player policy needs `chooseCard(combat, playable)` returning `{ card, target }`
or `null` (end turn); optionally `usePotions(combat)`.

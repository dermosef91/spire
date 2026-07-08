# Balance Findings — 2026-07-07 (Ascension 0, `main` @ 708262e)

Run with the simulator described in [`BALANCE-SIM.md`](./BALANCE-SIM.md). All
numbers below are Ascension 0 (baseline difficulty) unless noted.

## TL;DR

- **The game is currently close to unwinnable.** Full-run win rate: Amara
  2.7% (8/300), Kofi 0.0% (0/300), Zara 0.0% (0/300).
- **Root cause isolates to one fight: The Gatekeeper**, the Act 1 boss. Tested
  in isolation (fresh full HP, starter deck, `--mode encounters --act 1`),
  it's a **0.0% win rate for all three characters** (n=60 each). Even a
  **fully upgraded** starter deck still can't beat it as Amara (0/60) or
  reliably as Zara (6.7%); only Kofi's poison kit gets through at all (68.3%),
  because poison bypasses Block and the boss's whole kit is built on stacking
  Block.
- Everything else in Act 1 (weak/normal/hard tiers, most elites) is won
  comfortably in isolation — several flagged `trivial`. Act 1 is a cakewalk
  that dumps every run into a wall.

## Enemies

### Overtuned

**The Gatekeeper (Act 1 boss) — critical.**
250 HP vs. Act 1 elites' ~60 HP (4×), and a kit that spends roughly half its
turns behind heavy self-Block (`Seal the Gate`: 18 Block + Frail on the
player; then at 50% HP it re-enters with **+3 Strength and another 18
Block**) while cycling a double debuff (`Decree`: Weak *and* Vulnerable
together — a combined ~44% swing against the player's damage output and
damage taken) between two attack patterns (`Judgement` 16, `Sevenfold Strike`
4×4=16).

- Isolated win rate at full HP, starter deck: **0.0%** for Amara, Kofi, Zara
  (n=60 each, avg HP lost 68–80 — more than any character's max HP, meaning
  most losses are outright kills, not narrow misses).
- Isolated win rate, **fully upgraded** starter deck: Amara 0.0% (0/60), Zara
  6.7%, Kofi 68.3%.
- In full-run simulation (real drafted deck, relics, etc.) this single fight
  accounts for the large majority of all deaths: seen-and-died 97/300
  (Amara), 124/300 (Kofi), 102/300 (Zara) — i.e. most runs that reach it die
  there, and most runs that don't reach it die earlier just from attrition
  built up getting there.
- Not a recent regression — `hpMin`/`hpMax: 250` has been unchanged across
  the visible history of `enemies.js`; this has likely been unwinnable (or
  very close to it) for a long time with nothing surfacing it, since there's
  no balance test in CI.

**Recommendation:** cut HP substantially (150–180 puts it at ~2.5–3× an Act 1
elite, a more normal "first boss" spike), and soften the phase-2 entry (it
currently stacks Strength *and* Block on top of an already Block-heavy kit —
pick one). Consider dropping `Decree` to a single debuff instead of
Weak+Vulnerable together, since that stacks multiplicatively with the Block
turtling to leave almost no efficient turn for the player to profit from.

**Rust Maw (Act 1 elite)** — the hardest non-boss fight by a wide margin:
75–98% isolated win rate (worst for Amara), ~55–70 avg HP lost even on wins.
`Rusted Crush` (24 flat damage, fixed 3-turn cycle so at least readable) is
proportionally huge against 68–80 max HP characters. Not urgent on its own,
but worth revisiting once the Gatekeeper is fixed and more runs actually
reach it at real HP totals.

### Weak / trivial (isolated ~100% win rate, low HP lost)

- **Tide Priest + Spark Imp** — 100% win, **~0.1–0.2 avg HP lost** across all
  three characters: the most trivial fight in the game. Spark Imp draws focus
  and dies before it ramps; Tide Priest's own output is too low to matter
  once its ward is dead.
- **Spark Imp + Spark Imp** — 100% win, ~0.3–3.9 avg HP lost. Billed as a
  "twin glass-cannon burst check" but a starter deck brushes it off before
  either ramps.
- **Brass Sentinel (solo, normal tier)** — 100% win at very low HP loss for
  Kofi/Zara (1.4–2.5). The "retaliator wall" premise doesn't threaten a deck
  that can just wait out Barricade or shrug off Rivet's single Dazed.
- **Gilded Warden (solo elite)** — 100% win rate for all three despite big
  numbers (24–34 avg HP lost); the paired version (+ Spark Imp, 62–87% win)
  is where the actual threat lives.
- Act 1 `weak` tier (Husk Drone, Static Jackal, Reef Spitter alone) — fine as
  intentional tutorial-tier fights.

## Characters

- **Kofi (poison/Blight kit)** is the standout performer against the current
  Act 1 gate specifically because poison (`tickPoison` → direct `loseHp`,
  see `combat.js`) **bypasses Block entirely**, and the Gatekeeper's entire
  kit is built around stacking Block. Despite having the *lowest* HP pool
  (68 vs. Amara's 80 / Zara's 72), his upgraded starter deck clears the boss
  68% of the time — Amara and Zara, who both rely on damage the Gatekeeper's
  Block absorbs, essentially never do (0% / 6.7%).
- **Amara** cannot beat the Act 1 boss even with a fully upgraded starter
  deck (0/60) — a severe outlier. Her starter kit (Slash/Brace/Sunder,
  physical/Tempo-based) has no answer to a boss that spends half its turns
  immune-by-Block. She does have the best-in-game rare burst card
  (`Skyfall Hammer`, see below) and her best cards correlate with big
  survival gains in full runs — but she essentially never lives long enough
  to draft into them.
- Full-run win rates confirm the ranking: **Amara 2.7% > Kofi 0.0% = Zara
  0.0%** — Kofi and Zara are worse off than even the low Amara bar because
  the deck-drafting heuristic isn't targeting the Gatekeeper's specific
  weakness (poison), so Kofi rarely arrives with enough Blight built up, and
  Zara has no tool for it at all in her kit.

## Cards

Caveat: because so few runs are won at all, win/loss correlation is mostly
noise. The numbers below use **fights survived before death** (a continuous
0..N score) instead of the binary win flag — much more signal, but this
still describes what helps survive *this* balance state, not an abstract
"best card" ranking.

Biggest positive swings, Amara (n=250 climbs, card present in final deck vs.
not):

| Card | Δ fights survived |
| --- | --- |
| Untouchable (rare power, gain Flow every turn) | +9.83 |
| Echo of the Warden (colorless uncommon) | +7.38 |
| Unbroken Dance | +6.21 |
| Skyfall Hammer | +6.08 |
| Shattered Cadence | +5.97 |

Kofi/Zara show the same shape but much flatter (max ~+3.4) — almost nobody on
those characters survives long enough for deck composition to show up in the
data; that's a symptom of the boss wall, not a statement about those cards.

**Raw power-budget outlier (from the card data directly, independent of
simulation):**

- **Skyfall Hammer** (Amara, rare, cost 3, 32 dmg, single target, no
  condition, no drawback) = **10.67 dmg/energy**. No other rare
  single-target burst card matches this rate — Zara's closest equivalent,
  *Falling Star* (rare, cost 5, 24 dmg), is 4.8 dmg/energy, less than half.
  Worth a look for a modest nerf or an added condition, though it's not
  urgent while the Act 1 wall dominates every outcome.
- *Reckless Glory* (common, cost 1, 12 dmg) looks like a similar outlier at
  12 dmg/energy, but it adds a Wound to the discard pile every use — a real
  drawback that roughly justifies the rate. Not flagged as a problem.

## Relics

Same caveat as cards. The strongest positive correlations for Amara are
*Ascendant Crown* and *Eternal Flame* (+15 fights survived) — both are
**boss-tier** +1 energy/turn relics. This is confounded: you can only own a
boss relic after already beating an Act 1 boss, so part of that correlation
is "already survived the hard part," not the relic's raw power. Filtering to
relics obtainable earlier (common/uncommon, from elites or treasure),
*Iron Lattice* (+7.6), *Twin Serpent Ring* (+7.2), and *Kente Wrap* (+6.7)
show the next-clearest lift — all three are unconditional free Block/draw/
energy with zero downside, versus narrower-condition relics like
*Obsidian Charm* (one-time Resolve on first HP loss this combat) or
*Talking Drum* (draw on every 3rd card played) which show much smaller
gains. Nothing here reads as individually broken; general "always-on, no
condition" relics simply outperform conditional ones right now, which is a
softer, lower-priority tuning note next to the Gatekeeper issue.

## Methodology

```bash
node tools/balance-sim.mjs --mode runs --char all -n 300 --seed 12345
node tools/balance-sim.mjs --mode runs --char all -n 300 --seed 12345 --json

node tools/balance-sim.mjs --mode encounters --char all --act 1 -n 60 --seed 12345
node tools/balance-sim.mjs --mode encounters --char all --act 1 -n 60 --seed 12345 --upgraded
```

Card/relic correlation used a one-off ~120-line script that imports
`RunState`/`simulateRun` from the real sim and monkeypatches
`RunState.prototype.addRelic` / `addCardById` to log every acquisition per
run, then compares "fights survived before death" for runs where a given
card/relic ended up in the final deck vs. runs where it didn't (min 8 samples
each side, N=250 climbs/character). Not committed to `tools/` — ad hoc
instrumentation for this pass, reproducible from the description above if
useful again.

Note on `--mode encounters` at full scope (`--char all`, no `--act` filter,
default n=200): this is very slow in this environment — the harness zeroes
out the engine's `setTimeout`-paced animation delays by rescheduling them at
0ms rather than resolving as microtasks (see `tools/sim/harness.mjs`), and
worst-case fights (a starter deck grinding to the 300-turn cap against the
Gatekeeper) rack up enough real timer ticks that a full 3-character × 3-act ×
all-tiers sweep didn't finish in 20+ minutes of wall clock despite <5% CPU
use. Scoping with `--act` and a smaller `-n` (as above) avoids this and is
sufficient to isolate the fights that matter.

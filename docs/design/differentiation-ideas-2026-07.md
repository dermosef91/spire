# 30 ideas to differentiate ÀṢẸ from Slay the Spire

Ideation only — nothing implemented. Grounded in the engine as of `main`
(rhythm/QTE layer, Tempo power, three champions — Amara/Tempo, Kofi/Blight-Verses,
Zara/Spirit-orbs — hit-counted debuffs, Blight-spreads-on-death, the parry QTE,
boss phase/summon/enrage AI, and the "the Spire renders winners into the enemies
the next climber fights" narrative with its complicit-vs-unwrite endings).

## The premise

Right now ÀṢẸ is *StS-plus-three-wedges*: the rhythm layer, the champion
identities, and the extraction narrative. Those three are the real assets. Every
idea below is scored on how far it pushes one of them past "reskin of a StS
mechanic" into something StS structurally cannot do. The genre-defining move is
to make **the music, the story, and the roguelite loop mechanically inseparable
from the deckbuilding** — StS keeps all three cosmetic.

Ranking key — each idea scored 1–5 on:
- **Diff** — how differentiating vs StS (5 = StS can't do this without a rewrite)
- **Fit** — how naturally it grows from systems already in the repo
- **Cost** — build cost, *inverted* (5 = cheap, 1 = a whole subsystem)

Overall rank is roughly `Diff×2 + Fit + Cost`, then hand-tuned for how much each
idea reinforces the game's identity rather than sprawling it.

---

## Tier S — signature wedges (define the game's identity)

### 1. Living backing track — the Groove meter *is* combat state
A persistent, combat-wide rhythm meter (not the current per-card QTE) that rises
as you play on-beat and cleanly, and audibly layers instruments in as it climbs
(kick → hats → kora → horns → full chorus). At thresholds it grants a passive
band-wide bonus (e.g. +1 card draw, cheaper Verses) and decays if you stall or
whiff. Tempo becomes a *shared* groove, not a per-strike counter.
**Diff 5 · Fit 5 · Cost 3.** The audio system, Tempo power, and `fx` pacing
already exist; this promotes Tempo from a number to the game's heartbeat. This is
the single biggest "not StS" lever — StS combat is silent bookkeeping.

### 2. The Archive remembers — your dead runs populate the Spire
The narrative literally says winners become the next climber's enemies. Make it
true across runs: when a run ends (win *or* loss), snapshot the champion + a
signature card/relic into `meta`, and let future runs encounter a "Rendered
[Amara]" mini-boss built from that snapshot. Your own past climbs become the
opposition. A genuine roguelite nemesis loop that *is* the story.
**Diff 5 · Fit 5 · Cost 3.** `meta`/`save.js` already persists cross-run state;
enemies are data-driven blueprints. No other deckbuilder ties the ghost loop to
its lore this tightly.

### 3. On-beat card *sequencing* — deckbuilding as choreography
Cards played in rhythm and in the right *order* form named phrases (e.g.
Attack→Attack→Skill = a "Flourish", three Verses in a bar = a "Chorus") that pay
a bonus. Shifts optimization from "which cards are in my hand" (StS) to "in what
order, on what beat" — the deck becomes a dance you perform, not a bag you empty.
**Diff 5 · Fit 4 · Cost 3.** `combat.lastPlayedType` alternation tracking is
already contemplated in the card-ideas doc; extend to short sequence windows.

### 4. Champion Echoes — capture a defeated foe's signature move
Enemies are former champions. On kill, offer to briefly wield the fallen
champion's move as a one-shot "Echo" card added to your hand (self-exhausting).
The colorless `echo_of_the_*` cards already gesture at this — make it a live
capture verb. Turns every fight into "which of you do I carry upward."
**Diff 4 · Fit 5 · Cost 4.** Echo cards + `onEnemyDeath` hook exist; wire a
grant on kill.

### 5. The Climb Clock — extraction pressure
The Spire extracts climbers who linger. A visible climb timer / turn-budget
(you already track `bestTime`) that, when it runs low, escalates: elites wander,
the furnace "heats" (enemy damage mult creeps). Rewards decisive routing and
punishes the StS habit of grinding every node. Reframes the map from a shopping
trip into a heist.
**Diff 4 · Fit 4 · Cost 3.** `run.enemyDamageMult()` and timing already exist;
this is a run-level modifier + UI.

---

## Tier A — strong systemic differentiators

### 6. Enemy positioning — front/back lanes
Give the enemy side two ranks. Back-rank foes (summoners, chanters) are shielded
until the front falls or you use a reach/AoE card; melee foes must advance a turn
to strike. StS has zero positioning — this alone reshapes targeting, AoE value,
and the summoner archetype you already ship (`choir_master`/`echo_mote`).
**Diff 5 · Fit 3 · Cost 2.** Real engine + `combatView` layout work, but the
crowded-board CSS (`.enemies-3/4`) is already solved.

### 7. Living cards — cards that evolve through use *within a run*
Play a card enough times in one run and it evolves (Slash → Slash+ → a named
variant), independent of campfire upgrades. Your most-played cards visibly grow,
so a run has a signature. StS upgrades are a binary campfire choice; this makes
the deck a living record of how you fought.
**Diff 4 · Fit 4 · Cost 3.** Cards already use a per-instance state model
(`createCard`/`upgradeCard`); add a play-count → evolve threshold.

### 8. Corruption gauge — spare vs. slay, with teeth
Alongside HP, some champion-echo enemies have a Corruption bar. Damage HP to kill
(furnace them, as the Spire wants); or spend Tempo/specific cards to drain
Corruption instead and *free* the champion — a harder path that grants a boon and
nudges you toward the unwrite ending. Choice with mechanical weight, tied to the
one narrative StS doesn't have.
**Diff 5 · Fit 4 · Cost 2.** Ties the ending flags (`spireUnwritten`) to
moment-to-moment play. New enemy sub-state + win-condition branch.

### 9. Musical Keys — a champion-wide stance/mode you shift mid-fight
Each champion can shift "key" (e.g. Amara: Marcato/aggressive vs Legato/defensive)
which re-tints every card's effect while active. One resource-gated toggle that
re-colors the whole hand, generalizing Tempo into a mode system. StS has no
stance layer outside one character's niche.
**Diff 4 · Fit 4 · Cost 3.** A per-combat `combat.key` read by card effects; UI
is a single toggle pip.

### 10. Duet runs — climb with two champions
Pick two champions; their pools merge and a shared "Harmony" resource builds when
you alternate their card colors. Doubles the build space and makes the
call-and-response theme literal. StS is strictly one character per run.
**Diff 4 · Fit 3 · Cost 2.** Deck/pool plumbing is per-character today; merging
is real state-model work but no new combat math.

### 11. The floor acts — environmental hazards per act
The Spire's rooms aren't inert. Each act's battlefield has a live hazard on a
timer (Act 1 rising brine that adds Sundered; Act 3 static surges that hit the
lowest-block combatant). StS rooms never act on their own; this makes *where* you
fight matter.
**Diff 4 · Fit 3 · Cost 3.** A per-act combat hook firing on a turn cadence,
purely additive to the engine.

### 12. Persistent unwriting — the world changes across runs
Earning the unwrite ending doesn't just set a flag: it permanently alters future
runs (a node type disappears, an act's palette decays, a champion's dialogue
shifts). The meta-narrative has mechanical memory. StS's meta is inert unlocks.
**Diff 5 · Fit 4 · Cost 3.** `meta.spireUnwritten` exists; gate map/data
variations on it.

### 13. Ancestor lineage — a meta boon tree, not just card unlocks
Each win adds an Ancestor to a lineage board; each grants a small run-start boon
you can equip within a budget. Replaces StS's "unlock more cards into the pool"
(which arguably makes early runs *worse*) with a thematic, additive progression.
**Diff 3 · Fit 4 · Cost 3.** `meta.wins` + a boon list applied in
`RunState` constructor; mirrors the existing char/card unlock pattern.

### 14. Name-forging — craft cards from fragments mid-run
The Archive "catalogues names." Let a special node/event fuse two cards' fragments
into a new named card (a verb + a noun → a bespoke card). Gives runs an authorship
StS's fixed card list can't.
**Diff 4 · Fit 2 · Cost 2.** Needs a fragment/compose model; the most net-new
data work in Tier A, but high identity payoff.

---

## Tier B — meaningful adds

### 15. Interrupt parry — parry to *redirect*, not just soften
Extend the parry QTE: a Perfect parry can knock a telegraphed enemy move off its
beat (cancel/delay/downgrade the intent), not merely halve the hit. Intent re-pick
already exists (`checkPhase`). Turns defense into an offensive rhythm play.
**Diff 4 · Fit 5 · Cost 4.**

### 16. Stanzas — songs that resolve over several turns
Kofi's Verses generalize into multi-turn "Stanzas": commit a card that resolves a
line each turn, building to a payoff, breakable if you fall off-beat. A
commitment/tension layer StS's instant-resolution cards lack.
**Diff 3 · Fit 4 · Cost 3.**

### 17. Initiative combat — speed interleaves the turn
Instead of strict player-phase / enemy-phase, fast foes act between your cards
based on a Speed stat. Rhythm-native (things happen on beats, not in blocks) and
raises the stakes of card order. A structural departure from StS's rigid phases.
**Diff 4 · Fit 2 · Cost 1.** Deep combat-loop surgery — high risk, listed for
completeness.

### 18. Reactive map — upstream choices reshape downstream
An event or spared champion earlier in the act changes what appears later (free a
foe → they aid you at the boss; loot a shrine → the act "notices" and hardens).
StS's map is fixed at generation; this makes routing a narrative.
**Diff 4 · Fit 3 · Cost 2.**

### 19. The one that killed you — named nemesis return
Lighter-weight cousin of #2: the specific enemy that ended your *last* run returns
mid-climb, buffed, with a line of dialogue and a bonus for besting it. Cheap,
personal, immediately felt.
**Diff 3 · Fit 4 · Cost 4.**

### 20. Deck-driven music — your build literally sounds different
Each card/archetype maps to an instrument or motif; the combat track is composed
from your actual deck, so an aggro deck and a Blight deck *sound* different. Makes
deckbuilding audible. StS's audio is fixed per act.
**Diff 4 · Fit 3 · Cost 2.**

### 21. Sacrifice to the Archive — erase a card for power
A node where you feed a card to the Archive (it is "catalogued" — gone forever)
for a permanent run boon. Thematic card-removal-as-cost, with the erasure the
story is *about*. StS removal is a neutral service; here it's complicity.
**Diff 3 · Fit 4 · Cost 4.**

### 22. Rival climber — race a Rendered champion up a parallel track
A ghost climber ascends alongside you on a side rail; beat their pace for rewards,
fall behind and they reach the Heart first (a soft fail/twist). Turns the solo
climb into a contest. Pairs naturally with #2 and the Climb Clock.
**Diff 4 · Fit 2 · Cost 2.**

### 23. Diegetic instrument UI — the drum *is* the energy interface
Àṣẹ/Tempo render as a physical drum/kora you strike; End Turn is a downbeat. Pure
presentation, but it sells "this is a music game, not a spreadsheet" harder than
any single mechanic. Fits the no-emoji, custom-line-art rule.
**Diff 3 · Fit 4 · Cost 3.**

### 24. Descent (NG+) — climb *down* into the furnace
After unwriting, a New Game+ that descends with inverted rules (you're now the
Rendered thing others fight; enemies play *your* archetypes back at you). Gives
mastery somewhere to go and closes the narrative loop. StS's Ascension is just
numeric knobs.
**Diff 4 · Fit 3 · Cost 2.**

### 25. Performance-scaled difficulty — the Spire matches your rhythm
Sustained clean rhythm play quietly raises the stakes (and rewards) that fight;
whiffing eases it. A dynamic, skill-reactive difficulty that only makes sense
*because* of the rhythm layer. StS difficulty is fixed per Ascension.
**Diff 3 · Fit 4 · Cost 3.**

---

## Tier C — polish, niche, and experiments

### 26. Daily seeded climb with shared nemeses
A daily seed where the Rendered enemies are drawn from *other players'* dead runs
(async, no server needed if seed-encoded or opt-in export). Community texture on
top of #2.
**Diff 3 · Fit 2 · Cost 2.**

### 27. Pure-rhythm mode — music-only combat
A mode where card play is fully driven by hitting beats; the deck is a track you
perform. The extreme end of the rhythm wedge, as an unlockable variant. High risk,
high identity.
**Diff 4 · Fit 2 · Cost 1.**

### 28. Song-relics you must maintain
Relics that only pay out while you keep the groove (see #1) above a threshold —
"living" relics you play *around*, not passive triggers. StS relics are fire-and-
forget.
**Diff 3 · Fit 4 · Cost 4.**

### 29. Hotseat "pass the drum"
Local two-player: alternate control of turns/fights, or one drives rhythm while
the other picks cards. Cheap social hook the mobile-first, keyboard-and-touch
input model already half-supports.
**Diff 3 · Fit 2 · Cost 3.**

### 30. Contagion economy — Blight as a board-wide system
Extend Blight-spreads-on-death into a full contagion layer: Blight jumps, mutates,
and can be *harvested* for resources, making Kofi's archetype a spatial economy
rather than a DoT. Deepens an already-unique mechanic.
**Diff 3 · Fit 4 · Cost 3.**

---

## If you build only three

1. **#1 Living Groove meter** — makes the rhythm wedge the *point*, not a minigame.
2. **#2 The Archive remembers** — makes the story the *loop*, the thing no
   deckbuilder has done.
3. **#6 Enemy positioning** — the cheapest way to make *combat itself* feel unlike
   StS turn after turn.

Those three hit all three assets (music, story, combat) and reinforce each other:
the groove feeds the fights, the fights feed the Archive, the Archive gives the
positioned board its named champions to fight.

# Card ideation — 50 new cards (Amara + Colorless)

Ideation only, nothing implemented. Grounded in the engine as of main @ 6984fe6:
existing ctx helpers (`deal/gainBlock/applyEnemy/gainTempo/spendAllTempo/...`),
existing triggers (`turnStart`, `turnEnd`, `cardPlayed`, `versePlayed`,
`tempoGained`, `hpLost`, `cardExhausted`), the `playable()` predicate, the
rhythm layer (grades Perfect/Good/Miss, parry, Tempo cap 10, null grade counts
as 'good' when Rhythm is off), and hit-counted debuffs (stacks in the 1–2 band).

## New mechanics these cards introduce

| Mechanic | What it is | Engine cost |
|---|---|---|
| **Riposte N** (self buff, hit-counted) | The next attack that hits you is answered for N damage, then Riposte is consumed. Transparent, finite, telegraphed — the honest replacement for the removed Backlash/thorns. | Small: check in `applyDamage` on player, like Exposed consumption. |
| **Flow N** (self buff, hit-counted) | The next N attacks against you *miss entirely*. True dodge — StS has no miss mechanic. | Small: early-out in `enemyAttack`, consume stack. |
| **Challenged** (enemy mark, max one) | Your attacks deal +3 to the Challenged enemy. Duel flavor. | Small: flat bonus in `calcAttackDamage`. |
| **Vow** (one-shot pledge) | Card states a condition checked at the start of your next turn. Kept → payoff; broken → stated price. Fires `vowKept`/`vowBroken` for glue cards. Shown as a self pip while pending. | Medium: once-triggers + a pip. |
| **Debt** (deferred cost) | Power now, price collected at the start of the next turn(s). Shown as a pip ("Debt: 2 Àṣẹ due"). Winning the fight first voids the bill — that race *is* the archetype. | Medium: ledger + `turnStart` collection. |
| **onExhaust** (blueprint hook) | Cards that trigger when Exhausted, by any means. Pairs with Ethereal-as-*upside*. | Tiny: `fire('cardExhausted')` already exists. |
| **Alternation tracking** | `combat.lastPlayedType` — call-and-response payoffs for Attack↔Skill alternation. | Tiny. |
| **Intent verbs** | Re-pick an enemy's intent / delay its action one turn. Intent re-pick already exists (`checkPhase` does it). | Small–medium. |
| **Gold-cost cards** | `playable()` gates on `run.gold`; playing spends it. | Tiny. |
| **QTE-meta** | Per-mark damage payoffs; wider/slower Perfect windows. Cards that buff the *player's hands*. | Medium: rhythm.js options. |

Rhythm-off fallbacks are noted per card where a card reads the rhythm layer
(design rule from the codebase: Tempo cards must never go dead headless).

---

## AMARA (28)

### Riposte — the Bladedancer answers (5)
The parry QTE exists but no card touches it. These make defense a weapon
without resurrecting opaque thorns: every answer is finite and telegraphed.

1. **Answering Steel** — 1, Skill, Common. Gain 5 Block. Gain Riposte 6. *Up: 7 Block, Riposte 9.* (Works with Rhythm off — Riposte triggers on being hit, not on parrying.)
2. **Steady the Line** — 1, Skill, Uncommon. Gain 8 Block. This turn, missing a parry does not halve your Block. *Up: 11 Block, and a missed parry no longer breaks Tempo.* (Rhythm off: just a good block card — insurance costs nothing when there's no risk.)
3. **Answer in Kind** — 1, Power, Uncommon. Whenever you successfully parry, apply 1 Sapped to the attacker. *Up: also deal 4 damage to it.* (Rhythm off: triggers whenever you fully block an attack instead.)
4. **Blade Turn** — 1, Skill, Rare, Exhaust. Until your next turn, successful parries reflect the parried attack's full damage back at the attacker. *Up: cost 0.* (The anti-boss-nuke button. Rhythm off: reflect the first fully-blocked attack.)
5. **Duelist's Grammar** — 2, Power, Rare. You may parry even with no Block; successful parries first grant 5 Block. *Up: 8 Block.* (Unlocks the parry minigame full-time — currently gated on having Block. Rhythm off: gain 3 Block whenever an enemy attacks you.)

### Oaths — vows with teeth (6)
Self-imposed constraints, checked at the start of your next turn. StS has
nothing like promising the game something. Agojie discipline as mechanics.

6. **Oath of Iron** — 1, Skill, Common, Exhaust. Gain 6 Block. Vow: take no HP damage before your next turn → gain 2 Resolve. *Up: 9 Block, 3 Resolve.*
7. **Oath of the Empty Hand** — 0, Skill, Uncommon, Exhaust. Vow: end this turn with no cards in hand → next turn, draw 2 extra cards and gain 1 Àṣẹ. *Up: draw 3 extra.*
8. **Vow of Stillness** — 1, Skill, Uncommon. Gain 10 Block. Vow: play no Attacks this turn → your Block carries over through next turn. Break it → lose all Block immediately. *Up: 14 Block.* (Conditional Barricade; tense with intent-reading.)
9. **Blood Oath** — 1, Skill, Rare, Exhaust. Choose an enemy. Vow: it dies before your next turn → heal 8 and gain 2 Resolve. It survives → take 8 damage. *Up: heal 10, gain 3 Resolve, take only 6.*
10. **Litany of the Line** — 1, Power, Rare. Whenever you fulfill a Vow, gain 1 Resolve and draw 1 card. *Up: also gain 4 Block.* (Archetype glue — needs ~3+ Vow cards in the pool to earn its slot.)
11. **Oathbreaker's Edge** — 2, Attack, Uncommon. Deal 12. If you have broken a Vow this combat, deal 20 instead. *Up: 15/25.* (Makes broken vows a build, not just a punishment — the fallen-Agojie fantasy.)

### The Duel — Challenged (4)
Mark one foe; honor demands you finish it. Single-target commitment as an
archetype (Marks don't exist in StS proper).

12. **Call the Duel** — 0, Skill, Uncommon, Exhaust. Challenge an enemy (only one at a time): your attacks deal +3 damage to it. When it dies, draw 3 cards. *Up: +4 damage, and gain 1 Àṣẹ on the kill.*
13. **Measured Circle** — 1, Skill, Common. Gain 6 Block. If an enemy is Challenged, apply 1 Sapped to it. *Up: 9 Block, 2 Sapped.*
14. **To the Hilt** — 1, Attack, Uncommon. Only targets the Challenged enemy (`playable()` gate). Deal 4 + 2× your Tempo. *Up: 6 + 2×.* (Duel × Tempo crossover.)
15. **Take Their Name** — 3, Attack, Rare, Exhaust. Deal 26 to the Challenged enemy. If this kills it, gain 3 Resolve and heal 6 — claim what the Spire would have taken. *Up: 34, 4 Resolve, heal 8.* (You do to champions exactly what the Spire does. The lore, weaponized.)

### Tempo expansion (6)
The system exists; these deepen its decision space — protecting it, breaking it
on purpose, and making the cap a payoff instead of waste.

16. **Half-Beat** — 0, Skill, Common, Exhaust. Gain 2 Tempo. *Up: no Exhaust.*
17. **Clean Cut** — 1, Attack, Common. Deal 7. If this strike grades Perfect (or you have 5+ Tempo), apply 2 Exposed. *Up: 10 damage.* (First card where the *grade itself* is the payoff, not just the multiplier. Tempo clause keeps it alive Rhythm-off.)
18. **Hold the Rhythm** — 1, Skill, Uncommon. Gain 5 Block. Until your next turn, your Tempo cannot break. *Up: 8 Block.* (Insurance before a risky parry turn.)
19. **Shattered Cadence** — 2, Attack, Uncommon. Deal 16. Your rhythm breaks: Tempo drops to 0. *Up: 20.* (Overstatted attack whose cost is your rhythm — the inverse of every other Tempo card. Play it the beat *after* you've spent everything.)
20. **Overflow** — 1, Power, Uncommon. Whenever your Tempo reaches 10 (the cap), unleash: deal 8 damage to ALL enemies, then Tempo resets to 5. *Up: 12 damage.* (Turns the cap from waste into a loop.)
21. **The Beat Bites** — 2, Power, Rare. Whenever you gain Tempo, deal that much damage to a random enemy. *Up: cost 1.* (Tempo becomes a damage engine; watch balance with Pulse Stone / Drummer's Bangle.)

### Scars — wear your history (4)
Status cards as fuel, not just chaff. Scar (wound) already exists; nothing
generates or rewards it player-side yet.

22. **Reckless Glory** — 1, Attack, Common. Deal 12. Add a Scar to your discard pile. *Up: 15.*
23. **Worn Proud** — 1, Power, Uncommon. Whenever a Status card enters your hand, gain 3 Block and 1 Tempo. *Up: 4 Block.* (Also a tech pick vs status-inflicting enemies.)
24. **Proof of Survival** — 1, Skill, Common. Gain 4 Block, plus 3 more for each Status card in your hand. *Up: 5, +4 each.*
25. **Open the Old Wounds** — 1, Attack, Rare. Exhaust all Status cards in your hand: deal 9 damage to ALL enemies for each. *Up: 12.* (Payoff capstone; feeds the colorless Archive package too.)

### Flow — the untouchable dance (3)
True dodge. Not block, not Phase — the blade simply isn't where they strike.

26. **Read the Wind** — 1, Skill, Uncommon, Exhaust. Gain 1 Flow (the next attack against you misses entirely). *Up: cost 0.*
27. **Ghost Steps** — 2, Skill, Rare, Exhaust. Gain 2 Flow. If you have 6+ Tempo, gain 3 instead. *Up: cost 1.*
28. **Untouchable** — 3, Power, Rare. At the start of each turn, gain 1 Flow. *Up: cost 2.* (Hard-counters big single hitters, punched through by multi-hit swarms — self-balancing.)

---

## COLORLESS (22)

### Spire's Bargains — Debt (6)
The run's central lie as a card archetype: the Spire gives, and always
collects. Every card is strong now with a bill at your next turn start — and
killing everything first voids the bill. No StS equivalent (energy/draw debt
across turns doesn't exist there).

29. **Borrowed Time** — 0, Skill, Uncommon, Exhaust. Gain 2 Àṣẹ. Debt: start next turn with 2 less Àṣẹ. *Up: Debt is 1.*
30. **Advance on the Prize** — 0, Skill, Uncommon, Exhaust. Draw 3. Debt: draw 2 fewer next turn. *Up: draw 4.*
31. **Flesh Ledger** — 0, Skill, Uncommon. Gain 11 Block. Debt: lose 5 HP at the start of your next turn. *Up: 15 Block.* (The purest "win before the bill" card.)
32. **Mortgaged Strength** — 1, Skill, Uncommon. Gain 4 Resolve. Debt: lose 2 Resolve at the start of each of your next two turns. *Up: 5 Resolve.* (Front-loaded, decays to net zero.)
33. **Bribe the Doorkeeper** — 1, Skill, Uncommon, Exhaust. Costs 15 Gold to play (unplayable without it). Remove all your debuffs and gain 1 Charm. *Up: costs 10 Gold.* (Gold as a combat resource — new genre of cost.)
34. **Skip Town** — 1, Skill, Rare, Exhaust. Cancel ALL your outstanding Debts. The Spire remembers: add a Sorrow curse to your discard pile. *Up: cost 0.* (Escape hatch with a scar. Option: make the Sorrow permanent-to-deck for a real run-level price — flag for playtesting.)

### The Archive — echoes of fallen champions (5)
Ethereal as an *upside*: ghost cards that want to be Exhausted. Each Echo names
a champion the player also fights as an enemy (Cantor, Sentinel, Warden) — the
same person, remembered instead of rendered. `onExhaust` fires by any means:
Ethereal at turn end, exhaust-payoff cards, anything.

35. **Echo of the Cantor** — 1, Skill, Uncommon, Ethereal. Gain 5 Block. When this is Exhausted: apply 1 Sapped to ALL enemies. *Up: 7 Block.*
36. **Echo of the Sentinel** — 1, Skill, Uncommon, Ethereal. Gain 4 Block. When Exhausted: gain 7 Block. *Up: 6/9.* (Play it now, or let the ghost guard you at turn's end.)
37. **Echo of the Warden** — 1, Attack, Uncommon, Ethereal. Deal 7. When Exhausted: deal 10 to a random enemy. *Up: 9/13.*
38. **Remembered Name** — 1, Power, Rare. Whenever one of your cards is Exhausted, deal 3 damage to a random enemy. *Up: 4.* (The Archive answers every erasure.)
39. **The Catalogue Opens** — 2, Skill, Rare, Exhaust. Exhaust your hand: deal 4 damage to ALL enemies for each card Exhausted. *Up: 5.* (Detonates every Echo at once — the combo capstone.)

### Misdirection — read and rewrite the intent (4)
StS shows you intents but never lets you touch them. The engine already
re-picks intents mid-combat (boss phases do it), so the verbs are cheap.

40. **Read the Field** — 0, Skill, Common. If any enemy intends to attack, gain 5 Block; otherwise draw 2 cards. *Up: 7 Block / draw 3.* (Never dead; teaches intent-reading.)
41. **Provoke the Tell** — 0, Skill, Uncommon, Exhaust. An enemy re-picks its intent. Draw 1. *Up: no Exhaust.* (Reroll the future.)
42. **Stagger** — 2, Skill, Rare, Exhaust. An enemy skips its action this turn; its intent carries over. *Up: cost 1.*
43. **Bait the Strike** — 1, Skill, Uncommon. Gain 5 Block. If an enemy attacks you before your next turn, it gains 2 Exposed. *Up: 7 Block, and you gain 2 Tempo when it triggers.* (A trap card — enemy-turn interaction in a deckbuilder.)

### Call & Response (3)
Alternation-matters: Attack↔Skill weaving, the call-and-response tradition as
mechanics. StS has zero alternation payoffs. Works in any deck — ideal
colorless identity, and it naturally *teaches* good play rhythm.

44. **Step, Turn, Strike** — 1, Attack, Common. Deal 6. If the previous card you played this turn was a Skill, deal 10 instead. *Up: 8/13.*
45. **Answer-Song** — 1, Skill, Common. Gain 4 Block. If the previous card you played this turn was an Attack, gain 7 instead. *Up: 5/9.*
46. **Call and Response** — 1, Power, Uncommon. Whenever you play an Attack directly after a Skill or a Skill directly after an Attack, draw 1 card (up to 3 times per turn). *Up: cap 4, and gain 2 Block each trigger.*

### Rhythm-meta (2)
Cards that alter the QTE layer itself — buffing the player's hands, not the
character. No other deckbuilder can even express these.

47. **Three-Step Killing Form** — 2, Attack, Uncommon, qteMarks 3. Deal 6 damage for each mark you strike cleanly; Perfect marks deal 8. Rhythm off: flat 18. *Up: 8/10, flat 24.* (Per-mark payoffs instead of one grade for the whole card.)
48. **Slow the World** — 2, Power, Rare. Time thickens: your strike QTEs move slower and Perfect windows widen. Rhythm off: attacks grant +1 extra Tempo. *Up: cost 1.*

### Odd gems (2)
49. **Swallow Sorrow** — 1, Skill, Uncommon. Exhaust a Status or Curse from your hand: gain 9 Block and draw 1 card. If you have none, gain 4 Block. *Up: 12/6.* (Bridges the Scar and Archive packages.)
50. **Reckoning** — 1, Attack, Rare. Deal damage equal to the number of foes slain this run. *Up: +10 flat.* (The Spire made you count. Weak floor 1, monstrous by Act 3 — consider a cap ~40.)

---

## Cross-package synergy map
- Scars (22–25) ↔ Swallow Sorrow (49) ↔ Worn Proud (23) ↔ Archive exhaust triggers (38).
- Duel (12–15) ↔ Tempo (14 scales with it) ↔ Blood Oath (9 is a Vow-flavored duel).
- Bait the Strike (43) ↔ Riposte package (1–5) ↔ Vow of Stillness (8): a whole "invite the hit" defensive identity.
- Debt (29–34) ↔ burst finishers (15, 19, 39): borrow big, kill before the bill.
- Call & Response (44–46) ↔ literally every deck; gentle glue.

## Suggested implementation order (if/when picked up)
1. Zero-new-status cards first: Oathbreaker's Edge-style conditionals, Read the Field, Call & Response trio, Scars package, Echoes (uses existing `cardExhausted`).
2. One new status each: Riposte, Flow, Challenged (all reuse the hit-counted pattern from Exposed).
3. Systems: Vow, Debt (pips + triggers), intent verbs.
4. Rhythm-meta last (touches rhythm.js options).

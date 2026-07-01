// Story events — the "?" nodes. Each event presents choices; a choice's
// effect(run, ctx) mutates run state and returns a result string shown to the player.
// These encounters are original to ÀṢẸ — grown from the Spire's own world (the
// Sunken Market, the Brass Archive, the Static Crown) rather than borrowed.
//
// Each event carries an `art` id. The event view looks for a custom image at
// assets/event-art/<art>.png, falling back to a committed SVG placeholder and
// finally to the generic "?" node glyph. See tools/gen-event-art.js.
//
// Choice fields:
//   label      — button text
//   effect(run)— mutates run, returns the result string
//   condition  — optional (run) => bool gate for showing the choice
//   flow       — 'upgrade' | 'removeForGold' (handled by the event view)
//   gold       — cost consumed by the 'removeForGold' flow

export const EVENTS = [
  // ───────────────────────────── Act 1 — The Sunken Market ─────────────────
  {
    id: 'drowned_griot',
    name: 'The Drowned Griot',
    acts: [1, 2],
    art: 'drowned_griot',
    text:
      'A griot lies half-sunk between the market stalls, robes fanned across the black water. The brass throat grafted at their neck still hums a praise-song — but the last verse was never finished. It tugs at the songs already coiled in your deck.',
    choices: [
      {
        label: 'Finish the verse (Upgrade a card)',
        flow: 'upgrade',
        effect: () => 'You sing the missing line. One of your cards remembers how it was meant to sound.',
      },
      {
        label: 'Pry loose the brass throat (Gain 70 gold, lose 10 HP)',
        effect: (run) => { run.gold += 70; run.takeDamage(10); return 'The throat comes free in a spray of trapped static (+70 gold) that bites back through your hands (−10 HP).'; },
      },
      {
        label: 'Lay the griot to rest (Heal 15 HP)',
        effect: (run) => { run.heal(15); return 'You close the singer’s eyes and press them beneath the tide. The market’s murmur quiets; you breathe easier (+15 HP).'; },
      },
    ],
  },
  {
    id: 'bone_scale_merchant',
    name: 'The Bone-Scale Merchant',
    acts: [1],
    art: 'bone_scale_merchant',
    text:
      'A merchant of jointed brass and bleached bone waits behind a great balance scale, one pan for flesh, one for fortune. "Everything balances in the Market," it clicks. "Set something upon the scale, and the scale answers in kind."',
    choices: [
      {
        label: 'Weigh your blood (Lose 8 HP, gain 60 gold)',
        effect: (run) => { run.takeDamage(8); run.gold += 60; return 'The pan drinks a measure of you (−8 HP) and tips heavy with coin (+60 gold).'; },
      },
      {
        label: 'Weigh your coin (Lose 45 gold, gain a Relic)',
        condition: (run) => run.gold >= 45,
        effect: (run) => { run.gold -= 45; const r = run.grantRandomRelic(); return r ? `Your gold sinks away (−45) and the scale offers up ${r} in its place.` : 'Your gold sinks away — but the scale has nothing left to weigh against it.'; },
      },
      { label: 'Refuse to be weighed', effect: () => 'You keep your measure to yourself and move on.' },
    ],
  },
  {
    id: 'salt_shrine',
    name: 'Shrine of Salt and Circuitry',
    acts: [1, 2],
    art: 'salt_shrine',
    text:
      'Cowrie shells and humming diodes ring a tidal pool where offerings dissolve into light. This is where the Sunken Market speaks to the Ancestors — and the Ancestors answer offerings in kind.',
    choices: [
      {
        label: 'Offer blood (Lose 10 HP, gain a Relic)',
        effect: (run) => { run.takeDamage(10); const r = run.grantRandomRelic(); return r ? `You bleed into the salt (−10 HP). The shells clatter and yield ${r}.` : 'You bleed into the salt (−10 HP), but the pool has nothing to give.'; },
      },
      {
        label: 'Offer coin (Lose 55 gold, heal to full)',
        condition: (run) => run.gold >= 55,
        effect: (run) => { run.gold -= 55; run.hp = run.maxHp; return 'Your coin dissolves into the tide (−55 gold). The Ancestors knit you whole again (healed to full).'; },
      },
      { label: 'Offer only silence', effect: () => 'You bow to the pool and leave your wounds where they lie.' },
    ],
  },

  // ───────────────────────────── Act 2 — The Brass Archive ─────────────────
  {
    id: 'archive_of_names',
    name: 'The Archive of Your Name',
    acts: [2, 3],
    art: 'archive_of_names',
    text:
      'The shelves lean toward you, riffling through scrolls that bear your own deeds — every card you carry inscribed and cross-referenced. The Archive remembers everything, and it is willing to forget, or to remember, at a price.',
    choices: [
      {
        label: 'Tear a page loose (Remove a card, lose 6 HP)',
        flow: 'removeForGold',
        gold: 0,
        effect: (run) => { run.takeDamage(6); return 'The page rips free of you and of your deck alike. It stings where it tore away (−6 HP).'; },
      },
      {
        label: 'Sell a memory (Lose 6 Max HP, gain 80 gold)',
        effect: (run) => { run.maxHp = Math.max(1, run.maxHp - 6); run.hp = Math.min(run.hp, run.maxHp); run.gold += 80; return 'A shelf-clerk files a piece of you away forever (−6 Max HP) and slides a heavy purse across the desk (+80 gold).'; },
      },
      { label: 'Close the ledger and leave', effect: () => 'You refuse to be catalogued today. The shelves sigh shut.' },
    ],
  },
  {
    id: 'clockwork_scribe',
    name: 'The Clockwork Scribe',
    acts: [2, 3],
    art: 'clockwork_scribe',
    text:
      'A brass automaton copies scrolls without end, its quill dripping molten gold. "I can set your hand down truer," it grinds, gears turning behind glass eyes. "The Archive keeps a tithe, but the work is honest."',
    choices: [
      {
        label: 'Have a card rewritten truer (Upgrade a card)',
        flow: 'upgrade',
        effect: () => 'The quill scratches over your card in gold, and it stands sharper than before.',
      },
      {
        label: 'Commission an erasure (Remove a card for 25 gold)',
        condition: (run) => run.gold >= 25,
        flow: 'removeForGold',
        gold: 25,
        effect: () => 'The scribe strikes the card from the record. It unwrites itself from your deck.',
      },
      { label: 'Leave the scribe to its scrolls', effect: () => 'The gears grind on without you.' },
    ],
  },

  // ───────────────────────────── Act 3 — The Static Crown ──────────────────
  {
    id: 'static_choir',
    name: 'The Choir of Static',
    acts: [3],
    art: 'static_choir',
    text:
      'At the Crown, a choir turns toward you as one — the kept voices of everyone who climbed before you and was welcomed home. They do not sing words; they sing the shape of you, and offer to fold you in early. Power now, for a fracture let into the self.',
    choices: [
      {
        label: 'Join the harmony (Gain a Relic, take 2 Static)',
        effect: (run) => { const r = run.grantRandomRelic(); run.addCardById('static_curse'); run.addCardById('static_curse'); return r ? `The choir opens and takes you in. You rise with ${r} — but two threads of Static now sing in your deck.` : 'The choir opens, yet finds nothing new to gift you. Two threads of Static lodge in your deck all the same.'; },
      },
      {
        label: 'Hum a single note (Heal 25 HP)',
        effect: (run) => { run.heal(25); return 'You answer with one steady note. The harmony steadies you in turn (+25 HP).'; },
      },
      { label: 'Cover your ears and climb', effect: () => 'You refuse the chorus and keep to your own silence.' },
    ],
  },
  {
    id: 'unwritten_pilgrim',
    name: 'The Unwritten Pilgrim',
    acts: [3],
    art: 'unwritten_pilgrim',
    text:
      'A figure climbs beside you, features smeared to static where a face should be — a champion who reached the summit before you, ascended, and was kept. Now it has come loose, half-unwritten, climbing again. It holds out cupped hands. "Carry my burden the last of the way," it whispers, "and I will carry some of yours."',
    choices: [
      {
        label: 'Take its burden (Add a Regret, heal to full)',
        effect: (run) => { run.addCardById('regret'); run.hp = run.maxHp; return 'You take the weight into your deck (gain Regret) and the pilgrim pours its strength into you (healed to full).'; },
      },
      {
        label: 'Trade it a memory for coin (Remove a card, gain 40 gold)',
        flow: 'removeForGold',
        gold: 0,
        effect: (run) => { run.gold += 40; return 'The pilgrim swallows the card whole and presses cold coins into your palm (+40 gold).'; },
      },
      { label: 'Walk on alone', effect: () => 'You leave the pilgrim to its unwriting and climb.' },
    ],
  },
];

export function eventsForAct(act) {
  return EVENTS.filter((e) => e.acts.includes(act));
}

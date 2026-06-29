// Story events — the "?" nodes. Each event presents choices; a choice's
// effect(run, ctx) mutates run state and returns a result string shown to the player.
// ctx provides helpers: addCard(id), removeCardChoice(), upgradeCardChoice(), etc.,
// handled by the event view. Here, effects return { text, reward } or trigger flows.

export const EVENTS = [
  {
    id: 'ancestor_shrine',
    name: 'The Ancestor Shrine',
    acts: [1, 2, 3],
    text:
      'A shrine of cowrie shells and humming circuitry pulses in the dark. The Ancestors offer counsel — for a price in blood or memory.',
    choices: [
      {
        label: 'Pray (Lose 8 HP, gain a random Relic)',
        effect: (run) => { run.takeDamage(8); const r = run.grantRandomRelic(); return r ? `You bleed onto the shells. They grant you ${r}.` : 'The shrine has nothing left to give.'; },
      },
      {
        label: 'Meditate (Heal 20% Max HP)',
        effect: (run) => { const amt = Math.floor(run.maxHp * 0.2); run.heal(amt); return `Stillness. You recover ${amt} HP.`; },
      },
      { label: 'Leave', effect: () => 'You bow and move on.' },
    ],
  },
  {
    id: 'static_pool',
    name: 'Pool of Static',
    acts: [1, 2],
    text:
      'A still pool reflects a sky that is not above you. Voices whisper from the Static beneath its surface, promising power for a sliver of self.',
    choices: [
      {
        label: 'Drink deep (+8 Max HP, gain a Static curse)',
        effect: (run) => { run.maxHp += 8; run.hp += 8; run.addCardById('static_curse'); return 'Power floods you (+8 Max HP) — but Static lodges in your deck.'; },
      },
      {
        label: 'Cup your hands (Heal 12 HP)',
        effect: (run) => { run.heal(12); return 'Cool clarity. You heal 12 HP.'; },
      },
      { label: 'Refuse', effect: () => 'You turn from the pool. The whispers fade.' },
    ],
  },
  {
    id: 'wandering_smith',
    name: 'The Wandering Smith',
    acts: [1, 2, 3],
    text:
      'A smith with arms of burnished bronze tends a forge of starfire. "Bring me a blade or a song," she says, "and I will make it sing truer."',
    choices: [
      {
        label: 'Upgrade a card',
        flow: 'upgrade',
        effect: () => 'The smith hammers your card into a sharper form.',
      },
      {
        label: 'Reforge (Remove a card for 25 gold)',
        condition: (run) => run.gold >= 25,
        flow: 'removeForGold',
        gold: 25,
        effect: () => 'The card is unmade in white fire.',
      },
      { label: 'Decline', effect: () => 'You leave the forge glowing behind you.' },
    ],
  },
  {
    id: 'masked_dancer',
    name: 'The Masked Dancer',
    acts: [1, 2, 3],
    text:
      'A figure in a towering Egungun mask dances between the pillars. They beckon: trade fortune for foresight, or coin for clarity.',
    choices: [
      {
        label: 'Trade 40 gold for a card-removal',
        condition: (run) => run.gold >= 40,
        flow: 'removeForGold',
        gold: 40,
        effect: () => 'A card dissolves into ribbons of light.',
      },
      {
        label: 'Gamble (50% gain 80 gold, 50% lose 30 gold)',
        effect: (run) => { if (run.rng.bool()) { run.gold += 80; return 'The dance favors you (+80 gold).'; } run.gold = Math.max(0, run.gold - 30); return 'The mask laughs (−30 gold).'; },
      },
      { label: 'Watch and leave', effect: () => 'You memorize the steps and move on.' },
    ],
  },
  {
    id: 'golden_idol',
    name: 'The Golden Idol',
    acts: [1, 2],
    text:
      'A grinning idol of solid gold sits on a pressure plate. Greed and danger are the same color here.',
    choices: [
      {
        label: 'Take the idol (Gain 90 gold, take 12 damage)',
        effect: (run) => { run.gold += 90; run.takeDamage(12); return 'You snatch the idol (+90 gold) as darts fly (−12 HP).'; },
      },
      {
        label: 'Take it carefully (Gain 90 gold, gain a curse)',
        effect: (run) => { run.gold += 90; run.addCardById('regret'); return 'You take the idol (+90 gold). Regret follows you.'; },
      },
      { label: 'Leave it', effect: () => 'Some debts are not worth the coin.' },
    ],
  },
  {
    id: 'star_navigator',
    name: 'The Star Navigator',
    acts: [2, 3],
    text:
      'An old navigator charts the cosmos on a cracked astrolabe. "I can show you the swift path," she says, "but the sky always takes its toll."',
    choices: [
      {
        label: 'Transcend (Heal to full, lose 10 Max HP)',
        effect: (run) => { run.maxHp = Math.max(10, run.maxHp - 10); run.hp = run.maxHp; return 'You are remade whole, but lessened (−10 Max HP, healed to full).'; },
      },
      {
        label: 'Chart fortune (Gain 70 gold)',
        effect: (run) => { run.gold += 70; return 'She traces a route to coin (+70 gold).'; },
      },
      { label: 'Sail on', effect: () => 'You keep your own course.' },
    ],
  },
];

export function eventsForAct(act) {
  return EVENTS.filter((e) => e.acts.includes(act));
}

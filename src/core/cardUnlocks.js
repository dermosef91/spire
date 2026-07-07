// Card unlock conditions. Cards flagged `locked: true` in data/cards.js are
// hidden from card rewards and shop offers until their condition here is met
// at least once; the unlock is then permanent, persisted in meta.unlockedCards
// (see core/save.js). Mirrors the character-unlock pattern in core/unlocks.js,
// but keyed by card id and checked against a finished run instead of win count.

import { CARDS } from '../data/cards.js';

export const CARD_UNLOCKS = {
  reckoning: {
    desc: 'Slay 20 foes in a single run.',
    check: (run) => run.foesSlain >= 20,
  },
};

/** True when a card is locked and its owner hasn't met the unlock condition yet. */
export function isCardLocked(id, meta) {
  const bp = CARDS[id];
  return !!(bp && bp.locked && !(meta.unlockedCards || []).includes(id));
}

// Runs every locked card's condition against the just-finished run and
// returns the blueprints of any newly-unlocked cards, mutating meta.unlockedCards.
export function checkNewCardUnlocks(meta, run) {
  if (!meta.unlockedCards) meta.unlockedCards = [];
  const already = new Set(meta.unlockedCards);
  const newly = [];
  for (const [id, u] of Object.entries(CARD_UNLOCKS)) {
    if (!already.has(id) && u.check(run)) {
      already.add(id);
      newly.push(CARDS[id]);
    }
  }
  meta.unlockedCards = Array.from(already);
  return newly;
}

// Character-unlock progression.
// Amara is always available; the rest unlock as the player accumulates wins.

const CHAR_UNLOCK = { amara: 0, kofi: 1, zara: 2 };

/** True when the player has enough wins to use this character. */
export function isCharUnlocked(id, meta) {
  return (meta.wins || 0) >= (CHAR_UNLOCK[id] ?? 0);
}

/** Human-readable unlock requirement, or null if already free. */
export function charUnlockReq(id) {
  const n = CHAR_UNLOCK[id] ?? 0;
  if (n <= 0) return null;
  return `Win ${n} run${n > 1 ? 's' : ''} to unlock`;
}

/**
 * Given a new win count, return an array of character ids that *just* became
 * unlocked (i.e. their threshold equals `wins`).  Empty if nothing new.
 */
export function newlyUnlockedChars(wins) {
  return Object.entries(CHAR_UNLOCK)
    .filter(([, req]) => req > 0 && req === wins)
    .map(([id]) => id);
}

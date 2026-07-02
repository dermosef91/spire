// localStorage persistence for an in-progress run + meta stats.
import { RunState } from './state.js';

const SAVE_KEY = 'spire_of_ase_run_v1';
const META_KEY = 'spire_of_ase_meta_v1';

export function saveRun(run) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(run.toJSON())); } catch (e) { /* storage full / disabled */ }
}
export function loadRun() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return RunState.fromJSON(JSON.parse(raw));
  } catch (e) { return null; }
}
export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

export function loadMeta() {
  // Merge with defaults so saves from before a new field existed pick it up.
  try { return { ...defaultMeta(), ...(JSON.parse(localStorage.getItem(META_KEY)) || {}) }; } catch (e) { return defaultMeta(); }
}
export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
}
function defaultMeta() {
  // maxAscension: highest level unlocked; ascension: last-selected level.
  // ascendedOnce: has the climber reached the Heart and been taken up at least
  //   once (the first ascent is always the complicit one — you cannot refuse
  //   what you do not yet understand). timesAscended: how many climbs have
  //   ended at the Heart. spireUnwritten: has the true ending been earned.
  // rhythm: the timed-hit QTE mode on attacks/parries (off = classic combat).
  return {
    runs: 0, wins: 0, bestFloor: 0, ascensions: 0, maxAscension: 0, ascension: 0,
    tutorialDone: false, ascendedOnce: false, timesAscended: 0, spireUnwritten: false,
    rhythm: true,
  };
}

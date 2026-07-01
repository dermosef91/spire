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
  try { return JSON.parse(localStorage.getItem(META_KEY)) || defaultMeta(); } catch (e) { return defaultMeta(); }
}
export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
}
function defaultMeta() {
  // maxAscension: highest level unlocked; ascension: last-selected level.
  return { runs: 0, wins: 0, bestFloor: 0, ascensions: 0, maxAscension: 0, ascension: 0, tutorialDone: false };
}

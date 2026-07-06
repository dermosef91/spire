#!/usr/bin/env node
// ===========================================================================
// ÀṢẸ — Balance Simulator
// ===========================================================================
// Play the game thousands of times without touching a browser, to see how the
// numbers actually shake out. It drives the REAL combat engine and the REAL
// content modules (cards, enemies, relics, potions, encounter tables, map gen),
// so it stays correct as you rebalance — there is nothing to hand-sync.
//
//   node tools/balance-sim.mjs                     # full climbs, all champions
//   node tools/balance-sim.mjs --mode encounters   # isolated fight tuning
//   node tools/balance-sim.mjs --char amara -n 500 # more samples, one champion
//   node tools/balance-sim.mjs --path aggressive   # bias the route choice
//   node tools/balance-sim.mjs --json > out.json   # machine-readable
//
// Options:
//   --mode  runs | encounters | both   (default: runs)
//   --char  amara | kofi | zara | all   (default: all)
//   -n, --n N                           samples per champion (default: 300 runs / 200 per-encounter)
//   --seed  N                           base RNG seed (default: 12345; runs use seed+i)
//   --act   1|2|3                        encounters mode: which act's fights (default: all)
//   --path  random | aggressive | cautious   route strategy (default: random)
//   -a, --ascension N                   ascension level 0-12 (default: 0) — scales enemy HP/damage etc.
//   --upgraded                          encounters mode: test with a fully-upgraded starter deck
//   --json                              emit JSON instead of a text report
//
// The player/pathing/deck/rest AI lives in tools/sim/policies.mjs — tune it to
// model different skill levels. Everything else is the game's own code.

import { CHARACTERS } from '../src/data/characters.js';
import { ENCOUNTERS, ACT_NAMES } from '../src/data/encounters.js';
import { ENEMIES } from '../src/data/enemies.js';
import { RunState } from '../src/core/state.js';
import { runCombat } from './sim/harness.mjs';
import { simulateRun } from './sim/run.mjs';
import { defaultPlayerPolicy } from './sim/policies.mjs';

// --------------------------------------------------------------- args
function parseArgs(argv) {
  const a = { mode: 'runs', char: 'all', n: null, seed: 12345, act: 'all', path: 'random', upgraded: false, ascension: 0, json: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--mode') a.mode = argv[++i];
    else if (t === '--char') a.char = argv[++i];
    else if (t === '-n' || t === '--n') a.n = parseInt(argv[++i], 10);
    else if (t === '--seed') a.seed = parseInt(argv[++i], 10);
    else if (t === '--act') a.act = argv[++i];
    else if (t === '--path') a.path = argv[++i];
    else if (t === '--ascension' || t === '-a') a.ascension = parseInt(argv[++i], 10) || 0;
    else if (t === '--upgraded') a.upgraded = true;
    else if (t === '--json') a.json = true;
    else if (t === '--help' || t === '-h') a.help = true;
  }
  return a;
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const r1 = (x) => Math.round(x * 10) / 10;
const encLabel = (ids) => ids.map((id) => ENEMIES[id]?.name || id).join(' + ');

function resolveChars(sel) {
  if (sel === 'all') return Object.keys(CHARACTERS);
  return sel.split(',').map((s) => s.trim()).filter((c) => CHARACTERS[c]);
}

// ======================================================================
// ENCOUNTERS MODE — pit a controlled deck against each defined fight.
// ======================================================================
async function runEncounterMode(args) {
  const chars = resolveChars(args.char);
  const n = args.n || 200;
  const acts = args.act === 'all' ? [1, 2, 3] : [parseInt(args.act, 10)];
  const tiers = ['weak', 'normal', 'hard', 'elite', 'boss'];
  const results = [];

  for (const charId of chars) {
    for (const act of acts) {
      const table = ENCOUNTERS[act];
      for (const tier of tiers) {
        for (const enemyIds of (table[tier] || [])) {
          const rec = { charId, act, tier, enemyIds, wins: 0, losses: 0, turns: [], hpLost: [] };
          for (let i = 0; i < n; i++) {
            // Fresh champion at full HP with the (optionally upgraded) starter deck.
            const run = new RunState(charId, args.seed + i * 7919 + act * 131 + tier.length, args.ascension);
            if (args.upgraded) run.deck.forEach((e) => { e.upgraded = true; });
            const f = await runCombat(run, enemyIds, tier === 'weak' ? 'monster' : tier, defaultPlayerPolicy);
            if (f.victory) rec.wins++; else rec.losses++;
            rec.turns.push(f.turns);
            rec.hpLost.push(f.hpLost);
          }
          results.push(rec);
        }
      }
    }
  }
  return results;
}

function reportEncounters(results, args) {
  if (args.json) { console.log(JSON.stringify({ mode: 'encounters', args, results: results.map(summ) }, null, 2)); return; }
  const byChar = groupBy(results, (r) => r.charId);
  console.log(`\n=== ENCOUNTER BALANCE  (${(args.n || 200)} sims each · ${args.upgraded ? 'UPGRADED' : 'starter'} deck · A${args.ascension}) ===`);
  for (const [charId, recs] of byChar) {
    console.log(`\n${CHARACTERS[charId].name}  (${CHARACTERS[charId].title})`);
    console.log(pad('  Act / Tier', 14) + pad('Encounter', 34) + pad('Win%', 8) + pad('AvgTurns', 10) + pad('AvgHPLost', 10) + 'Flag');
    for (const r of recs) {
      const winRate = r.wins / (r.wins + r.losses);
      const avgHp = mean(r.hpLost);
      const flag = winRate < 0.6 ? '⚠ HARD' : winRate > 0.99 && avgHp < 3 ? '· trivial' : '';
      console.log(
        pad(`  ${r.act} ${r.tier}`, 14) +
        pad(encLabel(r.enemyIds), 34) +
        pad(pct(winRate), 8) +
        pad(String(r1(mean(r.turns))), 10) +
        pad(String(r1(avgHp)), 10) + flag,
      );
    }
  }
}
const summ = (r) => ({
  charId: r.charId, act: r.act, tier: r.tier, enemy: encLabel(r.enemyIds), enemyIds: r.enemyIds,
  n: r.wins + r.losses, winRate: r.wins / (r.wins + r.losses),
  avgTurns: r1(mean(r.turns)), avgHpLost: r1(mean(r.hpLost)),
});

// ======================================================================
// RUNS MODE — full climbs along generated paths.
// ======================================================================
async function runRunsMode(args) {
  const chars = resolveChars(args.char);
  const n = args.n || 300;
  const out = {};
  for (const charId of chars) {
    const runs = [];
    for (let i = 0; i < n; i++) {
      runs.push(await simulateRun(charId, args.seed + i, { pathStrategy: args.path, ascension: args.ascension }));
    }
    out[charId] = runs;
  }
  return out;
}

function reportRuns(out, args) {
  if (args.json) {
    const compact = {};
    for (const [c, runs] of Object.entries(out)) {
      compact[c] = runs.map((r) => ({ seed: r.seed, victory: r.victory, actReached: r.actReached, hp: r.hp, death: r.death, deckSize: r.deckSize, relics: r.relics }));
    }
    console.log(JSON.stringify({ mode: 'runs', args, summary: runsSummary(out), runs: compact }, null, 2));
    return;
  }
  console.log(`\n=== FULL-RUN BALANCE  (${args.n || 300} climbs each · path='${args.path}' · A${args.ascension}) ===`);
  for (const [charId, runs] of Object.entries(out)) {
    const wins = runs.filter((r) => r.victory);
    const winRate = wins.length / runs.length;
    console.log(`\n${CHARACTERS[charId].name}  (${CHARACTERS[charId].title})`);
    console.log(`  Win rate (cleared Act 3):  ${pct(winRate)}  (${wins.length}/${runs.length})`);
    console.log(`  Avg act reached:           ${r1(mean(runs.map((r) => r.actReached)))}`);
    console.log(`  Avg HP left on victory:    ${wins.length ? r1(mean(wins.map((r) => r.hp))) : '—'}`);
    console.log(`  Avg deck / relics at end:  ${r1(mean(runs.map((r) => r.deckSize)))} cards · ${r1(mean(runs.map((r) => r.relics)))} relics`);

    // where do runs end?
    const reach = { 1: 0, 2: 0, 3: 0, win: 0 };
    for (const r of runs) { if (r.victory) reach.win++; else reach[r.actReached]++; }
    console.log(`  Ended in:  Act1 ${reach[1]} · Act2 ${reach[2]} · Act3 ${reach[3]} · Victory ${reach.win}`);

    // deadliest fights (by deaths, then HP drain)
    const enc = new Map();
    for (const r of runs) {
      for (const f of r.fights) {
        const key = `A${f.act} ${encLabel(f.enemyIds)}`;
        const e = enc.get(key) || { key, kind: f.kind, count: 0, hpLost: [], turns: [], deaths: 0 };
        e.count++; e.hpLost.push(f.hpLost); e.turns.push(f.turns);
        if (!f.victory) e.deaths++;
        enc.set(key, e);
      }
    }
    const table = [...enc.values()]
      .sort((a, b) => (b.deaths - a.deaths) || (mean(b.hpLost) - mean(a.hpLost)))
      .slice(0, 10);
    console.log(`  Toughest fights encountered:`);
    console.log('    ' + pad('Fight', 40) + pad('Seen', 7) + pad('Deaths', 8) + pad('AvgHPLost', 11) + 'AvgTurns');
    for (const e of table) {
      console.log('    ' +
        pad(e.key, 40) + pad(String(e.count), 7) +
        pad(String(e.deaths), 8) + pad(String(r1(mean(e.hpLost))), 11) +
        String(r1(mean(e.turns))));
    }
  }
}

function runsSummary(out) {
  const s = {};
  for (const [charId, runs] of Object.entries(out)) {
    const wins = runs.filter((r) => r.victory);
    s[charId] = {
      n: runs.length,
      winRate: wins.length / runs.length,
      avgActReached: r1(mean(runs.map((r) => r.actReached))),
      avgHpOnVictory: wins.length ? r1(mean(wins.map((r) => r.hp))) : null,
    };
  }
  return s;
}

// --------------------------------------------------------------- misc utils
function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function pad(s, w) { s = String(s); return s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length); }

// --------------------------------------------------------------- main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('See header of tools/balance-sim.mjs for usage.');
    return;
  }
  const t0 = Date.now();
  if (args.mode === 'encounters' || args.mode === 'both') {
    reportEncounters(await runEncounterMode(args), args);
  }
  if (args.mode === 'runs' || args.mode === 'both') {
    reportRuns(await runRunsMode(args), args);
  }
  if (!args.json) console.log(`\n(done in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

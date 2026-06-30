// Branching act map à la Slay the Spire: a layered DAG of rooms the player
// navigates upward. Rows are floors; columns are lanes. Paths wander between
// adjacent columns, sharing nodes where they cross.

const ROWS = 15;
const COLS = 5;
const PATHS = 5;

export function generateMap(rng, act) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  const ensure = (r, c) => {
    if (!grid[r][c]) grid[r][c] = { row: r, col: c, type: null, next: [] };
    return grid[r][c];
  };

  // Carve paths
  const starts = [];
  for (let p = 0; p < PATHS; p++) {
    let cur = p < COLS ? p % COLS : rng.int(0, COLS - 1);
    if (p === 0) cur = rng.int(0, COLS - 1);
    ensure(0, cur);
    if (!starts.includes(cur)) starts.push(cur);
    for (let r = 1; r < ROWS; r++) {
      const opts = [cur - 1, cur, cur + 1].filter((c) => c >= 0 && c < COLS);
      const nc = rng.pick(opts);
      ensure(r, nc);
      const prev = grid[r - 1][cur];
      if (!prev.next.includes(nc)) prev.next.push(nc);
      cur = nc;
    }
  }

  // Assign room types
  const TREASURE_ROW = 8;
  const REST_ROW = ROWS - 1; // campfire before the boss
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      if (!node) continue;
      if (r === 0) { node.type = 'monster'; continue; }
      if (r === TREASURE_ROW) { node.type = 'treasure'; continue; }
      if (r === REST_ROW) { node.type = 'rest'; continue; }
      node.type = rollRoom(rng, r);
    }
  }

  return { act, rows: ROWS, cols: COLS, grid, starts: starts.sort((a, b) => a - b), boss: { type: 'boss' } };
}

function rollRoom(rng, row) {
  const table = [];
  table.push({ value: 'monster', weight: 45 });
  table.push({ value: 'event', weight: 22 });
  table.push({ value: 'shop', weight: 9 });
  if (row >= 4) {
    table.push({ value: 'elite', weight: 16 });
    table.push({ value: 'rest', weight: 8 });
  } else {
    table.push({ value: 'monster', weight: 24 });
  }
  return rng.weighted(table);
}

// Nodes reachable from the player's current position.
export function nextNodes(map, position) {
  if (!position) return map.starts.map((c) => ({ row: 0, col: c }));
  const node = map.grid[position.row][position.col];
  if (!node) return [];
  if (position.row === map.rows - 1) return [{ boss: true }];
  return node.next.map((c) => ({ row: position.row + 1, col: c }));
}

export function nodeAt(map, pos) {
  if (pos.boss) return map.boss;
  return map.grid[pos.row][pos.col];
}

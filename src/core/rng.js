// Seeded, deterministic pseudo-random number generator (mulberry32).
// Each run uses a seed so the journey up the Spire can, in principle, be replayed.

export class RNG {
  constructor(seed) {
    if (typeof seed === 'string') seed = hashString(seed);
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  // Returns a float in [0, 1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [min, max] inclusive
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min, max) {
    return this.next() * (max - min) + min;
  }

  bool(chance = 0.5) {
    return this.next() < chance;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Fisher-Yates shuffle (returns a new array)
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Pick `count` distinct items
  sample(arr, count) {
    return this.shuffle(arr).slice(0, count);
  }

  // Weighted pick: items = [{ value, weight }]
  weighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }
}

export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

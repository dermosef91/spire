#!/usr/bin/env node
// Temporary data-fetch helper for the Munich restaurant map (see munich-restaurant-map/).
// Runs on a GitHub Actions runner (open egress) — the Claude session network
// policy blocks Overpass directly. Zero deps; Node >= 18 (global fetch).
//
// Writes:
//   tools/munich/raw-districts.json   — Munich Stadtbezirke boundaries (admin_level 9/10), full geometry
//   tools/munich/raw-restaurants.json — amenity=restaurant/fast_food/cafe/bar with tags + center coords

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(outDir, { recursive: true });

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(query, label) {
  for (const url of MIRRORS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[${label}] POST ${url} (attempt ${attempt})`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`[${label}] got ${json.elements?.length ?? 0} elements`);
        return json;
      } catch (e) {
        console.warn(`[${label}] failed: ${e.message}`);
        await new Promise(r => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw new Error(`[${label}] all mirrors failed`);
}

// Munich = kreisfreie Stadt München, admin_level 6. Stadtbezirke are 9 or 10
// depending on mapping era — fetch both, the processor picks the level that
// yields the canonical 25 districts.
const DISTRICTS_Q = `
[out:json][timeout:300];
area["boundary"="administrative"]["admin_level"="6"]["name"="München"]->.muc;
rel(area.muc)["boundary"="administrative"]["admin_level"~"^(9|10)$"];
out geom tags;
`;

const RESTAURANTS_Q = `
[out:json][timeout:600];
area["boundary"="administrative"]["admin_level"="6"]["name"="München"]->.muc;
nwr(area.muc)["amenity"~"^(restaurant|fast_food|cafe|bar)$"];
out tags center;
`;

const districts = await overpass(DISTRICTS_Q, 'districts');
writeFileSync(join(outDir, 'raw-districts.json'), JSON.stringify(districts));

const restaurants = await overpass(RESTAURANTS_Q, 'restaurants');
writeFileSync(join(outDir, 'raw-restaurants.json'), JSON.stringify(restaurants));

console.log('done');

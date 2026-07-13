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
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

// Overpass instances 406/403 requests without an identifying UA, and shared
// GitHub-runner IPs get 429s — identify ourselves and back off patiently.
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'munich-restaurant-map-databuild/1.0 (one-off; https://github.com/dermosef91/spire)',
  'Accept': 'application/json',
};

async function overpass(query, label) {
  for (let round = 1; round <= 3; round++) {
    for (const url of MIRRORS) {
      try {
        console.log(`[${label}] POST ${url} (round ${round})`);
        const res = await fetch(url, {
          method: 'POST',
          headers: HEADERS,
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.elements) throw new Error('no elements in response');
        console.log(`[${label}] got ${json.elements.length} elements`);
        return json;
      } catch (e) {
        console.warn(`[${label}] failed: ${e.message}`);
        await new Promise(r => setTimeout(r, 15000 * round));
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

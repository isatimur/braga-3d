// Fetch the Braga street network from OpenStreetMap (Overpass API) and write data/roads.json.
// Node 22, no dependencies. Run: node scripts/fetch-roads.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'roads.json');

// West edge is -8.490 (not -8.455) so the bbox includes Mosteiro de Tibães (lon -8.4788).
const BBOX = { s: 41.52, w: -8.49, n: 41.575, e: -8.36 };
const ORIGIN = { lat: 41.5503, lon: -8.42 };
const TOLERANCE_M = 5;

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
const QUERY = `[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|pedestrian|living_street)$"](${b});
  way["waterway"~"^(river|stream)$"](${b});
  way["railway"="rail"](${b});
);
out geom;`;

const KIND = {
  motorway: 'primary', trunk: 'primary', primary: 'primary',
  secondary: 'secondary', tertiary: 'secondary',
};

const wait = ms => new Promise(res => setTimeout(res, ms));

async function fetchOverpass() {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    for (const url of MIRRORS) {
      try {
        console.log(`Overpass: ${url} (round ${round + 1})`);
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'braga-3d-data/1.0' },
          body: 'data=' + encodeURIComponent(QUERY),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!Array.isArray(j.elements) || j.elements.length === 0) throw new Error('empty response');
        return j.elements;
      } catch (e) {
        lastErr = e;
        console.warn(`  failed: ${e.message}`);
        await wait(5000 * (round + 1));
      }
    }
  }
  throw new Error(`All Overpass mirrors failed: ${lastErr?.message}`);
}

// Local equirectangular projection in metres around ORIGIN.
const M_LAT = 111320;
const M_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toXY = ([lat, lon]) => [(lon - ORIGIN.lon) * M_LON, (lat - ORIGIN.lat) * M_LAT];

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Iterative Douglas-Peucker on projected points; returns kept indices.
function simplify(pts, tol) {
  if (pts.length <= 2) return pts.map((_, i) => i);
  const xy = pts.map(toXY);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let max = 0, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = segDist(xy[k], xy[i], xy[j]);
      if (d > max) { max = d; idx = k; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([i, idx], [idx, j]); }
  }
  const out = [];
  keep.forEach((v, i) => v && out.push(i));
  return out;
}

const r5 = v => Math.round(v * 1e5) / 1e5;

function kindOf(tags) {
  if (tags.waterway) return 'water';
  if (tags.railway) return 'rail';
  return KIND[tags.highway] || 'minor';
}

// Overpass returns whole ways, which can run km past the bbox. Split each way into
// runs of in-bbox points; keep one outside neighbour on each side so lines reach the edge.
const inBox = ([lat, lon]) => lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e;
function clip(pts) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < pts.length; i++) {
    if (inBox(pts[i])) {
      if (!cur) { cur = i > 0 ? [pts[i - 1]] : []; }
      cur.push(pts[i]);
    } else if (cur) {
      cur.push(pts[i]);
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs.filter(r => r.length >= 2);
}

const elements = await fetchOverpass();
const features = [];
const counts = {};
for (const el of elements) {
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
  const kind = kindOf(el.tags || {});
  for (const raw of clip(el.geometry.map(g => [g.lat, g.lon]))) {
    const pts = simplify(raw, TOLERANCE_M).map(i => [r5(raw[i][0]), r5(raw[i][1])]);
    const dedup = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (dedup.length < 2) continue;
    counts[kind] = (counts[kind] || 0) + 1;
    features.push({ kind, pts: dedup });
  }
}
if (features.length === 0) throw new Error('No features after conversion');

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify({ origin: ORIGIN, bbox: BBOX, features });
writeFileSync(OUT, json);
console.log(`Wrote ${OUT}: ${features.length} features, ${(json.length / 1024 / 1024).toFixed(2)} MB`, counts);

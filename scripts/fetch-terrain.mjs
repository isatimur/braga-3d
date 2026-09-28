// Fetch a real elevation grid for the Braga bbox and write data/terrain.json.
// Source: OpenTopoData (EU-DEM 25 m, fallback SRTM 30 m), fallback Open-Elevation.
// Node 22, no dependencies. Run: node scripts/fetch-terrain.mjs
// Public OpenTopoData limits: 100 locations per request, 1 request per second.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'terrain.json');
const CACHE = join(ROOT, 'data', '.cache', 'terrain-raw.json');

const BBOX = { s: 41.52, w: -8.49, n: 41.575, e: -8.36 };
const COLS = 90; // along longitude, west -> east
const ROWS = 60; // along latitude, south -> north
const BATCH = 100;
const PACE_MS = 1100;
const DATASETS = ['eudem25m', 'srtm30m'];

const wait = ms => new Promise(res => setTimeout(res, ms));
const lonAt = c => BBOX.w + ((BBOX.e - BBOX.w) * c) / (COLS - 1);
const latAt = r => BBOX.s + ((BBOX.n - BBOX.s) * r) / (ROWS - 1);

// Row-major, row 0 = south edge, col 0 = west edge.
const points = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) points.push([latAt(r), lonAt(c)]);

async function openTopo(dataset, pts) {
  const loc = pts.map(([la, lo]) => `${la.toFixed(6)},${lo.toFixed(6)}`).join('|');
  const url = `https://api.opentopodata.org/v1/${dataset}?locations=${loc}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'braga-3d-data/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.status !== 'OK' || !Array.isArray(j.results) || j.results.length !== pts.length) {
    throw new Error(`bad reply: ${j.status} ${j.error || ''}`);
  }
  return j.results.map(x => x.elevation);
}

async function openElevation(pts) {
  const r = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'braga-3d-data/1.0' },
    body: JSON.stringify({ locations: pts.map(([latitude, longitude]) => ({ latitude, longitude })) }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return j.results.map(x => x.elevation);
}

// Fetch one batch; try each source in order, with retries. Returns {values, source}.
async function fetchBatch(pts) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const ds of DATASETS) {
      try {
        const v = await openTopo(ds, pts);
        if (v.every(x => typeof x === 'number')) return { values: v, source: `opentopodata/${ds}` };
        throw new Error(`null elevations in ${ds}`);
      } catch (e) {
        lastErr = e;
        console.warn(`  ${ds} failed: ${e.message}`);
        await wait(PACE_MS * (attempt + 1));
      }
    }
    try {
      return { values: await openElevation(pts), source: 'open-elevation' };
    } catch (e) {
      lastErr = e;
      console.warn(`  open-elevation failed: ${e.message}`);
      await wait(3000 * (attempt + 1));
    }
  }
  throw new Error(`All elevation sources failed: ${lastErr?.message}`);
}

// Resumable cache of raw batch results keyed by batch index.
mkdirSync(dirname(CACHE), { recursive: true });
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const key = `${COLS}x${ROWS}:${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
if (cache.key !== key) { cache.key = key; cache.batches = {}; }

const nBatches = Math.ceil(points.length / BATCH);
for (let b = 0; b < nBatches; b++) {
  if (cache.batches[b]) continue;
  const pts = points.slice(b * BATCH, (b + 1) * BATCH);
  const res = await fetchBatch(pts);
  cache.batches[b] = res;
  writeFileSync(CACHE, JSON.stringify(cache));
  console.log(`batch ${b + 1}/${nBatches} ok (${res.source})`);
  await wait(PACE_MS);
}

const heights = [];
const sources = {};
for (let b = 0; b < nBatches; b++) {
  const { values, source } = cache.batches[b];
  sources[source] = (sources[source] || 0) + values.length;
  heights.push(...values.map(v => Math.round(v * 10) / 10));
}
if (heights.length !== COLS * ROWS) throw new Error(`grid has ${heights.length} values, want ${COLS * ROWS}`);

const min = Math.min(...heights), max = Math.max(...heights);

// Bilinear sample for sanity checks.
function sample(lat, lon) {
  const fc = ((lon - BBOX.w) / (BBOX.e - BBOX.w)) * (COLS - 1);
  const fr = ((lat - BBOX.s) / (BBOX.n - BBOX.s)) * (ROWS - 1);
  const c0 = Math.floor(fc), r0 = Math.floor(fr), tc = fc - c0, tr = fr - r0;
  const h = (r, c) => heights[Math.min(ROWS - 1, r) * COLS + Math.min(COLS - 1, c)];
  return (h(r0, c0) * (1 - tc) + h(r0, c0 + 1) * tc) * (1 - tr) + (h(r0 + 1, c0) * (1 - tc) + h(r0 + 1, c0 + 1) * tc) * tr;
}

// Point samples at exact coordinates (not interpolated from the grid).
const probes = { centre: [41.5503, -8.42], 'bom-jesus': [41.55494, -8.37703], sameiro: [41.54182, -8.36954] };
const probeRes = await fetchBatch(Object.values(probes));
const sanity = {};
Object.keys(probes).forEach((k, i) => {
  sanity[k] = { point_m: Math.round(probeRes.values[i]), grid_m: Math.round(sample(...probes[k])) };
});

const out = {
  bbox: BBOX,
  cols: COLS,
  rows: ROWS,
  row_order: 'south_to_north',
  col_order: 'west_to_east',
  spacing_deg: { lat: (BBOX.n - BBOX.s) / (ROWS - 1), lon: (BBOX.e - BBOX.w) / (COLS - 1) },
  source: Object.keys(sources).join(', '),
  min_m: min,
  max_m: max,
  sanity,
  heights,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`Wrote ${OUT}: ${COLS}x${ROWS}, min ${min} m, max ${max} m, sources`, sources);
console.log('sanity', sanity);

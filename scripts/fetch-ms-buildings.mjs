// Microsoft Global ML Building Footprints (ODbL) for the gaps in the OSM
// buildings. https://github.com/microsoft/GlobalMLBuildingFootprints
//
// Node 22, no dependencies. Run: node scripts/fetch-ms-buildings.mjs [--fetch | --build]
//   (default: fetch what is missing, then build)
//
//   fetch  the dataset-links CSV, the zoom-9 quadkeys over the wide bbox
//          (lat 41.47..41.63, lon -8.55..-8.30), their Portugal GeoJSONL
//          files (gzipped, ~125 MB) into data/.cache/ms-raw/; then one pass
//          keeps the polygons inside the bbox in data/.cache/ms-raw/bbox.json.
//   build  simplify (1 m), round to 5 decimals, drop slivers < 12 m², drop
//          every polygon that overlaps an OSM building (data/buildings.json,
//          data/tiles/*.json) or a landmark outline/part (data/footprints.json)
//          by >= 15 % of either polygon's area, drop MS duplicates (quadkey
//          seams), set heights, and write
//            data/buildings-ms.json          the core bbox, buildings.json format, k "ms"
//            data/tiles-ms/<x>_<y>.json      the ring, the data/tiles grid and format
//            data/tiles-ms/index.json
//          Re-run --build after buildings.json, the tiles or footprints change.
//
// Heights: MS `height` when > 0; otherwise the area class (<= 80 m² 4 m,
// <= 200 m² 7 m, <= 600 m² 10 m, larger 12 m). Above 80 m², when at least 3
// OSM buildings stand within 150 m, the height is the mean of the area class
// and their mean height; in the historic centre (600 m around the Sé) +2 m
// when that OSM mean is above the area class. Rounded to 0.5 m, 3..40 m.
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, renameSync } from 'node:fs';
import { createGunzip, gzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, CORE_BBOX, TILE_GRID, simplifyRing, toXY } from './geo-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', '.cache', 'ms-raw');
const BBOX_FILE = join(RAW, 'bbox.json');
const OUT_CORE = join(ROOT, 'data', 'buildings-ms.json');
const OUT_DIR = join(ROOT, 'data', 'tiles-ms');
const LINKS = 'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv';
const WIDE = { s: 41.47, w: -8.55, n: 41.63, e: -8.3 };
const G = TILE_GRID;
const args = process.argv.slice(2);
const DO_FETCH = !args.includes('--build');
const DO_BUILD = !args.includes('--fetch');

// ML outlines sit 1-3 m off the OSM outline of the same house: at 30 % some
// 280 core houses stood half inside an OSM one; 15 % drops them
const OVERLAP = 0.15;
const MIN_M2 = 12;
const SIMPLIFY_M = 1;
const NEAR_M = 150;
const CENTRE = toXY([41.5498, -8.427]); // the Sé
const CENTRE_R = 600;
const SCHOOL = [41.55751, -8.41708]; // Colégio Leonardo da Vinci, for the report

const q5 = (v) => Math.round(v * 1e5);
const r5 = (v) => q5(v) / 1e5;

// ------------------------------------------------------------ quadkeys
function tileXY(lat, lon, z) {
  const n = 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [Math.floor(((lon + 180) / 360) * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)];
}
function quadkey(x, y, z) {
  let q = '';
  for (let i = z; i > 0; i--) {
    const m = 1 << (i - 1);
    q += ((x & m ? 1 : 0) + (y & m ? 2 : 0)).toString();
  }
  return q;
}
function quadkeysFor(b, z = 9) {
  const [x0, y0] = tileXY(b.n, b.w, z);
  const [x1, y1] = tileXY(b.s, b.e, z);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(quadkey(x, y, z));
  return out;
}

// ------------------------------------------------------------ fetch
async function download(url, file) {
  const tmp = file + '.part';
  const res = await fetch(url, { headers: { 'User-Agent': 'braga-3d-data/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  renameSync(tmp, file);
}

async function fetchAll() {
  mkdirSync(RAW, { recursive: true });
  const linksFile = join(RAW, 'dataset-links.csv');
  if (!existsSync(linksFile)) {
    console.log('fetch: dataset-links.csv');
    await download(LINKS, linksFile);
  }
  const want = new Set(quadkeysFor(WIDE));
  const rows = readFileSync(linksFile, 'utf8')
    .split('\n')
    .map((l) => l.split(','))
    .filter((c) => c[0] === 'Portugal' && want.has(c[1]));
  console.log(`fetch: quadkeys ${[...want].join(', ')}; Portugal files ${rows.length}`);
  if (!rows.length) throw new Error('no Portugal files for these quadkeys');
  const files = [];
  for (const [, qk, url, size] of rows) {
    const file = join(RAW, `${qk}-${url.split('/').pop()}`);
    if (!existsSync(file)) {
      console.log(`fetch: ${qk} (${size})`);
      await download(url, file);
    }
    files.push(file);
  }

  // one pass: the polygons inside the wide bbox ([lon, lat] as in the source)
  let total = 0;
  const kept = [];
  const exact = new Set();
  let exactDup = 0;
  const lonLat = /\[\[\[(-?[\d.]+), (-?[\d.]+)\]/;
  for (const file of files) {
    let n = 0;
    const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      n++;
      const m = lonLat.exec(line);
      if (!m) continue;
      const lon = +m[1];
      const lat = +m[2];
      if (lat < WIDE.s - 0.002 || lat > WIDE.n + 0.002 || lon < WIDE.w - 0.002 || lon > WIDE.e + 0.002) continue;
      const f = JSON.parse(line);
      const g = f.geometry;
      const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [];
      for (const ring of rings) {
        const key = ring.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
        if (exact.has(key)) {
          exactDup++;
          continue;
        }
        exact.add(key);
        kept.push({ r: ring.map((p) => [+p[1].toFixed(7), +p[0].toFixed(7)]), h: f.properties?.height ?? -1 });
      }
    }
    total += n;
    console.log(`fetch: ${file.split('/').pop()}: ${n} features`);
  }
  writeFileSync(BBOX_FILE, JSON.stringify({ fetched: new Date().toISOString(), files: files.map((f) => f.split('/').pop()), scanned: total, exactDup, polys: kept }));
  console.log(`fetch: ${total} features scanned, ${kept.length} polygons near the bbox (${exactDup} exact duplicates across files)`);
}

// ------------------------------------------------------------ geometry (metres)
function area(xy) {
  let a = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) a += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  return a / 2;
}
function centroidXY(xy) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const f = xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
    a += f;
    cx += (xy[j][0] + xy[i][0]) * f;
    cy += (xy[j][1] + xy[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return xy.reduce((s, p) => [s[0] + p[0] / xy.length, s[1] + p[1] / xy.length], [0, 0]);
  return [cx / (3 * a), cy / (3 * a)];
}
function inPoly(x, y, xy) {
  let inside = false;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const a = xy[i];
    const b = xy[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function bboxOf(xy) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of xy) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}
// up to ~200 points on a grid inside the polygon (at least the centroid)
function samples(P) {
  if (P.samples) return P.samples;
  const b = P.box;
  const step = Math.max(0.5, Math.sqrt(((b.x1 - b.x0) * (b.y1 - b.y0)) / 200));
  const out = [];
  for (let x = b.x0 + step / 2; x < b.x1; x += step) for (let y = b.y0 + step / 2; y < b.y1; y += step) if (inPoly(x, y, P.xy)) out.push(x, y);
  if (!out.length) out.push(...centroidXY(P.xy));
  P.samples = out;
  return out;
}
// share of A's sample points inside any polygon of list
function shareIn(A, list) {
  const s = samples(A);
  let hit = 0;
  for (let i = 0; i < s.length; i += 2) {
    const x = s[i];
    const y = s[i + 1];
    for (const B of list) {
      if (x < B.box.x0 || x > B.box.x1 || y < B.box.y0 || y > B.box.y1) continue;
      if (inPoly(x, y, B.xy)) {
        hit++;
        break;
      }
    }
  }
  return (hit * 2) / s.length;
}
const boxHit = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;

// A uniform grid over polygons (by bbox).
function makeIndex(cell) {
  const m = new Map();
  const keyOf = (i, j) => i * 100003 + j;
  return {
    add(P) {
      const b = P.box;
      for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++) {
        for (let j = Math.floor(b.y0 / cell); j <= Math.floor(b.y1 / cell); j++) {
          const k = keyOf(i, j);
          let a = m.get(k);
          if (!a) m.set(k, (a = []));
          a.push(P);
        }
      }
    },
    query(b) {
      const out = new Set();
      for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++) {
        for (let j = Math.floor(b.y0 / cell); j <= Math.floor(b.y1 / cell); j++) {
          const a = m.get(keyOf(i, j));
          if (a) for (const P of a) if (boxHit(P.box, b)) out.add(P);
        }
      }
      return [...out];
    },
  };
}
const polyOf = (ll, extra = {}) => {
  const xy = ll.map(toXY);
  return { xy, box: bboxOf(xy), ...extra };
};

// ------------------------------------------------------------ OSM and landmarks
function decodeTile(t) {
  const out = [];
  for (const rec of t.b) {
    const pts = [];
    let x = 0;
    let y = 0;
    for (let i = 2; i + 1 < rec.length; i += 2) {
      x += rec[i];
      y += rec[i + 1];
      pts.push([(t.o[0] + y) / 1e5, (t.o[1] + x) / 1e5]);
    }
    if (pts.length >= 3) out.push({ p: pts, h: rec[0] / 10 });
  }
  return out;
}

function loadOsm() {
  const osm = [];
  const core = JSON.parse(readFileSync(join(ROOT, 'data', 'buildings.json'), 'utf8'));
  for (const b of core.buildings) if (Array.isArray(b.p) && b.p.length >= 3) osm.push(polyOf(b.p, { h: b.h, src: 'core' }));
  const nCore = osm.length;
  const dir = join(ROOT, 'data', 'tiles');
  for (const f of readdirSync(dir)) {
    if (!/^\d+_\d+\.json$/.test(f)) continue;
    for (const b of decodeTile(JSON.parse(readFileSync(join(dir, f), 'utf8')))) osm.push(polyOf(b.p, { h: b.h, src: 'tile' }));
  }
  const marks = [];
  const fp = JSON.parse(readFileSync(join(ROOT, 'data', 'footprints.json'), 'utf8'));
  for (const [id, v] of Object.entries(fp)) {
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v.outline) && v.outline.length >= 3) marks.push(polyOf(v.outline, { id }));
    for (const p of v.parts || []) if (Array.isArray(p.pts) && p.pts.length >= 3) marks.push(polyOf(p.pts, { id, tag: p.tag }));
  }
  console.log(`build: OSM ${nCore} core + ${osm.length - nCore} tile buildings, ${marks.length} landmark outlines/parts`);
  return { osm, marks };
}

// ------------------------------------------------------------ build
function heightOf(P, near) {
  if (P.msH > 0) return Math.min(60, Math.max(3, Math.round(P.msH * 2) / 2));
  const a = P.area;
  const cls = a <= 80 ? 4 : a <= 200 ? 7 : a <= 600 ? 10 : 12;
  let h = cls;
  if (a > 80 && near.n >= 3) {
    h = (cls + near.mean) / 2;
    const [cx, cy] = P.c;
    if (Math.hypot(cx - CENTRE[0], cy - CENTRE[1]) < CENTRE_R && near.mean > cls) h += 2;
  }
  return Math.min(40, Math.max(3, Math.round(h * 2) / 2));
}

const tileBox = (x, y) => ({ s: G.bbox.s + y * G.dLat, w: G.bbox.w + x * G.dLon, n: G.bbox.s + (y + 1) * G.dLat, e: G.bbox.w + (x + 1) * G.dLon });
const isCoreTile = (x, y) => x >= G.core.x0 && x < G.core.x1 && y >= G.core.y0 && y < G.core.y1;
const inCore = ([la, lo]) => la >= CORE_BBOX.s && la < CORE_BBOX.n && lo >= CORE_BBOX.w && lo < CORE_BBOX.e;

function enc(pts, o) {
  const out = [];
  let px = null;
  let py = null;
  for (const [la, lo] of pts) {
    const x = q5(lo) - o[1];
    const y = q5(la) - o[0];
    if (px === null) out.push(x, y);
    else if (x !== px || y !== py) out.push(x - px, y - py);
    else continue;
    px = x;
    py = y;
  }
  return out;
}

function build() {
  if (!existsSync(BBOX_FILE)) throw new Error('no data/.cache/ms-raw/bbox.json: run with --fetch first');
  const raw = JSON.parse(readFileSync(BBOX_FILE, 'utf8'));
  const { osm, marks } = loadOsm();
  const osmIdx = makeIndex(50);
  for (const P of osm) osmIdx.add(P);
  const markIdx = makeIndex(100);
  for (const P of marks) markIdx.add(P);
  // OSM heights by centroid, for the neighbour mean
  const hIdx = new Map();
  const HC = NEAR_M;
  for (const P of osm) {
    if (!(P.h > 0)) continue;
    const [cx, cy] = centroidXY(P.xy);
    const k = `${Math.floor(cx / HC)},${Math.floor(cy / HC)}`;
    let a = hIdx.get(k);
    if (!a) hIdx.set(k, (a = []));
    a.push(cx, cy, P.h);
  }
  const nearOf = ([x, y]) => {
    let n = 0;
    let s = 0;
    const i0 = Math.floor(x / HC);
    const j0 = Math.floor(y / HC);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const a = hIdx.get(`${i},${j}`);
        if (!a) continue;
        for (let k = 0; k < a.length; k += 3) {
          if (Math.hypot(a[k] - x, a[k + 1] - y) <= NEAR_M) {
            n++;
            s += a[k + 2];
          }
        }
      }
    }
    return { n, mean: n ? s / n : 0 };
  };

  const c = { scanned: raw.scanned, nearBbox: raw.polys.length, exactDupFiles: raw.exactDup, inBbox: 0, degenerate: 0, sliver: 0, dupOsm: 0, dupLandmark: 0, dupMs: 0, msHeight: 0, core: 0, ring: 0 };
  const cand = [];
  for (const rec of raw.polys) {
    let ring = rec.r;
    const c0 = ring[0];
    if (ring.length > 1 && c0[0] === ring.at(-1)[0] && c0[1] === ring.at(-1)[1]) ring = ring.slice(0, -1);
    let ll = simplifyRing(ring, SIMPLIFY_M).map(([la, lo]) => [r5(la), r5(lo)]);
    ll = ll.filter((p, i) => {
      const n = ll[(i + 1) % ll.length];
      return p[0] !== n[0] || p[1] !== n[1];
    });
    if (ll.length < 3) {
      c.degenerate++;
      continue;
    }
    const P = polyOf(ll, { ll, msH: rec.h });
    P.c = centroidXY(P.xy);
    const cLL = [ORIGIN.lat + P.c[1] / 111320, ORIGIN.lon + P.c[0] / (111320 * Math.cos((ORIGIN.lat * Math.PI) / 180))];
    if (cLL[0] < WIDE.s || cLL[0] >= WIDE.n || cLL[1] < WIDE.w || cLL[1] >= WIDE.e) continue;
    if (cLL[0] < G.bbox.s || cLL[0] >= G.bbox.n || cLL[1] < G.bbox.w || cLL[1] >= G.bbox.e) continue;
    c.inBbox++;
    P.cLL = cLL;
    P.area = Math.abs(area(P.xy));
    if (P.area < MIN_M2) {
      c.sliver++;
      continue;
    }
    cand.push(P);
  }

  // overlap with OSM / landmarks: >= 30 % of either polygon
  const overlaps = (P, list) => {
    if (!list.length) return false;
    if (shareIn(P, list) >= OVERLAP) return true;
    for (const B of list) if (shareIn(B, [P]) >= OVERLAP) return true;
    return false;
  };
  const kept = [];
  const msIdx = makeIndex(50);
  // larger first, so a seam duplicate keeps its larger copy
  cand.sort((a, b) => b.area - a.area);
  for (const P of cand) {
    if (overlaps(P, markIdx.query(P.box))) {
      c.dupLandmark++;
      continue;
    }
    if (overlaps(P, osmIdx.query(P.box))) {
      c.dupOsm++;
      continue;
    }
    if (overlaps(P, msIdx.query(P.box))) {
      c.dupMs++;
      continue;
    }
    msIdx.add(P);
    kept.push(P);
  }

  // heights, split core / ring
  const coreList = [];
  const ringTiles = new Map();
  const hist = {};
  for (const P of kept) {
    const h = heightOf(P, P.msH > 0 ? null : nearOf(P.c));
    if (P.msH > 0) c.msHeight++;
    hist[h] = (hist[h] || 0) + 1;
    P.hOut = h;
    if (inCore(P.cLL)) {
      coreList.push({ p: P.ll, h, k: 'ms' });
      c.core++;
      continue;
    }
    const x = Math.floor((P.cLL[1] - G.bbox.w) / G.dLon);
    const y = Math.floor((P.cLL[0] - G.bbox.s) / G.dLat);
    if (x < 0 || y < 0 || x >= G.nx || y >= G.ny || isCoreTile(x, y)) continue;
    const key = `${x}_${y}`;
    let T = ringTiles.get(key);
    if (!T) ringTiles.set(key, (T = { x, y, list: [] }));
    T.list.push(P);
    c.ring++;
  }

  // ---- write the core
  const coreDoc = {
    origin: ORIGIN,
    bbox: CORE_BBOX,
    source: 'Microsoft Global ML Building Footprints, ODbL 1.0 (https://github.com/microsoft/GlobalMLBuildingFootprints)',
    fetched: raw.fetched,
    buildings: coreList,
  };
  const coreJson = JSON.stringify(coreDoc);
  writeFileSync(OUT_CORE, coreJson);

  // ---- write the ring tiles
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  const want = new Set();
  let total = 0;
  for (const T of [...ringTiles.values()].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const box = tileBox(T.x, T.y);
    const o = [q5(box.s), q5(box.w)];
    const out = { v: 1, x: T.x, y: T.y, bbox: [box.s, box.w, box.n, box.e].map((v) => +v.toFixed(6)), o, b: [], r: [], w: [], a: [] };
    for (const P of T.list) out.b.push([Math.round(P.hOut * 10), 0, ...enc(P.ll, o)]);
    const json = JSON.stringify(out);
    const key = `${T.x}_${T.y}`;
    writeFileSync(join(OUT_DIR, `${key}.json`), json);
    want.add(`${key}.json`);
    const bytes = Buffer.byteLength(json);
    total += bytes;
    index.push({ x: T.x, y: T.y, bbox: out.bbox, n: out.b.length, bytes, gz: gzipSync(json).length });
  }
  for (const f of readdirSync(OUT_DIR)) if (/^\d+_\d+\.json$/.test(f) && !want.has(f)) unlinkSync(join(OUT_DIR, f));
  const doc = {
    v: 1,
    source: coreDoc.source,
    fetched: raw.fetched,
    origin: ORIGIN,
    core: CORE_BBOX,
    grid: { bbox: G.bbox, nx: G.nx, ny: G.ny, dLat: G.dLat, dLon: G.dLon, core: G.core },
    kinds: { b: ['ms'] },
    bytes: total,
    gz: index.reduce((s, t) => s + t.gz, 0),
    count: c.ring,
    tiles: index,
  };
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(doc));

  // ---- report
  const school = toXY(SCHOOL);
  const within = (list) => list.filter((P) => Math.hypot(P.c[0] - school[0], P.c[1] - school[1]) <= 150).length;
  for (const P of osm) P.c = centroidXY(P.xy);
  const osmNear = within(osm);
  const msNear = within(kept);
  const coreBytes = Buffer.byteLength(coreJson);
  console.log('counts', c);
  console.log('heights (m: count)', hist);
  console.log(`core: ${c.core} buildings, ${(coreBytes / 1048576).toFixed(2)} MB (${(gzipSync(coreJson).length / 1048576).toFixed(2)} MB gzip)`);
  console.log(`ring: ${c.ring} buildings in ${index.length} tiles, ${(total / 1048576).toFixed(2)} MB (${(doc.gz / 1048576).toFixed(2)} MB gzip), largest ${Math.max(...index.map((t) => t.bytes)) / 1024 | 0} KB`);
  console.log(`school (150 m): OSM ${osmNear}, MS added ${msNear}, total ${osmNear + msNear}`);
}

if (DO_FETCH) await fetchAll();
if (DO_BUILD) build();

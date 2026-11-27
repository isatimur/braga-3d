// Fetch a city's street network from OpenStreetMap (Overpass API) and write <data dir>/roads.json.
// Node 22, no dependencies.
//   node scripts/fetch-roads.mjs            (use the cached raw reply if there is one)
//   node scripts/fetch-roads.mjs --fetch    (always ask Overpass again)
//   --city <id>   the city (default braga; see cities/<id>.json)
//   --dry-run     print the city, bbox and paths, then exit
//
// data/roads.json (Braga; another city: its data dir), v2:
//   { v: 2, origin, bbox, nodes: n, features: [{ kind, pts, t?, j? }] }
//   kind  primary | secondary | minor | foot | rail | water (the draw buckets)
//   pts   [[lat, lon], ...] simplified to 5 m (roundabouts and links 1.5 m);
//         within FOOT_R of the origin to 1 m, with 6 decimals
//   kind foot: every footway, path, cycleway, steps and service way within
//         FOOT_R of the origin; outside it only their bridges
//   t     the tags that matter for drawing and traffic (only those present):
//           hw  highway class (motorway, trunk_link, residential ...)
//           sub footway / path / cycleway / service kind (sidewalk, crossing,
//               alley, driveway, parking_aisle ...), wd mapped width (m)
//           name, ref
//           ow  1 = one way along pts, -1 = one way against pts (OSM oneway,
//               implied for motorway, motorway_link and roundabouts)
//           ln, lf, lb  lanes, lanes:forward, lanes:backward (integers)
//           br  bridge value (yes, viaduct ...), bs bridge:structure
//           tu  tunnel value (yes, building_passage, culvert ...)
//           ly  layer (integer), ms maxspeed (km/h), sf surface, jn junction
//   j     junctions: flat [pointIndex, nodeId, ...]. nodeId is a dense index
//         shared by every feature through the same OSM node: the traffic
//         graph joins streets there. Every feature end is listed too.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dirname } from 'node:path';
import { CITY, BBOX, ORIGIN, overpass, simplify, r5, r6, dataPath, cachePath, dataRel } from './geo-lib.mjs';

const OUT = dataPath('roads.json');
const RAW = cachePath('roads-raw.json.gz');

if (process.argv.includes('--dry-run')) {
  console.log(`city ${CITY.id}; data dir ${dataRel()}`);
  console.log('bbox', BBOX, 'origin', ORIGIN);
  console.log(`out ${dataRel('roads.json')}; cache ${dataRel('.cache', 'roads-raw.json.gz')}, ${dataRel('.cache', 'bridges-raw.json.gz')}`);
  process.exit(0);
}

const ROADS = 'motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|unclassified|residential|living_street|pedestrian';
const FOOT = 'footway|path|cycleway|steps|service|track|bridleway';
const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
// The walkable centre: every footway, path, cycleway, steps, alley and other
// service way within FOOT_R metres of the origin (the street-level detail
// radius of the renderer, src/roads.js SIDEWALK_R, plus a margin). Outside
// it only their bridges. Inside it the geometry keeps more points (CENTRE_TOL,
// 6 decimals). docs/osm-audit-2026-11-27.md has the numbers behind this.
const FOOT_R = CITY.roads?.foot_radius_m ?? 2100;
const CENTRE_TOL = 1;
const QUERY = `[out:json][timeout:240];
(
  way["highway"~"^(${ROADS})$"](${b});
  way["highway"~"^(${FOOT})$"]["bridge"]["bridge"!="no"](${b});
  way["highway"~"^(${FOOT})$"](around:${FOOT_R},${ORIGIN.lat},${ORIGIN.lon});
  way["waterway"~"^(river|stream)$"](${b});
  way["railway"="rail"](${b});
);
out body geom;`;
// a footway or service way the centre draws: not an area outline (the
// pedestrian areas come from streetscape.json), not indoors or on an upper
// floor, not underground or on a raised deck (a tunnel or a layer: the
// network would hide it or stand it on piers), not a private driveway. A
// building passage stays: the houses above cover it. Bridges stay as before.
const isBridge = (t) => !!t.bridge && t.bridge !== 'no';
const footKept = (t) => {
  if (isBridge(t)) return true;
  if (t.area === 'yes' || t.indoor === 'yes') return false;
  if (t.level != null && t.level !== '0') return false;
  if (t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage') return false;
  if (t.layer != null && t.layer !== '0') return false;
  return t.access !== 'private';
};
const M_LAT0 = 111320;
const M_LON0 = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const inCentre = ([lat, lon]) => Math.hypot((lat - ORIGIN.lat) * M_LAT0, (lon - ORIGIN.lon) * M_LON0) <= FOOT_R;

// draw bucket per highway class
const KIND = {
  motorway: 'primary', trunk: 'primary', primary: 'primary',
  motorway_link: 'primary', trunk_link: 'primary', primary_link: 'primary',
  secondary: 'secondary', tertiary: 'secondary', secondary_link: 'secondary', tertiary_link: 'secondary',
  unclassified: 'minor', residential: 'minor', living_street: 'minor', pedestrian: 'minor',
};
const kindOf = (t) => (t.waterway ? 'water' : t.railway ? 'rail' : KIND[t.highway] || (t.highway ? 'foot' : null));

const int = (v) => {
  const m = String(v ?? '').match(/^-?\d+/);
  return m ? parseInt(m[0], 10) : null;
};
function maxspeed(v) {
  if (v == null) return null;
  const s = String(v);
  if (/^PT:urban$/i.test(s)) return 50;
  if (/^PT:rural$/i.test(s)) return 90;
  if (/^PT:motorway$/i.test(s)) return 120;
  if (/^PT:trunk$/i.test(s)) return 100;
  const n = parseFloat(s);
  if (!(n > 0)) return null;
  return Math.round(/mph/.test(s) ? n * 1.609 : n);
}
function oneway(t) {
  const o = String(t.oneway ?? '').toLowerCase();
  if (o === 'yes' || o === 'true' || o === '1') return 1;
  if (o === '-1' || o === 'reverse') return -1;
  if (o === 'no' || o === 'false' || o === '0') return 0;
  if (o === 'reversible' || o === 'alternating') return 0;
  if (t.highway === 'motorway' || t.highway === 'motorway_link') return 1;
  if (t.junction === 'roundabout' || t.junction === 'circular') return 1;
  return 0;
}
function tagsOf(t) {
  const o = {};
  if (t.highway) o.hw = t.highway;
  if (t.railway) o.rw = t.railway;
  if (t.waterway) o.ww = t.waterway;
  if (t.name) o.name = t.name;
  if (t.ref) o.ref = t.ref;
  if (t.highway) {
    const ow = oneway(t);
    if (ow) o.ow = ow;
    const ln = int(t.lanes);
    if (ln > 0 && ln < 10) o.ln = ln;
    const lf = int(t['lanes:forward']);
    if (lf > 0 && lf < 8) o.lf = lf;
    const lb = int(t['lanes:backward']);
    if (lb > 0 && lb < 8) o.lb = lb;
    const ms = maxspeed(t.maxspeed);
    if (ms) o.ms = ms;
    if (t.surface) o.sf = t.surface;
    if (t.junction) o.jn = t.junction;
    if (t.access === 'no' || t.motor_vehicle === 'no' || t.motorcar === 'no') o.nocar = 1;
    // the kind of footway or service way (sidewalk, crossing, alley ...)
    const sub = t.footway || t.path || t.cycleway || t.service;
    if (sub && KIND[t.highway] == null && /^[a-z_]{2,24}$/.test(sub)) o.sub = sub;
    // a mapped width (m), kept for the footways
    const wd = parseFloat(String(t.width ?? '').replace(',', '.'));
    if (KIND[t.highway] == null && wd >= 0.5 && wd <= 20) o.wd = Math.round(wd * 10) / 10;
  }
  if (t.bridge && t.bridge !== 'no') o.br = t.bridge;
  if (t['bridge:structure']) o.bs = t['bridge:structure'];
  if (t['bridge:name']) o.bn = t['bridge:name'];
  if (t.tunnel && t.tunnel !== 'no') o.tu = t.tunnel;
  if (t['tunnel:name']) o.tn = t['tunnel:name'];
  const ly = int(t.layer);
  if (ly) o.ly = ly;
  return o;
}

async function load() {
  if (!process.argv.includes('--fetch') && existsSync(RAW)) {
    console.log(`using cached ${RAW}`);
    return JSON.parse(gunzipSync(readFileSync(RAW)).toString('utf8'));
  }
  const els = await overpass(QUERY, { label: 'roads', rounds: 4 });
  mkdirSync(dirname(RAW), { recursive: true });
  writeFileSync(RAW, gzipSync(JSON.stringify(els)));
  return els;
}

// Overpass returns whole ways, which can run km past the bbox. Split each way into
// runs of in-bbox points; keep one outside neighbour on each side so lines reach the edge.
const inBox = ([lat, lon]) => lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e;
function clipRuns(pts) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < pts.length; i++) {
    if (inBox(pts[i])) {
      if (!cur) cur = i > 0 ? [i - 1] : [];
      cur.push(i);
    } else if (cur) {
      cur.push(i);
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs.filter((r) => r.length >= 2);
}

const elements = await load();
const ways = elements.filter((e) => e.type === 'way' && e.geometry?.length >= 2 && e.nodes?.length === e.geometry.length && kindOf(e.tags || {}) && (kindOf(e.tags) !== 'foot' || footKept(e.tags)));

// how many street ways use each OSM node: 2+ is a junction. `use` counts the
// streets and the footway bridges (the traffic graph, as before the centre's
// footways came in); `meet` counts every way, so a footway's meeting point
// with a street or another footway survives simplification in both.
const net = (t) => KIND[t.highway] != null || isBridge(t);
const use = new Map();
const meet = new Map();
for (const w of ways) {
  if (!w.tags.highway) continue;
  const seen = new Set();
  for (const id of w.nodes) {
    if (seen.has(id)) continue; // a closed way touches its first node twice
    seen.add(id);
    meet.set(id, (meet.get(id) || 0) + 1);
    if (net(w.tags)) use.set(id, (use.get(id) || 0) + 1);
  }
}
const dense = new Map();
const nodeId = (osm) => {
  let v = dense.get(osm);
  if (v === undefined) dense.set(osm, (v = dense.size));
  return v;
};

const features = [];
const counts = {};
const structures = { bridges: [], tunnels: [] };
for (const w of ways) {
  const tags = w.tags;
  const kind = kindOf(tags);
  const t = tagsOf(tags);
  const pts = w.geometry.map((g) => [g.lat, g.lon]);
  const fine = tags.junction === 'roundabout' || tags.junction === 'circular' || /_link$/.test(tags.highway || '') || t.br || t.tu;
  const tol = fine ? 1.5 : 5;
  const isStreet = !!tags.highway;
  for (const run of clipRuns(pts)) {
    // simplify piecewise between the points that must stay: the run's ends
    // and every junction node, so shared nodes survive in both ways
    const keep = [0];
    for (let k = 1; k < run.length - 1; k++) if (isStreet && (meet.get(w.nodes[run[k]]) || 0) > 1) keep.push(k);
    keep.push(run.length - 1);
    const outPts = [];
    const outIds = [];
    for (let s = 0; s < keep.length - 1; s++) {
      const a = keep[s];
      const bb = keep[s + 1];
      const piece = [];
      for (let k = a; k <= bb; k++) piece.push(k);
      const ll = piece.map((k) => pts[run[k]]);
      const sub = simplify(ll, ll.some(inCentre) ? Math.min(tol, CENTRE_TOL) : tol);
      // map simplified points back to their run indices (simplify keeps order)
      let q = 0;
      const idx = [];
      for (const k of piece) {
        if (q < sub.length && pts[run[k]] === sub[q]) {
          idx.push(k);
          q++;
        }
      }
      for (let m = s === 0 ? 0 : 1; m < idx.length; m++) {
        outPts.push(pts[run[idx[m]]]);
        outIds.push(w.nodes[run[idx[m]]]);
      }
    }
    const P = [];
    const J = [];
    for (let k = 0; k < outPts.length; k++) {
      // 5 decimals is up to 0.7 m off; the centre keeps 6 (0.07 m)
      const rd = inCentre(outPts[k]) ? r6 : r5;
      const p = [rd(outPts[k][0]), rd(outPts[k][1])];
      const osm = outIds[k];
      const end = k === 0 || k === outPts.length - 1;
      const junction = isStreet && (end || (use.get(osm) || 0) > 1);
      if (P.length && P.at(-1)[0] === p[0] && P.at(-1)[1] === p[1]) {
        // rounded onto the previous point: the junction id moves there
        if (junction) {
          if (J.length && J.at(-2) === P.length - 1) J[J.length - 1] = nodeId(osm);
          else J.push(P.length - 1, nodeId(osm));
        }
        continue;
      }
      if (junction) J.push(P.length, nodeId(osm));
      P.push(p);
    }
    if (P.length < 2) continue;
    // a closed way (roundabout) ends where it starts: same node id both ends
    const f = { kind, pts: P };
    if (Object.keys(t).length) f.t = t;
    if (J.length) f.j = J;
    features.push(f);
    counts[kind] = (counts[kind] || 0) + 1;
    if (t.br || (t.ly > 0 && !t.tu)) structures.bridges.push(f);
    if (t.tu || t.ly < 0) structures.tunnels.push(f);
  }
}
if (features.length === 0) throw new Error('No features after conversion');

// every street piece must know the nodes at both its ends
let loose = 0;
for (const f of features) {
  if (!f.t?.hw) continue;
  const j = f.j || [];
  const has = (i) => j.some((v, k) => k % 2 === 0 && v === i);
  if (!has(0) || !has(f.pts.length - 1)) loose++;
}
console.log(`street pieces without both end nodes: ${loose}`);
if (loose) throw new Error('junction ids lost');

// the named bridges of OSM (man_made=bridge outlines), for the report
const BR_RAW = cachePath('bridges-raw.json.gz');
let named = [];
try {
  if (!process.argv.includes('--fetch') && existsSync(BR_RAW)) named = JSON.parse(gunzipSync(readFileSync(BR_RAW)).toString('utf8'));
  else {
    named = await overpass(`[out:json][timeout:90];(way["man_made"="bridge"](${b});relation["man_made"="bridge"](${b}););out tags center;`, { label: 'bridges', rounds: 2, allowEmpty: true });
    writeFileSync(BR_RAW, gzipSync(JSON.stringify(named)));
  }
} catch (e) {
  console.warn(`man_made=bridge query failed: ${e.message}`);
}
if (process.argv.includes('--list')) for (const e of named) if (e.tags?.name) console.log('  NAMED', e.tags.name, e.center?.lat, e.center?.lon, e.tags['bridge:structure'] || '', e.tags.material || '');

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify({ v: 2, source: '© OpenStreetMap contributors, ODbL 1.0', origin: ORIGIN, bbox: BBOX, nodes: dense.size, features });
writeFileSync(OUT, json);
console.log(`Wrote ${OUT}: ${features.length} features, ${dense.size} junction nodes, ${(json.length / 1024 / 1024).toFixed(2)} MB`, counts);
const label = (f) => `${f.kind}/${f.t.hw || f.t.rw || f.t.ww} ${f.t.name || f.t.bn || f.t.tn || ''} ${f.t.ref || ''} br=${f.t.br || ''} tu=${f.t.tu || ''} ly=${f.t.ly ?? ''}`.replace(/\s+/g, ' ');
console.log(`bridges ${structures.bridges.length}, tunnels ${structures.tunnels.length}`);
if (process.argv.includes('--list')) {
  for (const f of structures.bridges) console.log('  B', label(f), f.pts[0]);
  for (const f of structures.tunnels) console.log('  T', label(f), f.pts[0]);
}

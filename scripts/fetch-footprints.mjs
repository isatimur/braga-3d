// Fetch the real OSM footprint of every landmark and write data/footprints.json.
// Also adds an `osm` field to each landmark in data/landmarks.json.
// Node 22, no dependencies. Run: node scripts/fetch-footprints.mjs
//
// The OSM object for each landmark was picked by hand from an Overpass search
// (name / historic / place_of_worship / stadium / building within 300 m).
// The script re-checks each pick: the object must exist, carry the expected
// name, lie near the landmark coordinate, and (when tagged) its Wikidata item
// must point back to it (P402) or sit within 400 m of it (P625).
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, wait, toXY, toLL, r6, ringArea, centroid, minAreaRect, tagHeight, simplifyRing } from './geo-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANDMARKS = join(ROOT, 'data', 'landmarks.json');
const OUT = join(ROOT, 'data', 'footprints.json');

// ---------------------------------------------------------------------------
// Curated configuration.
//  main      OSM key of the principal object (outline, bearing, extent).
//  name      regex the main object's name must match (sanity check).
//  site      how parts are collected: {buffer} = main outline grown by N m,
//            {area:key, buffer} = a separate site polygon, {radius} = circle.
//  cats      part categories to collect inside the site.
//  include   extra OSM keys always added as parts; exclude: keys never added.
//  height    fallback / override {m, source, note, force}. `force` is used only
//            where the OSM tag is clearly wrong for the real building.
// ---------------------------------------------------------------------------
const CFG = {
  'bom-jesus': {
    main: 'w146373021', name: /Bom Jesus/, site: { area: 'w1539525894', buffer: 5 },
    cats: ['building', 'stairs', 'funicular', 'water', 'square'],
    // All funicular track ways (the lower half leaves the sanctuary area) + the entrance portico.
    include: ['w26307689', 'w1386644706', 'w772942622', 'w1386644707', 'w772942621', 'w1386644708', 'w1386644709', 'w1386644710', 'w824194596', 'w1539539849'],
  },
  sameiro: {
    main: 'w146227475', name: /Sameiro/, site: { radius: 130 },
    cats: ['building', 'stairs'],
  },
  'se-braga': {
    main: 'w22746378', name: /Sé Catedral/, site: { buffer: 2 },
    cats: ['building', 'garden'],
    // Chapels and the cloister garden of the cathedral complex.
    include: ['w953084301', 'w953084306', 'w1363722399', 'w953084304', 'w953084305', 'w953084310', 'w167197846'],
    // Igreja da Misericórdia touches the Sé but is a separate church.
    exclude: ['w160362963', 'w953084302'],
  },
  'arco-porta-nova': {
    // The gate is an OSM node; its barrier=wall way gives the line across Rua D. Diogo de Sousa.
    main: 'n243891111', name: /Porta Nova/, gateWall: 'w824236466', site: { radius: 1 },
    cats: [], include: ['w815656316'],
  },
  'santa-barbara': {
    main: 'w22745314', name: /Santa Bárbara/, site: { buffer: 3 },
    cats: ['water', 'ruins', 'monument'],
    include: ['w1408446166', 'w1411157146', 'r20123877', 'n1724210420'],
  },
  'praca-republica': {
    main: 'r14626258', name: /Praça da República/, site: { buffer: 2 },
    cats: ['water'], include: ['w132951673', 'w167193931'],
  },
  'theatro-circo': { main: 'w108153358', name: /Theatro Circo/, site: { buffer: 0 }, cats: [] },
  'palacio-raio': { main: 'w269246992', name: /Raio/, site: { buffer: 0 }, cats: [] },
  'torre-menagem': {
    main: 'w828265603', name: /Torre de Menagem/, site: { buffer: 0 }, cats: [], include: ['r17830717'],
  },
  'santa-cruz': { main: 'w121590141', name: /Santa Cruz/, site: { buffer: 0 }, cats: [] },
  'estadio-braga': {
    main: 'w116650252', name: /Estádio Municipal de Braga/, site: { buffer: 0 }, cats: ['pitch'],
    // bearing/extent come from the whole stadium outline (pitch + both stands, 238 m across the
    // pitch). The pitch's own long axis is perpendicular to that; it is written as pitch_bearing_deg.
    include: ['w166248899'], stands: 'r17396393', pitch: 'w166248899',
  },
  'termas-romanas': {
    main: 'r11244034', name: /Termas Romanas/, site: { buffer: 25 },
    // Toilets block and the separate Teatro Romano site (own Wikidata item Q10378913) are left out.
    cats: ['ruins', 'building'], exclude: ['w819854795', 'w170679509'],
  },
  'fonte-idolo': { main: 'w146343020', name: /Fonte do Ídolo/, site: { buffer: 0 }, cats: [] },
  tibaes: {
    main: 'r2271296', name: /Tibães/, site: { buffer: 40 },
    cats: ['building', 'church', 'garden', 'water'], include: ['w170604958'],
    exclude: ['w161754617'],
  },
  biscainhos: {
    main: 'r13337528', name: /Biscainhos/, site: { buffer: 0 }, cats: [], include: ['r20033289'],
  },
  'avenida-central': {
    main: 'w134654858', name: /Avenida Central/, site: { buffer: 8 },
    cats: ['water', 'monument', 'building'],
    include: ['w108153350'], streets: /^Avenida (Central|da Liberdade)$/,
  },
};

// Verified or estimated heights, used when OSM has no height / levels tag (or force).
// Filled from research; each has a source.
import { HEIGHTS } from './landmark-heights.mjs';

// ---------------------------------------------------------------------------
const landmarks = JSON.parse(readFileSync(LANDMARKS, 'utf8'));
const missingCfg = landmarks.filter(l => !CFG[l.id]).map(l => l.id);
if (missingCfg.length) throw new Error(`No config for: ${missingCfg.join(', ')}`);

const keyOf = el => el.type[0] + el.id;
const parseKey = k => ({ type: { w: 'way', r: 'relation', n: 'node' }[k[0]], id: Number(k.slice(1)) });
const dist = (a, b) => { const p = toXY(a), q = toXY(b); return Math.hypot(p[0] - q[0], p[1] - q[1]); };

// ---- 1. Download: all explicit objects + all candidate parts around each landmark ----
const explicit = new Set();
for (const c of Object.values(CFG)) {
  [c.main, c.site.area, c.gateWall, c.stands, ...(c.include || [])].filter(Boolean).forEach(k => explicit.add(k));
}
const byType = { n: [], w: [], r: [] };
for (const k of explicit) byType[k[0]].push(k.slice(1));
let q = '[out:json][timeout:180];(';
if (byType.n.length) q += `node(id:${byType.n.join(',')});`;
if (byType.w.length) q += `way(id:${byType.w.join(',')});`;
if (byType.r.length) q += `relation(id:${byType.r.join(',')});`;
for (const l of landmarks) {
  const R = CFG[l.id].site.radius ? CFG[l.id].site.radius + 50 : l.id === 'bom-jesus' ? 700 : l.id === 'avenida-central' ? 700 : 300;
  const a = `around:${R},${l.lat},${l.lon}`;
  q += `wr(${a})["building"];way(${a})["highway"="steps"];way(${a})["highway"="footway"]["name"~"Escad"];`;
  q += `way(${a})["railway"="funicular"];wr(${a})["leisure"~"garden|pitch|park"];wr(${a})["natural"="water"];`;
  q += `nwr(${a})["amenity"="fountain"];wr(${a})["place"="square"];nwr(${a})["historic"];`;
  if (CFG[l.id].streets) q += `way(${a})["highway"]["name"~"${CFG[l.id].streets.source}"];`;
}
q += ');out geom;';
const elements = await overpass(q, { label: 'footprints' });
const els = new Map(elements.map(e => [keyOf(e), e]));
console.log(`Overpass: ${els.size} unique elements`);

// ---- 2. Geometry helpers ----
function joinRings(ways) {
  const rings = [], open = ways.map(w => w.slice());
  while (open.length) {
    let cur = open.shift(), guard = 0;
    while ((cur[0][0] !== cur.at(-1)[0] || cur[0][1] !== cur.at(-1)[1]) && guard++ < 1000) {
      const end = cur.at(-1);
      const k = open.findIndex(o => (o[0][0] === end[0] && o[0][1] === end[1]) || (o.at(-1)[0] === end[0] && o.at(-1)[1] === end[1]));
      if (k < 0) break;
      const nxt = open.splice(k, 1)[0];
      cur = cur.concat(nxt[0][0] === end[0] && nxt[0][1] === end[1] ? nxt.slice(1) : nxt.reverse().slice(1));
    }
    rings.push(cur);
  }
  return rings;
}
const isClosed = p => p.length >= 4 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1];
// Returns {rings:[closed rings], lines:[open lines], point}
function geomOf(el) {
  if (el.type === 'node') return { rings: [], lines: [], point: [el.lat, el.lon] };
  if (el.type === 'way') {
    const p = (el.geometry || []).map(g => [g.lat, g.lon]);
    const area = isClosed(p) && !(el.tags?.highway && !el.tags?.area && el.tags.highway !== 'pedestrian') && !el.tags?.barrier && !el.tags?.railway;
    return area ? { rings: [p], lines: [] } : { rings: [], lines: [p] };
  }
  const outers = (el.members || []).filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry?.length >= 2)
    .map(m => m.geometry.map(g => [g.lat, g.lon]));
  const joined = joinRings(outers);
  return { rings: joined.filter(isClosed), lines: joined.filter(r => !isClosed(r)) };
}
const allPts = g => [...g.rings.flat(), ...g.lines.flat(), ...(g.point ? [g.point] : [])];
const center = g => (g.rings.length ? centroid(g.rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a))) :
  g.point ? g.point : (() => { const p = allPts(g); return [p.reduce((s, x) => s + x[0], 0) / p.length, p.reduce((s, x) => s + x[1], 0) / p.length]; })());

function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPoly(pxy, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((pxy[0] - a[0]) * dx + (pxy[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    m = Math.min(m, Math.hypot(pxy[0] - a[0] - t * dx, pxy[1] - a[1] - t * dy));
  }
  return m;
}
// Is geometry g inside any of the site polygons grown by buffer (by its centre point)?
function inSite(g, sitePolys, buffer) {
  const c = toXY(center(g));
  return sitePolys.some(p => pointInPoly(c, p) || distToPoly(c, p) <= buffer);
}

function categoryOf(t = {}) {
  if (t.railway === 'funicular') return 'funicular';
  if (t.highway === 'steps' || (t.highway === 'footway' && /Escad/.test(t.name || ''))) return 'stairs';
  if (t.building === 'stadium' || t.building === 'grandstand') return 'stand';
  if (t.leisure === 'pitch') return 'pitch';
  if (t.leisure === 'stadium') return 'site';
  if (t.man_made === 'tower' || t.building === 'tower') return 'tower';
  if (t.historic === 'city_gate') return 'gate';
  if (/church|chapel|cathedral|basilica|religious/.test(t.building || '') || t.amenity === 'place_of_worship') return 'church';
  if (t.historic === 'ruins' || t.historic === 'archaeological_site') return 'ruins';
  if (t.building) return 'building';
  if (t.amenity === 'fountain' || t.natural === 'water') return 'water';
  if (t.leisure === 'garden' || t.leisure === 'park') return 'garden';
  if (t.place === 'square') return 'square';
  if (t.historic === 'memorial' || t.historic === 'monument' || t.historic === 'wayside_cross') return 'monument';
  if (t.highway) return 'street';
  return 'other';
}
const catMatches = (cat, cats) => cats.includes(cat) || (cats.includes('building') && ['church', 'tower', 'stand'].includes(cat));

// Default part heights when OSM has no height tag (stated estimates).
const PART_DEFAULT = { church: 10, building: 7, tower: 15, stand: 25, gate: 10, ruins: 1.5, monument: 4, water: 1.5 };
function partHeight(t, cat) {
  if (Number(t.layer) < 0 || t.location === 'underground') return { h: 0, src: 'underground' };
  const th = tagHeight(t);
  if (th) return { h: th.h, src: th.src };
  if (cat === 'church' && /chapel/.test(t.building || '')) return { h: 6, src: 'estimate' };
  if (t.building === 'roof') return { h: 4, src: 'estimate' };
  if (PART_DEFAULT[cat] != null) return { h: PART_DEFAULT[cat], src: 'estimate' };
  return { h: 0, src: 'flat' };
}

const round = pts => pts.map(([a, b]) => [r6(a), r6(b)]);
const ringOut = r => { const p = r.slice(); if (isClosed(p)) p.pop(); return round(p); };

// Rectangle outline around a gate line: long side along the wall, depth `d` metres.
function rectAroundLine(line, width, depth) {
  const a = toXY(line[0]), b = toXY(line.at(-1));
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]];
  const hw = width / 2, hd = depth / 2;
  return [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]].map(([s, t]) => toLL([c[0] + u[0] * s + v[0] * t, c[1] + u[1] * s + v[1] * t]));
}

// ---- 3. Wikidata verification ----
async function checkWikidata(qid, key, near) {
  try {
    const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: { 'User-Agent': 'braga-3d-data/1.0' } });
    if (!r.ok) return `wikidata ${qid}: HTTP ${r.status}`;
    const ents = (await r.json()).entities;
    const e = ents[qid] || Object.values(ents)[0];
    const claim = p => e.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
    const p402 = claim('P402');
    const label = e.labels?.pt?.value || e.labels?.en?.value;
    const notes = [`${qid} "${label}"`];
    if (p402) notes.push(key[0] === 'r' && String(p402) === key.slice(1) ? 'P402 matches' : `P402=${p402} (differs)`);
    const c = claim('P625');
    if (c) notes.push(`P625 ${Math.round(dist([c.latitude, c.longitude], near))} m away`);
    return notes.join(', ');
  } catch (err) {
    return `wikidata ${qid}: ${err.message}`;
  }
}

// ---- 4. Build each landmark ----
const out = {};
const report = [];
for (const l of landmarks) {
  const cfg = CFG[l.id];
  const main = els.get(cfg.main);
  if (!main) throw new Error(`${l.id}: main object ${cfg.main} not returned by Overpass`);
  const mt = main.tags || {};
  if (!cfg.name.test(mt.name || '')) throw new Error(`${l.id}: ${cfg.main} name "${mt.name}" does not match ${cfg.name}`);

  // Outline of the main object.
  let mg = geomOf(main);
  let outline;
  if (cfg.gateWall) {
    const wall = geomOf(els.get(cfg.gateWall)).lines[0];
    const h = HEIGHTS[l.id] || {};
    const wallLen = dist(wall[0], wall.at(-1));
    outline = rectAroundLine(wall, Math.max(wallLen, h.width_m || 0), h.depth_m || 3);
  } else {
    if (!mg.rings.length) throw new Error(`${l.id}: main object has no closed ring`);
    outline = mg.rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a));
  }
  const mainPoint = mg.point || center(mg);
  const dMain = dist(mainPoint, [l.lat, l.lon]);
  if (dMain > 250) throw new Error(`${l.id}: main object is ${Math.round(dMain)} m from the landmark coordinate`);

  // Principal axis: of the main building, or of `axisFrom` (e.g. the stadium stands).
  const axisPts = cfg.axisFrom ? allPts(geomOf(els.get(cfg.axisFrom))) : outline;
  const rect = minAreaRect(axisPts);

  // Site polygons for part collection.
  let sitePolys = [outline.map(toXY)], buffer = cfg.site.buffer ?? 0;
  if (cfg.site.area) sitePolys = geomOf(els.get(cfg.site.area)).rings.map(r => r.map(toXY));
  const radius = cfg.site.radius;

  const partKeys = new Set();
  for (const [k, el] of els) {
    if (k === cfg.main || k === cfg.site.area || k === cfg.gateWall || k === cfg.stands) continue;
    if ((cfg.exclude || []).includes(k)) continue;
    const g = geomOf(el);
    if (!allPts(g).length) continue;
    const cat = categoryOf(el.tags);
    if (!catMatches(cat, cfg.cats)) continue;
    if (cat === 'street') continue;
    const ok = radius ? dist(center(g), [l.lat, l.lon]) <= radius : inSite(g, sitePolys, buffer);
    if (ok) partKeys.add(k);
  }
  for (const k of cfg.include || []) partKeys.add(k);
  if (cfg.streets) for (const [k, el] of els) if (el.tags?.highway && cfg.streets.test(el.tags.name || '')) partKeys.add(k);

  // The main object is always the first part.
  const parts = [];
  const pushPart = (el, g, catOverride, nameOverride) => {
    const t = el.tags || {};
    const cat = catOverride || categoryOf(t);
    const ph = partHeight(t, cat);
    const geoms = [...g.rings.map(r => ({ pts: ringOut(r), closed: true })), ...g.lines.map(r => ({ pts: round(r), closed: false })),
      ...(g.point ? [{ pts: round([g.point]), closed: false }] : [])];
    for (const gg of geoms) {
      const p = { tag: cat, osm: keyOf(el), pts: gg.pts, closed: gg.closed, height_m: ph.h, height_source: ph.src };
      if (t.name || nameOverride) p.name = nameOverride || t.name;
      if (t.layer) p.layer = Number(t.layer);
      parts.push(p);
    }
  };
  if (cfg.gateWall) {
    pushPart(main, { rings: [outline.concat([outline[0]])], lines: [] }, 'gate');
  } else {
    pushPart(main, { rings: [outline], lines: [] });
  }
  if (cfg.stands) {
    const st = els.get(cfg.stands);
    const g = geomOf(st);
    // Each outer ring of the stadium building multipolygon is one stand.
    g.rings.forEach((r, i) => pushPart(st, { rings: [r], lines: [] }, 'stand', `Stand ${i + 1}`));
  }
  const missing = [];
  for (const k of partKeys) {
    const el = els.get(k);
    if (!el) { missing.push(k); continue; }
    pushPart(el, geomOf(el));
  }
  if (missing.length) console.warn(`${l.id}: include ids not returned: ${missing.join(', ')}`);

  // Height of the landmark.
  const cfgH = HEIGHTS[l.id];
  const th = tagHeight(mt);
  let height, hsrc, hnote;
  if (cfgH?.force || (!th && cfgH)) { height = cfgH.m; hsrc = cfgH.source; hnote = cfgH.note; }
  else if (th) { height = th.h; hsrc = th.src; }
  else throw new Error(`${l.id}: no height tag and no entry in landmark-heights.mjs`);
  if (th && cfgH?.force) hnote = `${hnote || ''} (OSM tag gives ${th.h} m, ${th.src}; overridden)`.trim();
  // The landmark height belongs to its tallest element. For a building that is the
  // main part; for open sites (garden, square, stadium site) it is a named part and
  // the site polygon itself stays flat.
  const tallKey = cfgH?.on || cfg.main;
  const tallParts = parts.filter(p => p.osm === tallKey && (!cfgH?.onTag || p.tag === cfgH.onTag));
  if (!tallParts.length) throw new Error(`${l.id}: tallest element ${tallKey} is not among the parts`);
  for (const p of tallParts) { p.height_m = height; p.height_source = hsrc; }
  if (tallKey !== cfg.main) {
    const flat = ['garden', 'square', 'site', 'street', 'pitch'].includes(parts[0].tag);
    parts[0].height_m = cfgH?.main_m ?? (flat ? 0 : parts[0].height_m);
    parts[0].height_source = cfgH?.main_m != null ? cfgH.main_source || 'estimate' : flat ? 'flat' : parts[0].height_source;
  }
  for (const p of parts) if (['garden', 'square', 'site', 'street', 'pitch', 'stairs', 'funicular'].includes(p.tag) && !tallParts.includes(p)) {
    p.height_m = 0; p.height_source = 'flat';
  }

  const verify = mt.wikidata ? await checkWikidata(mt.wikidata, cfg.main, [l.lat, l.lon]) : 'no wikidata tag on main object';
  await wait(300);

  const osmIds = [...new Set([cfg.main, cfg.stands, ...parts.map(p => p.osm)].filter(Boolean))];
  out[l.id] = {
    osm: { ...parseKey(cfg.main), name: mt.name, wikidata: mt.wikidata || null },
    verify,
    outline: ringOut(outline),
    parts,
    centroid: round([centroid(outline)])[0],
    bearing_deg: rect.bearing,
    extent_m: [Math.round(rect.long * 10) / 10, Math.round(rect.short * 10) / 10],
    area_m2: Math.round(Math.abs(ringArea(outline))),
    height_m: height,
    height_source: hsrc,
    ...(hnote ? { height_note: hnote } : {}),
    ...(cfg.pitch ? { pitch_bearing_deg: minAreaRect(allPts(geomOf(els.get(cfg.pitch)))).bearing } : {}),
    osm_ids: osmIds,
    exclude_outline: !['avenida-central', 'praca-republica', 'santa-barbara'].includes(l.id),
    main_offset_m: Math.round(dMain),
  };
  l.osm = { type: parseKey(cfg.main).type, id: parseKey(cfg.main).id, height_m: height, height_source: hsrc };
  const tagCount = {};
  parts.forEach(p => (tagCount[p.tag] = (tagCount[p.tag] || 0) + 1));
  report.push([l.id, cfg.main, `${out[l.id].extent_m[0]}x${out[l.id].extent_m[1]} m`, `${rect.bearing}°`, `${height} m (${hsrc})`,
    `${parts.length} parts ${JSON.stringify(tagCount)}`, `off ${Math.round(dMain)} m`, verify].join(' | '));
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
writeFileSync(LANDMARKS, JSON.stringify(landmarks, null, 2) + '\n');
console.log(`Wrote ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB) and updated landmarks.json`);
for (const r of report) console.log(r);

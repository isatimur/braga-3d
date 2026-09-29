// Universidade Católica Portuguesa, Braga campus, metric builder.
//
// Frame (fit.js): +z = the long west front of the Faculdade de Filosofia
// on Praça da Faculdade (270 deg, snapped to 268.5), origin at the centre
// of the faculty outline (OSM w423244424, 47.8 x 23.1 m). Parts drawn on
// their OSM polygons: the Igreja dos Jesuítas (Sagrado Coração, w118358119)
// 30 m west across the square; the Campus Camões (w107495353, 138 x 208 m,
// 150 m east, local -z) with its buildings, the pool and two paths. The
// Camões buildings are not in the grey city mass (data notes), so the
// model draws them.
// From data/dimensions.json and ucp-braga.jpg: six storeys, about 20 m,
// white render, a grid of punched windows with dark red frames and, on the
// two lower floors, continuous window bands between white mullions; a
// granite base; flat roofs behind a parapet; the corner tower about a
// storey and a half higher (26 m) with its angled cap and antennas.
// The Jesuit church (10 m) gets a granite Baroque front and one bell tower.
// Assumption: the church front faces west (+z), toward Rua de São Barnabé;
// OSM does not say which end is the front.
// Only the faculty and the church are padded; the Camões campus is draped
// on the real slope (it climbs 10 m).
import * as THREE from 'three';
import { corniceProfile, MAT } from './kit.js';
import { win, cartouche, bellTower, scrollCrest, pediment } from './parts.js';
import { edges, offset, bbox, centroid, inside, clean, obb } from './geom.js';
import { polyCornice } from './metric.js';
import { drapePoly, ribbon, lowTree } from './drape.js';

const RENDER = 'white';
const FRAME = 0x6a2c28; // the dark red window frames of the photo
const STOREY = 3.1;

// Flat pane on a wall face (2 triangles), facing +z of the current push.
function pane(k, x, y, w, h, z, color, emit = 0) {
  k.add(new THREE.PlaneGeometry(w, h), color, { x, y: y + h / 2, z, emit, mat: MAT.flat });
}

// Window grid on every outline edge: punched windows on the upper floors,
// banded glazing with mullions on the two lower floors.
function gridFacade(k, pts, y0, storeys, o = {}) {
  const rnd = k.rnd;
  for (const e of edges(pts)) {
    if (e.len < 3.5) continue;
    k.push({ x: e.mx + e.nx * 0.02, y: y0, z: e.mz + e.nz * 0.02, ry: e.ry });
    const n = Math.max(1, Math.floor((e.len - 1.2) / (o.bay ?? 3)));
    const pitch = (e.len - 1.2) / n;
    for (let s = 0; s < storeys; s++) {
      const y = (o.first ?? 1.6) + s * STOREY;
      if (s < (o.bands ?? 2)) {
        pane(k, 0, y + 0.2, e.len - 1.6, 1.9, 0.05, 'glass', 0.14);
        k.box(e.len - 1.4, 0.35, 0.3, RENDER, 0, y - 0.25, 0.1); // band sill
        k.box(e.len - 1.4, 0.3, 0.3, RENDER, 0, y + 2.1, 0.1); // band head
        for (let i = 0; i <= n; i++) k.box(0.28, 1.9, 0.24, RENDER, -((n * pitch) / 2) + i * pitch, y + 0.2, 0.1);
      } else {
        for (let i = 0; i < n; i++) {
          const u = -((n - 1) * pitch) / 2 + i * pitch;
          pane(k, u, y + 0.35, 1.35, 1.6, 0.04, FRAME);
          pane(k, u, y + 0.43, 1.15, 1.44, 0.07, 'glass', rnd() > 0.6 ? 0.35 : 0.1);
        }
        k.box(e.len, 0.12, 0.14, RENDER, 0, y + 0.18, 0.07); // sill line
      }
    }
    k.pop();
  }
}

function faculty(k, O) {
  const H = 20; // main block (dims main_block)
  k.prism(O, -1.5, H + 1.5, RENDER);
  k.prism(offset(O, 0.25), -1.5, 3.0, 'graniteGrey'); // granite base
  gridFacade(k, O, 0, 6);
  polyCornice(k, O, H - 0.4, corniceProfile('band', 0.4), RENDER);
  k.prism(offset(O, -0.4), H, 0.35, 'lead'); // roof terrace
  k.prism(O, H, 1.1, RENDER, { holes: [offset(O, -0.35)] }); // parapet
  // roof plant rooms
  k.box(8, 2.6, 5, RENDER, -12, H, -4);
  k.box(4, 2.2, 4, RENDER, 6, H, -6);
  // entrance on the front recess (+z): granite portico, glazed doors
  k.box(10, 0.4, 3.2, 'graniteLight', 7, 3.6, 3.7);
  for (const x of [2.6, 11.4]) k.box(0.5, 3.6, 0.5, 'graniteLight', x, 0, 5);
  pane(k, 7, 0.1, 6, 3, 2.22, 'glass', 0.3);
  k.box(12, 0.25, 6, 'graniteLight', 7, -0.05, 5); // steps
}

// The corner tower: 26 m, a storey and a half above the block, windows on
// every floor, the loggia and the angled cap of the photo, the antennas.
function tower(k, x0, x1, z0, z1, Htot) {
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const hb = Htot - 2.2; // body; the cap rises to the total
  k.box(w, hb + 1.5, d, RENDER, cx, -1.5, cz);
  for (const [ry, len, ox, oz] of [[0, w, 0, d / 2], [Math.PI / 2, d, w / 2, 0], [-Math.PI / 2, d, -w / 2, 0]]) {
    k.push({ x: cx + ox + Math.sin(ry) * 0.03, z: cz + oz + Math.cos(ry) * 0.03, ry });
    for (let s = 0; s < 6; s++) {
      const y = 1.6 + s * STOREY;
      pane(k, 0, y + 0.3, 1.5, 1.7, 0.04, FRAME);
      pane(k, 0, y + 0.38, 1.3, 1.54, 0.07, 'glass', s % 3 === 1 ? 0.35 : 0.12);
    }
    // top loggia: a wide opening under the cap
    pane(k, 0, hb - 3.2, len - 1.6, 2.4, 0.06, 'dark');
    k.box(len - 1.4, 0.2, 0.9, 'iron', 0, hb - 3.2, 0.45); // loggia rail
    k.pop();
  }
  // statue on a bracket at the front corner (dims note)
  k.box(1.1, 0.3, 0.9, 'graniteLight', x0 + 1, 21.2, z1 + 0.45);
  k.statue(2.2, 'graniteLight', x0 + 1, 21.5, z1 + 0.5, { pose: 'raise', seg: 6 });
  // the angled cap: a flared slab and a slanted top to the real height
  k.frustum(w + 1.2, d + 1.2, w + 0.2, d + 0.2, 0.5, RENDER, cx, hb, cz);
  k.frustum(w + 0.2, d + 0.2, w * 0.55, d * 0.9, Htot - hb - 0.5, RENDER, cx, hb + 0.5, cz);
  return { cx, cz, top: Htot };
}

// Igreja dos Jesuítas (Sagrado Coração) on its OSM polygon.
function jesuitChurch(k, P, ground) {
  // oriented box: its u axis (cos a, -sin a) runs along the longest edge,
  // the nave; turn local +z onto it, toward +z of the site (the front)
  const b = obb(P.pts);
  const cx = b.cx;
  const cz = b.cz;
  const L = b.L;
  const W = b.W;
  const ry = b.a + Math.PI / 2 + (-Math.sin(b.a) < 0 ? Math.PI : 0);
  const y0 = ground(cx, cz);
  const H = 10;
  k.push({ x: cx, y: y0, z: cz, ry });
  const G = 'graniteWarm';
  k.box(W, H + 1.5, L, 'plaster', 0, -1.5, 0);
  k.box(W + 0.4, 1.9, L + 0.4, 'granite', 0, -1.5, 0);
  for (const s of [-1, 1]) k.box(0.7, H, 0.7, G, s * (W / 2 - 0.2), 0, L / 2 - 0.2);
  k.corniceRing(W, L, corniceProfile('eave', 0.5), G, 0, H - 0.5, 0);
  k.gableRoof(W, L - 1, 2.6, 'terracotta', 0, H, -0.5, { over: 0.4, mat: MAT.tile });
  // side windows (tall, arched)
  for (const s of [-1, 1]) {
    k.push({ x: s * (W / 2), ry: (s * Math.PI) / 2 });
    for (let i = 0; i < 4; i++) win(k, -L / 2 + 5 + i * ((L - 9) / 3), 5.2, 1.1, 2.6, 0, { arch: 'round', bw: 0.26, depth: 0.2, trim: G, pane: 'glass', emit: 0.2 });
    k.pop();
  }
  // Baroque front: granite frontispiece, portal, window, niche, scroll gable
  const zf = L / 2;
  k.box(W - 0.6, H - 0.4, 0.6, G, 0, 0, zf + 0.1);
  for (const s of [-1, 1]) {
    k.box(0.8, H - 0.5, 0.4, G, s * (W / 2 - 1.2), 0, zf + 0.5);
    k.box(0.8, H - 0.5, 0.4, G, s * 1.9, 0, zf + 0.5);
  }
  k.surround({ x: 0, y: 0, w: 2, h: 3.6, arch: 'round' }, 0.35, 0.3, G, zf + 0.4);
  pane(k, 0, 0, 2, 3.2, zf + 0.42, 'wood');
  pediment(k, 3.4, 0.9, 0.4, G, 0, 4.35, zf + 0.7, { frame: 0.2 });
  win(k, 0, 6.1, 1.3, 2.0, zf + 0.4, { arch: 'round', bw: 0.3, depth: 0.25, trim: G, pane: 'glass', emit: 0.3 });
  // statue niches either side of the window
  for (const s of [-1, 1]) {
    k.surround({ x: s * 3.3, y: 5.4, w: 0.9, h: 2.1, arch: 'round' }, 0.2, 0.2, G, zf + 0.4);
    pane(k, s * 3.3, 5.4, 0.9, 2.0, zf + 0.42, 'graniteDark');
    k.statue(1.6, 'graniteLight', s * 3.3, 5.45, zf + 0.6, { seg: 6 });
  }
  k.cornice(W + 0.4, corniceProfile('classic', 0.55), G, 0, H - 0.6, zf + 0.4);
  scrollCrest(k, W - 1.5, 3.4, 0.5, G, 0, H, zf + 0.45);
  k.box(0.26, 1.8, 0.26, 'iron', 0, H + 3.3, zf + 0.45);
  k.box(0.9, 0.2, 0.2, 'iron', 0, H + 4.5, zf + 0.45);
  // the one bell tower, on the north front corner
  bellTower(k, { x: -W / 2 - 1.6, y: 0, z: zf - 2, w: 3.6, hBody: H + 0.4, hBelfry: 3, body: 'plaster', trim: G, cap: 'bell', capH: 1.8, windows: 2, openings: 1, clock: false, urns: true });
  k.pop();
}

// A two-storey campus building on its OSM polygon, on its own ground.
function campusBlock(k, P, ground, h) {
  const pts = clean(P.pts, 0.6);
  if (pts.length < 3) return;
  const gs = pts.map(([x, z]) => ground(x, z));
  const y0 = gs.reduce((a, v) => a + v, 0) / gs.length;
  const yb = Math.min(...gs) - 1.2;
  k.prism(pts, yb, y0 - yb + h, RENDER);
  k.prism(offset(pts, 0.2), yb, y0 - yb + 1.1, 'graniteGrey');
  k.push({ y: y0 });
  gridFacade(k, pts, 0, Math.max(1, Math.round(h / STOREY)), { bands: 0, bay: 3.2 });
  k.pop();
  polyCornice(k, pts, y0 + h - 0.35, corniceProfile('band', 0.35), RENDER);
  // tiled hip roof on simple plans, a roof terrace on complex ones
  if (pts.length <= 5) {
    const b = obb(pts);
    k.push({ x: b.cx, z: b.cz, ry: b.a });
    k.hipRoof(b.L, b.W, Math.min(3, b.W * 0.3), 'terracotta', 0, y0 + h, 0, { over: 0.5, mat: MAT.tile });
    k.pop();
  } else {
    k.prism(offset(pts, -0.3), y0 + h, 0.3, 'lead');
    k.prism(pts, y0 + h, 0.8, RENDER, { holes: [offset(pts, -0.3)] });
  }
}

function ucp(k, { footprint, dims }) {
  const O = footprint.outline;
  const ground = footprint.ground;
  const hTot = dims?.height_m?.total ?? 26;
  k.groundLine = (x, z) => ground(x, z);
  // --- the faculty block and its corner tower (main)
  k.begin('mask');
  k.begin('main');
  faculty(k, O);
  tower(k, 16.6, 23.6, 3.2, 11.6, hTot);
  k.end('main');
  k.end('mask');
  // antennas on the tower cap (outside 'main': the 26 m is the building)
  for (const [dx, h] of [[-1.2, 6], [1.4, 3.5]]) {
    k.cyl(0.08, 0.1, h, 4, 'steel', 20.1 + dx, hTot - 0.2, 7.4);
    k.box(0.5, 1.2, 0.2, 'white', 20.1 + dx + 0.3, hTot + h - 2, 7.4);
  }
  // --- Praça da Faculdade: granite paving between faculty and church,
  // a few trees and benches
  const church = footprint.part(/Jesu/);
  const cz0 = church ? bbox(church.pts).z0 : 38;
  k.box(49, 0.14, cz0 - 6.7 - 1, 'graniteLight', 0, -0.04, (6.7 + cz0 - 1) / 2, { mat: MAT.smooth });
  for (let i = 0; i < 5; i++) {
    const x = -20 + i * 7;
    lowTree(k, x, 0.1, 30, 7, { spread: 0.3 });
    k.box(2, 0.45, 0.6, 'graniteLight', x + 3.5, 0.1, 30);
  }
  if (church) {
    k.begin('church');
    jesuitChurch(k, church, ground);
    k.end('church');
  }

  // --- Campus Camões, draped on its slope
  const campus = footprint.part(/Ciências Sociais/);
  const blocks = footprint.parts.filter((p) => p.tag === 'building' && p !== footprint.parts[0]);
  const churchPart = footprint.parts.find((p) => p.tag === 'church' && !/Jesu/.test(p.name || ''));
  const pool = footprint.parts.find((p) => p.tag === 'other' && !p.name && p.pts.length <= 6);
  const holes = [...blocks, churchPart, pool].filter(Boolean).map((p) => p.pts);
  if (campus) {
    drapePoly(k, campus.pts, ground, 0.18, 'grass', { cell: 10, holes, mat: MAT.leaf });
    // perimeter wall with railings
    for (const e of edges(clean(campus.pts, 1))) {
      const a = [e.a[0], ground(e.a[0], e.a[1]), e.a[1]];
      const b = [e.b[0], ground(e.b[0], e.b[1]), e.b[1]];
      k.segment([a[0], a[1] + 0.5, a[2]], [b[0], b[1] + 0.5, b[2]], 0.5, 1.4, 'graniteGrey', { ext: 0.3 });
      k.segment([a[0], a[1] + 1.8, a[2]], [b[0], b[1] + 1.8, b[2]], 0.06, 0.9, 'iron');
    }
  }
  for (const p of blocks) campusBlock(k, p, ground, p.pts.length > 10 ? 6 : 7.4);
  if (churchPart) campusBlock(k, churchPart, ground, 10);
  if (pool) {
    const gs = pool.pts.map(([x, z]) => ground(x, z));
    const y = Math.min(...gs);
    k.prism(offset(pool.pts, 1.4), y - 1, 1.25, 'graniteLight', { holes: [pool.pts] });
    k.prism(pool.pts, y - 1, 0.95, 'water', { emit: 0.3 });
    for (let i = 1; i < 5; i++) {
      const b = obb(pool.pts);
      k.push({ x: b.cx, z: b.cz, ry: b.a });
      k.box(b.L - 1, 0.04, 0.12, 'white', 0, y - 0.03, -b.W / 2 + (i * b.W) / 5);
      k.pop();
    }
  }
  for (const p of footprint.parts.filter((q) => q.tag === 'path')) ribbon(k, p.pts, 3, ground, 0.24, 'graniteLight', { mat: MAT.smooth });
  // trees across the lawns, clear of buildings and paths
  if (campus) {
    const b = bbox(campus.pts);
    const rnd = k.rnd;
    let n = 0;
    for (let t = 0; t < 400 && n < 46; t++) {
      const x = b.x0 + rnd() * b.w;
      const z = b.z0 + rnd() * b.d;
      if (!inside(campus.pts, x, z)) continue;
      if (holes.some((h) => inside(offset(h, 3), x, z))) continue;
      const hh = 8 + rnd() * 7;
      if (rnd() > 0.8) k.tree(x, ground(x, z), z, hh, { kind: 'cypress' });
      else lowTree(k, x, ground(x, z), z, hh);
      n++;
    }
  }
}
ucp.metric = true;
ucp.rule = {
  extent: [/Jesu/, 'building', 'church', 'other', 'path'],
  pad: { parts: [/^Universidade Católica Portuguesa$/, /Jesu/] },
  frame: { parts: [/^Universidade Católica Portuguesa$/, /Jesu/], margin: 14 },
  view: 0.7,
  note: 'faculty (main, 26 m tower) and Jesuit church padded; Campus Camões draped on its slope; camera frames faculty + church',
};

export default { 'ucp-braga': ucp };

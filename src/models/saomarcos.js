// Igreja e Hospital de São Marcos, metric builder (1:1 metres).
//
// Frame (fit.js): +z = the NNW front on Largo Carlos Amarante (332 deg), origin
// at the centre of the church outline (OSM w363528976, 15.2 x 29.6 m). The
// hospital (Vila Galé Collection hotel, OSM r17978905, ring with a 23 m
// courtyard) stands behind and beside the church, its long front in line with
// the church towers (z = 12.5). Later wings to the south-east (OSM r8340055
// with a 21 x 7 m courtyard, w146343003).
// From data/dimensions.json and sao-marcos.jpg / sao-marcos-3.jpg (about 44
// px/m): church 15.2 m wide, twin towers to the crosses at 20.4 m, convex
// central bay (two pairs of granite columns, the door, the barred window
// over a balcony, oval windows), the attic with the niche and the triangular
// pediment; the hospital front: white render panels between granite
// pilasters, framed windows with iron balconies over barred ground windows,
// entablature, balustrade and 12 apostle statues on pedestals (4 over each
// wing, 4 on the central bay).
import * as THREE from 'three';
import { corniceProfile, MAT, PROFILES } from './kit.js';
import { win, pediment, cartouche, volute, flameUrn, bell } from './parts.js';
import { offset, inside, area, edges } from './geom.js';
import { lowTree } from './drape.js';
import { onEdge } from './metric.js';

const G = 'granite';
const GL = 'graniteLight';
const DOOR = 0x2f4a3a; // the dark green doors and railings of the photos

// The hospital's front line (hotel ring, z of the front edge by x).
const FRONT = [[-22.9, 12.0], [-11.5, 12.4], [-8.9, 12.6], [-7.8, 12.6], [7.5, 12.4], [11.7, 12.5], [21.6, 12.9]];
function zf(x) {
  for (let i = 0; i < FRONT.length - 1; i++) {
    const [x0, z0] = FRONT[i];
    const [x1, z1] = FRONT[i + 1];
    if (x >= x0 && x <= x1) return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
  }
  return x < 0 ? 12.0 : 12.9;
}

// Courtyards in the frame (from the OSM holes).
const COURT = [[12.7, -27.1], [-9.8, -25.2], [-12.8, -48.2], [10.7, -50.1]];
const COURT2 = [[74.1, -67.8], [53.4, -71.3], [54.5, -78.4], [75.3, -74.9]];

// Church front: the convex bay is an arc of radius R centred at (0, ZC).
const R = 6.16;
const ZC = 8.64;
const HALF = Math.asin(4.8 / R);
const zArc = (x, r = R) => ZC + Math.sqrt(Math.max(0, r * r - x * x));

// Stepped hipped roof over a ring with holes: layers of insets.
function roofOver(k, ring, holes, y, layers, color = 'terracotta') {
  const a0 = Math.abs(area(ring));
  let yy = y;
  for (const { d, h } of layers) {
    const outer = d >= 0 ? offset(ring, d) : offset(ring, d);
    const a = Math.abs(area(outer));
    if (a < a0 * 0.15) break;
    const hs = holes.map((p) => offset(p, -d));
    k.prism(outer, yy, h, color, { holes: hs, mat: MAT.tile });
    yy += h;
  }
  return yy;
}

// Cheap windows on the edges of a polygon: a granite frame plane and a lit
// pane per bay and storey. inward = the polygon is a courtyard (normal in).
function bandWindows(k, poly, o) {
  const rnd = k.rnd;
  for (const e0 of edges(poly)) {
    if (e0.len < 5) continue;
    if (o.skip && o.skip(e0)) continue;
    const e = o.inward ? { ...e0, nx: -e0.nx, nz: -e0.nz, ry: e0.ry + Math.PI } : e0;
    const bay = o.bay ?? 3.5;
    const n = Math.max(1, Math.floor((e.len - 1.5) / bay));
    const pitch = (e.len - 1.5) / n;
    onEdge(k, e, 0, 0.02);
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * pitch) / 2 + i * pitch;
      o.storeys.forEach(([y, w, h]) => {
        k.add(new THREE.PlaneGeometry(w + 0.5, h + 0.5), G, { x: u, y: y + h / 2, z: 0.02, mat: MAT.flat });
        k.add(new THREE.PlaneGeometry(w, h), 'glass', { x: u, y: y + h / 2, z: 0.05, emit: rnd() > 0.65 ? 0.5 : 0.1, mat: MAT.flat });
      });
    }
    k.pop();
  }
}

// One of the twin towers: granite body to the main cornice, belfry, upper
// stage with an oculus, pyramid spire, ball and cross (top at 20.5 m).
function tower(k, tx, side) {
  const tz = 10.4;
  const w = 4.0;
  const d = 4.4;
  k.box(w, 13.8, d, G, tx, -1, tz);
  // corner quoins and carved oval panels
  for (const s of [-1, 1]) k.box(0.5, 11.2, 0.16, GL, tx + s * (w / 2 - 0.3), 1.2, tz + d / 2 + 0.02);
  k.box(1.6, 2.2, 0.14, GL, tx, 7.4, tz + d / 2 + 0.02);
  k.box(1.2, 1.8, 0.14, 'graniteDark', tx, 7.6, tz + d / 2 + 0.06);
  k.box(0.14, 2.2, 1.6, GL, tx + side * (w / 2 + 0.02), 7.4, tz);
  k.box(1.3, 2.4, 0.12, 'dark', tx, 3.0, tz + d / 2 + 0.03, { emit: 0.1 });
  k.corniceRing(w, d, corniceProfile('classic', 0.5), G, tx, 12.8, tz);
  // belfry: four slabs with a round-arched opening, a bell, corner quoins
  const wb = 3.2;
  const yb = 13.4;
  const hb = 2.6;
  const t = 0.55;
  const hole = [{ x: 0, y: 0.35, w: 1.25, h: 2.2, arch: 'round', pane: null }];
  for (const [ry, len] of [[0, wb], [Math.PI, wb], [Math.PI / 2, wb - 2 * t], [-Math.PI / 2, wb - 2 * t]]) {
    k.push({ x: tx, y: yb, z: tz, ry });
    k.wall(len, hb, t, G, hole, 0, 0, wb / 2 - t / 2);
    k.surround(hole[0], 0.16, 0.14, GL, wb / 2);
    k.pop();
  }
  k.box(wb - 2 * t, hb, wb - 2 * t, 'dark', tx, yb, tz);
  bell(k, 0.9, tx, yb + 0.5, tz + wb / 2 - t - 0.3);
  k.corniceRing(wb, wb, corniceProfile('classic', 0.35), G, tx, yb + hb, tz);
  // upper stage with an oculus each side
  const yu = yb + hb + 0.35;
  k.box(2.5, 1.5, 2.5, G, tx, yu, tz);
  for (const [ry, dx, dz] of [[0, 0, 1], [Math.PI / 2, 1, 0], [-Math.PI / 2, -1, 0]]) {
    k.cyl(0.36, 0.36, 0.16, 10, 'dark', tx + dx * 1.27, yu + 0.75, tz + dz * 1.27, { rx: Math.PI / 2, ry });
  }
  k.corniceRing(2.5, 2.5, corniceProfile('classic', 0.28), G, tx, yu + 1.5, tz);
  // corner pinnacles and the spire
  const ys = yu + 1.8;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.pinnacle(0.9, G, tx + sx * 1.15, ys - 0.25, tz + sz * 1.15);
  k.cone(1.8, 1.9, 4, G, tx, ys, tz);
  k.sphere(0.2, G, tx, ys + 1.9, tz, { seg: 6, rings: 4 });
  const yx = ys + 2.05;
  k.box(0.09, 20.5 - yx, 0.09, 'iron', tx, yx, tz);
  k.box(0.6, 0.08, 0.08, 'iron', tx, 20.5 - 0.55, tz);
}

function church(k, O) {
  // plan: the OSM outline with the front replaced by the symmetric convex bay
  const rear = O.slice(0, 6);
  const arc = [];
  for (let i = 0; i <= 10; i++) {
    const a = -HALF + (2 * HALF * i) / 10;
    arc.push([R * Math.sin(a), ZC + R * Math.cos(a)]);
  }
  const plan = [...rear, [-7.6, 12.5], ...arc, [7.5, 12.5]];
  const proud = offset(plan, 0.06);
  k.prism(proud, -1.5, 11.4 + 1.5, G);
  k.prism(offset(plan, 0.2), -1.5, 1.5 + 1.0, 'graniteDark');
  k.gableRoof(14.6, 24.5, 3.6, 'terracotta', 0, 11.4, -3, { over: 0.3, mat: MAT.tile });
  k.cyl(0.3, 0.3, 0.3, 6, G, 0, 15.0, -14.6); // chancel finial base
  // the rear: chancel gable end, plain
  k.box(15.3, 0.4, 0.5, G, 0, 11.3, -14.7);

  // ---- the convex bay: wall, string courses, cornice
  const a0 = -HALF;
  k.cyl(R + 0.12, R + 0.12, 9.6, 16, G, 0, 0, ZC, { open: true, t0: a0 + Math.PI, tl: 2 * HALF, smooth: true });
  return { plan };
}

function centralFront(k) {
  const RR = R + 0.12;
  const arcCyl = (r, h, y, color) => k.cyl(r, r, h, 16, color, 0, y, ZC, { t0: -HALF, tl: 2 * HALF, smooth: true });
  arcCyl(RR + 0.32, 0.4, 4.7, G); // string course
  arcCyl(RR + 0.55, 0.55, 9.4, G); // main cornice
  arcCyl(RR + 0.2, 0.9, 0, 'graniteDark'); // base
  // columns in pairs each side, on pedestals
  for (const x of [-4.7, -2.6, 2.6, 4.7]) {
    const z = zArc(x, RR) + 0.3;
    k.box(1.0, 1.2, 1.0, G, x, 0, z);
    k.column(7.9, 0.4, G, x, 1.2, z, { seg: 8 });
    k.box(1.0, 0.3, 1.0, G, x, 9.1, z);
  }
  // door: framed, with a segmental head and the dark green leaves
  const zd = zArc(0, RR);
  k.wall(3.2, 5.4, 0.5, G, [{ x: 0, y: 0.15, w: 2.2, h: 4.2, arch: 'seg', rise: 0.5, pane: DOOR, inset: 0.2 }], 0, 0, zd - 0.05);
  k.box(3.6, 0.35, 0.8, G, 0, 5.4, zd + 0.15);
  k.box(1.5, 0.5, 0.5, G, 0, 5.75, zd + 0.1);
  // steps
  for (let j = 0; j < 3; j++) k.box(4.4 + j * 0.5, 0.17 * (3 - j), 0.36, G, 0, 0, zd + 0.1 + 0.34 * (j + 0.5));
  // balcony and barred window over the door
  k.box(3.4, 0.28, 0.9, G, 0, 6.3, zd + 0.3);
  k.balustrade(3.0, 0.9, G, 0, 6.55, zd + 0.55, { cheap: true, d: 0.16, sp: 0.32, posts: 2 });
  win(k, 0, 7.0, 2.4, 2.6, zd + 0.02, { trim: G, bw: 0.28, depth: 0.28, bars: true, pane: 'glass', emit: 0.2 });
  // windows and oval windows between the column pairs
  for (const s of [-1, 1]) {
    const x = 3.65 * s;
    const th = Math.asin(x / RR);
    k.push({ x, z: zArc(x, RR) + 0.06, ry: th });
    win(k, 0, 5.7, 1.1, 2.0, 0, { trim: G, bw: 0.2, depth: 0.2, bars: true, pane: 'glass', emit: 0.1 });
    k.add(new THREE.TorusGeometry(0.42, 0.1, 4, 12), G, { y: 2.3, z: 0.05, sy: 1.5 });
    k.add(new THREE.CircleGeometry(0.4, 10), 'glass', { y: 2.3, z: 0.03, sy: 1.5, emit: 0.1 });
    k.pop();
  }
  // the attic over the bay: niche with the bishop, volutes, pediment, cross
  k.box(8.0, 4.2, 3.0, G, 0, 9.8, 11.0);
  k.surround({ x: 0, y: 10.6, w: 1.3, h: 2.5, arch: 'round' }, 0.24, 0.2, GL, 12.5);
  k.plane((() => { const s = new THREE.Shape(); s.moveTo(-0.65, 10.6); s.lineTo(0.65, 10.6); s.lineTo(0.65, 12.05); s.absarc(0, 12.05, 0.65, 0, Math.PI, false); s.closePath(); return s; })(), 'dark', 0, 0, 12.53);
  k.statue(1.7, GL, 0, 10.7, 12.6, { pose: 'hold', arms: true });
  for (const s of [-1, 1]) {
    volute(k, 0.9, 0.5, G, s * 4.25, 10.6, 11.9, { dir: s, turns: 1.2 });
    flameUrn(k, 1.1, G, s * 3.3, 13.8, 12.2, { seg: 6 });
    k.box(0.5, 3.0, 0.2, GL, s * 2.6, 10.3, 12.55);
  }
  pediment(k, 8.4, 2.3, 0.9, G, 0, 13.9, 12.0, { frame: 0.32 });
  cartouche(k, 1.2, 1.3, 0.3, G, 0, 14.3, 12.6, { scrolls: false });
  k.box(0.9, 0.5, 0.9, G, 0, 16.2, 11.7);
  k.box(0.26, 1.9, 0.26, GL, 0, 16.7, 11.7);
  k.box(1.0, 0.24, 0.26, GL, 0, 17.9, 11.7);
  // four statues over the cornice of the bay
  for (const [x, dz] of [[-2.6, 0], [2.6, 0], [-4.7, 0], [4.7, 0]]) {
    const z = zArc(x, RR + 0.3) - 0.2;
    k.box(0.9, 1.0, 0.9, G, x, 9.95, z);
    k.statue(2.3, GL, x, 10.95, z, { pose: x > 0 ? 'raise' : 'hold' });
  }
}

// The long hospital front (one wing): pilasters, windows, entablature,
// balustrade and four statues on pedestals.
function frontWing(k, x0, x1, doorBay, dir) {
  const n = 3;
  const pitch = (x1 - x0) / n;
  const cx = (x0 + x1) / 2;
  const zc = zf(cx);
  const len = x1 - x0;
  // granite base band, entablature, cornice
  k.box(len + 0.6, 1.3, 0.5, 'graniteDark', cx, -0.4, zc + 0.15);
  k.box(len + 0.4, 0.9, 0.3, G, cx, 8.55, zc + 0.15);
  k.cornice(len + 0.6, corniceProfile('classic', 0.55), G, cx, 9.35, zc);
  // pilasters at the bay lines, with pedestals and capitals
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * pitch;
    const z = zf(x);
    k.box(1.0, 1.3, 0.7, 'graniteDark', x, 0, z + 0.3);
    k.box(0.85, 7.4, 0.36, G, x, 1.3, z + 0.18);
    k.box(1.1, 0.5, 0.5, G, x, 8.0, z + 0.25);
  }
  // bays: framed windows, balconies, ground-floor bars, doors
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * pitch;
    const z = zf(x);
    if (i === doorBay) {
      k.wall(2.4, 4.4, 0.4, G, [{ x: 0, y: 0, w: 1.7, h: 3.7, arch: 'round', pane: DOOR, inset: 0.15 }], x, 0, z);
      k.box(2.8, 0.3, 0.7, G, x, 4.4, z + 0.25);
    } else {
      win(k, x, 0.9, 1.1, 1.8, z, { trim: G, bw: 0.24, depth: 0.2, bars: true, pane: 'glass', emit: 0.1 });
    }
    win(k, x, 4.7, 1.2, 2.5, z, { trim: G, bw: 0.28, depth: 0.22, pane: 'glass', emit: i === 1 ? 0.5 : 0.15, head: 'seg', balcony: true });
  }
  // balustrade with statues on the pilaster lines
  k.balustrade(len, 1.2, G, cx, 9.9, zc + 0.05, { cheap: true, d: 0.42, sp: 0.5, posts: n });
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * pitch;
    const z = zf(x) + 0.05;
    k.box(0.95, 0.9, 0.95, G, x, 11.1, z);
    k.statue(2.3, GL, x, 12.0, z, { pose: (i + (dir > 0 ? 1 : 0)) % 2 ? 'raise' : 'hold', ry: 0 });
  }
}

function hospital(k, ring, O) {
  const churchZone = offset(O, 0.5);
  // walls, plinth
  k.prism(ring, -1.5, 11.5, 'plaster', { holes: [COURT] });
  k.prism(offset(ring, 0.12), -1.5, 2.7, 'graniteDark', { holes: [offset(COURT, -0.12)] });
  // eave cornice on the free edges, windows
  const free = (e) => inside(churchZone, e.mx, e.mz) || (e.nz > 0.9 && e.mz > 10);
  for (const e of edges(ring)) {
    if (e.len < 3 || free(e)) continue;
    onEdge(k, e, 9.3);
    k.cornice(e.len + 1, corniceProfile('eave', 0.5), G, 0, 0, 0);
    k.pop();
  }
  const storeys = [[1.3, 1.1, 1.8], [4.5, 1.1, 2.0], [7.3, 1.0, 1.4]];
  bandWindows(k, ring, { storeys, skip: free, bay: 3.6 });
  bandWindows(k, COURT, { storeys, inward: true, bay: 3.6 });
  // roof: four steps, ridge about 14.5 m
  roofOver(k, ring, [COURT], 10.0, [{ d: 0.5, h: 0.5 }, { d: -1.8, h: 1.0 }, { d: -3.8, h: 1.0 }]);
  // the courtyard: paving, a lawn, trees and a basin
  const cx = 0;
  const cz = -37.6;
  k.prism(COURT, -0.3, 0.42, GL, { mat: MAT.smooth });
  k.prism(offset(COURT, -4.5), -0.3, 0.55, 'grass', { mat: MAT.leaf });
  k.cyl(1.9, 2.0, 0.55, 14, GL, cx, 0.2, cz);
  k.cyl(1.6, 1.6, 0.08, 14, 'water', cx, 0.68, cz, { emit: 0.25 });
  k.cyl(0.25, 0.32, 1.2, 8, GL, cx, 0.6, cz);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lowTree(k, cx + sx * 5.6, 0.3, cz + sz * 5.6, 5.5, { lobes: 1 });
  // the hospital front: two wings and the trees of the Largo
  frontWing(k, 8.0, 21.4, 2, 1);
  frontWing(k, -22.6, -8.0, 0, -1);
}

// Later wings to the south-east: plain rendered ranges with a hipped roof.
function wingBlock(k, pts, holes, wall, roofLayers) {
  k.prism(pts, -1.5, wall + 1.5, 'plaster', { holes });
  k.prism(offset(pts, 0.12), -1.5, 2.7, 'graniteDark', { holes: holes.map((h) => offset(h, -0.12)) });
  for (const e of edges(pts)) {
    if (e.len < 3) continue;
    onEdge(k, e, wall - 0.7);
    k.cornice(e.len + 1, corniceProfile('eave', 0.45), G, 0, 0, 0);
    k.pop();
  }
  const st = wall > 11 ? [[1.3, 1.1, 1.8], [4.5, 1.1, 2.0], [7.6, 1.0, 1.6]] : [[1.3, 1.1, 1.8], [4.5, 1.1, 2.0]];
  bandWindows(k, pts, { storeys: st, bay: 3.8 });
  for (const h of holes) bandWindows(k, h, { storeys: st, inward: true, bay: 3.8 });
  roofOver(k, pts, holes, wall, roofLayers);
  for (const h of holes) {
    k.prism(h, -0.3, 0.42, GL, { mat: MAT.smooth });
  }
}

function saoMarcos(k, { footprint }) {
  const O = footprint.outline;
  const byOsm = (id) => footprint.parts.find((p) => p.osm === id);
  const hotel = byOsm('r17978905');
  const w1 = byOsm('r8340055');
  const w2 = byOsm('w146343003');
  k.begin('mask');
  k.begin('main');
  church(k, O);
  centralFront(k);
  tower(k, -5.6, -1);
  tower(k, 5.6, 1);
  k.end('main');
  if (hotel) hospital(k, hotel.pts, O);
  k.end('mask');
  // the later wings stand outside the mask box (it would swallow the Raio)
  if (w1) wingBlock(k, w1.pts, [COURT2], 12, [{ d: 0.5, h: 0.6 }, { d: -1.2, h: 1.4 }, { d: -3.2, h: 1.4 }]);
  if (w2) wingBlock(k, w2.pts, [], 10.5, [{ d: 0.5, h: 0.6 }, { d: -1.1, h: 1.3 }, { d: -2.8, h: 1.3 }]);
}
saoMarcos.metric = true;
saoMarcos.rule = {
  extent: [/^São Marcos$/, /Vila Gall/],
  view: 0.5,
  frame: { parts: [/Igreja/, /Vila Gall/], margin: 6 },
  note: 'church on its outline (main, 20.5 m towers); hospital ring (Vila Galé) with its courtyard, the long front with 12 apostles; later wings r8340055 and w146343003 on their OSM parts; mask = all',
};

export default { 'sao-marcos': saoMarcos };

// Jardim de Santa Bárbara and the old Paço Episcopal, metric builder.
// Frame: front 77 deg (the garden faces east; the medieval wing on its
// west side looks back east over it). snap is off: the garden has no clean
// edge at 77 (its east side is ragged, the nearest long edge gives 84) and
// its straight west edge faces exactly 257, so front 77 keeps the local
// axes on that edge, on the ruin arcade and on the wing behind it.
// Local +x runs roughly north, -z west.
// From data/dimensions.json: garden 59 x 45.5 (OSM outline), wing 15 m,
// fountain 5 m, eight straight paths meeting at the fountain, the arcade
// ruin 18 m (OSM ruins line). The Paço ranges (OSM parts, not drawn by
// buildings.json except a 7 m copy of the smaller part) are drawn as plain
// granite ranges; the crenellated medieval wing and its tower face the
// garden across the Largo where the ruined arches stand.
import * as THREE from 'three';
import { corniceProfile, MAT } from './kit.js';
import { bbox, inside, offset } from './geom.js';
import { polyCornice, polyWindows } from './metric.js';

const TAU = Math.PI * 2;
const G = 'graniteWarm';
// planting in the real, fairly bright colours of the beds, slightly muted
const SALVIA = 0x9c3a31;
const MARIGOLD = 0xb98a3a;
const AGERATUM = 0x6a6390;
const WHITE_BED = 0xd6d2c4;
const SOIL = 0x5b4634;

// Low clipped hedge ring (torus flattened), centre (x, z), radius r.
function hedgeRing(k, x, z, r, arc = TAU, a0 = 0, h = 0.6) {
  const g = new THREE.TorusGeometry(r, 0.4, 3, Math.max(8, Math.round((arc * r) / 1.1)), arc);
  g.rotateX(Math.PI / 2);
  k.add(g, 'hedge', { x, y: 0.3 + h * 0.4, z, ry: a0, sy: h / 0.8, flat: true });
}

// How far a ray from (x, z) along (dx, dz) stays inside the polygon.
function reach(pts, x, z, dx, dz, max = 80) {
  let t = 0;
  while (t < max && inside(pts, x + dx * (t + 0.5), z + dz * (t + 0.5))) t += 0.5;
  return t;
}

function santaBarbara(k, { footprint, dims }) {
  const rnd = k.rnd;
  const O = footprint.outline;
  const fp = footprint.part(/Fonte de Santa/);
  const [fx, fz] = fp ? fp.pts.reduce((a, p) => [a[0] + p[0] / fp.pts.length, a[1] + p[1] / fp.pts.length], [0, 0]) : [0, 0];
  const hWing = dims?.height_m?.palace_wing ?? 15;
  const hFount = dims?.height_m?.fountain ?? 5;

  k.begin('mask');
  // --- garden ground: lawn/soil base on the real outline, granite kerb
  k.prism(O, -0.6, 0.9, 'grass');
  k.prism(offset(O, 0.4), -0.6, 1.0, 'granite', { holes: [O] });
  // --- the eight straight paths meeting at the fountain
  const paths = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const L = reach(O, fx, fz, dx, dz);
    paths.push({ a, dx, dz, L });
    k.push({ x: fx + (dx * (L + 3)) / 2, z: fz + (dz * (L + 3)) / 2, ry: Math.atan2(-dz, dx) });
    k.box(L - 3, 0.08, 2.2, 'sand', 0, 0.3, 0, { mat: MAT.smooth });
    // box hedges along both sides
    for (const s of [-1, 1]) k.box(L - 4.5, 0.55, 0.45, 'hedge', 0.6, 0.3, s * 1.35);
    k.pop();
  }
  // paved round the fountain
  k.cyl(4.2, 4.2, 0.1, 20, 'sand', fx, 0.3, fz, { smooth: true, mat: MAT.smooth });
  // --- beds in the eight sectors: box ring, flowers, a topiary cone,
  //     roses; colours per bed
  const beds = [SALVIA, MARIGOLD, AGERATUM, SALVIA, WHITE_BED, MARIGOLD, AGERATUM, SALVIA];
  paths.forEach((p, i) => {
    const q = paths[(i + 1) % 8];
    const a = (p.a + q.a + (i === 7 ? TAU : 0)) / 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const L = reach(O, fx, fz, dx, dz);
    // inner round bed and an outer long bed along the sector
    const r1 = Math.min(7.5, L * 0.35);
    const bx = fx + dx * r1;
    const bz = fz + dz * r1;
    const R = Math.min(3.2, r1 * 0.5);
    hedgeRing(k, bx, bz, R);
    k.cyl(R - 0.3, R - 0.3, 0.35, 14, beds[i], bx, 0.3, bz, { jit: 0.08, mat: MAT.leaf });
    k.tree(bx, 0.3, bz, 2.2, { kind: 'topiary', color: 'hedge' });
    if (L > 14) {
      const r2 = (r1 + R + L - 1.5) / 2;
      const len = L - 1.5 - (r1 + R) - 1;
      k.push({ x: fx + dx * r2, z: fz + dz * r2, ry: Math.atan2(-dz, dx) });
      const wd = Math.min(7, r2 * 0.55);
      k.box(len, 0.35, wd, SOIL, 0, 0.3, 0);
      k.box(len - 0.8, 0.45, wd - 1, beds[(i + 3) % 8], 0, 0.3, 0, { jit: 0.1, mat: MAT.leaf });
      for (const s of [-1, 1]) k.box(len, 0.6, 0.4, 'hedge', 0, 0.3, s * (wd / 2));
      for (const s of [-1, 1]) k.box(0.4, 0.6, wd, 'hedge', s * (len / 2), 0.3, 0);
      // clipped yew cones at the bed ends, rose bushes
      k.tree(-len / 2 - 0.2, 0.3, 0, 2.6, { kind: 'topiary', color: 'hedge' });
      k.tree(len / 2 + 0.2, 0.3, 0, 2.6, { kind: 'topiary', color: 'hedge' });
      for (let j = 0; j < 3; j++) k.ico(0.55, 1, j % 2 ? 0x9a2f3a : 0xb86a6a, (j - 1) * len * 0.3, 1.1, (rnd() - 0.5) * 2, { jitter: 0.2, mat: MAT.leaf });
      k.pop();
    }
  });
  // --- the fountain: octagonal steps, basin, baluster column, the saint
  k.cyl(3.2, 3.2, 0.3, 8, 'granite', fx, 0.3, fz, { ry: Math.PI / 8 });
  k.cyl(2.7, 2.7, 0.3, 8, 'granite', fx, 0.6, fz, { ry: Math.PI / 8 });
  k.cyl(2.1, 2.2, 0.75, 16, 'granite', fx, 0.9, fz, { smooth: true });
  k.cyl(1.85, 1.85, 0.1, 16, 'water', fx, 1.5, fz, { smooth: true, emit: 0.3 });
  k.lathe([[0, 0], [0.35, 0], [0.25, 0.6], [1.0, 0.8], [1.05, 1.05], [0.25, 1.1], [0.2, 1.9], [0.45, 2.0], [0.45, 2.2], [0, 2.2]], 12, 'granite', fx, 1.6, fz, { smooth: true });
  k.cyl(0.9, 0.9, 0.06, 12, 'water', fx, 2.55, fz, { smooth: true, emit: 0.3 });
  k.marker('fountain', fx, 1.6, fz, { kind: 'tiered', r: 1.85, upper: 2.61, upperR: 0.9 });
  k.statue(hFount - 3.8, 'graniteLight', fx, 3.8, fz, { seg: 7 });
  // --- twisted iron lamps where the paths meet the ring
  for (let i = 0; i < 8; i += 2) {
    const p = paths[i];
    const x = fx + p.dx * 5.2 + p.dz * 1.6;
    const z = fz + p.dz * 5.2 - p.dx * 1.6;
    k.cyl(0.1, 0.13, 3.6, 6, 'iron', x, 0.3, z);
    for (let j = 0; j < 6; j++) k.add(new THREE.TorusGeometry(0.15, 0.04, 3, 6), 'iron', { x, y: 0.6 + j * 0.5, z, rx: Math.PI / 2 });
    k.lamp(1.4, x, 3.9, z, { color: 'iron' });
  }
  // lime trees along the east (street) edge
  for (let i = 0; i < 7; i++) {
    const x = -18 + i * 6;
    const z = 22.5 + rnd() * 1.5;
    if (inside(O, x, z)) k.tree(x, 0.3, z, 9 + rnd() * 3, { lobes: 1 });
  }

  // --- the ruined arcade on the OSM ruins line (five arches, west of the garden)
  const ru = footprint.part('ruins');
  if (ru) {
    const a = ru.pts[0];
    const b = ru.pts[ru.pts.length - 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    k.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
    const n = 5;
    const pitch = len / n;
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + i * pitch;
      k.box(1.1, 3.6, 1.1, G, x, 0, 0);
      k.box(1.3, 0.3, 1.3, 'granite', x, 3.6, 0);
    }
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (i + 0.5) * pitch;
      // pointed arch rib (the arches stand open, no wall above)
      const s = new THREE.Shape();
      const r = pitch / 2;
      s.moveTo(-r - 0.3, 0);
      s.quadraticCurveTo(-r - 0.1, 2.3, 0, 2.7);
      s.quadraticCurveTo(r + 0.1, 2.3, r + 0.3, 0);
      s.lineTo(r - 0.4, 0);
      s.quadraticCurveTo(r - 0.5, 1.6, 0, 2.0);
      s.quadraticCurveTo(-r + 0.5, 1.6, -r + 0.4, 0);
      s.closePath();
      k.extrude(s, 0.8, G, x, 3.9, 0, { curve: 6 });
    }
    for (let i = 0; i < 3; i++) k.box(0.8 + rnd() * 0.6, 0.5, 0.7, 'graniteLight', (rnd() - 0.5) * len, 0, 1.4 + rnd(), { ry: rnd() * 2 });
    k.pop();
  }

  // --- the crenellated medieval wing and its tower (east face of the Paço
  //     block behind the Largo, OSM part edge at z ~ -69, x -23 .. 0)
  const W0 = -22.6;
  const W1 = 0.6;
  const zW = -68.9;
  const dW = 8;
  // wall to the parapet walk (13 m, above the 12 m roofs of the later
  // ranges round it), pointed merlons to 14.5; face 0.9 m proud of the range
  const hWall = hWing - 2;
  k.box(W1 - W0, hWall + 1, dW, G, (W0 + W1) / 2, -1, zW - dW / 2 + 0.9);
  k.crenels(W1 - W0, dW, G, (W0 + W1) / 2, hWall, zW - dW / 2 + 0.9, { mw: 0.9, mh: 1.5, t: 0.6, pointed: true });
  // twin Gothic windows on the upper floor, a door, slits
  k.push({ x: (W0 + W1) / 2, z: zW + 0.9 });
  for (let i = 0; i < 5; i++) {
    const x = -9.6 + i * 4.8;
    for (const s of [-1, 1]) {
      k.surround({ x: x + s * 0.55, y: 7.2, w: 0.8, h: 1.7, arch: 'round' }, 0.2, 0.2, 'granite', 0);
      k.box(0.8, 1.5, 0.08, 'dark', x + s * 0.55, 7.2, 0.02);
    }
    k.box(0.3, 1.7, 0.25, 'granite', x, 7.2, 0.1);
    k.box(0.25, 0.9, 0.08, 'dark', x, 3, 0.02);
  }
  k.surround({ x: 6.5, y: -0.5, w: 1.8, h: 3.2, arch: 'round' }, 0.3, 0.25, 'granite', 0);
  k.box(1.8, 2.7, 0.08, 'dark', 6.5, -0.5, 0.02);
  k.pop();
  // the tower at the north end, proud of the wing
  const tx = 5.8;
  const tz = zW - 2.5;
  const tw = 8.4;
  const hTow = hWing + 1.2;
  k.box(tw, hTow - 1.9, tw, G, tx, -1, tz);
  k.crenels(tw, tw, G, tx, hTow - 2.9, tz, { mw: 0.9, mh: 1.9, t: 0.6, pointed: true });
  k.push({ x: tx, z: tz + tw / 2 });
  k.surround({ x: 0, y: 9.8, w: 1, h: 2, arch: 'round' }, 0.25, 0.2, 'granite', 0);
  k.box(1, 1.8, 0.08, 0x7a2a2a, 0, 9.8, 0.02);
  k.box(0.3, 1.2, 0.08, 'dark', 0, 5.5, 0.02);
  k.pop();
  k.end('mask');

  // --- the Paço ranges on their OSM polygons: granite walls, cornice,
  //     windows in two storeys, tiled roof surface
  for (const part of footprint.partsOf(/Antigo Paço/)) {
    const pts = offset(part.pts, 0.3); // encloses the 7 m copy in buildings.json
    const h = 11;
    k.prism(pts, -1.5, h + 1.5, 'granite');
    k.prism(offset(pts, 0.15), -1.5, 2, 'graniteDark');
    polyCornice(k, pts, h - 0.5, corniceProfile('eave', 0.5), 'graniteLight');
    polyWindows(k, pts, { storeys: [1.6, 6.4], bay: 5.6, w: 1.2, h: 2.1, minLen: 6, margin: 2, win: { trim: 'graniteLight', pane: 'glass', bw: 0.22, depth: 0.2 } });
    k.prism(offset(pts, 0.4), h, 0.25, 'terracotta', { mat: MAT.tile });
    k.prism(offset(pts, -2.5), h + 0.25, 0.9, 'terracotta', { mat: MAT.tile });
  }
  void bbox;
}
santaBarbara.metric = true;
santaBarbara.rule = {
  front: 77,
  snap: false,
  extent: [/Antigo Paço/, 'ruins'],
  note: 'front 77 unsnapped (garden west edge faces 257); model = garden, ruin arcade, crenellated wing and tower, Paço ranges on their OSM parts',
};

export default { 'santa-barbara': santaBarbara };

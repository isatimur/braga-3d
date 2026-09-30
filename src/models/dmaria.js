// Escola Secundária D. Maria II (Liceu Feminino de Braga, 1961-64; blocks
// renovated by Parque Escolar, 2011), metric builder.
//
// Frame (fit.js): +z = the long north-west front on Rua 25 de Abril (308 deg,
// snapped to the site outline), origin at the centre of the site outline
// (way 21372352, 207 x 120 m). Drawn on the polygons of footprints.json:
//  - the 1964 north-west wing (w473728998, 13 m): three floors of white
//    render, continuous ribbon windows between projecting white slab edges,
//    a low terracotta hip roof with deep eaves, and the taller stair block
//    with the mosaic arch (photo);
//  - the two Microsoft-ML block polygons (12 m), which merge the renovated
//    blocks A-G and their covered walks (data notes): flat roofs with a
//    parapet, ribbon windows, a light fascia; drawn where they do not double
//    the wing (they are only padded by the wing walls);
//  - the yard: paving, two multi-sport courts in the central court with lines
//    and goals, a granite retaining wall and birches on the forecourt, the
//    site fence on the outline, the footpath.
// Assumptions: the blocks are 12 m flat-roofed (dims); the OSM wing is the
// only building with a verified footprint; the ML polygons are approximate.
import * as THREE from 'three';
import { MAT, archPath } from './kit.js';
import { ribbonWindows } from './parts.js';
import { offset, bbox, edges, inside } from './geom.js';
import { polyBand } from './metric.js';
import { lowTree, ribbon } from './drape.js';

const RENDER = 'plaster';
const COURT_GREEN = 0x3f7f5a;
const COURT_BLUE = 0x5f7aa6;

// The 1964 wing: three floors, ribbon windows, slab edges, hip roofs.
function wing(k, P) {
  const pts = P.pts;
  const H = 11.3; // eaves
  k.prism(pts, -0.6, H + 0.6, RENDER);
  k.prism(offset(pts, 0.2), -0.6, 1.6, 'graniteGrey'); // granite plinth
  for (const y of [1.9, 4.95, 8.0]) polyBand(k, pts, y, 0.5, 0.22, 'white');
  ribbonWindows(k, pts, 0, { storeys: 3, first: 2.55, storey: 3.05, h: 1.3, margin: 1.4, minLen: 6, emit: 0.16 });
  ribbonWindows(k, pts, 0, { storeys: 1, first: 0.35, h: 1.0, margin: 3, minLen: 10, emit: 0.1, trim: 'graniteDark' }); // basement band
  // eaves plate with beam ends, then the hip roofs on the three arms
  k.prism(offset(pts, 0.55), H - 0.05, 0.3, 'white');
  for (const e of edges(pts)) {
    if (e.len < 8) continue;
    k.push({ x: e.mx + e.nx * 0.05, y: H - 0.55, z: e.mz + e.nz * 0.05, ry: e.ry });
    const n = Math.floor(e.len / 3);
    for (let i = 0; i < n; i++) k.box(0.4, 0.4, 0.3, 'white', -((n - 1) * 3) / 2 + i * 3, 0, 0.12);
    k.pop();
  }
  const roof = (x0, x1, z0, z1, rise) => k.hipRoof(x1 - x0, z1 - z0, rise, 'terracotta', (x0 + x1) / 2, H + 0.25, (z0 + z1) / 2, { over: 0.55, mat: MAT.tile });
  roof(-82.2, 31.1, 15.8, 28.3, 1.45);
  // the stair block: taller flat-roofed tower (13 m to the parapet), mosaic arch
  const sx0 = -68.2;
  const sx1 = -49.5;
  const sz0 = 34.9;
  const sz1 = 52.1;
  k.box(sx1 - sx0, 1.7 + 0.1, sz1 - sz0, RENDER, (sx0 + sx1) / 2, H - 0.1, (sz0 + sz1) / 2);
  k.prism([[sx0, sz0], [sx1, sz0], [sx1, sz1], [sx0, sz1]], 12.35, 0.65, RENDER, { holes: [[[sx0 + 0.35, sz0 + 0.35], [sx0 + 0.35, sz1 - 0.35], [sx1 - 0.35, sz1 - 0.35], [sx1 - 0.35, sz0 + 0.35]]] });
  k.box(sx1 - sx0 - 0.7, 0.12, sz1 - sz0 - 0.7, 'lead', (sx0 + sx1) / 2, 12.3, (sz0 + sz1) / 2);
  k.box(4.5, 0.7, 3.5, RENDER, sx0 + 4, 12.9, sz0 + 5); // lift/stair head
  const cx = (sx0 + sx1) / 2;
  k.push({ x: cx, z: sz1, ry: 0 });
  const ring = (w, h, col, dz, emit = 0) => {
    const p = new THREE.Shape();
    archPath(p, 0, 0, w, h);
    k.plane(p, col, 0, 0.9, 0.04 + dz, { mat: MAT.flat, emit });
  };
  ring(5.6, 8.0, 'flowerRed', 0);
  ring(5.0, 7.4, 'gold', 0.02);
  ring(4.4, 6.8, 'doorBlue', 0.04);
  ring(3.8, 6.2, 'maroon', 0.06);
  k.add(new THREE.CircleGeometry(1.5, 12), 'flowerYellow', { x: 0, y: 4.6, z: 0.12, mat: MAT.flat });
  k.add(new THREE.CircleGeometry(0.9, 10), 'flowerRed', { x: 0, y: 4.6, z: 0.14, mat: MAT.flat });
  k.box(1.6, 2.2, 0.15, 'iron', -3.9, 0.9, 0.05); // service door
  k.pop();
  // hip roofs over the 3 wings of the polygon that sit between the eaves
  roof(-61.7, -52.4, 28.1, 34.9, 0.9);
}

// A block of the renovated school (ML polygon): flat roof, ribbon windows.
function block(k, P, H = 12) {
  const pts = P.pts;
  k.prism(pts, -0.6, H, RENDER);
  k.prism(offset(pts, 0.12), -0.6, 1.2, 'graniteGrey');
  polyBand(k, pts, 3.8, 0.4, 0.15, 'graniteLight');
  polyBand(k, pts, 7.6, 0.4, 0.15, 'graniteLight');
  ribbonWindows(k, pts, 0, { storeys: 3, first: 1.5, storey: 3.8, h: 1.7, margin: 1.5, minLen: 7, emit: 0.16 });
  k.prism(pts, H - 0.6, 0.6, RENDER, { holes: [offset(pts, -0.3)] });
  k.prism(offset(pts, -0.3), H - 0.6, 0.12, 'lead');
}

// A multi-sport court centred at (cx, cz): coloured surface, white lines, goals.
function court(k, cx, cz, w, d, col) {
  k.box(w + 3, 0.05, d + 3, COURT_GREEN === col ? 0x59714f : 0x6d768c, cx, 0.0, cz, { mat: MAT.smooth });
  k.box(w, 0.07, d, col, cx, 0.0, cz, { mat: MAT.smooth });
  const ln = (lw, ld, x, z) => k.box(lw, 0.09, ld, 'white', cx + x, 0.0, cz + z, { mat: MAT.smooth });
  ln(w - 0.6, 0.1, 0, d / 2 - 0.4);
  ln(w - 0.6, 0.1, 0, -d / 2 + 0.4);
  ln(0.1, d - 0.7, w / 2 - 0.4, 0);
  ln(0.1, d - 0.7, -w / 2 + 0.4, 0);
  ln(0.1, d - 0.7, 0, 0);
  // centre circle as an octagon of dashes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(1.4, 0.09, 0.1, 'white', cx + Math.cos(a) * 2.1, 0.0, cz + Math.sin(a) * 2.1, { ry: -a + Math.PI / 2 });
  }
  // goals: two posts, a bar, a net panel
  for (const s of [-1, 1]) {
    const gx = cx + s * (w / 2 - 0.3);
    for (const dz of [-1.5, 1.5]) k.box(0.1, 2.1, 0.1, 'white', gx, 0, cz + dz);
    k.box(0.1, 0.1, 3.1, 'white', gx, 2.05, cz);
    k.add(new THREE.PlaneGeometry(2.9, 1.9), 'steel', { x: gx + s * 0.9, y: 1.05, z: cz, ry: Math.PI / 2, mat: MAT.flat });
  }
}

function dmaria(k, { footprint }) {
  const O = footprint.outline;
  const P = footprint.parts;
  const w = P.find((p) => p.osm === 'w473728998');
  const blocks = P.filter((p) => /Microsoft/.test(p.name || ''));
  const path = P.find((p) => p.tag === 'path');
  const rnd = k.rnd;
  // --- the yard: paved site, a strip of lawn on the south-east side
  k.prism(O, -0.4, 0.42, 'graniteGrey', { mat: MAT.smooth });
  // cobbled forecourt (photo): lighter strip along the front
  k.box(202, 0.03, 8, 'graniteLight', 1, 0.02, 55.5, { mat: MAT.smooth });

  k.begin('mask');
  if (w) wing(k, w);
  for (const b of blocks) block(k, b, 12);
  k.end('mask');

  // --- courts in the central court, benches and lamps
  court(k, -26, -22, 28, 15, COURT_GREEN);
  court(k, 12, -22, 28, 15, COURT_BLUE);
  for (const cx of [-26, 12]) {
    for (const s of [-1, 1]) {
      k.cyl(0.07, 0.07, 3.1, 5, 'iron', cx + s * 14.1, 0.02, -22 + 9.4);
    }
  }
  for (let i = 0; i < 5; i++) k.box(1.8, 0.45, 0.5, 'seat', -50 + i * 26, 0, -2.5);
  for (let i = 0; i < 6; i++) k.lamp(5.5, -60 + i * 22, 0, -38);

  // --- front: granite retaining wall and birches (photo)
  k.wallLine([-99, 55], [99, 55], 1.1, 0.5, 'graniteDark', 0);
  for (let i = 0; i < 6; i++) k.box(0.7, 1.5, 0.7, 'graniteDark', -96 + i * 38, 0, 55);
  for (let i = 0; i < 22; i++) {
    const x = -95 + i * 9 + (rnd() - 0.5) * 2;
    lowTree(k, x, 0, 53.4 + (i % 2) * 1.6, 8.5 + rnd() * 2.5, { spread: 0.2, bole: 0.55, color: rnd() > 0.4 ? 'foliage' : 'foliageDark' });
  }
  for (let i = 0; i < 12; i++) {
    const x = -75 + rnd() * 140;
    const z = -45 + rnd() * 42;
    if (blocks.some((b) => inside(offset(b.pts, 4), x, z)) || (x > -42 && x < 26 && z > -32 && z < -12)) continue;
    lowTree(k, x, 0, z, 7 + rnd() * 3, { spread: 0.22, bole: 0.5 });
  }

  // --- the site fence on the outline: posts and two rails
  for (const e of edges(O)) {
    const n = Math.max(1, Math.round(e.len / 8));
    k.wallLine(e.a, e.b, 0.05, 0.05, 'iron', 2.0);
    k.wallLine(e.a, e.b, 0.05, 0.05, 'iron', 0.5);
    for (let i = 0; i <= n; i++) k.box(0.12, 2.2, 0.12, 'iron', e.a[0] + (e.b[0] - e.a[0]) * (i / n), 0, e.a[1] + (e.b[1] - e.a[1]) * (i / n));
  }
  if (path) ribbon(k, path.pts, 2.4, () => 0, 0.05, 'graniteLight', { keep: (x, z) => inside(O, x, z), mat: MAT.smooth });
}

dmaria.metric = true;
dmaria.rule = {
  base: { part: /Dona Maria/, stat: 'mean' },
  view: 0.7,
  note: 'flat default pad on the mean level; mask = the buildings only; height = the wing stair block, 13 m',
};

export default { 'dmaria-ii': dmaria };

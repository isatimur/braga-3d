// Museu de Arqueologia D. Diogo de Sousa (2007, Carlos Guimarães and Luís
// Soares Carneiro), metric builder.
//
// Frame (fit.js): +z = the west-south-west front on Rua dos Bombeiros
// Voluntários (250 deg), origin at the centre of the site outline
// (way 104691209, 127 x 125 m). Drawn on the OSM polygons:
//  - the exhibition body (w108351556, 10 m, two double-height levels): a long
//    white-rendered mass 59 x 29 m with a projecting entrance bay on the
//    front and the clefts of its back; the long front wall carries the
//    museum name in black capitals and the rust-and-black logo (photo);
//  - the four-level technical block (w444600885, 12.8 m) with its rooftop
//    plant cage; the one-level wing (w439194283, 3.2 m) that runs to the
//    street; the roofed structure (w1256950800, 4 m) on posts;
//  - the gardens: Jardim dos Miliários (milestones in the lawn), the lawn
//    round the excavated Roman domus (low walls, mosaic floors, a peristyle
//    of column stumps behind a parapet), paved courtyard with granite joints
//    and a stepped bank.
// Assumption: OSM does not say which block is the cafeteria or the technical
// sector; the four-level block is drawn as the technical one (dims note).
// The flat pad is the default: the site is nearly level.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { ribbonWindows } from './parts.js';
import { offset, bbox, inside } from './geom.js';
import { lowTree } from './drape.js';

const WALL = 'plaster';

// Roof of a flat-roofed body: a parapet ring and a lead deck; top = y0 + h.
function flatRoof(k, pts, y0, h, wall = WALL) {
  k.prism(pts, y0, 0.6, wall, { holes: [offset(pts, -0.3)] });
  k.prism(offset(pts, -0.3), y0, 0.14, 'lead');
  return h;
}

// A stroke of a capital letter on the current wall (2 triangles).
function stroke(k, x0, y0, x1, y1, w, z) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 1e-4) return;
  k.add(new THREE.PlaneGeometry(L + w * 0.6, w), 'dark', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, rz: Math.atan2(y1 - y0, x1 - x0), mat: MAT.flat });
}

const GLYPH = {
  D: [[[0, 0], [0, 1], [0.55, 1], [1, 0.75], [1, 0.25], [0.55, 0], [0, 0]]],
  I: [[[0.5, 0], [0.5, 1]], [[0.2, 1], [0.8, 1]], [[0.2, 0], [0.8, 0]]],
  O: [[[0.3, 1], [0.7, 1], [1, 0.75], [1, 0.25], [0.7, 0], [0.3, 0], [0, 0.25], [0, 0.75], [0.3, 1]]],
  G: [[[1, 0.78], [0.7, 1], [0.3, 1], [0, 0.75], [0, 0.25], [0.3, 0], [0.7, 0], [1, 0.25], [1, 0.45], [0.55, 0.45]]],
  E: [[[1, 1], [0, 1], [0, 0], [1, 0]], [[0, 0.5], [0.8, 0.5]]],
  S: [[[1, 0.82], [0.7, 1], [0.3, 1], [0, 0.8], [0.1, 0.6], [0.9, 0.4], [1, 0.2], [0.7, 0], [0.3, 0], [0, 0.18]]],
  U: [[[0, 1], [0, 0.25], [0.3, 0], [0.7, 0], [1, 0.25], [1, 1]]],
  A: [[[0, 0], [0.5, 1], [1, 0]], [[0.2, 0.35], [0.8, 0.35]]],
  '.': [[[0.4, 0], [0.6, 0], [0.6, 0.18], [0.4, 0.18], [0.4, 0]]],
};

// A line of text on the wall at the current transform; x = left edge.
function text(k, str, x, y, h, z) {
  const gw = h * 0.62;
  const sw = h * 0.11;
  let cx = x;
  for (const ch of str) {
    if (ch === ' ') {
      cx += gw * 0.7;
      continue;
    }
    const g = GLYPH[ch];
    const w = ch === '.' ? gw * 0.3 : ch === 'I' ? gw * 0.55 : gw;
    if (g) {
      for (const line of g) {
        for (let i = 1; i < line.length; i++) {
          const [a, b] = line[i - 1];
          const [c, d] = line[i];
          stroke(k, cx + a * w, y + b * h, cx + c * w, y + d * h, sw, z);
        }
      }
    }
    cx += w + h * 0.3;
  }
  return cx - h * 0.3;
}

function exhibition(k, P) {
  const pts = P.pts;
  const H = 10;
  k.prism(pts, -0.4, H - 0.6 + 0.4, WALL);
  k.prism(offset(pts, 0.1), -0.4, 1.2, 'graniteGrey');
  flatRoof(k, pts, H - 0.6, H);
  // small square openings along the long walls (photo)
  k.push({ x: -38.3, z: 20.5, ry: 0 });
  for (let i = 0; i < 8; i++) k.box(0.55, 0.55, 0.16, 'dark', -16 + i * 4.6 + (i > 3 ? 2.6 : 0), 4.3 + (i % 3) * 0.02, 0.05);
  // the name in capitals, the rust-and-black logo, "MUSEU DE ARQUEOLOGIA" line
  k.add(new THREE.PlaneGeometry(1.2, 4.2), 'dark', { x: -17.2, y: 7.4, z: 0.03, mat: MAT.flat });
  k.add(new THREE.PlaneGeometry(1.5, 4.2), 'rust', { x: -15.6, y: 7.4, z: 0.03, mat: MAT.flat });
  k.add(new THREE.PlaneGeometry(1.2, 4.2), 'dark', { x: -13.9, y: 7.4, z: 0.03, mat: MAT.flat });
  text(k, 'D. DIOGO', -12.2, 5.4, 3.8, 0.04);
  text(k, 'DE SOUSA', -12.2, 0.9, 3.8, 0.04);
  k.pop();
  // the entrance bay projecting on the front (x -18.3..-12.6, z to 30.7)
  k.push({ x: -15.45, z: 30.7, ry: 0 });
  k.add(new THREE.PlaneGeometry(4.6, 3.6), 'glass', { x: 0, y: 2.0, z: 0.06, mat: MAT.flat, emit: 0.3 });
  k.box(5.4, 0.35, 3.4, 'graniteGrey', 0, 3.9, 1.7); // canopy
  for (const s of [-1, 1]) k.box(0.16, 0.16, 0.16, 'iron', s * 2.5, 3.5, 3.2);
  k.pop();
  // a band of tall windows on the west end (photo of the courtyard side)
  ribbonWindows(k, pts, 0, { storeys: 1, first: 5.3, h: 2.2, minLen: 12, margin: 3, only: (e) => e.nx < -0.7, emit: 0.16 });
}

function tech(k, P) {
  const pts = P.pts;
  const H = 12.8;
  k.prism(pts, -0.4, H + 0.4 - 0.6, WALL);
  k.prism(offset(pts, 0.1), -0.4, 1.1, 'graniteGrey');
  flatRoof(k, pts, H - 0.6, H);
  ribbonWindows(k, pts, 0, { storeys: 4, first: 1.2, storey: 3.2, h: 1.6, margin: 1.6, minLen: 6, emit: 0.14 });
  // rooftop plant in a light frame cage (photo: chillers behind glass)
  const b = bbox(pts);
  const cx = b.cx - 2;
  const cz = b.cz - 5;
  for (const [dx, dz] of [[-3.2, -2.2], [3.2, -2.2], [-3.2, 2.2], [3.2, 2.2]]) k.box(0.12, 0.8, 0.12, 'iron', cx + dx, H, cz + dz);
  k.box(6.6, 0.1, 4.6, 'iron', cx, H + 0.8, cz);
  k.box(2.6, 0.7, 1.6, 'white', cx - 1.5, H + 0.05, cz, { mat: MAT.metal });
  k.box(2.6, 0.7, 1.6, 'steel', cx + 1.8, H + 0.05, cz, { mat: MAT.metal });
  k.add(new THREE.BoxGeometry(6.4, 0.8, 4.4), 'glass', { x: cx, y: H + 0.4, z: cz, glass: true });
}

function lowWing(k, P) {
  const pts = P.pts;
  const H = 3.2;
  k.prism(pts, -0.4, H + 0.4 - 0.4, WALL);
  k.prism(pts, H - 0.4, 0.4, 'graniteLight', { mat: MAT.smooth });
  ribbonWindows(k, pts, 0, { storeys: 1, first: 0.7, h: 1.9, margin: 2, minLen: 8, emit: 0.2 });
}

// The roofed structure: a slab on steel posts.
function roofed(k, P) {
  const b = bbox(P.pts);
  k.box(b.w, 0.35, b.d, 'graniteLight', b.cx, 3.65, b.cz);
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) k.box(0.22, 3.65, 0.22, 'steel', b.x0 + 0.5 + (i * (b.w - 1)) / 4, 0, b.cz + s * (b.d / 2 - 0.5), { mat: MAT.metal });
  k.box(b.w - 1, 0.1, b.d - 1, 'window', b.cx, 3.58, b.cz, { emit: 0.5 }); // lit soffit
}

function drawRuins(k, R) {
  const [x0, x1, z0, z1] = R;
  k.box(x1 - x0, 0.1, z1 - z0, 'sand', (x0 + x1) / 2, 0, (z0 + z1) / 2, { mat: MAT.smooth });
  // parapet with a rail round the excavation
  const t = 0.3;
  const pw = (a, b) => k.wallLine(a, b, 0.95, t, 'graniteLight', 0, { ext: t });
  pw([x0, z0], [x1, z0]);
  pw([x0, z1], [x1, z1]);
  pw([x0, z0], [x0, z1]);
  pw([x1, z0], [x1, z1]);
  // walls of the domus (low courses of granite blocks)
  const WH = 0.75;
  const w = (a, b, h = WH) => k.wallLine(a, b, h, 0.55, 'graniteDark', 0.05, { ext: 0.55 });
  const X0 = x0 + 2.5;
  const X1 = x1 - 2.5;
  const Z0 = z0 + 2.5;
  const Z1 = z1 - 2.5;
  w([X0, Z0], [X1, Z0]);
  w([X0, Z1], [X1, Z1]);
  w([X0, Z0], [X0, Z1]);
  w([X1, Z0], [X1, Z1], 0.55);
  w([X0 + 7, Z0], [X0 + 7, Z0 + 5]);
  w([X0 + 7, Z0 + 8], [X0 + 7, Z1]);
  w([X0 + 14, Z0], [X0 + 14, Z0 + 3.4]);
  w([X0, Z0 + 6], [X0 + 3, Z0 + 6], 0.5);
  w([X0 + 7, Z0 + 6], [X0 + 14, Z0 + 6], 0.5);
  // mosaic floors (patterned planes on the sand)
  const mosaic = (mx0, mz0, mx1, mz1, c1, c2) => {
    k.box(mx1 - mx0, 0.03, mz1 - mz0, c1, (mx0 + mx1) / 2, 0.1, (mz0 + mz1) / 2, { mat: MAT.smooth });
    k.box(mx1 - mx0 - 0.9, 0.03, mz1 - mz0 - 0.9, c2, (mx0 + mx1) / 2, 0.13, (mz0 + mz1) / 2, { mat: MAT.smooth });
    k.box(mx1 - mx0 - 1.8, 0.03, mz1 - mz0 - 1.8, c1, (mx0 + mx1) / 2, 0.16, (mz0 + mz1) / 2, { mat: MAT.smooth });
  };
  mosaic(X0 + 0.5, Z0 + 0.5, X0 + 6.5, Z0 + 5.5, 'terracotta', 'sand');
  mosaic(X0 + 7.5, Z0 + 6.5, X0 + 13.5, Z0 + 12.5, 'graniteDark', 'graniteLight');
  // peristyle: column stumps and the impluvium
  for (let i = 0; i < 4; i++) {
    for (const zz of [Z0 + 1.6, Z1 - 1.6]) k.cyl(0.32, 0.36, 0.7 + (i % 2) * 0.35, 8, 'graniteLight', X1 - 7.6 + i * 2.2, 0.05, zz);
  }
  k.box(3.6, 0.2, 3.0, 'water', X1 - 3.4, 0.02, (Z0 + Z1) / 2, { mat: MAT.water, emit: 0.2 });
}

function milestones(k, P) {
  const b = bbox(P.pts);
  let n = 0;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 4; i++) {
      const x = b.x0 + 6 + i * ((b.w - 12) / 3) + (j % 2) * 2;
      const z = b.z0 + 9 + j * 11;
      if (!inside(P.pts, x, z)) continue;
      const h = 1.5 + ((n * 37) % 7) * 0.13;
      k.cyl(0.26, 0.31, h, 8, 'graniteLight', x, 0.15, z);
      k.cyl(0.3, 0.3, 0.14, 8, 'graniteGrey', x, 0.15 + h - 0.05, z);
      k.cyl(0.55, 0.6, 0.15, 8, 'graniteGrey', x, 0.1, z);
      n++;
    }
  }
}

function diogo(k, { footprint }) {
  const O = footprint.outline;
  const rnd = k.rnd;
  // --- ground: paved site (granite joints), lawns, the excavation hole
  const P = footprint.parts;
  const ex = P.find((p) => p.osm === 'w108351556');
  const te = P.find((p) => p.osm === 'w444600885');
  const lw = P.find((p) => p.osm === 'w439194283');
  const rf = P.find((p) => p.osm === 'w1256950800');
  const gardens = P.filter((p) => p.tag === 'garden');
  k.prism(O, -0.4, 0.42, 'graniteGrey', { mat: MAT.smooth });
  const RUIN = [0.9, 29.4, -34.2, -14.9];
  for (const g of gardens) {
    const holes = g.pts.length === 14 ? [[[RUIN[0] - 0.3, RUIN[2] - 0.3], [RUIN[1] + 0.3, RUIN[2] - 0.3], [RUIN[1] + 0.3, RUIN[3] + 0.3], [RUIN[0] - 0.3, RUIN[3] + 0.3]]] : undefined;
    k.prism(g.pts, -0.05, 0.2, 'grass', { mat: MAT.leaf, holes });
  }
  // paving joints in the courtyard between the blocks
  for (let x = 5; x <= 50; x += 9) k.box(0.14, 0.03, 30, 'graniteDark', x, 0.02, 10, { mat: MAT.smooth });
  for (let z = -6; z <= 26; z += 8) k.box(45, 0.03, 0.14, 'graniteDark', 27.5, 0.02, z, { mat: MAT.smooth });

  // --- buildings (their plan is the mask)
  k.begin('mask');
  if (ex) exhibition(k, ex);
  if (te) tech(k, te);
  if (lw) lowWing(k, lw);
  if (rf) roofed(k, rf);
  k.end('mask');

  drawRuins(k, RUIN);
  const mil = P.find((p) => /Miliários/.test(p.name || ''));
  if (mil) milestones(k, mil);
  // stepped granite bank facing the courtyard (photo, left)
  k.push({ x: 20, z: 32, ry: Math.PI });
  k.stairs(20, 3.2, 1.0, 5, 'graniteGrey', 0, 0, 0, {});
  k.pop();
  // steel and glass canopy over the bank (sloping glazed roof)
  k.add(new THREE.PlaneGeometry(20, 4.6), 'glass', { x: 20, y: 3.4, z: 36.2, rx: -Math.PI / 2 + 0.16, glass: true });
  for (let i = 0; i < 5; i++) k.box(0.12, 3.0, 0.12, 'steel', 10.5 + i * 4.75, 0, 38.4, { mat: MAT.metal });
  k.box(20, 0.12, 0.14, 'steel', 20, 3.55, 38.4, { mat: MAT.metal });
  // trees on the lawns and along the street, lamps along the paths
  const b = bbox(O);
  let n = 0;
  for (let t = 0; t < 400 && n < 26; t++) {
    const x = b.x0 + 4 + rnd() * (b.w - 8);
    const z = b.z0 + 4 + rnd() * (b.d - 8);
    if (!inside(O, x, z) || !gardens.some((g) => inside(g.pts, x, z))) continue;
    if ([ex, te, lw, rf].some((p) => p && inside(offset(p.pts, 3), x, z))) continue;
    if (x > RUIN[0] - 2 && x < RUIN[1] + 2 && z > RUIN[2] - 2 && z < RUIN[3] + 2) continue;
    lowTree(k, x, 0.15, z, 6 + rnd() * 3.5);
    n++;
  }
  for (let i = 0; i < 6; i++) k.lamp(4.2, 4 + i * 8.5, 0, 24 + (i % 2) * 22);
  // benches of granite in the courtyard
  for (let i = 0; i < 4; i++) k.box(2.2, 0.45, 0.6, 'graniteLight', 12 + i * 8, 0, 27);
}

diogo.metric = true;
diogo.rule = {
  base: { part: /Museu de Arqueologia/, stat: 'mean' },
  view: 0.9,
  note: 'flat default pad on the mean level; mask = the museum buildings only (gardens and paving are outside the plan); height = the four-level block, 12.8 m',
};

export default { 'diogo-sousa': diogo };

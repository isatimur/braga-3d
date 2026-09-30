// Museu de Arqueologia D. Diogo de Sousa (2007, Carlos Guimarães and Luís
// Soares Carneiro), metric builder.
//
// Frame (fit.js): +z = the west-south-west front on Rua dos Bombeiros
// Voluntários (250 deg), origin at the centre of the site outline
// (way 104691209, 127 x 125 m). The museum is a low, long composition of
// one- and two-storey volumes in white render over a granite plinth, set
// round paved courts and gardens (photos). Drawn on the OSM polygons:
//  - the exhibition body (w108351556): a 6.4 m gallery ring round the
//    double-height hall (10 m, dims) with the plant unit on its roof; the
//    long front wall carries the museum name in black capitals, the
//    rust-and-black logo and a row of small square openings; the glazed
//    entrance bay projects into the forecourt under a thin canopy on posts;
//  - the services block (w444600885): two storeys (7.8 m) on a granite base,
//    one wide window on the upper floor and a louvred band on the lower
//    (photo of the courtyard). OSM gives building:levels=4: the site falls
//    to the east and the lower levels sit below the court, so the block
//    reads as two storeys from the museum side;
//  - the cafeteria wing (w439194283): one glazed storey under a slab, with a
//    pergola of slender posts on the court side; the roofed structure
//    (w1256950800) on posts;
//  - the gardens: Jardim dos Miliários (milestones in the lawn), the
//    excavated Roman domus (low walls, mosaic floors, a peristyle of column
//    stumps and three standing columns behind a parapet), loose Roman stones
//    on the lawn beside it, the paved court with granite joints, a granite
//    retaining wall with a stepped bench, and the stepped bank under a
//    glazed canopy.
// Two flag masts on the forecourt (photo) top the model at 12.8 m, the
// dimensions.json total derived from the four OSM levels of the services
// block. The flat pad is the default: the site is nearly level.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { ribbonWindows, flatWindow } from './parts.js';
import { offset, bbox, inside, edges } from './geom.js';
import { lowTree } from './drape.js';

const WALL = 'plaster';
const PLINTH = 1.1;

// Roof of a flat-roofed body: a parapet ring and a lead deck; top = y0 + h.
function flatRoof(k, pts, y0, h, wall = WALL) {
  k.prism(pts, y0, 0.6, wall, { holes: [offset(pts, -0.3)] });
  k.prism(offset(pts, -0.3), y0, 0.14, 'lead');
  return h;
}

// The granite plinth every block stands on (photo of the courtyard).
function plinth(k, pts) {
  k.prism(offset(pts, 0.12), -0.4, PLINTH + 0.4, 'graniteGrey');
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

// Rooftop plant: two units in a low rail cage (photo: the unit on the roof
// behind the name wall).
function plant(k, cx, y, cz) {
  for (const [dx, dz] of [[-3.1, -2.1], [3.1, -2.1], [-3.1, 2.1], [3.1, 2.1]]) k.box(0.1, 1.1, 0.1, 'iron', cx + dx, y, cz + dz);
  k.box(6.3, 0.06, 0.06, 'iron', cx, y + 1.05, cz - 2.1);
  k.box(6.3, 0.06, 0.06, 'iron', cx, y + 1.05, cz + 2.1);
  k.box(0.06, 0.06, 4.3, 'iron', cx - 3.1, y + 1.05, cz);
  k.box(0.06, 0.06, 4.3, 'iron', cx + 3.1, y + 1.05, cz);
  k.box(2.4, 0.9, 1.5, 'white', cx - 1.5, y, cz, { mat: MAT.metal });
  k.box(2.4, 0.9, 1.5, 'steel', cx + 1.6, y, cz, { mat: MAT.metal });
}

function exhibition(k, P) {
  const pts = P.pts;
  const H = 6.4; // the gallery ring (photo: the name wall is about 6 m)
  k.prism(pts, -0.4, H - 0.6 + 0.4, WALL);
  plinth(k, pts);
  flatRoof(k, pts, H - 0.6, H);
  // the double-height hall rises to 10 m (dims) in the middle of the ring
  const hall = [[-52, -1], [-6, -1], [-6, 14], [-52, 14]];
  k.prism(hall, H - 0.5, 10 - 0.6 - (H - 0.5), WALL);
  flatRoof(k, hall, 10 - 0.6, 10);
  plant(k, -20, 10, 7);
  // the front wall (x -58..-18 at z 20.6): small square openings, the
  // rust-and-black logo and the name in capitals (photo)
  k.push({ x: -38, z: 20.62, ry: 0 });
  for (const x of [-17.5, -15, -12.5, 6, 8.5, 11, 13.5, 16, 18.5]) k.box(0.55, 0.55, 0.16, 'dark', x, 4.7, 0.05);
  k.add(new THREE.PlaneGeometry(0.9, 2.8), 'dark', { x: -12.6, y: 3.6, z: 0.03, mat: MAT.flat });
  k.add(new THREE.PlaneGeometry(1.1, 2.8), 'rust', { x: -11.4, y: 3.6, z: 0.03, mat: MAT.flat });
  k.add(new THREE.PlaneGeometry(0.9, 2.8), 'dark', { x: -10.2, y: 3.6, z: 0.03, mat: MAT.flat });
  text(k, 'D. DIOGO', -8.6, 3.5, 2.0, 0.04);
  text(k, 'DE SOUSA', -8.6, 0.9, 2.0, 0.04);
  k.pop();
  // the glazed entrance bay (x -18.3..-12.6, z to 30.7) under a thin canopy
  // on two slender posts
  k.push({ x: -15.45, z: 30.7, ry: 0 });
  flatWindow(k, 0, 0.25, 5.0, 4.5, 0.05, { emit: 0.32, frame: 0.12 });
  k.box(1.0, 2.4, 0.04, 'dark', 0, 0.25 + 1.2, 0.1, { mat: MAT.flat }); // the door
  k.box(7.2, 0.28, 4.4, 'white', 0, 4.55, 2.1, { mat: MAT.smooth }); // canopy slab
  for (const s of [-1, 1]) k.box(0.14, 4.55, 0.14, 'steel', s * 3.2, 0, 3.9, { mat: MAT.metal });
  k.pop();
  // ribbons: offices on the west end, the hall foyer glazed to the court
  ribbonWindows(k, pts, 0, { storeys: 1, first: 2.2, h: 1.8, minLen: 12, margin: 3, only: (e) => e.nx < -0.7, emit: 0.16 });
  ribbonWindows(k, pts, 0, { storeys: 1, first: 1.3, h: 2.4, minLen: 12, margin: 2.5, only: (e) => e.nx > 0.7, emit: 0.2 });
}

// The two-storey services block on its granite base (photo of the court).
function services(k, P) {
  const pts = P.pts;
  const H = 7.8;
  k.prism(pts, -0.4, H - 0.6 + 0.4, WALL);
  plinth(k, pts);
  flatRoof(k, pts, H - 0.6, H);
  for (const e of edges(pts)) {
    if (e.len < 10) continue;
    k.push({ x: e.mx + e.nx * 0.03, y: 0, z: e.mz + e.nz * 0.03, ry: e.ry });
    // one wide window on the upper floor, a louvred band over the plinth
    flatWindow(k, 0, 4.6, Math.min(e.len - 5, 9), 2.1, 0, { emit: 0.14, frame: 0.16 });
    const lw = e.len - 3.6;
    flatWindow(k, 0, 1.4, lw, 1.7, 0, { pane: 'steel', emit: 0, frame: 0.12 });
    for (let i = 1; i < 4; i++) k.box(lw, 0.04, 0.02, 'graniteDark', 0, 1.4 + i * 0.42, 0.04, { mat: MAT.flat });
    k.pop();
  }
  const b = bbox(pts);
  plant(k, b.cx, H, b.cz - 4);
}

// The cafeteria: one glazed storey under a slab, a pergola on the court side.
function cafeteria(k, P) {
  const pts = P.pts;
  const H = 3.6;
  k.prism(pts, -0.4, H + 0.4 - 0.4, WALL);
  k.prism(offset(pts, 0.1), -0.4, 0.9, 'graniteGrey');
  k.prism(offset(pts, 0.2), H - 0.4, 0.4, 'graniteLight', { mat: MAT.smooth });
  ribbonWindows(k, pts, 0, { storeys: 1, first: 0.6, h: 2.5, margin: 1.5, minLen: 8, emit: 0.22 });
  // pergola: a thin slab on slender posts along the east (court) face
  const b = bbox(pts);
  const len = b.d - 3;
  k.box(2.8, 0.22, len, 'graniteLight', b.x1 + 1.4, 3.3, b.cz, { mat: MAT.smooth });
  const n = Math.max(2, Math.round(len / 4.5));
  for (let i = 0; i <= n; i++) k.box(0.16, 3.3, 0.16, 'steel', b.x1 + 2.6, 0, b.z0 + 1.5 + (i * len) / n, { mat: MAT.metal });
}

// The roofed structure: a slab on steel posts.
function roofed(k, P) {
  const b = bbox(P.pts);
  k.box(b.w, 0.35, b.d, 'graniteLight', b.cx, 3.65, b.cz);
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) k.box(0.22, 3.65, 0.22, 'steel', b.x0 + 0.5 + (i * (b.w - 1)) / 4, 0, b.cz + s * (b.d / 2 - 0.5), { mat: MAT.metal });
  k.box(b.w - 1, 0.1, b.d - 1, 'window', b.cx, 3.58, b.cz, { emit: 0.5 }); // lit soffit
}

// A standing Roman column: shaft, base and a plain capital.
function column(k, x, z, h) {
  k.cyl(0.42, 0.46, 0.25, 8, 'graniteGrey', x, 0.05, z);
  k.cyl(0.3, 0.34, h, 8, 'graniteLight', x, 0.3, z);
  k.box(0.9, 0.3, 0.9, 'graniteGrey', x, 0.3 + h, z);
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
  // peristyle: column stumps, three re-erected columns and the impluvium
  for (let i = 0; i < 4; i++) {
    for (const zz of [Z0 + 1.6, Z1 - 1.6]) k.cyl(0.32, 0.36, 0.7 + (i % 2) * 0.35, 8, 'graniteLight', X1 - 7.6 + i * 2.2, 0.05, zz);
  }
  for (let i = 0; i < 3; i++) column(k, X0 + 2 + i * 3, Z1 - 1.3, 3.0 + (i % 2) * 0.4);
  k.box(3.6, 0.2, 3.0, 'water', X1 - 3.4, 0.02, (Z0 + Z1) / 2, { mat: MAT.water, emit: 0.2 });
}

// Loose Roman stones on the lawn beside the excavation: blocks, drums, a
// sarcophagus and a column on a plinth.
function stones(k, G, rnd) {
  const spots = [[34, -24], [37.5, -27], [41, -23.5], [36, -31], [44, -28], [39.5, -20.5], [47, -24]];
  let i = 0;
  for (const [x, z] of spots) {
    if (!inside(G.pts, x, z)) continue;
    const ry = rnd() * Math.PI;
    if (i % 3 === 0) k.box(1.3, 0.6, 0.8, 'graniteLight', x, 0.15, z, { ry });
    else if (i % 3 === 1) k.cyl(0.42, 0.42, 0.9, 8, 'graniteGrey', x, 0.15, z);
    else k.box(0.9, 0.5, 0.7, 'graniteDark', x, 0.15, z, { ry });
    i++;
  }
  k.box(2.3, 0.95, 1.1, 'graniteDark', 42.5, 0.15, -33.5, { ry: 0.3 }); // sarcophagus
  k.box(2.4, 0.22, 1.2, 'graniteLight', 42.5, 1.1, -33.5, { ry: 0.3 }); // its lid
  column(k, 34.5, -36, 2.6);
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
  // --- ground: paved site (granite joints), lawns, the excavation
  const P = footprint.parts;
  const ex = P.find((p) => p.osm === 'w108351556');
  const sv = P.find((p) => p.osm === 'w444600885');
  const cf = P.find((p) => p.osm === 'w439194283');
  const rf = P.find((p) => p.osm === 'w1256950800');
  const gardens = P.filter((p) => p.tag === 'garden');
  k.prism(O, -0.4, 0.42, 'graniteGrey', { mat: MAT.smooth });
  // the excavation sits in the notch of the south lawn (x 0..30, z -35..-14)
  const RUIN = [0.9, 29.4, -34.2, -14.9];
  for (const g of gardens) k.prism(g.pts, -0.05, 0.2, 'grass', { mat: MAT.leaf });
  // paving joints: the court between the blocks and the forecourt
  for (let x = 5; x <= 50; x += 9) k.box(0.14, 0.03, 30, 'graniteDark', x, 0.02, 10, { mat: MAT.smooth });
  for (let z = -6; z <= 26; z += 8) k.box(45, 0.03, 0.14, 'graniteDark', 27.5, 0.02, z, { mat: MAT.smooth });
  for (let z = 36; z <= 60; z += 6) k.box(13, 0.03, 0.14, 'graniteDark', -17, 0.02, z, { mat: MAT.smooth });
  for (let x = -21; x <= -13; x += 4) k.box(0.14, 0.03, 32, 'graniteDark', x, 0.02, 47, { mat: MAT.smooth });

  // --- buildings (their plan is the mask)
  k.begin('mask');
  if (ex) exhibition(k, ex);
  if (sv) services(k, sv);
  if (cf) cafeteria(k, cf);
  if (rf) roofed(k, rf);
  k.end('mask');

  drawRuins(k, RUIN);
  const lawn = gardens.find((g) => g.pts.length === 14);
  if (lawn) stones(k, lawn, rnd);
  const mil = P.find((p) => /Miliários/.test(p.name || ''));
  if (mil) milestones(k, mil);
  // the raised court: a granite retaining wall with a stepped bench between
  // the court and the lower lawn of the domus (photo)
  k.wallLine([1, -13.6], [29, -13.6], 1.1, 0.5, 'graniteGrey', 0, { ext: 0.5 });
  k.box(27.5, 0.5, 0.7, 'graniteGrey', 15, 0, -12.9);
  k.box(27.5, 0.45, 0.6, 'graniteLight', 15, 0.5, -13.0);
  // stepped granite bank facing the court (photo, left)
  k.push({ x: 20, z: 32, ry: Math.PI });
  k.stairs(20, 3.2, 1.0, 5, 'graniteGrey', 0, 0, 0, {});
  k.pop();
  // steel and glass canopy over the bank (sloping glazed roof)
  k.add(new THREE.PlaneGeometry(20, 4.6), 'glass', { x: 20, y: 3.4, z: 36.2, rx: -Math.PI / 2 + 0.16, glass: true });
  for (let i = 0; i < 5; i++) k.box(0.12, 3.0, 0.12, 'steel', 10.5 + i * 4.75, 0, 38.4, { mat: MAT.metal });
  k.box(20, 0.12, 0.14, 'steel', 20, 3.55, 38.4, { mat: MAT.metal });
  // two flag masts on the forecourt (photo): the tallest point of the site
  k.begin('height');
  for (const [x, c] of [[-22, 'rust'], [-18, 'flowerRed']]) {
    k.cyl(0.05, 0.09, 12.8, 6, 'steel', x, 0, 44, { mat: MAT.metal });
    k.add(new THREE.PlaneGeometry(1.8, 1.1), c, { x: x + 0.95, y: 12.0, z: 44, mat: MAT.flat });
  }
  k.end('height');
  // trees on the lawns and along the street, lamps along the paths
  const b = bbox(O);
  let n = 0;
  for (let t = 0; t < 400 && n < 26; t++) {
    const x = b.x0 + 4 + rnd() * (b.w - 8);
    const z = b.z0 + 4 + rnd() * (b.d - 8);
    if (!inside(O, x, z) || !gardens.some((g) => inside(g.pts, x, z))) continue;
    if ([ex, sv, cf, rf].some((p) => p && inside(offset(p.pts, 3), x, z))) continue;
    if (x > RUIN[0] - 2 && x < RUIN[1] + 2 && z > RUIN[2] - 2 && z < RUIN[3] + 2) continue;
    if (x > 32 && x < 49 && z > -38 && z < -19) continue; // the stones
    lowTree(k, x, 0.15, z, 6 + rnd() * 3.5);
    n++;
  }
  for (let i = 0; i < 6; i++) k.lamp(4.2, 4 + i * 8.5, 0, 24 + (i % 2) * 22);
  // benches of granite in the court
  for (let i = 0; i < 4; i++) k.box(2.2, 0.45, 0.6, 'graniteLight', 12 + i * 8, 0, 27);
}

diogo.metric = true;
diogo.rule = {
  base: { part: /Museu de Arqueologia/, stat: 'mean' },
  view: 0.9,
  note: 'flat default pad on the mean level; mask = the museum buildings only (gardens and paving are outside the plan); the blocks are one and two storeys (hall 10 m); height = the flag masts, 12.8 m',
};

export default { 'diogo-sousa': diogo };

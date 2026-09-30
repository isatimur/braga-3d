// Capela de São Frutuoso de Montélios, metric builder.
//
// Frame (fit.js): the OSM outline is the Greek-cross chapel (way 159104082,
// 13.3 x 11.5 m). Its west arm (the entrance, azimuth 250) is local +z and is
// buried in the east wall of the Igreja de São Jerónimo de Real (w131049722,
// the former Franciscan church, 41 x 28 m, 12 m). The Convento de São
// Francisco (w159104084, 9 m) lies on the far (-z) side of the chapel, a U
// open toward it. Everything is drawn on its OSM polygon.
// Chapel (photos, DGPC plan: four equal apses round a square crossing):
// grey lichen-stained granite ashlar, three free arms with tiled gables and
// raking cornices (about 5.5 m to the ridge), a square tower over the
// crossing with a corbel-table frieze of small arches, twin openings and a
// pyramidal tile roof, 9 m to the finial (dims). Blind horseshoe arches and
// triangular (delta) reliefs on the arm faces.
// Assumptions: the arm the photo shows with the door is drawn as the -z arm;
// the church front faces +z (SW forecourt) on the nave end at z = 18.2; the
// church and convent details (windows, roofs) are generic, the sources give
// heights only (12 m and 9 m, estimates).
import * as THREE from 'three';
import { corniceProfile, MAT, archPath } from './kit.js';
import { win, pediment, punchedWindows } from './parts.js';
import { offset, obb } from './geom.js';
import { lowTree } from './drape.js';

const STONE = 'granite';
const ARM_W = 6.1;
const ARM_H = 3.7; // walls to the eaves
const ARM_RISE = 1.7;
const TOWER_H = 7.5;

// Horseshoe outline: jambs at +-w/2 (0.86 of the circle radius), the circle
// closes over the springing so the feet are narrower than the diameter.
function horseshoe(p, cx, y0, w, h) {
  const R = w / 2 / 0.86;
  const yc = y0 + h - R;
  const dy = Math.sqrt(R * R - (0.86 * R) ** 2);
  const a = Math.atan2(-dy, 0.86 * R);
  p.moveTo(cx - w / 2, y0);
  p.lineTo(cx + w / 2, y0);
  p.lineTo(cx + w / 2, yc - dy);
  p.absarc(cx, yc, R, a, Math.PI - a, false);
  p.lineTo(cx - w / 2, y0);
  return p;
}

// Blind arch in relief on a wall face at z: a light rim and a dark recess.
function blindArch(k, cx, y0, w, h, z) {
  k.extrude(horseshoe(new THREE.Shape(), cx, y0, w, h), 0.12, 'graniteLight', 0, 0, z + 0.06);
  k.plane(horseshoe(new THREE.Shape(), cx, y0 + 0.13, w * 0.7, h - 0.24), 'graniteDark', 0, 0, z + 0.125, { mat: MAT.flat });
}

// Triangular (delta) relief frame on a wall face at z.
function delta(k, cx, y0, w, h, z) {
  const s = new THREE.Shape();
  s.moveTo(cx - w / 2, y0);
  s.lineTo(cx + w / 2, y0);
  s.lineTo(cx, y0 + h);
  s.closePath();
  const t = 0.15;
  const hole = new THREE.Path();
  hole.moveTo(cx - w / 2 + t * 2.1, y0 + t);
  hole.lineTo(cx + w / 2 - t * 2.1, y0 + t);
  hole.lineTo(cx, y0 + h - t * 2.4);
  hole.closePath();
  s.holes.push(hole);
  k.extrude(s, 0.1, 'graniteLight', 0, 0, z + 0.05);
}

// One free arm, drawn round its own origin (core edge midpoint), outward = +z.
function arm(k, o) {
  const { D } = o;
  k.push({ x: o.x, z: o.z, ry: o.ry });
  k.box(ARM_W, ARM_H + 0.5, D, STONE, 0, -0.5, D / 2);
  k.box(ARM_W + 0.2, 0.55, D + 0.1, 'graniteDark', 0, -0.05, D / 2 + 0.05); // plinth
  k.corniceRing(ARM_W, D, corniceProfile('classic', 0.26), STONE, 0, ARM_H - 0.32, D / 2, { skip: [Math.PI] });
  k.gableRoof(ARM_W + 0.1, D - 0.2, ARM_RISE, 'terracotta', 0, ARM_H, D / 2 - 0.1, { over: 0.22, mat: MAT.tile });
  pediment(k, ARM_W + 0.1, ARM_RISE * 0.97, 0.3, STONE, 0, ARM_H, D - 0.1, { frame: 0.2 });
  if (!o.buried) {
    // string course and the row of reliefs on the end face
    k.box(ARM_W + 0.1, 0.13, 0.12, 'graniteLight', 0, 1.35, D + 0.03);
    k.box(ARM_W + 0.1, 0.13, 0.12, 'graniteLight', 0, 3.05, D + 0.03);
    if (o.door) {
      blindArch(k, -2.0, 1.55, 1.2, 1.4, D);
      delta(k, -0.05, 1.55, 1.4, 1.2, D);
      // the door: dark opening in a granite surround, a step
      k.box(0.16, 1.9, 0.22, 'graniteLight', 1.5, 0, D + 0.05);
      k.box(0.16, 1.9, 0.22, 'graniteLight', 2.5, 0, D + 0.05);
      k.box(1.16, 0.22, 0.26, 'graniteLight', 2.0, 1.9, D + 0.06);
      k.plane(new THREE.Shape([new THREE.Vector2(-0.42, 0), new THREE.Vector2(0.42, 0), new THREE.Vector2(0.42, 1.85), new THREE.Vector2(-0.42, 1.85)]), 'dark', 2.0, 0, D + 0.03, { mat: MAT.flat });
      k.box(1.5, 0.16, 0.7, 'graniteDark', 2.0, 0, D + 0.35);
    } else {
      blindArch(k, -2.0, 1.55, 1.2, 1.4, D);
      delta(k, -0.05, 1.55, 1.4, 1.2, D);
      blindArch(k, 2.0, 1.55, 1.2, 1.4, D);
      delta(k, 0, 3.15, 1.6, 0.5, D);
    }
    // one blind arch on each side face
    for (const s of [-1, 1]) {
      k.push({ x: s * (ARM_W / 2), ry: (s * Math.PI) / 2 });
      blindArch(k, -D / 2, 1.55, 1.1, 1.4, 0);
      k.pop();
    }
  }
  k.pop();
}

function tower(k, x0, x1, z0, z1) {
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  k.box(w, TOWER_H + 0.5, d, STONE, cx, -0.5, cz);
  k.corniceRing(w, d, corniceProfile('classic', 0.3), STONE, cx, TOWER_H - 0.4, cz);
  k.corniceRing(w, d, corniceProfile('band', 0.14), 'graniteLight', cx, ARM_H + 1.05, cz);
  // the four faces: corbel-table frieze of small blind arches, twin openings
  for (const [ry, len, ox, oz] of [[0, w, 0, d / 2], [Math.PI, w, 0, -d / 2], [Math.PI / 2, d, w / 2, 0], [-Math.PI / 2, d, -w / 2, 0]]) {
    k.push({ x: cx + ox, z: cz + oz, ry });
    k.box(len - 0.3, 0.14, 0.14, 'graniteLight', 0, TOWER_H - 1.35, 0.03);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const u = -(len - 1.2) / 2 + (i * (len - 1.2)) / (n - 1);
      const p = new THREE.Shape();
      archPath(p, u, 0, 0.42, 0.62);
      k.plane(p, 'graniteDark', 0, TOWER_H - 1.05, 0.03, { mat: MAT.flat });
    }
    for (const s of [-1, 1]) {
      const p = new THREE.Shape();
      archPath(p, s * 0.42, 0, 0.34, 1.05);
      k.plane(p, 'dark', 0, TOWER_H - 3.1, 0.03, { mat: MAT.flat });
    }
    k.pop();
  }
  // pyramidal tile roof, ridge finial and iron cross
  k.hipRoof(w, d, 1.2, 'terracotta', cx, TOWER_H, cz, { over: 0.3, mat: MAT.tile });
  const top = TOWER_H + 1.2;
  k.cyl(0.05, 0.08, 0.3, 4, 'iron', cx, top - 0.03, cz);
  return top;
}

function chapel(k) {
  k.begin('main');
  // crossing tower and the free arms
  tower(k, -3.2, 2.95, -2.1, 4.4);
  arm(k, { x: -0.13, z: -2.1, ry: Math.PI, D: 3.6, door: true });
  arm(k, { x: 2.95, z: 0.85, ry: Math.PI / 2, D: 3.75 });
  arm(k, { x: -3.2, z: 1.45, ry: -Math.PI / 2, D: 3.5 });
  arm(k, { x: 0.1, z: 4.4, ry: 0, D: 1.3, buried: true });
  k.end('main');
  // flagged apron round the chapel (outside the main box)
  k.box(15.4, 0.12, 0.9, 'graniteDark', 0, -0.02, -6.4, { mat: MAT.smooth });
}

// Igreja de São Jerónimo de Real on its polygon: white walls, granite base
// and quoins, tiled gables, a Baroque front on the nave end (+z).
function church(k, P) {
  const pts = P.pts;
  const H = 8.6;
  k.prism(pts, -0.6, H + 0.6, 'plaster');
  k.prism(offset(pts, 0.12), -0.6, 1.5, 'graniteGrey');
  // nave (x -28.9..-17.05, z -8.55..18.2) and its front
  const nx0 = -28.9;
  const nx1 = -17.05;
  const ncx = (nx0 + nx1) / 2;
  k.gableRoof(nx1 - nx0 + 0.2, 26.75, 3.4, 'terracotta', ncx, H, 4.825, { over: 0.4, mat: MAT.tile });
  // side wing (x -17.05..10, z 5.7..19.65): ridge along x
  k.gableRoof(13.9, 27.05, 2.6, 'terracotta', -3.5, H, 12.7, { over: 0.4, mat: MAT.tile, ry: Math.PI / 2 });
  // west bulge (tower base of the OSM polygon): flat cap
  k.box(2.4, 0.4, 11.4, 'lead', -30.0, H, 12.7);
  k.corniceRing(nx1 - nx0 + 2.2, 26.75 + 0, corniceProfile('eave', 0.5), 'graniteWarm', ncx - 1.1, H - 0.5, 4.825, { skip: [Math.PI] });
  // front (z = 18.2): granite quoins, portal, window, niches, pediment
  const zf = 18.2;
  const cxF = (nx0 - 2.2 + nx1) / 2;
  const wF = nx1 - (nx0 - 2.2);
  for (const x of [nx1 - 0.25, nx0 - 2.2 + 0.25]) k.box(0.6, H, 0.35, 'graniteWarm', x, 0, zf + 0.1);
  k.surround({ x: cxF, y: 0, w: 2.2, h: 3.6, arch: 'round' }, 0.4, 0.35, 'graniteWarm', zf);
  k.plane(archShape(cxF, 0, 2.2, 3.6), 'wood', 0, 0, zf + 0.06, { mat: MAT.flat });
  pediment(k, 3.8, 1.0, 0.4, 'graniteWarm', cxF, 4.15, zf + 0.35, { frame: 0.22 });
  win(k, cxF, 5.7, 1.3, 1.9, zf, { arch: 'round', bw: 0.28, depth: 0.25, trim: 'graniteWarm', pane: 'glass', emit: 0.22 });
  for (const s of [-1, 1]) win(k, cxF + s * 4.2, 4.2, 0.9, 1.6, zf, { arch: 'round', bw: 0.2, depth: 0.2, trim: 'graniteWarm', pane: 'glass', emit: 0.2 });
  k.cornice(wF + 0.6, corniceProfile('classic', 0.45), 'graniteWarm', cxF, H - 0.5, zf + 0.3);
  // triangular front gable of the nave
  const s = new THREE.Shape();
  s.moveTo(-wF / 2, 0);
  s.lineTo(wF / 2, 0);
  s.lineTo(0, 3.3);
  s.closePath();
  k.extrude(s, 0.5, 'plaster', cxF, H, zf - 0.05);
  k.box(0.22, 1.6, 0.22, 'iron', cxF, H + 3.2, zf - 0.05);
  k.box(0.8, 0.18, 0.18, 'iron', cxF, H + 4.4, zf - 0.05);
  // windows on the +z side of the wing (z = 19.65)
  k.push({ x: -3.5, z: 19.65, ry: 0 });
  for (let i = 0; i < 4; i++) win(k, -9 + i * 5.6, 3.4, 1.0, 2.2, 0, { arch: 'round', bw: 0.22, depth: 0.2, trim: 'granite', pane: 'glass', emit: 0.2 });
  k.pop();
}

function archShape(cx, y0, w, h) {
  const p = new THREE.Shape();
  archPath(p, cx, y0, w, h);
  return p;
}

// Convento de São Francisco: a U of three wings round a court open to the
// chapel, white walls, granite base, two floors of windows, hip roofs.
function convent(k, P) {
  const pts = P.pts;
  const H = 9;
  k.prism(pts, -0.6, H + 0.6, 'plaster');
  k.prism(offset(pts, 0.12), -0.6, 1.4, 'granite');
  punchedWindows(k, pts, 0, { storeys: 2, first: 1.5, storey: 3.9, bay: 3.6, w: 1.1, h: 1.7, trim: 'granite', minLen: 6, emit: 0.14 });
  // wings: pts [F,G,H,E], [I,J,C,D], [A,B,C,J] by the polygon order
  const wing = (idx) => {
    const q = idx.map((i) => pts[i]);
    const b = obb(q);
    k.push({ x: b.cx, z: b.cz, ry: b.a });
    k.hipRoof(b.L, b.W, Math.min(3.2, b.W * 0.22), 'terracotta', 0, H, 0, { over: 0.35, mat: MAT.tile });
    k.pop();
  };
  wing([5, 6, 7, 4]); // west wing (F, G, H, E)
  wing([8, 9, 2, 3]); // back wing (I, J, C, D)
  wing([0, 1, 2, 9]); // east wing (A, B, C, J)
}

function frutuoso(k, { footprint }) {
  const ch = footprint.part(/Jerónimo/);
  const cv = footprint.part(/Convento/);
  k.begin('mask');
  if (ch) church(k, ch);
  if (cv) convent(k, cv);
  // court of the convent: gravel with a cross of flags, a well, planting
  k.box(15.2, 0.1, 15.6, 'sand', -3.1, -0.06, -16.4, { mat: MAT.smooth });
  k.box(1.6, 0.14, 15.6, 'graniteLight', -3.1, -0.05, -16.4, { mat: MAT.smooth });
  k.box(15.2, 0.14, 1.6, 'graniteLight', -3.1, -0.05, -16.0, { mat: MAT.smooth });
  k.cyl(0.7, 0.8, 0.9, 8, 'granite', -3.1, 0, -16.0);
  for (const [x, z] of [[-8, -12], [1.8, -12], [-8, -20.5], [1.8, -20.5]]) lowTree(k, x, 0, z, 4.5, { spread: 0.34, lobes: 1 });
  // low garden wall with granite piers closing the court toward the chapel
  for (const [x0, x1] of [[-10.3, -6.2], [1.2, 4.6]]) {
    k.wallLine([x0, -8.4], [x1, -8.2], 1.0, 0.4, 'plaster');
    k.box(0.5, 1.3, 0.5, 'granite', x1, 0, -8.2);
  }
  chapel(k);
  // forecourt of the church: granite paving and a step along the front
  k.box(14.6, 0.12, 1.5, 'graniteLight', -24.0, -0.03, 19.0, { mat: MAT.smooth });
  k.end('mask');
}

frutuoso.metric = true;
frutuoso.rule = {
  extent: [/Jerónimo/, /Convento/],
  frame: { parts: [/Capela/], margin: 9 },
  view: 2.6,
  note: 'chapel is main (9 m tower); church and convent drawn on their polygons (extent set); mask = whole model so the city mass under church and convent is hidden',
};

export default { 'sao-frutuoso': frutuoso };

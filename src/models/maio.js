// Estádio 1.º de Maio (João Simões, 1946-1950), metric builder.
//
// Frame (fit.js): +z = the north main front toward Parque da Ponte (345
// deg), origin at the centre of the OSM bowl (w22660087, 145.6 x 221.9 m).
// OSM has the bowl, the pitch (w22660434, 106.8 x 67.7) and the running
// track (r2215785, 184.6 x 91.9); no stands or tower. The stands are the
// ring between the track and the bowl outline: stepped granite terraces
// on an earth bank, laid on the real ground (the south end backs into the
// hill, which rises 17 m above the pitch there). Only the pitch and the
// track are padded (base = pitch mean).
// From data/dimensions.json and the photos: the slender prismatic granite
// tower (30 m) with the arms of the Republic and ESTÁDIO 1.º DE MAIO,
// rising through the long entrance canopy on granite piers (six openings,
// flagpoles on the canopy), two bronze relief panels either side, a wide
// two-flight stair down to the avenue; four floodlight masts at the
// corners; the covered tribune with its glazed corridor on the west stand
// (local +x); the red running track with white lanes. The photos show no
// marathon arch, so none is drawn.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { cartouche } from './parts.js';
import { bbox, offset, centroid } from './geom.js';
import { lowTree, lowConifer } from './drape.js';

const STONE = 0xa7a398; // the grey granite terraces
const TRACK = 0x9c4636; // tartan red
const CONC = 'graniteLight';

// Farthest hit of a ray from (cx, cz) along (dx, dz) with a closed polygon.
function rayHit(poly, cx, cz, dx, dz) {
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax;
    const ez = bz - az;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - cx) * ez - (az - cz) * ex) / den;
    const u = ((ax - cx) * dz - (az - cz) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
  }
  return best;
}

// Thin flat ring (lane line) between polygon offsets d0 > d1 (inward < 0).
function laneLine(k, poly, d, w, y, color) {
  k.prism(offset(poly, d), y, 0.03, color, { holes: [offset(poly, d - w)], mat: MAT.flat });
}

function stadium(k, { footprint, dims }) {
  const rnd = k.rnd;
  const E = dims?.elements ?? {};
  const g = footprint.ground;
  const O = footprint.outline;
  const pitch = footprint.part('pitch');
  const track = footprint.part('other');
  const HT = dims?.height_m?.entrance_tower ?? 30;
  const [tcx, tcz] = track ? centroid(track.pts) : [0, 8];

  k.begin('main');
  // --- running track, infield, pitch
  if (track) {
    k.prism(track.pts, -0.5, 0.58, TRACK, { mat: MAT.smooth });
    const inner = offset(track.pts, -8.2); // six lanes and the kerb
    k.prism(inner, -0.5, 0.62, 'grass');
    for (let i = 0; i <= 6; i++) laneLine(k, track.pts, -1 - i * 1.22, 0.06, 0.08, 'white');
    laneLine(k, track.pts, -8.2, 0.25, 0.12, 'white'); // kerb
  }
  if (pitch) {
    const pb = bbox(pitch.pts);
    k.prism(pitch.pts, -0.5, 0.66, 'grass');
    const PL = pb.d;
    const PW = pb.w;
    for (let i = 0; i < 12; i++) k.box(PW - 1, 0.03, PL / 12 - 0.1, i % 2 ? 'grass' : 'hedge', pb.cx, 0.16, pb.z0 + (i + 0.5) * (PL / 12), { mat: MAT.flat });
    const line = (w, d, x, z) => k.box(w, 0.04, d, 'white', pb.cx + x, 0.19, pb.cz + z, { mat: MAT.flat });
    const pl = (E.pitch_length_m ?? 106.4) - 1.5;
    const pw = (E.pitch_width_m ?? 65.7) - 1.5;
    line(pw, 0.14, 0, pl / 2);
    line(pw, 0.14, 0, -pl / 2);
    line(0.14, pl, pw / 2, 0);
    line(0.14, pl, -pw / 2, 0);
    line(pw, 0.14, 0, 0);
    k.add(new THREE.TorusGeometry(9.15, 0.08, 3, 36), 'white', { x: pb.cx, y: 0.2, z: pb.cz, rx: Math.PI / 2, mat: MAT.flat });
    for (const s of [-1, 1]) {
      line(40.3, 0.14, 0, s * (pl / 2 - 16.5));
      for (const sx of [-1, 1]) line(0.14, 16.5, sx * 20.15, s * (pl / 2 - 8.25));
      const gz = pb.cz + s * (pl / 2 + 0.1);
      for (const sx of [-1, 1]) k.box(0.12, 2.44, 0.12, 'white', pb.cx + sx * 3.66, 0.16, gz);
      k.box(7.32, 0.12, 0.12, 'white', pb.cx, 2.6, gz);
      k.box(7.3, 2.4, 2, 'white', pb.cx, 0.16, gz + s, { glass: true });
    }
  }

  // --- the bowl: stepped terraces between the track and the outline
  const N = 120;
  const NS = 14; // terraces
  const rings = []; // per angle: profile points [x, y, z]
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    const ri = (track ? rayHit(track.pts, tcx, tcz, dx, dz) : 60) + 1.6;
    const ro = rayHit(O, tcx, tcz, dx, dz) - 1.2;
    const depth = Math.max(3, ro - ri);
    const px = (t) => tcx + dx * (ri + t);
    const pz = (t) => tcz + dz * (ri + t);
    const gOut = g(px(depth), pz(depth));
    const y0 = Math.max(1.1, g(px(0), pz(0)) + 1.1);
    const yTop = Math.max(Math.min(10.5, depth * 0.48), gOut + 0.8, y0 + 2);
    const prof = [[px(0), -0.6, pz(0)], [px(0), y0, pz(0)]];
    for (let j = 0; j < NS; j++) {
      const t0 = 0.4 + ((depth - 3.6) * j) / NS;
      const t1 = 0.4 + ((depth - 3.6) * (j + 1)) / NS;
      const y = y0 + ((yTop - y0) * (j + 1)) / NS;
      prof.push([px(t0), y, pz(t0)], [px(t1), y, pz(t1)]);
    }
    // promenade on top, the outer wall down to the ground
    prof.push([px(depth), yTop, pz(depth)], [px(depth), Math.min(gOut, 0) - 1.5, pz(depth)]);
    rings.push({ prof, a, ri, ro, depth, yTop, y0, dx, dz });
  }
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < N; i++) {
    const A = rings[i].prof;
    const B = rings[(i + 1) % N].prof;
    for (let j = 0; j < A.length - 1; j++) quad(A[j], A[j + 1], B[j + 1], B[j]);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  k.add(sg, STONE, { flat: true, mat: MAT.ashlar });
  // yellow aisle stairs and the track-side railing
  for (let i = 0; i < N; i += 6) {
    const r = rings[i];
    const p0 = r.prof[1];
    const p1 = r.prof[r.prof.length - 3];
    k.segment([p0[0], p0[1] + 0.12, p0[2]], [p1[0], p1[1] + 0.12, p1[2]], 1.1, 0.14, 'flowerYellow', { mat: MAT.flat });
  }
  for (let i = 0; i < N; i++) {
    const a = rings[i].prof[1];
    const b = rings[(i + 1) % N].prof[1];
    k.segment([a[0], a[1] + 0.9, a[2]], [b[0], b[1] + 0.9, b[2]], 0.06, 0.06, 'iron');
  }

  // --- west stand (+x): the covered tribune and its glazed corridor
  const west = rings.filter((r) => r.dx > 0.93);
  if (west.length) {
    const zs = west.map((r) => r.prof[2][2]);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    const mid = west[Math.floor(west.length / 2)];
    const xb = mid.prof[mid.prof.length - 2][0];
    const yb = mid.yTop;
    const len = Math.min(64, z1 - z0);
    const zc = (z0 + z1) / 2;
    // back wall, posts and the cantilevered slab sloping to the pitch
    k.box(3.2, 7, len, CONC, xb - 1.6, yb, zc, { mat: MAT.smooth });
    k.box(2.2, 3, len, 'glass', xb - 1.6, yb + 0.6, zc, { emit: 0.2 });
    for (let i = 0; i <= 8; i++) k.box(0.7, 7.5, 0.7, CONC, xb - 0.2, yb, zc - len / 2 + (i * len) / 8);
    const xin = mid.prof[4][0];
    k.segment([xb + 0.5, yb + 7.4, zc], [xin, yb + 5.2, zc], len, 0.35, CONC, { mat: MAT.smooth });
    k.box(len * 0.02 + 0.3, 1.2, len, 'white', xin + 0.1, yb + 4.4, zc);
    // the glazed corridor along the top of the west stand
    k.box(2.6, 2.8, Math.min(150, (z1 - z0) + 40), 'glass', xb + 0.2, yb, zc, { glass: true });
    k.box(2.8, 0.3, Math.min(150, (z1 - z0) + 40), CONC, xb + 0.2, yb + 2.8, zc);
  }

  // --- the north front: canopy on granite piers, the tower, bronze panels
  const zF = 107.5;
  const CW = 46; // canopy length, six openings
  const pierX = [];
  for (let i = 0; i <= 6; i++) pierX.push(-CW / 2 + (i * CW) / 6);
  for (const x of pierX) if (Math.abs(x) > 1) k.box(1.6, 5.4, 1.8, 'granite', x, -1, zF);
  k.box(CW + 3, 0.7, 4.2, CONC, 0, 4.4, zF, { mat: MAT.smooth });
  k.box(CW + 3, 0.25, 4.4, 'graniteGrey', 0, 5.1, zF);
  for (const x of pierX) {
    // flagpoles on the canopy
    if (Math.abs(x) < 1) continue;
    k.cyl(0.05, 0.07, 7, 5, 'steel', x, 5.35, zF + 1.4);
  }
  // the tower: prismatic, slightly tapering, granite, the arms and letters
  const tw = 3.9;
  const td = 2.7;
  k.frustum(tw, td, tw * 0.9, td * 0.92, HT + 1, 'granite', 0, -1, zF, { mat: MAT.ashlar });
  k.push({ y: HT - 11, z: zF + td * 0.46 });
  cartouche(k, 1.6, 1.8, 0.2, 'bronze', 0, 3.6, 0.1, { scrolls: false });
  for (let i = 0; i < 3; i++) k.box(1.5 - i * 0.2, 0.55, 0.08, 'bronze', 0, 2.6 - i * 0.9, 0.08);
  k.pop();
  k.box(0.08, 1.2, 0.08, 'iron', 0.7, HT - 0.9, zF + 1.3); // the rail stub on top
  k.box(tw * 0.9, 0.2, td * 0.92, 'graniteGrey', 0, HT - 0.2, zF);
  // granite end walls of the front with the two bronze relief panels
  for (const s of [-1, 1]) {
    const x = s * (CW / 2 + 5.5);
    k.box(9, 6.6, 3, 'granite', x, -1, zF - 0.4);
    k.box(6.2, 3.8, 0.3, 'bronze', x, 1.2, zF + 1.2, { mat: MAT.metal });
    for (let j = 0; j < 5; j++) k.statue(2.2, 'bronze', x - 2.3 + j * 1.15, 1.35, zF + 1.35, { seg: 4, sz: 0.4, pose: j === 2 ? 'hold' : 'down', arms: j % 2 === 0 });
    k.box(9.4, 0.4, 3.4, 'graniteGrey', x, 5.6, zF - 0.4);
  }
  // the two-flight stair down to the avenue
  for (const s of [-1, 1]) k.stairs(8, 4.2, 1.6, 8, 'graniteLight', s * 7, -1.6, zF + 4.1, { below: 0.4 });
  k.box(6, 1.6, 4.2, 'graniteLight', 0, -1.6, zF + 4.1);
  k.box(CW, 0.3, 3, 'graniteLight', 0, -0.3, zF + 1.2);

  // --- four floodlight masts at the corners
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = rings.reduce((best, q) => {
      const s = q.dx * sx * 0.7 + q.dz * sz * 0.7;
      return !best || s > best.s ? { q, s } : best;
    }, null).q;
    const top = r.prof[r.prof.length - 2];
    const x = top[0] - r.dx * 1.5;
    const z = top[2] - r.dz * 1.5;
    const y = top[1];
    const h = Math.min(26, HT - 3.2 - y); // lamp head below the tower top
    k.frustum(1.6, 1.6, 0.5, 0.5, h, 'steel', x, y, z, { mat: MAT.metal });
    k.box(4.6, 3, 0.6, 'iron', x, y + h, z, { ry: Math.atan2(r.dx, r.dz) });
    k.box(4.2, 2.6, 0.2, 'window', x - r.dx * 0.35, y + h + 0.2, z - r.dz * 0.35, { ry: Math.atan2(r.dx, r.dz), emit: 0.7 });
  }
  k.end('main');

  // --- trees on the grass bank along the top of the south end
  for (let i = 0; i < N; i += 4) {
    const r = rings[i];
    if (r.dz > -0.35 || r.depth < 14) continue;
    const top = r.prof[r.prof.length - 3];
    const x = top[0] + r.dx * 0.6;
    const z = top[2] + r.dz * 0.6;
    if (rnd() > 0.6) lowConifer(k, x, top[1], z, 10 + rnd() * 5);
    else lowTree(k, x, top[1], z, 8 + rnd() * 4);
  }
}
stadium.metric = true;
stadium.rule = {
  base: { part: 'pitch', stat: 'mean' },
  // falloff 10 m: the default (23 m) would reach past the north front
  // into Parque da Ponte, whose south edge borders the bowl
  pad: { parts: ['pitch', 'other'], fall: 10 },
  view: 0.5,
  note: 'base on the pitch; pad only under pitch + track; the terraces follow the real ground to the bowl outline (the south end climbs the hill); tower 30 m at the north front',
};

export default { 'estadio-1-maio': stadium };

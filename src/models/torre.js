// Torre de Menagem (keep of Braga's lost castle, begun under D. Dinis,
// crowned under D. Fernando in the late 14th c.), metric builder.
// OSM outline 9.5 x 9.3 m; data/dimensions.json: parapet walk 30 m, merlon
// tops 31.3 m, four floors (the first about 12 m tall), four machicolated
// corner bartizans, five merlons between them on each face, two loopholes
// per face. pt.wikipedia (Castelo de Braga): granite walls "ligeiramente
// escalonada mais próxima do solo" (stepped near the ground), merlons and
// mata-cães added under D. Fernando, the royal arms over the door.
//
// From the photos (assets/img/torre-menagem*.jpg): a slightly battered
// granite shaft, the twin window high on one face with a slit below it,
// bartizans on stepped corbels at the corners, tall pointed merlons, and a
// solid masonry stair: a wedge climbing along one face from an iron gate
// near its middle to a landing past the corner, then a second flight up
// the adjacent face to the raised door. Which face carries the stair is
// not confirmed by the sources (pt.wikipedia has no article on the keep
// itself; the Castelo de Braga article does not say), so it is kept on the
// Terreiro side, the front (+z), turning onto the +x face.
import { corniceProfile, MAT } from './kit.js';
import { win, cartouche } from './parts.js';
import { bbox } from './geom.js';

const G = 'granite';
const T = 'graniteWarm';
const S = 'graniteGrey'; // the later stair masonry, cooler and weathered darker

function torre(k, { footprint, dims }) {
  const b = bbox(footprint.outline);
  const W = b.w; // 9.5
  const D = b.d; // 9.3
  const HP = dims?.height_m?.parapet ?? 30;
  const HT = dims?.height_m?.total ?? 31.3;
  const inset = 0.2; // batter: the shaft narrows 0.2 m per side to the top
  const top = HP - 2.3; // corbel course under the parapet

  k.begin('main');
  // stepped footing on the real outline, then the battered shaft
  k.prism(footprint.outline, -1.2, 1.6, G);
  k.box(W + 0.3, 0.6, D + 0.3, G, b.cx, 0, b.cz);
  k.box(W + 0.12, 0.6, D + 0.12, G, b.cx, 0.6, b.cz);
  k.frustum(W - 0.1, D - 0.1, W - 2 * inset, D - 2 * inset, top, G, b.cx, 0, b.cz, { noBottom: true });
  const halfAt = (half, y) => half - 0.05 - inset * (y / top);
  const faces = [
    { ry: 0, half: D / 2, len: W },
    { ry: Math.PI / 2, half: W / 2, len: D },
    { ry: Math.PI, half: D / 2, len: W },
    { ry: -Math.PI / 2, half: W / 2, len: D },
  ];
  faces.forEach((fc, i) => {
    k.push({ x: b.cx, z: b.cz, ry: fc.ry });
    // two loopholes per face: deep slits with splayed granite jambs
    for (const [x, y] of [[-0.3, 13.5], [0.25, 20]]) {
      const z = halfAt(fc.half, y);
      k.box(0.14, 1.5, 0.2, 'dark', x, y, z - 0.08, { mat: MAT.flat });
      for (const s of [-1, 1]) k.box(0.1, 1.6, 0.14, T, x + s * 0.13, y - 0.05, z + 0.02);
    }
    if (i === 0) {
      // twin window with a central colonette and a shared sill
      const z = halfAt(fc.half, 24.5);
      for (const sx of [-1, 1]) win(k, sx * 0.42, 24.2, 0.55, 1.3, z, { arch: 'round', bw: 0.12, depth: 0.18, pane: 'glass', trim: T });
      k.box(0.14, 1.3, 0.14, T, 0, 24.2, z + 0.08);
      k.box(1.9, 0.18, 0.32, T, 0, 23.95, z + 0.12);
    }
    if (i === 2) win(k, 0.3, 17, 0.45, 1.1, halfAt(fc.half, 17), { bw: 0.14, depth: 0.2, pane: 'dark', trim: T });
    k.pop();
  });

  // long-and-short quoins: the dressed corner stones stand a little proud
  // and alternate their long side between the two faces, course by course
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let c = 0; c * 0.62 < top - 1.6; c++) {
      const y = 1.2 + c * 0.62;
      const f = y / top;
      const hx = (W - 0.1) / 2 - inset * f;
      const hz = (D - 0.1) / 2 - inset * f;
      const long = c % 2 ? 1.0 : 0.55;
      const short = c % 2 ? 0.55 : 1.0;
      k.box(long, 0.56, short, G, b.cx + sx * (hx - long / 2 + 0.03), y, b.cz + sz * (hz - short / 2 + 0.03), { jit: 0.05 });
    }
  }

  // --- crown: corbel course (mata-cães), parapet with five pointed merlons
  // between the bartizans on each face, walk
  const wp = W - 2 * inset;
  const dp = D - 2 * inset;
  const BW = 2.0; // bartizan width
  faces.forEach((fc, i) => {
    const len = i % 2 ? dp : wp;
    const half = i % 2 ? wp / 2 : dp / 2;
    k.push({ x: b.cx, z: b.cz, ry: fc.ry });
    // three-step corbels carrying the parapet forward
    const nc = 7;
    for (let j = 0; j < nc; j++) {
      const x = -len / 2 + BW + 0.3 + (j + 0.5) * ((len - 2 * BW - 0.6) / nc);
      for (let s = 0; s < 3; s++) k.box(0.4, 0.28, 0.2 + s * 0.14, T, x, top - 0.9 + s * 0.28, half + 0.05 + s * 0.07);
    }
    k.box(len - 2 * BW + 0.2, 0.2, 0.55, T, 0, top - 0.06, half + 0.2);
    k.box(len - 2 * BW + 0.2, HP - top, 0.55, G, 0, top + 0.14, half + 0.2);
    // five merlons: tall slabs with pyramid tops, crenels between
    const span = len - 2 * BW;
    for (let j = 0; j < 5; j++) {
      const x = -span / 2 + (j + 0.5) * (span / 5);
      k.box(0.72, HT - HP - 0.59, 0.55, G, x, HP + 0.14, half + 0.2);
      k.cone(0.5, 0.45, 4, G, x, HT - 0.45, half + 0.2, { sz: 0.75 });
    }
    k.pop();
  });
  k.box(wp - 1, 0.25, dp - 1, 'graniteDark', b.cx, HP - 0.3, b.cz); // walk
  // corner bartizans on stepped corbels, slots in the floor, three
  // merlons on each outer face
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const bx = b.cx + sx * (wp / 2 - BW / 2 + 0.3);
    const bz = b.cz + sz * (dp / 2 - BW / 2 + 0.3);
    for (let s = 0; s < 4; s++) {
      const w = BW - 0.9 + s * 0.3;
      k.box(w, 0.4, w, T, bx - sx * (0.45 - s * 0.15), top - 1.8 + s * 0.4, bz - sz * (0.45 - s * 0.15));
    }
    k.box(BW, HP - top + 0.2, BW, G, bx, top - 0.2, bz);
    // machicolation slots and arrow slits
    for (const [ox, oz, ry] of [[sx * (BW / 2 + 0.01), 0, Math.PI / 2], [0, sz * (BW / 2 + 0.01), 0]]) {
      k.box(0.16, 0.9, 0.05, 'dark', bx + ox, top + 0.5, bz + oz, { ry });
      k.box(0.5, 0.15, 0.05, 'dark', bx + ox * 1.0, top - 0.1, bz + oz, { ry });
    }
    for (const [ox, oz] of [[sx * 0.62, sz * 0.62], [-sx * 0.35, sz * 0.62], [sx * 0.62, -sz * 0.35]]) {
      k.box(0.6, HT - HP - 0.45, 0.6, G, bx + ox, HP, bz + oz);
      k.cone(0.43, 0.45, 4, G, bx + ox, HT - 0.45, bz + oz);
    }
  }

  // --- the external stair (see the header): flight 1 along the front from
  // the gate near the middle up toward +x, a landing past the corner,
  // flight 2 up the +x face to the raised door with the royal arms
  // (widths held so the model box stays within 15 % of the OSM keep)
  const sw = 1.0; // stair width
  const zs = D / 2 + sw / 2 - 0.05;
  const xg = b.cx - 0.6; // foot of the stair, by the gate
  const xL = b.cx + W / 2 + 0.2; // start of the landing
  const r1 = 7.2;
  k.push({ x: (xg + xL) / 2, z: b.cz + zs, ry: -Math.PI / 2 });
  k.stairs(sw, xL - xg, r1, 34, S, 0, 0, 0, { below: 0.6 });
  k.pop();
  // landing block past the corner
  const lx = 0.8;
  k.box(lx, r1, sw + 1.4, S, xL + lx / 2, 0, b.cz + D / 2 - 0.7 + sw / 2);
  // flight 2 along the +x face toward -z
  const xs2 = b.cx + W / 2 + 0.5;
  const z2a = b.cz + D / 2 - 0.7; // bottom (at the landing)
  const z2b = b.cz - D / 2 + 3.0; // top
  const r2 = 4.2;
  k.stairs(1.0, z2a - z2b, r2, 22, S, xs2, r1, (z2a + z2b) / 2, { below: r1 + 0.6 });
  k.box(1.0, r1 + r2, 1.3, S, xs2, 0, z2b - 0.65); // top landing at the door
  // copings along the flights
  k.segment([xg, 0.95, b.cz + zs + sw / 2 - 0.1], [xL, r1 + 0.95, b.cz + zs + sw / 2 - 0.1], 0.22, 0.24, T);
  k.box(0.24, 0.9, sw + 1.4, T, xL + lx - 0.12, r1, b.cz + D / 2 - 0.7 + sw / 2);
  k.segment([xs2 + 0.39, r1 + 0.95, z2a], [xs2 + 0.39, r1 + r2 + 0.95, z2b], 0.22, 0.24, T);
  // the raised door on the +x face with the arms of D. Dinis above it
  k.push({ x: b.cx, z: b.cz, ry: Math.PI / 2 });
  {
    const u = -(z2b - 0.65 - b.cz); // along the +x face, local x = -z
    const zf = halfAt(W / 2, r1 + r2);
    win(k, u, r1 + r2, 1.0, 2.2, zf, { arch: 'round', bw: 0.26, depth: 0.25, pane: 'dark', trim: T });
    cartouche(k, 0.8, 0.95, 0.2, T, u, r1 + r2 + 2.7, zf + 0.1, { scrolls: false });
  }
  k.pop();
  // green iron gate at the foot of the stair (photo)
  const gx = xg - 0.15;
  for (let i = 0; i < 6; i++) k.box(0.035, 1.25, 0.035, 'lampGreen', gx, 0, b.cz + zs - sw / 2 + 0.12 + i * ((sw - 0.24) / 5));
  k.box(0.05, 0.06, sw, 'lampGreen', gx, 1.2, b.cz + zs);
  k.box(0.05, 0.06, sw, 'lampGreen', gx, 0.35, b.cz + zs);
  k.end('main');
  void corniceProfile;
}
torre.metric = true;
torre.rule = { note: 'free-standing keep; the external stair side is not confirmed by the sources (kept on the Terreiro front, turning onto the +x face)' };

export default { 'torre-menagem': torre };

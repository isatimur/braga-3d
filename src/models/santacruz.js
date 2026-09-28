// Igreja de Santa Cruz (1625-1737), metric builder. The OSM outline is the
// 18.2 x 49.4 m church rectangle; the front is its NNE short end (+z here).
// Sizes from data/dimensions.json: towers 25 m to the vanes, pediment
// cross 19 m, nave ridge 15 m, four Doric columns below, four Ionic
// pilasters above, three doors.
//
// The carved front, read off the reference photo (assets/img/santa-cruz.jpg,
// taken square-on; heights scaled from the 25 m vanes):
//   lower order 0-7.3 m: four fluted Doric columns on pedestals, the main
//     door and two side doors with inscription tablets over them,
//     entablature with the inscribed frieze, cornice breaking over the columns;
//   upper order 7.3-12.7 m: pedestal band with three tablets, four Ionic
//     pilasters, three framed relief panels (tree, the Cross, palm) over
//     small barred windows;
//   crest 12.7-19 m: oculus in a carved frame, a triangular pediment whose
//     raking cornices end in volutes on the tower cornices, the crowned arms
//     in the tympanum, two statues on pedestals, the central pedestal with
//     scrolls, a seated figure and the cross;
//   towers 4.4 m square: corner pilasters, three carved window frames on
//     the front (quatrefoil, lozenge, quatrefoil), cornice at 13.4 m, the
//     clock stage with a shell-crowned clock, cornice at 17.2 m, belfry with
//     a bell in a round arch, cornice at 21 m with corner gargoyles, flame
//     urns, a bell-shaped stone cupola with shells, lantern, iron cross and
//     the rooster vane.
// One granite tone: the carving reads through depth and shadow.
import * as THREE from 'three';
import { corniceProfile, MAT } from './kit.js';
import { cartouche, bell, volute, lobedFrame, shell, flutedColumn, flameUrn, tablet } from './parts.js';
import { bbox } from './geom.js';
import { polyCornice, polyWindows } from './metric.js';

const G = 'granite';
// carved relief: the same stone, dressed smooth and paler than the
// weathered ashlar round it (as in the photo), so it reads in shade too
const C = 'graniteLight';
const INK = 0x8f887a; // incised lettering: a shade darker than the stone

// One Braga tower of the front, centred at (x, z) with its front face at
// zf; returns nothing. hTop = the vane top.
function tower(k, x, zf, TW, TD, y0, hTop) {
  const z = zf - TD / 2;
  k.push({ x, z });
  const L1 = 13.4;
  const L2 = 17.2;
  const L3 = 21;
  // plinth pedestal with its cornice (the big granite bases of the photo)
  k.box(TW + 0.7, 1.9, TD + 0.5, G, 0, 0, 0.1);
  k.corniceRing(TW + 0.7, TD + 0.5, corniceProfile('base', 0.35), G, 0, 1.9, 0.1);
  // body to the first cornice
  k.box(TW, L1 - y0, TD, G, 0, y0, 0);
  // corner pilasters (front and sides), each a strip proud of the face
  for (const s of [-1, 1]) {
    k.box(0.8, L1 - 2.2, 0.3, G, s * (TW / 2 - 0.4), 2.2, TD / 2 + 0.15);
    k.box(0.3, L1 - 2.2, 0.8, G, s * (TW / 2 + 0.15), 2.2, TD / 2 - 0.4);
  }
  // pilaster capitals: a band under the cornice
  k.box(TW + 0.35, 0.35, TD + 0.35, G, 0, L1 - 0.6, 0);
  k.corniceRing(TW + 0.2, TD + 0.2, corniceProfile('classic', 0.65), G, 0, L1 - 0.25, 0);
  // the three carved window frames of the tower front
  lobedFrame(k, 'quatrefoil', 1.95, 0.34, C, 0, 5.0, TD / 2 + 0.17, { open: 0.36 });
  lobedFrame(k, 'diamond', 1.9, 0.34, C, 0, 8.2, TD / 2 + 0.17, { open: 0.34 });
  lobedFrame(k, 'quatrefoil', 1.85, 0.34, C, 0, 11.0, TD / 2 + 0.17, { open: 0.36, crest: false });
  // clock stage
  const cw = TW - 0.4;
  k.box(cw, L2 - L1 - 0.4, TD - 0.4, G, 0, L1 + 0.4, 0);
  for (const s of [-1, 1]) k.box(0.55, L2 - L1 - 0.4, 0.25, G, s * (cw / 2 - 0.27), L1 + 0.4, (TD - 0.4) / 2 + 0.12);
  {
    const cy = L1 + 2.0;
    const fz = (TD - 0.4) / 2;
    lobedFrame(k, 'oval', 1.95, 0.3, C, 0, cy, fz + 0.15, { open: 0.01, crest: false, pane: C });
    k.cyl(0.6, 0.6, 0.12, 16, 0xe2ddcf, 0, cy - 0.06, fz + 0.36, { rx: Math.PI / 2, smooth: true, mat: MAT.smooth });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.box(0.05, 0.14, 0.03, 'dark', Math.cos(a) * 0.5, cy + Math.sin(a) * 0.5 - 0.07, fz + 0.43, { rz: a - Math.PI / 2 });
    }
    k.box(0.05, 0.4, 0.03, 'dark', 0.08, cy, fz + 0.45, { rz: -0.4 });
    k.box(0.05, 0.3, 0.03, 'dark', -0.1, cy, fz + 0.46, { rz: 1.9 });
    shell(k, 0.55, 0.24, C, 0, cy + 0.95, fz + 0.2);
    for (const s of [-1, 1]) volute(k, 0.26, 0.16, C, s * 0.5, cy - 0.95, fz + 0.2, { dir: -s, turns: 1.3 });
  }
  k.corniceRing(cw + 0.3, TD - 0.1, corniceProfile('classic', 0.75), G, 0, L2 - 0.4, 0);
  // belfry: arched opening per face, corner pilasters, a bell
  const bw = TW - 0.7;
  const bd = TD - 1.1;
  const hF = L3 - L2 - 0.35;
  for (const [ry, len, off] of [[0, bw, bd / 2], [Math.PI, bw, bd / 2], [Math.PI / 2, bd, bw / 2], [-Math.PI / 2, bd, bw / 2]]) {
    k.push({ y: L2 + 0.35, ry });
    const hole = { x: 0, y: 0.35, w: 1.4, h: 2.55, arch: 'round', pane: null };
    k.wall(len, hF, 0.5, G, [hole], 0, 0, off - 0.25);
    k.surround(hole, 0.16, 0.12, G, off);
    k.box(0.35, 0.45, 0.2, G, 0, hole.y + hole.h + 0.02, off + 0.1); // keystone
    for (const s of [-1, 1]) k.box(0.5, hF, 0.22, G, s * (len / 2 - 0.25), 0, off + 0.11);
    k.pop();
  }
  k.box(bw - 1, hF, bd - 1, 'dark', 0, L2 + 0.35, 0);
  bell(k, 1.1, 0, L2 + 0.9, 0.3);
  k.corniceRing(bw + 0.1, bd + 0.1, corniceProfile('classic', 0.6), G, 0, L3 - 0.25, 0);
  // corner gargoyles on the cornices at 17.2 and 21 m
  for (const [yy, hw, hd] of [[L2 - 0.1, cw / 2 + 0.4, (TD - 0.1) / 2 + 0.4], [L3 + 0.1, bw / 2 + 0.3, bd / 2 + 0.3]]) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.segment([sx * (hw - 0.4), yy, sz * (hd - 0.4)], [sx * (hw + 0.45), yy + 0.12, sz * (hd + 0.45)], 0.2, 0.22, G, { mat: MAT.smooth });
    }
  }
  // cap: attic, flame urns on the corners, bell-shaped cupola with shells,
  // lantern, ball, cross, rooster vane
  const yc = L3 + 0.35;
  k.box(bw - 0.2, 0.45, bd - 0.2, G, 0, yc, 0);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) flameUrn(k, 1.25, C, sx * (bw / 2 - 0.1), yc, sz * (bd / 2 - 0.1));
  k.lathe([[0, 0], [1.15, 0], [1.15, 0.12], [0.98, 0.2], [1.02, 0.4], [0.8, 0.62], [0.5, 0.8], [0.34, 0.86], [0.38, 0.92], [0, 0.95]], 16, G, 0, yc + 0.45, 0, { sr: 1, sh: 1.6, smooth: true, mat: MAT.smooth });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k.push({ ry: a });
    shell(k, 0.34, 0.18, C, 0, yc + 0.55, 1.02);
    k.pop();
  }
  const yl = yc + 0.45 + 1.52;
  k.cyl(0.26, 0.3, 0.55, 8, G, 0, yl, 0);
  k.cone(0.34, 0.3, 8, G, 0, yl + 0.55, 0);
  k.sphere(0.16, G, 0, yl + 1.0, 0, { seg: 8, rings: 5 });
  const yr = yl + 1.14;
  k.box(0.07, hTop - yr, 0.07, 'iron', 0, yr, 0);
  k.box(0.6, 0.06, 0.06, 'iron', 0, hTop - 0.9, 0);
  // the rooster: a flat iron silhouette on the rod
  const r = new THREE.Shape([[-0.35, 0], [0.2, 0], [0.32, 0.18], [0.3, 0.42], [0.18, 0.5], [0.14, 0.3], [-0.05, 0.22], [-0.3, 0.45], [-0.42, 0.2]].map(([a, b]) => new THREE.Vector2(a, b)));
  k.extrude(r, 0.04, 'rust', 0.05, hTop - 0.6, 0, { mat: MAT.metal });
  k.pop();
}

// Relief motifs for the upper panels: the tree, the Cross, the palm.
function reliefTree(k, x, y, z) {
  k.box(0.14, 1.0, 0.12, C, x, y, z, { mat: MAT.smooth });
  for (const [dx, dy, r] of [[0, 1.45, 0.42], [-0.33, 1.2, 0.3], [0.33, 1.2, 0.3], [-0.2, 1.75, 0.28], [0.22, 1.72, 0.28]]) k.sphere(r, C, x + dx, y + dy, z, { seg: 7, rings: 4, sz: 0.3, flat: true, mat: MAT.smooth });
  k.box(0.7, 0.18, 0.2, C, x, y - 0.05, z); // the pot
}
function reliefPalm(k, x, y, z) {
  k.segment([x, y, z], [x + 0.04, y + 1.3, z], 0.13, 0.12, C, { mat: MAT.smooth });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.05 + (i / 8) * 0.9);
    const L = 0.55 + 0.15 * Math.sin(a);
    k.segment([x + 0.04, y + 1.3, z], [x + Math.cos(a) * L, y + 1.3 + Math.sin(a) * L * 0.9 - 0.12, z], 0.1, 0.05, C, { mat: MAT.smooth });
  }
  k.box(0.7, 0.18, 0.2, C, x, y - 0.05, z);
}
function reliefCross(k, x, y, z) {
  k.box(0.26, 2.3, 0.16, C, x, y, z, { mat: MAT.smooth });
  k.box(1.3, 0.26, 0.16, C, x, y + 1.55, z, { mat: MAT.smooth });
  // lance and reed crossing behind, the mound of Calvary
  k.segment([x - 0.75, y + 0.1, z - 0.04], [x + 0.75, y + 2.1, z - 0.04], 0.07, 0.06, C);
  k.segment([x + 0.75, y + 0.1, z - 0.04], [x - 0.75, y + 2.1, z - 0.04], 0.07, 0.06, C);
  k.frustum(1.0, 0.25, 0.3, 0.2, 0.35, C, x, y - 0.2, z);
}

function santaCruz(k, { footprint, dims }) {
  const b = footprint.box;
  const W = b.w; // 18.5 m
  const zF = b.z1; // front face
  const hT = dims?.height_m?.towers ?? 25;
  const hRidge = dims?.height_m?.nave_ridge ?? 15;
  const hCross = dims?.height_m?.pediment_cross ?? 19;
  const TW = 4.4; // tower width
  const TD = 5; // tower depth
  const xT = W / 2 - TW / 2; // tower centre
  const CW = W - 2 * TW; // centre width, 9.7 m

  k.begin('main');
  // --- nave and chancel on the real outline, behind the towers
  const nave = footprint.outline.map(([x, z]) => [x, Math.min(z, zF - TD + 0.2)]);
  const eaves = hRidge - 3.8;
  k.prism(nave, -1, eaves + 1, G);
  k.prism(nave.map(([x, z]) => [x * 1.02, z]), -1, 1.6, G); // plinth
  polyCornice(k, nave, eaves - 0.6, corniceProfile('classic', 0.6), G);
  const nb = bbox(nave);
  k.gableRoof(W - 0.6, nb.d - 0.6, hRidge - eaves, 'terracotta', 0, eaves, nb.cz, { over: 0.5 });
  // tall round-headed windows between pilasters along both long sides
  polyWindows(k, nave, {
    only: (e) => Math.abs(e.nx) > 0.9,
    storeys: [5.2],
    bay: 6.5,
    margin: 8,
    w: 1.5,
    h: 3.4,
    win: { arch: 'round', trim: G, bw: 0.3, depth: 0.3 },
  });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 7; i++) k.box(0.6, eaves, 0.35, G, sx * (W / 2 + 0.1), 0, nb.z0 + 3 + i * 6.5, { ry: Math.PI / 2 });
  }

  // --- towers
  const y0 = 0.45; // on the top step
  for (const sx of [-1, 1]) tower(k, sx * xT, zF, TW, TD, y0, hT);
  // steps across the front (three granite treads)
  for (let i = 0; i < 3; i++) k.box(W + 1.2 - i * 0.6, 0.15, 1.9 - i * 0.5, G, 0, i * 0.15, zF + 0.95 - i * 0.25);

  // --- centre: wall with the three doors
  const doors = [
    { x: 0, y: 0, w: 2.1, h: 4.4, pane: 'dark' },
    { x: -2.95, y: 0, w: 1.35, h: 3.3, pane: 'wood' },
    { x: 2.95, y: 0, w: 1.35, h: 3.3, pane: 'wood' },
  ];
  const wins = [-3, 0, 3].map((x) => ({ x: x * 0.97, y: 8.45 - y0, w: x ? 0.62 : 0.8, h: 0.36, pane: 'dark' }));
  k.wall(CW, 12.7 - y0, 1, G, [...doors, ...wins], 0, y0, zF - 0.5, { inset: 0.55 });
  for (const d of doors) {
    k.surround({ ...d, y: y0 }, 0.26, 0.22, G, zF);
    k.surround({ ...d, y: y0, w: d.w + 0.52, h: d.h + 0.26 }, 0.12, 0.34, G, zF);
    // panelled leaves
    if (d.x) for (const s of [-1, 1]) for (const yy of [0.4, 1.8]) k.box(d.w / 2 - 0.22, 1.1, 0.06, 'wood', d.x + (s * d.w) / 4, y0 + yy, zF - 0.52, { jit: 0.06 });
  }
  // inscription tablets over the doors
  tablet(k, 1.7, 0.62, 0.18, C, -2.95, y0 + 4.05, zF + 0.1);
  tablet(k, 1.7, 0.62, 0.18, C, 2.95, y0 + 4.05, zF + 0.1);
  tablet(k, 2.3, 0.5, 0.18, C, 0, y0 + 5.0, zF + 0.1, { lines: 1 });
  // four fluted Doric columns on pedestals
  const colX = [-4.25, -1.72, 1.72, 4.25];
  for (const x of colX) {
    k.box(0.95, 1.25, 0.95, G, x, y0, zF + 0.55);
    k.corniceRing(0.95, 0.95, corniceProfile('band', 0.14), G, x, y0 + 1.1, zF + 0.55);
    flutedColumn(k, 5.0, 0.3, G, x, y0 + 1.25, zF + 0.55, { flutes: 10, capital: 'doric' });
  }
  // entablature: architrave, inscribed frieze, cornice breaking forward
  const e0 = y0 + 6.25;
  k.box(CW + 0.3, 0.4, 0.9, G, 0, e0, zF + 0.25);
  k.box(CW + 0.1, 0.5, 0.7, G, 0, e0 + 0.4, zF + 0.2);
  for (let i = 0; i < 5; i++) k.box(1.2, 0.07, 0.02, INK, -3.4 + i * 1.7, e0 + 0.62, zF + 0.56, { mat: MAT.smooth });
  for (const x of colX) k.box(0.95, 0.9, 0.35, G, x, e0, zF + 0.85);
  k.cornice(CW + 0.7, corniceProfile('classic', 0.45), G, 0, e0 + 0.9, zF + 0.55);
  for (const x of colX) k.cornice(1.25, corniceProfile('classic', 0.45), G, x, e0 + 0.9, zF + 1.0);

  // --- upper order: pedestal band with tablets, Ionic pilasters, panels
  const u0 = e0 + 1.35; // 8.05
  k.box(CW - 0.2, 0.9, 0.5, G, 0, u0, zF + 0.1);
  const pilX = [-4.25, -1.72, 1.72, 4.25];
  for (const x of pilX) {
    k.box(0.85, 0.95, 0.75, G, x, u0, zF + 0.3);
    k.cyl(0.22, 0.22, 0.1, 8, C, x, u0 + 0.47 - 0.05, zF + 0.72, { rx: Math.PI / 2, sx: 0.8 });
  }
  for (const x of [-2.98, 0, 2.98]) tablet(k, x ? 1.3 : 1.9, 0.5, 0.14, C, x, u0 + 0.2, zF + 0.42, { lines: 2 });
  const p0 = u0 + 0.95;
  const pH = 3.35;
  for (const x of pilX) {
    k.box(0.62, pH, 0.36, G, x, p0, zF + 0.18);
    // sunk panel with a raised fillet down the pilaster face
    for (const t of [-0.22, 0.22]) k.box(0.1, pH - 0.5, 0.08, G, x + t, p0 + 0.25, zF + 0.38, { mat: MAT.smooth });
    k.box(0.08, pH - 0.9, 0.06, G, x, p0 + 0.45, zF + 0.38, { mat: MAT.smooth });
    // Ionic capital: abacus and two volutes
    k.box(0.8, 0.18, 0.5, G, x, p0 + pH - 0.05, zF + 0.25);
    for (const s of [-1, 1]) k.cyl(0.11, 0.11, 0.1, 8, C, x + s * 0.3, p0 + pH - 0.18 - 0.05, zF + 0.46, { rx: Math.PI / 2 });
  }
  // framed relief panels: tree | Cross | palm, over the small windows
  for (const [x, w, motif] of [[-2.98, 1.8, reliefTree], [0, 2.5, reliefCross], [2.98, 1.8, reliefPalm]]) {
    const fy = p0 + 0.25;
    const fh = pH - 0.45;
    const fz = zF + 0.06;
    k.box(w, fh, 0.12, G, x, fy, fz, { mat: MAT.smooth });
    for (const s of [-1, 1]) k.box(0.16, fh, 0.24, C, x + s * (w / 2 - 0.08), fy, fz + 0.06);
    k.box(w, 0.16, 0.24, C, x, fy + fh - 0.16, fz + 0.06);
    k.box(w, 0.16, 0.24, C, x, fy, fz + 0.06);
    // scrolled ears on the top corners
    for (const s of [-1, 1]) volute(k, 0.16, 0.14, C, x + s * (w / 2 - 0.1), fy + fh + 0.05, fz + 0.2, { dir: s, turns: 1.2 });
    motif(k, x, fy + 0.5, fz + 0.16);
  }
  // upper frieze and cornice, breaking over the pilasters
  const c0 = p0 + pH + 0.13;
  k.box(CW + 0.1, 0.45, 0.7, G, 0, c0, zF + 0.15);
  for (const x of pilX) k.box(0.8, 0.45, 0.3, G, x, c0, zF + 0.6);
  k.cornice(CW + 0.6, corniceProfile('classic', 0.42), G, 0, c0 + 0.45, zF + 0.45);

  // --- crest: oculus, pediment, arms, statues, the cross
  const q0 = c0 + 0.87; // 12.9
  // oculus in a carved lobed frame
  {
    const oy = q0 + 0.75;
    const outer = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r = 1.0 + 0.09 * Math.cos(8 * a);
      outer.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * 0.94));
    }
    const s = new THREE.Shape(outer);
    const h = new THREE.Path();
    h.absarc(0, 0, 0.58, 0, Math.PI * 2, true);
    s.holes.push(h);
    k.extrude(s, 0.36, C, 0, oy, zF - 0.05, { mat: MAT.smooth, curve: 14 });
    // moulded ring round the glass
    k.lathe([[0.58, 0], [0.74, 0], [0.8, 0.12], [0.72, 0.24], [0.58, 0.3]], 20, C, 0, oy, zF + 0.1, { rx: Math.PI / 2, smooth: true, mat: MAT.smooth });
    k.cyl(0.6, 0.6, 0.1, 14, 'glass', 0, oy - 0.05, zF - 0.2, { rx: Math.PI / 2, smooth: true });
    shell(k, 0.45, 0.22, C, 0, oy + 0.95, zF + 0.05);
    for (const s2 of [-1, 1]) volute(k, 0.32, 0.2, C, s2 * 1.25, oy - 0.2, zF + 0.05, { dir: s2, turns: 1.4 });
  }
  // raking cornices: from the volutes on the tower cornices to the apex
  const apex = q0 + 3.1;
  const xs = CW / 2 - 0.2;
  const ys = q0 + 0.9;
  const len = Math.hypot(xs, apex - ys);
  const ang = Math.atan2(apex - ys, xs);
  // the wall of the crest: a band to the rake springing, the tympanum above
  k.box(CW - 0.4, ys - q0 + 0.25, 0.8, G, 0, q0 - 0.2, zF - 0.6);
  const ty = new THREE.Shape([new THREE.Vector2(-xs, 0), new THREE.Vector2(xs, 0), new THREE.Vector2(0, apex - ys)]);
  k.extrude(ty, 0.8, G, 0, ys, zF - 0.6);
  for (const s of [-1, 1]) {
    // moulded raking cornice (profile across the rake) on a plain fascia
    k.push({ x: (s * xs) / 2, y: (ys + apex) / 2, z: zF - 0.2, rz: -s * ang });
    k.box(len + 0.3, 0.45, 0.35, G, 0, -0.62, 0.17);
    k.cornice(len + 0.6, corniceProfile('classic', 0.55), C, 0, -0.18, 0);
    k.pop();
    // the volute where the rake meets the tower cornice, curling outward
    volute(k, 0.72, 0.6, G, s * (xs + 0.25), ys - 0.3, zF + 0.15, { dir: s, turns: 1.5, band: 0.3 });
    // carved cartouche panels on the tympanum
    k.push({ x: s * 2.35, y: q0 + 1.4, z: zF - 0.15 });
    lobedFrame(k, 'diamond', 1.15, 0.24, C, 0, 0, 0, { open: 0.01, crest: false, pane: C });
    k.pop();
  }
  // tympanum: the crowned arms of the brotherhood
  cartouche(k, 1.25, 1.45, 0.35, C, 0, q0 + 1.55, zF + 0.05);
  // side statues on tall pedestals standing on the rake
  for (const s of [-1, 1]) {
    const px = s * 2.2;
    const py = ys + (apex - ys) * (1 - Math.abs(px) / xs);
    k.box(0.75, 16.35 - py, 0.75, G, px, py, zF - 0.1);
    k.box(0.9, 0.18, 0.9, G, px, 16.35, zF - 0.1);
    k.statue(1.55, 'graniteLight', px, 16.53, zF - 0.1, { pose: s > 0 ? 'hold' : 'pray' });
  }
  // central pedestal with rising scrolls, the seated figure, the cross
  k.box(1.1, 1.0, 1.0, G, 0, apex - 0.3, zF - 0.1);
  k.box(1.3, 0.2, 1.15, G, 0, apex + 0.7, zF - 0.1);
  for (const s of [-1, 1]) {
    volute(k, 0.5, 0.45, G, s * 1.05, apex + 0.1, zF - 0.1, { dir: -s, turns: 1.3, band: 0.32 });
    volute(k, 0.32, 0.4, G, s * 1.6, apex - 0.5, zF - 0.1, { dir: s, turns: 1.2 });
  }
  k.statue(1.15, 'graniteLight', 0, apex + 0.9, zF, { pose: 'pray', sy: 0.85 });
  k.box(0.2, hCross - apex - 0.9, 0.2, G, 0, apex + 0.9, zF - 0.4);
  k.box(1.2, 0.18, 0.18, G, 0, hCross - 0.75, zF - 0.4);
  k.end('main');
}
santaCruz.metric = true;
santaCruz.rule = { note: 'NNE front on Largo Carlos Amarante; church rectangle is the OSM outline' };

export default { 'santa-cruz': santaCruz };

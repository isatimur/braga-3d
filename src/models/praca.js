// Praça da República with the Arcada, metric builder.
// Frame: front snapped to the Arcada (NE 56 deg): the Arcada closes the
// west side of the square and faces +z; the OSM outline is the paved square
// (with its arm east along the head of the Avenida).
// From data/dimensions.json: Arcada 56.7 x 21.2 m (OSM part), 16 m, three
// storeys, 19 arches (8 each side, 3 in the Lapa front), Lapa bell tower
// 24 m, fountain 18.7 m (OSM part) with a 1.5 m rim. From the photos: the
// arcade 6.4 m on Tuscan columns, a tiled first floor with French windows
// and one long iron balcony, cornice and stone balustrade, a set-back attic
// storey; the granite Lapa front with a curved gable between the two arms,
// its white bell tower behind the right arm; the fountain's dome of spray.
import * as THREE from 'three';
import { corniceProfile, MAT, PROFILES } from './kit.js';
import { win, cartouche, bellTower, volute, flameUrn } from './parts.js';
import { bbox, offset, centroid } from './geom.js';

const TAU = Math.PI * 2;
const TILE = 0x9d949a; // the Arcada's grey-mauve tile cladding
const SPRAY = 0xe6f0f4;
const PAVING = 0xb3b0a8; // grey granite slabs

// Granite archivolt round an opening of width w and height h (crown) on a
// wall face at zf, with a keystone at the crown and imposts at the spring.
function archivolt(k, x, w, h, zf, o = {}) {
  const r = w / 2;
  const bw = o.bw ?? 0.24;
  const sp = h - r;
  const s = new THREE.Shape();
  s.moveTo(r + bw, 0);
  s.absarc(0, 0, r + bw, 0, Math.PI, false);
  s.lineTo(-r, 0);
  s.absarc(0, 0, r, Math.PI, 0, true);
  s.closePath();
  k.extrude(s, 0.16, o.color ?? 'graniteLight', x, sp, zf + 0.08, { curve: 6, mat: MAT.smooth });
  // keystone: wider at the top, proud of the archivolt
  k.frustum(0.3, 0.3, 0.42, 0.34, bw + 0.28, o.color ?? 'graniteLight', x, h - 0.06, zf + 0.12);
  for (const sx of [-1, 1]) k.box(0.34, 0.2, 0.3, o.color ?? 'graniteLight', x + sx * (r + bw * 0.4), sp - 0.2, zf + 0.1);
}

// Tuscan column under the arcade: plinth, torus base, shaft, echinus, abacus.
function tuscan(k, x, h, z) {
  const c = 'graniteLight';
  k.box(0.78, 0.2, 0.78, c, x, 0, z);
  k.lathe([[0.37, 0], [0.35, 0.14], [0.28, 0.24], [0.25, h - 0.62], [0.28, h - 0.56], [0.37, h - 0.4]], 8, c, x, 0.2, z, { smooth: true, mat: MAT.smooth });
  k.box(0.84, 0.2, 0.84, c, x, h - 0.2, z);
}

// Wrought-iron balcony railing along x: rails, bars, a scroll band.
function ironRail(k, len, h, x, y, z) {
  k.box(len, 0.06, 0.08, 'iron', x, y + h - 0.06, z);
  k.box(len, 0.05, 0.06, 'iron', x, y + 0.08, z);
  k.box(len, 0.04, 0.05, 'iron', x, y + h * 0.78, z);
  const n = Math.round(len / 0.45);
  for (let i = 0; i <= n; i++) k.box(0.025, h, 0.025, 'iron', x - len / 2 + (i * len) / n, y, z);
}

// Café table with chairs round it (n chairs), top 0.72 m.
function cafeSet(k, x, z, n, rot, col) {
  k.cyl(0.36, 0.36, 0.04, 7, 0x8e8577, x, 0.72, z, { mat: MAT.smooth });
  k.cyl(0.03, 0.03, 0.72, 3, 'iron', x, 0, z);
  k.cyl(0.2, 0.24, 0.04, 5, 'iron', x, 0, z);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const cx = x + Math.cos(a) * 0.66;
    const cz = z + Math.sin(a) * 0.66;
    // local -z (the sitter's view) turned toward the table
    k.push({ x: cx, z: cz, ry: Math.atan2(Math.cos(a), Math.sin(a)) });
    k.box(0.4, 0.05, 0.4, col, 0, 0.44, 0);
    k.box(0.4, 0.42, 0.04, col, 0, 0.49, 0.2);
    // bentwood legs: one hoop each side
    for (const lx of [-0.17, 0.17]) k.box(0.03, 0.44, 0.36, 'iron', lx, 0, 0);
    k.pop();
  }
}

// Café parasol: pole, eight-panel canopy with a valance.
function parasol(k, x, z, r = 1.7) {
  k.cyl(0.035, 0.035, 2.55, 4, 'iron', x, 0, z);
  k.cone(r, 0.55, 8, 0xe9e4d8, x, 2.25, z, { mat: MAT.smooth });
  k.cyl(r, r, 0.22, 8, 0xe2dccd, x, 2.05, z, { open: true, mat: MAT.smooth });
  k.cyl(0.08, 0.1, 0.4, 4, 'iron', x, 0, z);
}

// Cast-iron lamp post of the Braga squares: base, fluted shaft, collar,
// a four-sided lantern with its cap.
function ironLamp(k, x, z, h = 4.2) {
  const c = 'lampGreen';
  k.cyl(0.2, 0.26, 0.6, 8, c, x, 0, z);
  k.cyl(0.07, 0.11, h - 1.4, 8, c, x, 0.6, z);
  k.cyl(0.14, 0.1, 0.2, 8, c, x, h - 0.8, z);
  k.frustum(0.36, 0.36, 0.46, 0.46, 0.6, 'window', x, h - 0.6, z, { emit: 0.8 });
  k.cone(0.36, 0.32, 4, c, x, h, z);
  k.sphere(0.06, c, x, h + 0.36, z, { seg: 5, rings: 3 });
}

function praca(k, { footprint, dims }) {
  const rnd = k.rnd;
  const O = footprint.outline;
  const A = footprint.part('Arcada');
  const ab = bbox(A.pts);
  const zF = ab.z1; // arcade front line
  const x0 = ab.x0;
  const x1 = ab.x1;
  const L = x1 - x0;
  const cx = (x0 + x1) / 2;
  const hLapa = dims?.height_m?.lapa_tower ?? 24;
  const nSide = dims?.elements?.arcada_side_arches ?? 8;
  const CW = 13; // Lapa front width
  const SW = (L - CW) / 2; // each arm
  const G = 'graniteGrey';

  // --- paving on the real square outline (the pad levels it)
  k.prism(O, -0.6, 0.66, PAVING, { mat: MAT.ashlar });
  k.prism(offset(O, 0.25), -0.6, 0.72, G, { holes: [O] });

  k.begin('mask');
  // --- the Arcada: back mass on the OSM polygon behind the gallery
  const back = A.pts.map(([x, z]) => [x, Math.min(z, zF - 4.4)]);
  k.prism(back, -0.8, 12.4, 'plaster');
  // shop fronts at the back of the gallery, lit
  for (const sx of [-1, 1]) {
    const mx = cx + sx * (CW / 2 + SW / 2);
    k.box(SW - 0.6, 5.4, 0.3, 'dark', mx, 0, zF - 4.3);
    // café and shop doors (photo: Café Vianna): glazed double doors in dark
    // wood frames under arched fanlights, between granite piers
    for (let i = 0; i < nSide; i++) {
      const sx0 = mx - SW / 2 + (i + 0.5) * (SW / nSide);
      k.box(0.4, 5.4, 0.3, 'graniteLight', sx0 - SW / nSide / 2 + 0.2, 0, zF - 4.05);
      k.box(1.9, 4.1, 0.14, 'wood', sx0, 0, zF - 4.12);
      k.box(1.5, 2.7, 0.1, 'window', sx0, 0.35, zF - 4.02, { emit: 0.4 });
      k.box(0.08, 2.7, 0.12, 'wood', sx0, 0.35, zF - 3.98);
      k.cyl(0.72, 0.72, 0.1, 8, 'window', sx0, 3.3 - 0.05, zF - 4.0, { rx: Math.PI / 2, tl: Math.PI, t0: Math.PI / 2, emit: 0.3 });
    }
  }
  // gallery floor and ceiling
  k.box(L, 0.15, 4.4, G, cx, 0, zF - 2.2, { mat: MAT.ashlar });
  k.box(L, 0.4, 4.4, 'plaster', cx, 6.0, zF - 2.2);
  for (const sx of [-1, 1]) {
    const mx = cx + sx * (CW / 2 + SW / 2);
    // arcade: n round arches on Tuscan columns (photo: granite columns and
    // archivolts with keystones, the spandrels clad in the grey-mauve tile)
    const pitch = SW / nSide;
    const ow = pitch - 0.06; // free-standing columns: the wall springs from them
    const oh = 5.3;
    const ops = [];
    for (let i = 0; i < nSide; i++) ops.push({ x: -SW / 2 + (i + 0.5) * pitch, w: ow, h: oh });
    k.gate(SW, 6.4, 0.7, ops, TILE, mx, 0, zF - 0.35, { mat: MAT.render });
    for (const op of ops) archivolt(k, mx + op.x, ow, oh, zF);
    for (let i = 0; i <= nSide; i++) {
      const px = mx - SW / 2 + i * pitch;
      tuscan(k, px, oh - ow / 2, zF - 0.35);
    }
    // string course over the arches
    k.box(SW, 0.22, 0.2, G, mx, 6.15, zF + 0.1);
    // first floor: tile-clad wall with French windows, one long balcony
    const holes = [];
    for (let i = 0; i < nSide; i++) holes.push({ x: -SW / 2 + (i + 0.5) * pitch, y: 0.9, w: 1.25, h: 2.7, arch: 'seg', rise: 0.25, pane: 'glass' });
    k.wall(SW, 5.2, 0.6, TILE, holes, mx, 6.4, zF - 0.3, { inset: 0.4, mat: MAT.render });
    for (const hh of holes) k.surround({ ...hh, y: hh.y + 6.4 }, 0.2, 0.15, 'graniteLight', zF);
    k.box(SW, 0.25, 1.1, G, mx, 7.05, zF + 0.5);
    ironRail(k, SW - 0.2, 1.0, mx, 7.3, zF + 1.0);
    k.box(SW, 0.4, 0.8, G, mx, 6.4, zF + 0.1);
    // cornice, stone balustrade, set-back attic storey, roof
    k.cornice(SW + 0.2, corniceProfile('classic', 0.55), G, mx, 11.4, zF);
    k.balustrade(SW - 0.4, 0.95, G, mx, 11.95, zF + 0.1, { cheap: true, d: 0.22, sp: 0.5 });
    const attic = [];
    for (let i = 0; i < nSide; i++) attic.push({ x: -SW / 2 + (i + 0.5) * pitch, y: 0.5, w: 0.9, h: 1.5, pane: 'glass' });
    k.wall(SW, 2.5, 0.5, 'white', attic, mx, 12.4, zF - 3.8, { inset: 0.3 });
  }
  const roofPts = A.pts.map(([x, z]) => [x, Math.min(z, zF - 3.6)]);
  const rb = bbox(roofPts);
  k.box(L, 0.3, 3.6, 'lead', cx, 11.9, zF - 1.8);
  k.hipRoof(rb.w - 0.6, rb.d - 0.6, 1.2, 'terracotta', rb.cx, 14.9, rb.cz, { over: 0.4 });
  k.box(rb.w - 0.6, 2.5, rb.d - 0.6, 'plaster', rb.cx, 12.4, rb.cz);

  // --- Igreja da Lapa front (granite), in the middle of the Arcada
  k.push({ x: cx, z: zF + 0.4 });
  const ops = [{ x: -4, w: 2.3, h: 5.2 }, { x: 0, w: 2.8, h: 5.8 }, { x: 4, w: 2.3, h: 5.2 }];
  k.gate(CW, 12.4, 1.2, ops, 'granite', 0, 0, 0);
  k.box(CW - 0.6, 5.8, 0.3, 'dark', 0, 0, -0.9);
  for (const op of ops) archivolt(k, op.x, op.w, op.h, 0.6, { bw: 0.3, color: 'granite' });
  // tall windows with small panes (photo), iron guard, carved head
  for (const x of [-4, 0, 4]) {
    win(k, x, 7.3, 1.5, 3.1, 0.6, { bw: 0.3, depth: 0.3, pane: 'glass', emit: 0.15, trim: 'granite', head: 'seg' });
    for (let j = 1; j < 4; j++) k.box(1.5, 0.05, 0.05, 'white', x, 7.3 + (j * 3.1) / 4, 0.68);
    k.box(0.05, 3.1, 0.05, 'white', x, 7.3, 0.68);
    ironRail(k, 1.9, 0.9, x, 7.0, 1.0);
  }
  // pilasters (single-tone granite, as the front is), entablature, cornice
  for (const x of [-6.1, -2, 2, 6.1]) {
    k.box(0.7, 12.1, 0.45, 'granite', x, 0, 0.8);
    k.box(0.95, 0.35, 0.65, 'granite', x, 5.9, 0.85);
    k.box(0.95, 0.35, 0.65, 'granite', x, 11.75, 0.85);
  }
  k.box(CW + 0.6, 0.5, 1.8, 'granite', 0, 6.3, 0.3);
  k.cornice(CW + 0.8, corniceProfile('classic', 0.6), 'granite', 0, 12.1, 0.4);
  // curved gable with the arms, pinnacles and the cross
  const gs = new THREE.Shape();
  // (rises clear of the Arcada roofs, as in the photos: top 17.9 m)
  gs.moveTo(-6.5, 0);
  gs.quadraticCurveTo(-3.6, 0.6, -3.2, 2.6);
  gs.quadraticCurveTo(-1.6, 3.4, -0.6, 5.2);
  gs.lineTo(0.6, 5.2);
  gs.quadraticCurveTo(1.6, 3.4, 3.2, 2.6);
  gs.quadraticCurveTo(3.6, 0.6, 6.5, 0);
  gs.closePath();
  k.extrude(gs, 1.2, 'granite', 0, 12.7, 0, { curve: 6 });
  // moulded coping along the curve, volutes at the gable feet
  k.box(1.8, 0.4, 1.4, 'granite', 0, 17.9, 0);
  for (const sx of [-1, 1]) volute(k, 0.75, 0.9, 'granite', sx * 5.6, 13.3, 0.15, { dir: sx, turns: 1.5, band: 0.3 });
  cartouche(k, 1.8, 2.1, 0.4, 'graniteLight', 0, 14.2, 0.7);
  for (const x of [-6.1, -2.9, 2.9, 6.1]) {
    const tall = x === -6.1 || x === 6.1;
    k.pinnacle(tall ? 3.8 : 2.8, 'granite', x, tall ? 12.7 : 14.9, 0);
    if (tall) k.box(1.1, 0.25, 1.1, 'granite', x, 12.45, 0);
  }
  // cross on its pedestal
  k.box(0.9, 0.7, 0.9, 'granite', 0, 18.3, 0);
  k.box(0.22, 2.2, 0.22, 'granite', 0, 19.0, 0);
  k.box(1.1, 0.2, 0.2, 'granite', 0, 20.3, 0);
  k.pop();
  // Lapa bell tower (1771) behind the right arm (photo): white render with
  // granite quoins, belfry, cornice with a balustrade and corner obelisks,
  // then a square lantern stage with arched openings, a bell-shaped cap, a
  // ball and the iron cross, to 24 m
  {
    const tx = cx + CW / 2 + 3.2;
    const tz = zF - 9;
    const yT = bellTower(k, { x: tx, z: tz, w: 5, hBody: 15.2, hBelfry: 3.6, body: 'white', trim: 'granite', cap: 'none', urns: 'pinnacle', windows: 1, sideWindows: false, balustrade: true, lantern: false, cross: false });
    const lw = 2.3;
    const lh = 1.9;
    k.push({ x: tx, y: yT, z: tz });
    k.box(lw + 0.3, 0.2, lw + 0.3, 'granite', 0, 0, 0);
    k.box(lw, lh, lw, 'white', 0, 0.2, 0);
    for (const [qx, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.box(0.26, lh, 0.26, 'granite', qx * (lw / 2 - 0.1), 0.2, qz * (lw / 2 - 0.1));
    for (let f = 0; f < 4; f++) {
      k.push({ ry: (f * Math.PI) / 2 });
      win(k, 0, 0.45, 0.7, 1.15, lw / 2, { arch: 'round', bw: 0.12, depth: 0.15, pane: 'dark', trim: 'granite' });
      k.pop();
    }
    k.corniceRing(lw, lw, corniceProfile('classic', 0.25), 'granite', 0, lh + 0.2, 0);
    for (const [qx, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) flameUrn(k, 0.6, 'granite', qx * (lw / 2), lh + 0.45, qz * (lw / 2));
    const yc = lh + 0.45;
    k.lathe(PROFILES.bellCap, 12, 'granite', 0, yc, 0, { sr: lw * 0.46, sh: 0.95, smooth: true, mat: MAT.smooth });
    k.sphere(0.2, 'granite', 0, yc + 1.12, 0, { seg: 8, rings: 5 });
    const yx = yT + yc + 1.3;
    k.box(0.08, hLapa - yx, 0.08, 'iron', 0, yc + 1.3, 0);
    k.box(0.5, 0.07, 0.07, 'iron', 0, hLapa - yT - 0.35, 0);
    k.pop();
  }
  k.end('mask');

  // --- café terraces (the Vianna and its neighbours): round tables with
  // chairs under white parasols in front of the arcade, more tables
  // inside the gallery
  const chair = 0x6a3b36;
  for (let i = 0; i < 10; i++) {
    const x = x0 + 3 + i * ((L - 6) / 9);
    if (Math.abs(x - cx) < CW / 2 + 1) continue;
    parasol(k, x, zF + 3.4);
    cafeSet(k, x - 0.95, zF + 3.4, 3, i * 0.7, chair);
    cafeSet(k, x + 0.95, zF + 3.4, 3, i * 0.7 + 1, chair);
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = cx + sx * (CW / 2 + 2.5 + i * ((SW - 5) / 3));
      cafeSet(k, x, zF - 2.3, 2, 0, chair);
    }
  }

  // --- the fountain on its OSM polygon: low rim, shallow pool, the dome
  //     of spray, a ring of small jets
  const F = footprint.part(/Chafariz/);
  const [fx, fz] = centroid(F.pts);
  const rim = dims?.height_m?.fountain ?? 1.5;
  k.prism(F.pts, -0.3, 0.9, 'graniteLight', { holes: [offset(F.pts, -0.7)] });
  k.prism(offset(F.pts, -0.7), -0.3, 0.5, 'water', { emit: 0.25 });
  const fr = bbox(F.pts).w / 2;
  // the dome of spray as arcing jets (the real one reads as separate
  // streams, not a solid dome), plus the tall central jet
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const R = 4.4;
    const at = (t) => [fx + Math.cos(a) * (0.4 + (R - 0.4) * t), 0.2 + 4.6 * (1 - t * t), fz + Math.sin(a) * (0.4 + (R - 0.4) * t)];
    for (let s = 0; s < 3; s++) k.segment(at(s / 3), at((s + 1) / 3), 0.16, 0.16, SPRAY, { emit: 0.5, mat: MAT.water });
  }
  k.cyl(0.14, 0.24, 6.5, 6, SPRAY, fx, 0.2, fz, { emit: 0.5 });
  // named point for the app (water animation): the basin centre
  k.marker('fountain', fx, 0.2, fz, { kind: 'jet', r: +(bbox(F.pts).w / 2).toFixed(2), jet: 6.5 });
  k.cyl(3.2, 4.4, 0.35, 16, SPRAY, fx, 0.15, fz, { emit: 0.35, mat: MAT.water });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const r = fr - 2.2;
    k.cone(0.12, 1.2 + (i % 3) * 0.6, 4, SPRAY, fx + Math.cos(a) * r, 0.2, fz + Math.sin(a) * r, { emit: 0.45 });
  }
  void rim;

  // --- globe lamps on square posts round the fountain and along the front
  const lamp = (x, z) => {
    k.box(0.28, 5.2, 0.28, 'steel', x, 0.06, z, { mat: MAT.metal });
    k.sphere(0.42, 0xefdca0, x, 5.6, z, { seg: 8, rings: 5, emit: 0.8 });
  };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    lamp(fx + Math.cos(a) * (fr + 2.6), fz + Math.sin(a) * (fr + 2.6));
  }
  // cast-iron lanterns along the arcade front
  for (let i = 0; i < 6; i++) ironLamp(k, x0 + 3 + i * ((L - 6) / 5), zF + 6.8);
  // a few trees and benches at the square's east end
  for (let i = 0; i < 4; i++) {
    const x = fx + 12 + rnd() * 18;
    const z = fz + 10 + i * 6;
    k.tree(x, 0.06, z, 7 + rnd() * 2, { lobes: 1 });
  }
}
praca.metric = true;
praca.rule = {
  snapTo: 'Arcada',
  base: { part: /Chafariz/, stat: 'mean' },
  extent: [/Arcada/],
  frame: { parts: [/Arcada/, /Chafariz/], margin: 6 }, // the camera frames the Arcada and the fountain
  view: 0,
  note: 'front snapped to the Arcada (56 deg); the square outline is paved, the Arcada and fountain stand on their OSM parts',
};

export default { 'praca-republica': praca };

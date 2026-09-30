// Basílica dos Congregados, metric builder (1:1 metres).
//
// Frame (fit.js): +z = the north front on Avenida Central (352 deg, the
// 25.2 m edge of the church outline, OSM w121590117), origin at the centre
// of the outline box. Outline: the front block x -12.6..12.6, z 13.5..18.8;
// the nave x -9.3..9.1, z -6.8..13.5; the chancel x -6.2..5.6 to z -18.8.
// The Oratorian convent (w121590125, 36.8 x 45.3 m) lies west of the church
// (x -49.4..-12.6, z -26.5..18.8), today the UMinho music faculty.
// From data/dimensions.json and congregados.jpg (about 31 px/m): André
// Soares front of 1761-66 in grey granite, 25.2 m wide. Lower storey with
// the round-headed door and three lattice windows, cornice at 13.4 m; second
// storey with the statue niches (S. Filipe Néri and a companion), the great
// lattice window and the tower clocks, cornice at 20.5 m; twin belfries
// with a round-arched bell opening, corner urns and stone bell cupolas to
// 32 m; a curved gable with flame pinnacles and the cross between them. The
// side walls of the nave have tall windows between pilasters under a 18 m
// ridge. The convent: plastered three-storey wings round a courtyard, granite
// window frames, terracotta hip roofs. (The photos show no azulejo on the
// front; the tile colour is kept for the door reveal only.)
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win, cartouche, bell, flameUrn, volute } from './parts.js';
import { offset } from './geom.js';
import { polyCornice } from './metric.js';

const G = 'granite';
const GL = 'graniteLight';
const ZF = 19.2; // front plane of the carved face, 0.4 m proud of the outline (18.8)
const C1 = 13.4; // lower cornice
const C2 = 20.5; // tower body cornice
const H_TOP = 32; // tower tips
const TX = 9.6; // tower axis
const TW = 6.0; // tower width
const TZ = 16.15; // tower centre z

// One belfry with its bell cupola; top exactly at H_TOP.
function belfry(k, tx, side) {
  const w = 5.0;
  const d = 4.6;
  const t = 0.7;
  const y0 = C2;
  const hb = 5.4;
  // plinth, pilastered stage
  k.box(w, hb, d, G, tx, y0, TZ);
  const hole = [{ x: 0, y: 0.5, w: 1.7, h: 4.0, arch: 'round', pane: null }];
  for (const [ry, len, off] of [[0, w, d / 2], [Math.PI, w, d / 2], [Math.PI / 2, d, w / 2], [-Math.PI / 2, d, w / 2]]) {
    k.push({ x: tx, y: y0, z: TZ, ry });
    k.wall(len, hb, t, G, hole, 0, 0, off - t / 2 + 0.05);
    k.surround(hole[0], 0.25, 0.2, GL, off + 0.05);
    k.pop();
  }
  k.box(w - 2 * t, hb, d - 2 * t, 'graniteDark', tx, y0, TZ);
  bell(k, 1.5, tx, y0 + 0.8, TZ + d / 2 - t - 0.5);
  bell(k, 1.3, tx + side * (w / 2 - t - 0.5), y0 + 0.8, TZ);
  // corner pilasters
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.box(0.7, hb, 0.7, GL, tx + sx * (w / 2 - 0.3), y0, TZ + sz * (d / 2 - 0.3));
  // flame urns on the stepped corners of the tower body
  for (const [sx, sz] of [[1, 1], [-1, 1]]) flameUrn(k, 2.3, GL, tx + sx * (TW / 2 - 0.45), C2 + 0.1, TZ + 0.2 + sz * (5.7 / 2 - 0.45), { seg: 6 });
  // cornice, cupola
  const yc = y0 + hb;
  k.corniceRing(w, d, corniceProfile('classic', 0.55), G, tx, yc, TZ);
  const yd = yc + 0.5;
  k.box(w - 0.6, 0.4, d - 0.6, G, tx, yd, TZ);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) flameUrn(k, 1.5, GL, tx + sx * (w / 2 - 0.35), yd + 0.4, TZ + sz * (d / 2 - 0.35), { seg: 5 });
  k.lathe(PROFILES.bellCap, 12, G, tx, yd + 0.4, TZ, { sr: 2.1, sh: 2.4, smooth: true, mat: MAT.smooth });
  const yl = yd + 0.4 + 2.3;
  k.cyl(0.5, 0.6, 0.7, 8, G, tx, yl, TZ);
  k.lathe(PROFILES.bellCap, 8, G, tx, yl + 0.7, TZ, { sr: 0.75, sh: 0.7, smooth: true, mat: MAT.smooth });
  const ys = yl + 1.4;
  k.sphere(0.2, G, tx, ys, TZ, { seg: 6, rings: 4 });
  k.box(0.1, H_TOP - ys, 0.1, 'iron', tx, ys, TZ);
}

// The great front: lower wall with openings, second storey, gable.
function front(k) {
  const doorH = 5.8;
  const holes = [
    { x: 0, y: 0, w: 2.8, h: doorH, arch: 'round', pane: 'wood', inset: 0.25 },
    { x: 0, y: 9.0, w: 1.6, h: 3.4, arch: 'round', pane: 'glass', emit: 0.2, inset: 0.25 },
    { x: -4.9, y: 8.6, w: 1.2, h: 2.6, arch: 'round', pane: 'glass', emit: 0.2, inset: 0.25 },
    { x: 4.9, y: 8.6, w: 1.2, h: 2.6, arch: 'round', pane: 'glass', emit: 0.2, inset: 0.25 },
  ];
  for (const s of [-1, 1]) {
    holes.push({ x: s * TX, y: 2.6, w: 1.1, h: 1.6, pane: 'glass', emit: 0.12, inset: 0.25 });
    holes.push({ x: s * TX, y: 7.6, w: 1.1, h: 1.9, arch: 'round', pane: 'glass', emit: 0.12, inset: 0.25 });
  }
  k.wall(25.2, C1, 1.2, G, holes, 0, 0, ZF - 0.6, { inset: 0.3 });
  // second storey block (towers and central bay share one plane)
  k.box(25.2, C2 - C1, 5.7, G, 0, C1, TZ + 0.2);
  // plinth band and corner pilasters, paired pilasters between the bays
  k.box(25.4, 0.9, 0.3, 'graniteDark', 0, 0, ZF + 0.1);
  for (const x of [-12.2, 12.2, -6.7, 6.7, -3.4, 3.4]) {
    k.box(0.9, C2 - 0.6, 0.3, GL, x, 0.6, ZF + 0.12);
    k.box(1.2, 0.3, 0.4, G, x, 0.9, ZF + 0.14);
    k.box(1.2, 0.3, 0.4, G, x, C1 - 0.5, ZF + 0.14);
  }
  // door: surround, curved head, arms
  const door = holes[0];
  k.surround(door, 0.4, 0.35, GL, ZF);
  k.box(4.4, 0.4, 1.0, G, 0, doorH + 0.4, ZF + 0.4);
  const hd = new THREE.Shape();
  hd.moveTo(-2.4, 0);
  hd.lineTo(2.4, 0);
  hd.quadraticCurveTo(2.4, 1.0, 1.0, 1.15);
  hd.quadraticCurveTo(0, 1.5, -1.0, 1.15);
  hd.quadraticCurveTo(-2.4, 1.0, -2.4, 0);
  k.extrude(hd, 0.5, G, 0, doorH + 0.8, ZF + 0.35, { curve: 6 });
  // door wings: relief panels on the timber
  k.box(2.0, 0.05, 0.05, 'dark', 0, 1.0, ZF + 0.05);
  for (const s of [-1, 1]) k.box(0.9, 1.6, 0.05, 'wood', s * 0.66, 0.9, ZF - 0.05, { mat: MAT.smooth });
  // small crosses of consecration beside the door
  for (const s of [-1, 1]) {
    k.box(0.07, 0.5, 0.05, 'iron', s * 6.0, 4.0, ZF + 0.03);
    k.box(0.3, 0.07, 0.05, 'iron', s * 6.0, 4.28, ZF + 0.03);
  }
  // window surrounds, lower storey
  for (const h of holes.slice(1, 4)) {
    k.surround(h, 0.3, 0.3, GL, ZF);
    k.box(h.w + 1.2, 0.3, 0.6, G, h.x, h.y + h.h + 0.3, ZF + 0.3);
  }
  for (const s of [-1, 1]) {
    k.surround(holes[s < 0 ? 4 : 6], 0.22, 0.2, GL, ZF);
    k.surround(holes[s < 0 ? 5 : 7], 0.22, 0.2, GL, ZF);
    k.box(0.9, 0.07, 0.05, 'iron', s * TX, 3.3, ZF + 0.02);
  }
  // first cornice across the whole front
  k.cornice(25.8, corniceProfile('classic', 0.85), G, 0, C1, ZF);
  // second storey: niches with the statues of S. Filipe Néri and his companion
  for (const s of [-1, 1]) {
    const nx = s * 4.9;
    k.box(2.0, 3.9, 0.3, 'dark', nx, C1 + 1.2, ZF + 0.02);
    k.surround({ x: nx, y: C1 + 1.2, w: 2.0, h: 3.9, arch: 'round' }, 0.28, 0.35, GL, ZF);
    k.box(1.1, 0.9, 0.9, GL, nx, C1 + 1.2, ZF - 0.05);
    k.statue(2.0, GL, nx, C1 + 2.1, ZF - 0.05, { pose: s < 0 ? 'hold' : 'raise' });
    // flanking columns
    for (const c of [-1, 1]) k.column(4.2, 0.22, GL, nx + c * 1.45, C1 + 0.9, ZF + 0.2, { seg: 6 });
    // shell-like head
    k.cyl(1.0, 1.0, 0.3, 10, G, nx, C1 + 5.0, ZF + 0.15, { rx: Math.PI / 2, t0: -Math.PI / 2, tl: Math.PI });
  }
  // the great central window with its lattice, flanked by scrolls
  const gw = { x: 0, y: C1 + 2.2, w: 1.8, h: 3.8, arch: 'round' };
  k.box(gw.w, gw.h, 0.1, 'dark', 0, gw.y, ZF - 0.05);
  k.plane(new THREE.Shape([new THREE.Vector2(-0.8, 0), new THREE.Vector2(0.8, 0), new THREE.Vector2(0.8, 3.0), new THREE.Vector2(0, 3.7), new THREE.Vector2(-0.8, 3.0)]), 'glass', 0, gw.y, ZF + 0.02, { emit: 0.25, mat: MAT.flat });
  k.surround(gw, 0.4, 0.4, GL, ZF);
  for (let i = 1; i < 4; i++) k.box(0.05, 3.4, 0.05, 'iron', -0.8 + (1.6 * i) / 4, gw.y, ZF + 0.04);
  for (let i = 1; i < 6; i++) k.box(1.6, 0.05, 0.05, 'iron', 0, gw.y + (3.4 * i) / 6, ZF + 0.04);
  for (const s of [-1, 1]) {
    volute(k, 0.8, 0.3, G, s * 1.7, C1 + 5.4, ZF + 0.25, { dir: s, turns: 1.2 });
    k.box(0.9, 5.4, 0.35, GL, s * 2.9, C1 + 0.4, ZF + 0.16);
  }
  // clocks on the towers
  for (const s of [-1, 1]) {
    const cx = s * TX;
    const cy = C1 + 2.2;
    k.cyl(0.85, 0.85, 0.22, 16, GL, cx, cy, ZF + 0.02, { rx: Math.PI / 2, smooth: true });
    k.cyl(0.68, 0.68, 0.1, 16, 'white', cx, cy, ZF + 0.16, { rx: Math.PI / 2, smooth: true });
    k.box(0.07, 0.5, 0.05, 'dark', cx, cy, ZF + 0.26);
    k.box(0.36, 0.07, 0.05, 'dark', cx + 0.14, cy, ZF + 0.26);
    k.box(2.3, 0.7, 0.35, G, cx, cy + 1.3, ZF + 0.1, { mat: MAT.smooth });
  }
  // cornice of the second storey: tower rings, front across the centre
  for (const s of [-1, 1]) k.corniceRing(TW + 0.4, 5.7, corniceProfile('classic', 0.9), G, s * TX, C2, TZ + 0.2,{ skip: [(-s * Math.PI) / 2] });
  k.cornice(13.4, corniceProfile('classic', 0.9), G, 0, C2, ZF);
  // curved gable: two S curves up to a raised centre, with the arms
  const gb = new THREE.Shape();
  gb.moveTo(-6.4, 0);
  gb.lineTo(6.4, 0);
  gb.bezierCurveTo(6.4, 1.2, 4.6, 1.3, 3.8, 2.6);
  gb.quadraticCurveTo(3.0, 4.2, 1.6, 4.5);
  gb.quadraticCurveTo(0.5, 5.6, 0, 5.6);
  gb.quadraticCurveTo(-0.5, 5.6, -1.6, 4.5);
  gb.quadraticCurveTo(-3.0, 4.2, -3.8, 2.6);
  gb.bezierCurveTo(-4.6, 1.3, -6.4, 1.2, -6.4, 0);
  k.extrude(gb, 1.4, G, 0, C2 + 0.05, ZF - 1.1, { curve: 8 });
  k.push({ y: C2 + 0.2, z: ZF - 0.2, s: 0.94 });
  k.extrude(gb, 0.2, GL, 0, 0, 0, { curve: 8 });
  k.pop();
  cartouche(k, 1.7, 1.9, 0.3, GL, 0, C2 + 1.6, ZF - 0.25, { scrolls: true });
  k.box(2.2, 2.6, 0.2, 'dark', 0, C2 + 0.05, ZF - 0.4);
  // pinnacles on the gable, cross between the towers
  for (const x of [-4.5, -2.7, 2.7, 4.5]) flameUrn(k, 2.9, GL, x, C2 + (Math.abs(x) > 4 ? 0.6 : 2.6), ZF - 0.6, { seg: 6 });
  const yt = C2 + 5.5;
  k.box(0.9, 0.9, 0.9, G, 0, yt, ZF - 0.7);
  k.box(0.22, 4.4, 0.22, 'iron', 0, yt + 0.9, ZF - 0.7);
  k.box(1.5, 0.22, 0.22, 'iron', 0, yt + 3.6, ZF - 0.7);
  for (const s of [-1, 1]) {
    belfry(k, s * TX, s);
    // tower body pilasters on the outer flank (stepped volutes towards the gable)
    volute(k, 1.1, 0.4, G, s * (TX - 2.6), C2 + 0.4, ZF - 0.2, { dir: -s, turns: 1.2 });
  }
}

// The church: nave, chancel, roofs, side windows.
function church(k, O) {
  const EAVE = C1;
  k.prism(O, -1.5, EAVE + 1.5, G);
  k.prism(offset(O, 0.25), -1.5, 1.6, 'graniteDark');
  polyCornice(k, O, EAVE - 0.7, corniceProfile('eave', 0.6), G, { minLen: 2.5 });
  // nave roof (ridge 18 m), chancel roof
  k.gableRoof(18.4, 20.5, 4.6, 'terracotta', -0.1, EAVE, 3.4, { over: 0.35, mat: MAT.tile });
  k.gableRoof(11.8, 12.4, 3.4, 'terracotta', -0.3, EAVE - 1.6, -12.7, { over: 0.35, mat: MAT.tile });
  // behind the front block: a hip over the tower stage joint
  k.box(12.6, 0.6, 5.3, G, 0, C2, TZ);
  // the east and west walls of the nave: tall arched windows between pilasters
  for (const [side, x] of [[1, 9.1], [-1, -9.3]]) {
    k.push({ x, z: 3.4, ry: (side * Math.PI) / 2 });
    for (let i = 0; i < 4; i++) {
      const u = -8.5 + i * 5.6;
      win(k, u, 6.6, 1.5, 4.4, 0, { bw: 0.3, depth: 0.25, trim: GL, pane: 'glass', emit: 0.14, arch: 'round', sill: true });
      k.box(0.8, EAVE - 0.7, 0.3, GL, u + 2.8, 0, 0.1);
    }
    k.pop();
  }
  // chancel sides
  for (const [side, x] of [[1, 5.6], [-1, -6.2]]) {
    k.push({ x, z: -12.8, ry: (side * Math.PI) / 2 });
    for (let i = 0; i < 2; i++) win(k, -3 + i * 6, 5.2, 1.3, 3.2, 0, { bw: 0.28, depth: 0.22, trim: GL, pane: 'glass', emit: 0.12, arch: 'round' });
    k.pop();
  }
}

// The Oratorian convent: three floors round a courtyard.
function convent(k, P) {
  const xs = P.pts.map((p) => p[0]);
  const zs = P.pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const EAVE = 12;
  const D = 9;
  const outer = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const court = [[x0 + D, z0 + D], [x1 - D, z0 + D], [x1 - D, z1 - D], [x0 + D, z1 - D]];
  k.prism(outer, -1.5, EAVE + 1.5, 'plaster', { holes: [court] });
  k.prism(offset(outer, 0.2), -1.5, 1.5, G, { holes: [court] });
  polyCornice(k, outer, EAVE - 0.55, corniceProfile('eave', 0.55), G);
  const W = x1 - x0;
  const Dz = z1 - z0;
  const RISE = 2.4;
  k.hipRoof(W, D, RISE, 'terracotta', (x0 + x1) / 2, EAVE, z1 - D / 2, { over: 0.6, mat: MAT.tile });
  k.hipRoof(W, D, RISE, 'terracotta', (x0 + x1) / 2, EAVE, z0 + D / 2, { over: 0.6, mat: MAT.tile });
  k.hipRoof(D, Dz, RISE, 'terracotta', x0 + D / 2, EAVE, (z0 + z1) / 2, { over: 0.6, mat: MAT.tile });
  k.hipRoof(D, Dz, RISE, 'terracotta', x1 - D / 2, EAVE, (z0 + z1) / 2, { over: 0.6, mat: MAT.tile });
  // windows: three floors on the street front (+z), two on the west end and back
  const bay = (len, n) => (len - 2) / n;
  const face = (ry, cx, cz, len, floors) => {
    k.push({ x: cx, z: cz, ry });
    const n = Math.floor((len - 2) / 3.6);
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * 3.6) / 2 + i * 3.6;
      for (let f = 0; f < floors; f++) {
        const y = f === 0 ? 1.0 : 4.7 + (f - 1) * 3.6;
        const ground = f === 0;
        win(k, u, y, ground ? 1.1 : 1.25, ground ? 1.9 : 2.4, 0, {
          bw: 0.26,
          depth: 0.2,
          trim: G,
          pane: 'glass',
          emit: k.rnd() > 0.7 ? 0.28 : 0.1,
          head: ground ? undefined : 'flat',
          sill: !ground,
        });
        if (f === 1) k.box(1.9, 0.07, 0.45, 'iron', u, y - 0.1, 0.3);
      }
    }
    k.pop();
  };
  face(0, (x0 + x1) / 2, z1, W, 3);
  face(Math.PI, (x0 + x1) / 2, z0, W, 2);
  face(-Math.PI / 2, x0, (z0 + z1) / 2, Dz, 2);
  // courtyard faces: plain rows
  const xm = (x0 + x1) / 2;
  face(Math.PI, xm, z1 - D, W - 2 * D, 2);
  face(0, xm, z0 + D, W - 2 * D, 2);
  void bay;
  // a cloister well in the court
  k.box(W - 2 * D, 0.1, Dz - 2 * D, 'sand', xm, 0, (z0 + z1) / 2, { mat: MAT.smooth });
  k.cyl(0.9, 1.0, 0.9, 10, G, xm, 0.1, (z0 + z1) / 2);
}

function congregados(k, { footprint }) {
  const O = footprint.outline;
  const conv = footprint.part(/Convento/);
  k.begin('mask');
  k.begin('main');
  church(k, O);
  front(k);
  k.end('main');
  if (conv) convent(k, conv);
  k.end('mask');
}
congregados.metric = true;
congregados.rule = {
  extent: [/Convento/],
  view: 0.5,
  note: 'church on its outline (main; 32 m twin towers, gable, 18 m nave); the convent on its OSM part beside it, three floors round a court',
};

export default { congregados };

// Igreja e Convento do Pópulo, metric builder (1:1 metres).
//
// Frame (fit.js): +z = the ENE front on Largo do Pópulo (73 deg, snapped to
// the outline's front edge), origin at the centre of the church outline
// (OSM w109149780, 19 x 62.5 m). The convent (OSM w149489952, 66.6 x 37.4 m,
// today Câmara Municipal offices) stands south of the church, on local +x,
// its street front in line with the church front (z = 31.2).
// From data/dimensions.json: towers 26 m to the crosses, nave ridge 16 m,
// convent wing 14 m, two portal columns. Read off populo.jpg (the front
// is 19 m wide, about 34 px/m): tower bodies 5.1 m wide to the main
// cornice at 13.2 m, clock stage, belfry with one arched opening a side,
// bell-shaped stone cupola with a lantern and a vane cross; central bay
// with the round-arched portal between paired columns, the balcony and
// the tall arched window, the pediment with the arms; oval windows in
// framed panels on both tower bays. The convent front: white render,
// granite frames, two rows of windows, a row of oculi under the eaves, the
// granite frontispiece with the curved pediment and its oculus.
// The cloister (populo-5.jpg): arcades on granite piers round a box
// parterre, upper floor windows with iron balconies. The Fonte do Pópulo
// (OSM point) stands against the north wall of the nave.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win, pediment, cartouche, bell, lobedFrame, flameUrn, wallFountain, volute, flutedColumn } from './parts.js';
import { offset, bbox, centroid } from './geom.js';
import { polyCornice } from './metric.js';
import { lowTree, drapePoly, ribbon } from './drape.js';

const G = 'graniteGold'; // the golden granite of the front
const GS = 'granite'; // plain ashlar of the sides and the convent frames
const ZF = 31.2; // church front plane
const TOWER_W = 5.1;
const CORNICE = 13.2;
const H_TOWER = 26;

// One of the twin towers above the main cornice: clock stage, belfry,
// cornice, bell cupola, lantern, vane cross (top exactly at H_TOWER).
function towerTop(k, tx, tz, side) {
  const w = TOWER_W - 0.5;
  const y0 = CORNICE + 0.9;
  // clock stage with pilaster corners
  k.box(w, 1.9, w, G, tx, y0, tz);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.box(0.55, 1.9, 0.55, G, tx + sx * (w / 2 - 0.2), y0, tz + sz * (w / 2 - 0.2));
  for (const [ry, dx, dz] of [[0, 0, 1], [side * Math.PI / 2, side, 0]]) {
    k.push({ x: tx + dx * (w / 2), y: y0 + 1.05, z: tz + dz * (w / 2), ry });
    k.cyl(0.78, 0.78, 0.2, 14, G, 0, 0, 0.02, { rx: Math.PI / 2, smooth: true });
    k.cyl(0.62, 0.62, 0.1, 14, 'white', 0, 0, 0.14, { rx: Math.PI / 2, smooth: true });
    k.box(0.07, 0.5, 0.05, 'dark', 0, 0, 0.26);
    k.box(0.36, 0.07, 0.05, 'dark', 0.14, 0, 0.26);
    k.pop();
  }
  // belfry: four slabs with a round-arched opening, pilasters, bells
  const yb = y0 + 1.9;
  const hb = 3.9;
  const t = 0.6;
  const hole = [{ x: 0, y: 0.35, w: 1.6, h: 3.0, arch: 'round', pane: null }];
  for (const [ry, len] of [[0, w], [Math.PI, w], [Math.PI / 2, w - 2 * t], [-Math.PI / 2, w - 2 * t]]) {
    k.push({ x: tx, y: yb, z: tz, ry });
    k.wall(len, hb, t, G, hole, 0, 0, w / 2 - t / 2);
    k.surround(hole[0], 0.22, 0.18, G, w / 2);
    k.pop();
  }
  k.box(w - 2 * t, hb, w - 2 * t, 'dark', tx, yb, tz);
  bell(k, 1.15, tx, yb + 0.9, tz + w / 2 - t - 0.4);
  bell(k, 0.95, tx + side * (w / 2 - t - 0.4), yb + 1.0, tz);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.box(0.6, hb, 0.6, G, tx + sx * (w / 2 - 0.22), yb, tz + sz * (w / 2 - 0.22));
  // cornice and corner urns
  const yc = yb + hb;
  k.corniceRing(w, w, corniceProfile('classic', 0.45), G, tx, yc, tz);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) flameUrn(k, 1.1, G, tx + sx * (w / 2 - 0.1), yc + 0.45, tz + sz * (w / 2 - 0.1), { seg: 5 });
  // bell cupola (the scalloped stone domes of the photo), lantern, finial
  const yd = yc + 0.45;
  k.box(w - 0.3, 0.35, w - 0.3, G, tx, yd, tz);
  k.lathe(PROFILES.bellCap, 12, G, tx, yd + 0.35, tz, { sr: w * 0.47, sh: 2.3, smooth: true, mat: MAT.smooth });
  for (let i = 0; i < 4; i++) {
    // small dormer oculi on the cupola
    const a = (i * Math.PI) / 2;
    k.cyl(0.26, 0.26, 0.3, 8, 'dark', tx + Math.sin(a) * w * 0.36, yd + 1.05, tz + Math.cos(a) * w * 0.36, { rx: Math.PI / 2, ry: a });
  }
  const yl = yd + 0.35 + 2.3 - 0.1;
  k.cyl(0.55, 0.62, 1.2, 8, G, tx, yl, tz);
  for (let i = 0; i < 4; i++) k.box(0.3, 0.8, 0.06, 'dark', tx + Math.sin((i * Math.PI) / 2) * 0.58, yl + 0.2, tz + Math.cos((i * Math.PI) / 2) * 0.58, { ry: (i * Math.PI) / 2 });
  k.lathe(PROFILES.bellCap, 8, G, tx, yl + 1.2, tz, { sr: 0.72, sh: 0.75, smooth: true, mat: MAT.smooth });
  k.sphere(0.2, G, tx, yl + 2.05, tz, { seg: 6, rings: 4 });
  // iron vane cross to the real height
  const yx = yl + 2.2;
  k.box(0.1, H_TOWER - yx, 0.1, 'iron', tx, yx, tz);
  k.box(0.75, 0.08, 0.08, 'iron', tx, H_TOWER - 0.7, tz);
  k.box(0.5, 0.3, 0.03, 'iron', tx + 0.25, H_TOWER - 1.3, tz);
}

// Oval window in a framed granite panel (the tower bays of the front).
function ovalBay(k, x, y, z) {
  k.surround({ x, y: y - 1.9, w: 2.5, h: 3.8 }, 0.16, 0.12, G, z);
  lobedFrame(k, 'oval', 1.55, 0.26, G, x, y, z + 0.14, { open: 0.52, crest: false, pane: 'glass' });
}

function church(k, O) {
  const nave = O;
  // walls and plinth of the nave and chancel (granite ashlar)
  k.prism(nave, -1.5, CORNICE + 1.5, GS);
  k.prism(offset(nave, 0.25), -1.5, 1.7, 'graniteDark');
  polyCornice(k, nave, CORNICE - 0.6, corniceProfile('eave', 0.6), GS, { minLen: 2 });
  // nave roof: gable along z, ridge 16 m (dims nave_ridge)
  k.gableRoof(18.2, 55, 2.8, 'terracotta', -0.1, CORNICE, -3.8, { over: 0.4, mat: MAT.tile });
  k.box(18.8, 3.2, 0.6, GS, -0.1, CORNICE, -31.2); // chancel gable
  // north side: tall nave windows between pilasters, the door of the side chapel
  k.push({ x: -9.28, z: 0, ry: -Math.PI / 2 });
  for (let i = 0; i < 4; i++) {
    const u = -18 + i * 9.5;
    win(k, u, 8.2, 1.4, 2.6, 0, { bw: 0.3, depth: 0.25, trim: G, pane: 'glass', emit: 0.14, sill: true });
    k.box(0.9, CORNICE - 0.6, 0.35, GS, u + 4.75, 0, 0.1);
  }
  k.surround({ x: -12, y: 0, w: 1.6, h: 3.1 }, 0.3, 0.25, G, 0);
  k.box(1.6, 3.1, 0.08, 'wood', -12, 0, 0.02);
  k.pop();

  // ---- the front (+z): towers, central bay, pediment
  const txs = [-9.5 + TOWER_W / 2, 9.35 - TOWER_W / 2];
  const TD = 5.6; // tower depth
  for (const tx of txs) {
    k.box(TOWER_W, CORNICE + 1, TD, G, tx, -1, ZF - TD / 2);
    // paired pilasters on the tower front
    for (const s of [-1, 1]) {
      k.box(0.62, CORNICE - 1.2, 0.3, G, tx + s * (TOWER_W / 2 - 0.36), 1.2, ZF + 0.15);
      k.box(0.62, CORNICE - 1.2, 0.3, G, tx + s * (TOWER_W / 2 - 1.12), 1.2, ZF + 0.1);
      k.box(1.7, 1.2, 0.55, G, tx + s * (TOWER_W / 2 - 0.74), 0, ZF + 0.27); // pedestals
    }
    ovalBay(k, tx, 4.9, ZF);
    ovalBay(k, tx, 9.6, ZF);
    // cornice round the tower body and the tower top
    k.corniceRing(TOWER_W, TD, corniceProfile('classic', 0.9), G, tx, CORNICE, ZF - TD / 2, { skip: [(-Math.sign(tx) * Math.PI) / 2] });
    towerTop(k, tx, ZF - TD / 2, Math.sign(tx));
  }
  // central bay: the wall with the portal and the great window
  const bw = 19 - 2 * TOWER_W; // 8.8
  const zc = ZF - 0.35;
  const portal = { x: 0, y: 0.3, w: 2.5, h: 4.6, arch: 'round', pane: 'wood', inset: 0.9 };
  const bigWin = { x: 0, y: 7.8, w: 2.1, h: 4.0, arch: 'round', pane: 'glass', emit: 0.25, inset: 0.6 };
  k.wall(bw, CORNICE, 1.6, G, [portal, bigWin], -0.07, 0, zc - 0.8);
  k.box(bw, 0.3, 1.2, G, -0.07, 0, zc + 0.3); // door step
  k.surround(portal, 0.32, 0.3, G, zc);
  // the arms over the door, in the keystone
  cartouche(k, 0.8, 0.9, 0.2, G, 0, 4.5, zc + 0.35, { scrolls: false });
  // portal columns on pedestals, entablature, balcony
  for (const s of [-1, 1]) {
    k.box(1.0, 1.3, 1.0, G, s * 2.35, 0, zc + 0.55);
    flutedColumn(k, 4.4, 0.36, G, s * 2.35, 1.3, zc + 0.55, { capital: 'ionic', flutes: 10 });
    k.box(0.7, 5.7, 0.3, G, s * 3.4, 0, zc + 0.15);
  }
  k.box(bw - 0.4, 0.75, 1.5, G, -0.07, 5.7, zc + 0.55);
  k.box(bw - 1.8, 0.35, 1.6, G, -0.07, 6.45, zc + 0.8);
  k.balustrade(5.4, 1.0, G, -0.07, 6.8, zc + 1.2, { cheap: true, d: 0.26, sp: 0.36, posts: 2 });
  // the great window: surround, pilasters and columns, a shell crest
  k.surround(bigWin, 0.28, 0.28, G, zc);
  for (const s of [-1, 1]) {
    k.column(4.8, 0.3, G, s * 1.85, 7.8, zc + 0.45, { seg: 8 });
    k.box(0.6, 5.4, 0.25, G, s * 3.2, 7.6, zc + 0.12);
    // carved trophy panels between window and towers
    k.box(0.9, 2.6, 0.12, G, s * 2.75, 8.6, zc + 0.08, { mat: MAT.smooth });
    volute(k, 0.32, 0.14, G, s * 2.75, 10.6, zc + 0.2, { dir: s, turns: 1.2 });
    volute(k, 0.26, 0.14, G, s * 2.75, 9.2, zc + 0.2, { dir: -s, turns: 1.2 });
  }
  k.box(bw, 0.5, 0.7, G, -0.07, 12.4, zc + 0.35);
  // main cornice across the front
  k.cornice(19.9, corniceProfile('classic', 0.9), G, -0.07, CORNICE, ZF);
  // pediment with the arms of the archbishop and a cross
  const yp = CORNICE + 0.9;
  pediment(k, bw + 0.6, 3.1, 0.8, G, -0.07, yp, zc, { frame: 0.4 });
  cartouche(k, 1.9, 1.7, 0.35, G, -0.07, yp + 0.35, zc + 0.5, { scrolls: true });
  for (const s of [-1, 1]) flameUrn(k, 1.1, G, s * (bw / 2 + 0.1), yp + 0.2, zc + 0.2, { seg: 6 });
  k.box(0.9, 0.8, 0.9, G, -0.07, yp + 3.1, zc);
  k.box(0.28, 2.2, 0.28, G, -0.07, yp + 3.9, zc);
  k.box(1.2, 0.26, 0.28, G, -0.07, yp + 5.2, zc);
  // plinth band along the whole front
  k.box(19.6, 1.15, 0.5, 'graniteDark', -0.07, -0.4, ZF + 0.2);
}

// ---------------------------------------------------------------- convent
function convent(k, P) {
  const b = bbox(P.pts);
  const x0 = b.x0 + 0.2;
  const x1 = b.x1;
  const z0 = b.z0;
  const z1 = Math.max(b.z1, ZF) - 0.1;
  const D = 10.5; // range depth
  const EAVE = 11;
  const RISE = 3; // ridge at 14 m (dims convent_wing)
  const outer = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const court = [[x0 + D, z0 + D], [x1 - D, z0 + D], [x1 - D, z1 - D], [x0 + D, z1 - D]];
  k.prism(outer, -1.5, EAVE + 1.5, 'plaster', { holes: [court] });
  k.prism(offset(outer, 0.2), -1.5, 1.9, GS, { holes: [court] });
  polyCornice(k, outer, EAVE - 0.55, corniceProfile('eave', 0.55), GS);
  polyCornice(k, [...court].reverse(), EAVE - 0.4, corniceProfile('band', 0.4), GS);
  // four hipped ranges of canal tiles
  const W = x1 - x0;
  const Dz = z1 - z0;
  k.hipRoof(W, D, RISE, 'terracotta', (x0 + x1) / 2, EAVE, z1 - D / 2, { over: 0.6, mat: MAT.tile });
  k.hipRoof(W, D, RISE, 'terracotta', (x0 + x1) / 2, EAVE, z0 + D / 2, { over: 0.6, mat: MAT.tile });
  k.hipRoof(D, Dz, RISE, 'terracotta', x0 + D / 2, EAVE, (z0 + z1) / 2, { over: 0.6, mat: MAT.tile });
  k.hipRoof(D, Dz, RISE, 'terracotta', x1 - D / 2, EAVE, (z0 + z1) / 2, { over: 0.6, mat: MAT.tile });

  // --- street front (+z): 2 rows of framed windows and a row of oculi,
  // pilaster strips, the granite frontispiece in the middle
  const xm = (x0 + x1) / 2;
  const PW = 11; // frontispiece width
  const rnd = k.rnd;
  const pitch = 3.95;
  const n = Math.floor((W - 1) / pitch);
  for (let i = 0; i < n; i++) {
    const x = x0 + (W - n * pitch) / 2 + (i + 0.5) * pitch;
    if (Math.abs(x - xm) < PW / 2 + 0.3) continue;
    win(k, x, 1.3, 1.25, 2.1, z1, { bw: 0.28, depth: 0.22, trim: GS, pane: 'glass', emit: 0.1, bars: true, sill: true });
    win(k, x, 4.9, 1.35, 2.5, z1, { bw: 0.3, depth: 0.22, trim: GS, pane: 'glass', emit: rnd() > 0.5 ? 0.3 : 0.1, head: 'flat' });
    k.add(new THREE.TorusGeometry(0.5, 0.13, 3, 8), GS, { x, y: 8.95, z: z1 + 0.08, sy: 0.8 });
    k.add(new THREE.CircleGeometry(0.46, 10), 'glass', { x, y: 8.95, z: z1 + 0.03, sy: 0.8, emit: 0.1 });
  }
  // granite pilaster strips at the ends and every fourth bay
  for (const x of [x0 + 0.4, x1 - 0.4, xm - PW / 2 - 4 * pitch, xm + PW / 2 + 4 * pitch]) k.box(0.8, EAVE - 0.5, 0.25, GS, x, 0, z1 + 0.12);
  // frontispiece: granite, projecting, paired pilasters, door, balcony,
  // the curved (ogee) pediment with an oculus
  const zp = z1 + 0.5;
  k.box(PW, EAVE + 0.3, 1.0, G, xm, -1, z1);
  for (const s of [-1, 1]) {
    k.box(0.7, EAVE - 1.5, 0.3, G, xm + s * (PW / 2 - 0.35), 1.2, zp + 0.15);
    k.box(0.7, EAVE - 1.5, 0.3, G, xm + s * (PW / 2 - 1.2), 1.2, zp + 0.15);
  }
  k.surround({ x: xm, y: 0, w: 1.9, h: 3.3 }, 0.35, 0.3, G, zp);
  k.box(1.9, 3.3, 0.08, 'wood', xm, 0, zp + 0.02);
  for (const s of [-1, 1]) {
    k.column(3.6, 0.25, G, xm + s * 1.55, 0, zp + 0.35, { seg: 6 });
    win(k, xm + s * 3.4, 1.4, 1.2, 2.0, zp, { bw: 0.26, depth: 0.2, trim: G, pane: 'glass', emit: 0.1, bars: true });
    win(k, xm + s * 3.4, 5.0, 1.3, 2.4, zp, { bw: 0.28, depth: 0.22, trim: G, pane: 'glass', emit: 0.2, head: 'seg' });
  }
  k.box(4.4, 0.35, 1.3, G, xm, 3.8, zp + 0.6);
  k.balustrade(4.0, 1.0, G, xm, 4.15, zp + 1.0, { cheap: true, d: 0.24, sp: 0.34 });
  win(k, xm, 4.25, 1.5, 2.9, zp, { bw: 0.32, depth: 0.25, trim: G, pane: 'glass', emit: 0.3, head: 'tri' });
  k.cornice(PW + 0.6, corniceProfile('classic', 0.6), G, xm, EAVE - 0.6, zp);
  // ogee pediment: two S-curves up to a point, with a moulded border
  const ped = new THREE.Shape();
  const ph = 3.0;
  ped.moveTo(-PW / 2, 0);
  ped.lineTo(PW / 2, 0);
  ped.bezierCurveTo(PW * 0.44, ph * 0.3, PW * 0.2, ph * 0.35, PW * 0.12, ph * 0.72);
  ped.quadraticCurveTo(PW * 0.05, ph, 0, ph);
  ped.quadraticCurveTo(-PW * 0.05, ph, -PW * 0.12, ph * 0.72);
  ped.bezierCurveTo(-PW * 0.2, ph * 0.35, -PW * 0.44, ph * 0.3, -PW / 2, 0);
  k.extrude(ped, 0.7, G, xm, EAVE, zp - 0.1, { curve: 8 });
  k.push({ x: xm, y: EAVE + 0.05, z: zp + 0.3, s: 0.92 });
  k.extrude(ped, 0.2, GS, 0, 0, 0, { curve: 8 });
  k.pop();
  k.add(new THREE.TorusGeometry(0.62, 0.16, 4, 14), G, { x: xm, y: EAVE + 1.3, z: zp + 0.45 });
  k.add(new THREE.CircleGeometry(0.58, 12), 'glass', { x: xm, y: EAVE + 1.3, z: zp + 0.36, emit: 0.2 });
  k.sphere(0.25, G, xm, EAVE + ph + 0.05, zp + 0.1, { seg: 6, rings: 4 });
  // east end and the back: plain framed windows in two rows
  for (const [ry, cx, cz, len] of [[Math.PI / 2, x1, (z0 + z1) / 2, Dz], [Math.PI, xm, z0, W - 2]]) {
    k.push({ x: cx, z: cz, ry });
    const m = Math.floor((len - 2) / 4.2);
    for (let i = 0; i < m; i++) {
      const u = -((m - 1) * 4.2) / 2 + i * 4.2;
      for (const y of [1.4, 5.0]) {
        k.box(1.7, 2.7, 0.12, GS, u, y - 0.25, 0.04);
        k.box(1.2, 2.2, 0.06, 'glass', u, y, 0.12, { emit: 0.1 });
      }
    }
    k.pop();
  }

  // --- the cloister: two-storey arcade round the box parterre
  const cx0 = x0 + D;
  const cx1 = x1 - D;
  const cz0 = z0 + D;
  const cz1 = z1 - D;
  const cw = cx1 - cx0;
  const cd = cz1 - cz0;
  k.box(cw, 0.1, cd, 'sand', (cx0 + cx1) / 2, 0, (cz0 + cz1) / 2, { mat: MAT.smooth });
  const sides = [
    [(cx0 + cx1) / 2, cz0 + 2.6, 0, cw],
    [(cx0 + cx1) / 2, cz1 - 2.6, Math.PI, cw],
    [cx0 + 2.6, (cz0 + cz1) / 2, Math.PI / 2, cd - 5.2],
    [cx1 - 2.6, (cz0 + cz1) / 2, -Math.PI / 2, cd - 5.2],
  ];
  for (const [sx, sz, ry, len] of sides) {
    const na = Math.max(2, Math.round(len / 4.3));
    k.push({ x: sx, z: sz, ry });
    k.arcade(len, 5.6, 0.7, na, (len / na) * 0.7, 4.4, GS, 0, 0, 0, { mat: MAT.ashlar, curve: 5 });
    k.box(len, 0.5, 2.6, GS, 0, 5.6, -1.0); // gallery floor slab
    for (let i = 0; i <= na; i++) k.box(0.9, 5.6, 0.9, GS, -len / 2 + (i * len) / na, 0, 0.1); // piers
    for (let i = 0; i < na; i++) {
      const u = -len / 2 + ((i + 0.5) * len) / na;
      k.box(1.64, 2.74, 0.1, GS, u, 6.68, -0.12);
      k.box(1.2, 2.3, 0.06, 'glass', u, 6.9, -0.05, { emit: 0.12 });
      k.box(1.8, 0.1, 0.5, 'iron', u, 6.8, 0.15); // iron balcony
      k.box(1.8, 0.9, 0.05, 'iron', u, 6.8, 0.4);
      if (i > 0) k.cone(0.22, 1.3, 4, GS, -len / 2 + (i * len) / na, 6.1, 0.35); // obelisk finials on the piers
    }
    k.pop();
  }
  // box parterre: a ring and four beds
  const pcx = (cx0 + cx1) / 2;
  const pcz = (cz0 + cz1) / 2;
  const g = new THREE.TorusGeometry(Math.min(cd, cw) * 0.22, 0.35, 3, 20);
  g.rotateX(Math.PI / 2);
  k.add(g, 'hedge', { x: pcx, y: 0.35, z: pcz, sx: 1.5, flat: true });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const bx = pcx + sx * cw * 0.3;
    const bz = pcz + sz * cd * 0.2;
    k.box(cw * 0.26, 0.6, cd * 0.22, 'hedge', bx, 0.1, bz);
    k.box(cw * 0.24, 0.62, cd * 0.2, 'grass', bx, 0.1, bz);
  }
  k.cyl(0.8, 0.9, 0.9, 10, GS, pcx, 0.1, pcz);
  return { xm, z1 };
}

function populo(k, { footprint }) {
  const O = footprint.outline;
  const conv = footprint.part(/Convento/);
  k.begin('mask');
  k.begin('main');
  church(k, O);
  k.end('main');
  // Fonte do Pópulo against the north wall at the OSM point (outside
  // 'main': it stands proud of the church outline)
  const fp = footprint.part(/Fonte/);
  const fz = fp ? fp.pts[0][1] : -1.8;
  k.push({ x: -9.2, z: fz, ry: -Math.PI / 2 });
  wallFountain(k, 0, 0, 0, 3.4, { trim: G });
  k.pop();
  const c = conv ? convent(k, conv) : null;
  // --- the square in front: Largo do Pópulo (granite setts) and the
  // Campo da Vinha garden (lawn parterres, gravel walks, plane trees,
  // benches), both on their OSM parts and inside the mask so no city block
  // or ML "roof" can stand on them. The old 5.4 m strip is the fallback.
  const sq = footprint.part(/Largo do Pópulo/);
  const gd = footprint.part(/Campo da Vinha/);
  const ground = footprint.ground;
  if (sq) drapePoly(k, sq.pts, ground, 0.12, 'graniteLight', { cell: 8, mat: MAT.smooth });
  // garden beds: the central parterre of the Largo (9 m inside its kerb, as
  // on the ground: the paved ring carries the traffic and the market) and
  // the small OSM park polygon
  const beds = [];
  if (sq) beds.push(offset(sq.pts, -9));
  if (gd) beds.push(gd.pts);
  for (const bed of beds) {
    if (!bed || bed.length < 3) continue;
    drapePoly(k, bed, ground, 0.22, 'grass', { cell: 8, mat: MAT.leaf });
    try {
      const gb = bbox(bed);
      const cx = (gb.x0 + gb.x1) / 2;
      const cz = (gb.z0 + gb.z1) / 2;
      // two crossing walks, a ring walk 2.5 m inside the edge
      ribbon(k, [[gb.x0 + 3, cz], [gb.x1 - 3, cz]], 3, ground, 0.34, 'graniteLight', { step: 5, mat: MAT.smooth });
      ribbon(k, [[cx, gb.z0 + 3], [cx, gb.z1 - 3]], 3, ground, 0.34, 'graniteLight', { step: 5, mat: MAT.smooth });
      const walk = offset(bed, -2.5);
      ribbon(k, walk.concat([walk[0]]), 2.2, ground, 0.34, 'graniteLight', { step: 5, mat: MAT.smooth });
      // plane trees every 9 m along the ring, a bench beside every second one
      const ring = offset(bed, -5);
      let n = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 6; s < len - 3; s += 9) {
          const t = s / len;
          const x = a[0] + (b[0] - a[0]) * t;
          const z = a[1] + (b[1] - a[1]) * t;
          const y = ground(x, z);
          lowTree(k, x, y + 0.2, z, 9 + (n % 3), { spread: 0.5, bole: 0.9, color: 'foliage' });
          if (n % 2 === 0) k.box(1.6, 0.45, 0.5, 'graniteDark', x + 1.4, y + 0.6, z, { mat: MAT.flat });
          n++;
        }
      }
    } catch (e) {
      console.warn('[populo] garden details skipped:', e?.message || e);
    }
  }
  if (!sq && !gd) {
    const zs0 = ZF;
    const zs1 = ZF + 5.4;
    const xr = conv ? bbox(conv.pts).x1 + 0.6 : 12;
    k.box(xr + 12.5, 0.14, zs1 - zs0, 'graniteLight', (xr - 12.5) / 2, -0.02, (zs0 + zs1) / 2, { mat: MAT.smooth });
    if (c) {
      k.box(xr - 11, 0.2, 2.2, 'grass', (xr + 11) / 2, 0.02, ZF + 1.7);
      for (let i = 0; i < 6; i++) {
        const x = 14 + i * ((xr - 18) / 5);
        if (Math.abs(x - c.xm) < 5) continue;
        lowTree(k, x, 0.15, ZF + 1.7, 4.2, { spread: 0.34, bole: 0.35, color: 'foliage' });
      }
    }
  }
  k.end('mask');
  void centroid;
}
populo.metric = true;
populo.rule = {
  extent: [/Convento/, /Largo do Pópulo/, /Campo da Vinha/],
  view: 0.75,
  note: 'church on its outline (main, 26 m towers); convent on its OSM part; Largo do Pópulo paving and the Campo da Vinha garden on their OSM parts; mask = church + convent + square + garden',
};

export default { populo };

// Capela e Casa dos Coimbras, metric builder (1:1 metres).
//
// Frame (fit.js): +z = the south-west front on Largo de São João do Souto
// (238 deg), origin at the centre of the OSM way w223138080 (14 x 36.8 m).
// That way covers two buildings: the Igreja de São João do Souto (the plain
// body with the white azulejo front on the left of coimbras.jpg) and the
// chapel. The chapel is the tower part w1343853590 (6.2 x 7 m, x 4.3..10.5,
// z 11.4..18.4) with the gallery annex w1343853591 (6.3 x 2.9 m) in front
// of it. The Casa dos Coimbras (w146342996, rebuilt 1924) stands east.
// From data/dimensions.json: tower 16 m to the vane, church body 12 m,
// casa 12 m. Read off coimbras.jpg (tower 6.2 m wide, about 80 px/m):
// ashlar tower with a Gothic window over a niche with the Virgin, a
// cornice at 11.7 m, merlons with pinnacles, a tile pyramid roof, an iron
// vane with the armillary sphere; in front a gallery on slender columns
// with iron grilles, the arms in the frieze and a lean-to tile roof;
// twisted-rope mouldings on the corners and arches (coimbras-5.jpg: the
// casa has white walls with framed Manueline windows, tracery in the head).
import * as THREE from 'three';
import { corniceProfile, MAT, pointedPath } from './kit.js';
import { win, cartouche, lobedFrame, flameUrn } from './parts.js';
import { offset } from './geom.js';
import { polyCornice, onEdge, plainBuilding } from './metric.js';
import { edges } from './geom.js';

const G = 'graniteWarm';
const GD = 'graniteDark';
const ZF = 18.4; // the front plane of church and tower
const TX = 7.4; // tower centre x
const TW = 6.2;
const TD = 7.0;
const TZ = ZF - TD / 2;
const CORNICE = 11.6;
const H_TOP = 16;

// Twisted rope along an ellipse arc (a0..a1 radians), facing +z at plane z.
function ropeArc(k, cx, cy, rx, ry, a0, a1, z, size = 0.11, color = G) {
  const n = Math.max(6, Math.round((Math.abs(a1 - a0) * Math.max(rx, ry)) / (size * 1.6)));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const t = Math.atan2(ry * Math.cos(a), -rx * Math.sin(a));
    k.box(size * 2.2, size * 0.9, size * 1.1, color, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry - size * 0.45, z, { rz: t + 0.6, mat: MAT.smooth });
  }
}

function ropeLine(k, x0, y0, x1, y1, z, size = 0.11, color = G) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(len / (size * 1.6)));
  const t = Math.atan2(y1 - y0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    k.box(size * 2.2, size * 0.9, size * 1.1, color, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - size * 0.45, z, { rz: t + 0.6, mat: MAT.smooth });
  }
}

// Vertical rope on a column of radius r at (x, z).
function ropeColumn(k, x, z, y0, y1, r, color = G) {
  const n = Math.round((y1 - y0) / 0.2);
  for (let i = 0; i < n; i++) {
    const a = i * 1.1;
    k.box(0.16, 0.17, 0.1, color, x + Math.cos(a) * r, y0 + i * 0.2, z + Math.sin(a) * r, { ry: -a + Math.PI / 2, rz: 0.5, mat: MAT.smooth });
  }
}

// Church front of São João do Souto: azulejo panel, baroque door, oval
// window, scroll gable with a cross and urns (coimbras.jpg, left half).
function churchFront(k) {
  const xc = 0.7;
  const w = 7.2;
  const WH = 8.6;
  // rendered/tiled face with granite pilasters at the corners
  k.box(w - 0.2, WH, 0.16, 'plaster', xc, 0, ZF + 0.02);
  // tiled panel: near-white glazed tiles (the tile shader would tint it blue), a blue border
  k.box(w - 2.3, 6.3, 0.08, 'white', xc, 1.7, ZF + 0.1, { mat: MAT.smooth });
  k.box(w - 2.1, 0.12, 0.09, 0x6f86b8, xc, 1.6, ZF + 0.105, { mat: MAT.flat });
  for (const s of [-1, 1]) k.box(0.1, 6.3, 0.09, 0x6f86b8, xc + s * (w / 2 - 1.15), 1.7, ZF + 0.105, { mat: MAT.flat });
  for (const s of [-1, 1]) {
    k.box(0.95, WH, 0.5, G, xc + s * (w / 2 - 0.47), -0.5, ZF + 0.08);
    k.box(1.15, 0.5, 0.65, GD, xc + s * (w / 2 - 0.47), -0.3, ZF + 0.1);
  }
  // door: baroque frame with a curved head, green leaves
  k.surround({ x: xc, y: 0.1, w: 1.55, h: 3.2, arch: 'round' }, 0.32, 0.28, G, ZF + 0.08);
  k.box(1.55, 2.9, 0.06, 0x2f4a3a, xc, 0.1, ZF + 0.06, { mat: MAT.smooth });
  k.box(2.6, 0.32, 0.6, G, xc, 3.75, ZF + 0.28); // hood
  k.box(2.1, 0.3, 0.5, G, xc, 4.05, ZF + 0.22);
  k.box(0.6, 0.4, 0.3, G, xc, 4.35, ZF + 0.2);
  k.box(1.9, 0.14, 1.0, GD, xc, -0.06, ZF + 0.5); // step
  // oval window in its lobed frame
  lobedFrame(k, 'oval', 2.1, 0.3, G, xc, 6.4, ZF + 0.12, { open: 0.5, crest: false, pane: 'dark' });
  // main cornice and the shaped gable
  k.cornice(w + 0.6, corniceProfile('classic', 0.55), G, xc, WH - 0.55, ZF);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + 0.2, 0);
  s.lineTo(w / 2 - 0.2, 0);
  s.quadraticCurveTo(w / 2 - 0.1, 0.7, w / 2 - 0.9, 0.85);
  s.quadraticCurveTo(w / 2 - 1.9, 0.95, 1.2, 1.7);
  s.quadraticCurveTo(0.7, 2.4, 0, 2.5);
  s.quadraticCurveTo(-0.7, 2.4, -1.2, 1.7);
  s.quadraticCurveTo(-w / 2 + 1.9, 0.95, -w / 2 + 0.9, 0.85);
  s.quadraticCurveTo(-w / 2 + 0.1, 0.7, -w / 2 + 0.2, 0);
  k.extrude(s, 0.5, G, xc, WH, ZF - 0.05, { curve: 6 });
  k.push({ x: xc, y: WH + 0.1, z: ZF + 0.25, s: 0.9 });
  k.extrude(s, 0.16, 'white', 0, 0, 0, { curve: 6, mat: MAT.smooth });
  k.pop();
  // scroll ends and the cross on a plinth
  for (const sx of [-1, 1]) {
    k.sphere(0.32, G, xc + sx * (w / 2 - 0.55), WH + 1.05, ZF + 0.02, { seg: 7, rings: 4 });
    flameUrn(k, 1.3, G, xc + sx * (w / 2 - 0.55), WH + 1.05, ZF, { seg: 6 });
  }
  k.box(0.8, 0.5, 0.6, G, xc, WH + 2.3, ZF);
  k.box(0.26, 2.0, 0.24, G, xc, WH + 2.8, ZF);
  k.box(1.1, 0.26, 0.24, G, xc, WH + 4.0, ZF);
}

function churchBody(k, O) {
  const WH = 8.6;
  k.prism(O, -1.5, WH + 1.5, 'granite');
  k.prism(offset(O, 0.2), -1.5, 1.6, GD);
  polyCornice(k, O, WH - 0.5, corniceProfile('eave', 0.5), 'granite', { minLen: 3 });
  // roofs: the narrower front nave and the wider body behind (tiles)
  k.gableRoof(7.0, 9.3, 2.2, 'terracotta', 0.7, WH, 13.75, { over: 0.3, overEnd: 0.05, mat: MAT.tile });
  k.gableRoof(13.2, 27.5, 3.2, 'terracotta', 0.2, WH, -4.65, { over: 0.25, overEnd: 0.05, mat: MAT.tile });
  // side windows: round-headed, in the long walls
  for (const e of edges(O)) {
    if (e.len < 6) continue;
    const n = Math.max(1, Math.floor((e.len - 2) / 4.5));
    const p = (e.len - 2) / n;
    onEdge(k, e, 0, 0);
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * p) / 2 + i * p;
      win(k, u, 4.6, 1.1, 2.2, 0, { arch: 'round', bw: 0.25, depth: 0.22, trim: 'graniteLight', pane: 'glass', emit: 0.1 });
    }
    k.pop();
  }
  churchFront(k);
}

// The chapel tower: ashlar body, Gothic window, niche, cornice, merlons,
// pinnacles, tile pyramid, vane. Top exactly at H_TOP.
function tower(k) {
  const x0 = TX - TW / 2;
  const x1 = TX + TW / 2;
  // ashlar body and corner quoins
  k.box(TW, CORNICE + 1, TD, 'granite', TX, -1, TZ);
  for (const sx of [-1, 1]) {
    k.box(0.5, CORNICE, 0.5, 'graniteLight', TX + sx * (TW / 2 - 0.1), 0, ZF - 0.1);
    ropeLine(k, TX + sx * (TW / 2 - 0.02), 5.0, TX + sx * (TW / 2 - 0.02), CORNICE - 0.4, ZF + 0.18, 0.1);
  }
  // string course between the gallery roof and the window stage
  k.box(TW + 0.3, 0.4, 0.4, G, TX, 6.2, ZF + 0.1);
  k.box(0.3, 0.4, TD, G, x1 + 0.1, 6.2, TZ);
  // Gothic window (elliptical head, pointed hood), tracery, rope hood
  const wx = TX;
  const wy = 7.9;
  const ww = 1.7;
  const wh = 2.9;
  const hole = { x: wx, y: wy, w: ww, h: wh, arch: 'pointed' };
  k.surround(hole, 0.32, 0.3, G, ZF);
  const pane = new THREE.Shape();
  pointedPath(pane, wx, wy, ww, wh);
  k.plane(pane, 'glass', 0, 0, ZF + 0.04, { emit: 0.18, mat: MAT.flat });
  const spring = wy + Math.max(0, wh - ww * 0.85);
  ropeArc(k, wx, spring, ww / 2 + 0.36, ww * 0.85 + 0.36, 0, Math.PI, ZF + 0.32, 0.1);
  for (const sx of [-1, 1]) ropeLine(k, wx + sx * (ww / 2 + 0.36), wy, wx + sx * (ww / 2 + 0.36), spring, ZF + 0.32, 0.1);
  // mullions, transom, and a trefoil in the head
  k.box(0.09, wh * 0.72, 0.1, G, wx, wy, ZF + 0.12);
  k.box(ww, 0.09, 0.1, G, wx, wy + wh * 0.5, ZF + 0.12);
  k.box(0.05, wh * 0.72, 0.05, 'iron', wx - ww * 0.25, wy, ZF + 0.08);
  k.box(0.05, wh * 0.72, 0.05, 'iron', wx + ww * 0.25, wy, ZF + 0.08);
  lobedFrame(k, 'quatrefoil', 0.95, 0.16, G, wx, spring + 0.25, ZF + 0.12, { open: 0.42, crest: false, pane: 'dark' });
  // statue niche under the window: the Virgin with the Child
  k.box(1.1, 1.7, 0.3, 'dark', wx, 5.5, ZF + 0.05, { mat: MAT.flat });
  k.statue(1.35, 'graniteLight', wx, 5.55, ZF + 0.2, { pose: 'hold' });
  k.box(1.5, 0.25, 0.5, G, wx, 5.2, ZF + 0.25); // corbel
  k.box(1.3, 0.22, 0.45, G, wx, 7.15, ZF + 0.22); // canopy
  // corner statues on the front corners (coimbras.jpg: on brackets)
  for (const sx of [-1, 1]) {
    k.box(0.5, 0.3, 0.5, G, TX + sx * (TW / 2 + 0.1), 5.6, ZF - 0.1);
    k.statue(1.3, 'graniteLight', TX + sx * (TW / 2 + 0.1), 5.9, ZF - 0.1, { pose: 'hold', ry: sx * 0.3 });
    k.box(0.5, 0.3, 0.5, G, TX + sx * (TW / 2 + 0.1), 8.4, ZF - 0.1);
    k.statue(1.2, 'graniteLight', TX + sx * (TW / 2 + 0.1), 8.7, ZF - 0.1, { pose: 'down', ry: sx * 0.3 });
  }
  // cornice, then the battlement with merlons and pinnacles
  k.corniceRing(TW, TD, corniceProfile('classic', 0.6), G, TX, CORNICE, TZ);
  const yb = CORNICE + 0.6;
  k.crenels(TW - 0.1, TD - 0.1, G, TX, yb, TZ, { mw: 0.85, mh: 0.95, t: 0.55, pointed: true });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = TX + sx * (TW / 2 - 0.1);
    const pz = TZ + sz * (TD / 2 - 0.1);
    k.pinnacle(1.9, G, px, yb, pz);
    k.statue(0.9, 'graniteLight', px, yb + 1.85, pz, { arms: false });
  }
  // tile pyramid roof
  const yr = yb + 0.5;
  k.hipRoof(TW - 1.2, TD - 1.4, 2.0, 'terracotta', TX, yr, TZ, { over: 0.25, mat: MAT.tile });
  for (const s of [-1, 1]) k.box(0.3, 0.5, 0.3, G, TX + s * 0.9, yr + 0.9, TZ);
  // vane: pole, armillary sphere, cross with a sun ring, wind pennant
  const yv = yr + 2.0;
  k.cyl(0.05, 0.06, H_TOP - yv - 0.05, 5, 'iron', TX, yv, TZ);
  for (const a of [0, Math.PI / 2]) k.add(new THREE.TorusGeometry(0.34, 0.03, 4, 12), 'iron', { x: TX, y: yv + 0.5, z: TZ, ry: a });
  k.add(new THREE.TorusGeometry(0.42, 0.025, 4, 16), 'iron', { x: TX, y: H_TOP - 0.55, z: TZ });
  k.box(0.7, 0.05, 0.05, 'iron', TX, H_TOP - 0.55, TZ);
  k.box(0.05, 0.95, 0.05, 'iron', TX, H_TOP - 1.05, TZ);
  k.box(0.6, 0.18, 0.02, 'gold', TX + 0.45, H_TOP - 0.62, TZ);
  k.box(0.05, 0.1, 0.05, 'iron', TX, H_TOP - 0.1, TZ);
  void x0;
}

// The gallery in front of the tower (annex w1343853591, 6.3 x 2.9 m):
// piers, twisted columns, iron grilles, the arms, a lean-to tile roof.
function gallery(k) {
  const gx = 7.35;
  const gw = 6.3;
  const gz0 = ZF;
  const gz1 = ZF + 2.9;
  const H = 3.7;
  const zc = (gz0 + gz1) / 2;
  k.box(gw + 0.3, 0.45, 2.9 + 0.3, GD, gx, -0.2, zc); // plinth
  // corner piers
  for (const sx of [-1, 1]) for (const z of [gz0 + 0.25, gz1 - 0.25]) k.box(0.55, H, 0.5, G, gx + sx * (gw / 2 - 0.3), 0, z);
  // two slender columns in the front plane, ropes winding round them
  for (const sx of [-1, 1]) {
    const cx = gx + sx * 1.05;
    k.cyl(0.19, 0.22, H, 8, G, cx, 0, gz1 - 0.25);
    k.box(0.5, 0.28, 0.5, G, cx, H - 0.28, gz1 - 0.25);
    k.box(0.45, 0.25, 0.45, GD, cx, 0, gz1 - 0.25);
    ropeColumn(k, cx, gz1 - 0.25, 0.4, H - 0.4, 0.2);
  }
  // frieze with foliage, the arms of the Coimbra between two putti
  k.box(gw - 0.2, 0.75, 0.5, G, gx, H, gz1 - 0.25);
  k.box(gw + 0.1, 0.22, 0.75, G, gx, H + 0.75, gz1 - 0.15);
  k.box(gw - 0.9, 0.5, 0.08, 'foliageDark', gx, H + 0.12, gz1 + 0.02, { mat: MAT.smooth });
  cartouche(k, 0.85, 0.85, 0.22, G, gx, H + 0.04, gz1 + 0.05, { scrolls: false });
  // grilles: vertical iron bars between the piers and columns
  const bars = (x0, x1, z, along) => {
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 0.17));
    for (let i = 0; i <= n; i++) {
      const u = x0 + ((x1 - x0) * i) / n;
      if (along === 'x') k.box(0.035, H - 0.9, 0.035, 'iron', u, 0.5, z);
      else k.box(0.035, H - 0.9, 0.035, 'iron', z, 0.5, u);
    }
    if (along === 'x') {
      k.box(Math.abs(x1 - x0), 0.05, 0.05, 'iron', (x0 + x1) / 2, 0.5, z);
      k.box(Math.abs(x1 - x0), 0.05, 0.05, 'iron', (x0 + x1) / 2, H - 0.45, z);
    }
  };
  const fz = gz1 - 0.25;
  bars(gx - gw / 2 + 0.6, gx - 1.25, fz, 'x');
  bars(gx - 0.85, gx + 0.85, fz, 'x');
  bars(gx + 1.25, gx + gw / 2 - 0.6, fz, 'x');
  for (const sx of [-1, 1]) bars(gz0 + 0.5, gz1 - 0.5, gx + sx * (gw / 2 - 0.3), 'z');
  // the lean-to roof from the wall (5.9 m) down to the front eave (4.7 m)
  const s = new THREE.Shape();
  s.moveTo(-3.15, 4.75);
  s.lineTo(0, 5.9);
  s.lineTo(0, 5.55);
  s.lineTo(-3.15, 4.4);
  k.push({ x: gx, z: ZF, ry: Math.PI / 2 });
  k.extrude(s, gw + 0.4, 'terracotta', 0, 0, 0, { mat: MAT.tile });
  k.pop();
  // the recumbent lion on the ridge of the gallery roof
  k.box(0.9, 0.35, 0.35, 'graniteLight', gx, 5.6, zc - 0.2, { mat: MAT.smooth });
  k.sphere(0.2, 'graniteLight', gx + 0.5, 5.85, zc - 0.2, { seg: 5, rings: 3 });
}

// A Manueline window of the casa: round-headed opening, deep framed
// jambs, a rope hood, tracery in the head (coimbras-5.jpg).
function manuelineWin(k, x, y) {
  const w = 1.3;
  const h = 2.1;
  win(k, x, y, w, h, 0, { arch: 'round', bw: 0.34, depth: 0.32, trim: G, pane: 'glass', emit: 0.14, sill: true });
  const cy = y + h - w / 2;
  ropeArc(k, x, cy, w / 2 + 0.44, w / 2 + 0.44, 0, Math.PI, 0.36, 0.13);
  for (const sx of [-1, 1]) ropeLine(k, x + sx * (w / 2 + 0.44), y, x + sx * (w / 2 + 0.44), cy, 0.36, 0.13);
  k.box(w + 1.15, 0.28, 0.4, G, x, y + h + 0.5, 0.2); // lintel with rosettes
  for (let i = -2; i <= 2; i++) k.box(0.14, 0.14, 0.1, G, x + i * 0.3, y + h + 0.6, 0.42, { rz: Math.PI / 4 });
  k.box(0.14, 0.8, 0.3, G, x, y + h + 0.85, 0.15); // pinnacle above
  k.box(w, 0.9, 0.08, G, x, y - 0.95, 0.05, { mat: MAT.smooth }); // sill panel
  // tracery: a quatrefoil in the head over two mullions
  lobedFrame(k, 'quatrefoil', 0.6, 0.12, G, x, cy + 0.02, 0.14, { open: 0.42, crest: false, pane: 'dark' });
  k.box(0.06, h - w / 2, 0.08, 'white', x - 0.22, y, 0.1);
  k.box(0.06, h - w / 2, 0.08, 'white', x + 0.22, y, 0.1);
}

function casa(k, pts) {
  plainBuilding(k, pts, 10, { windows: false, rise: 2.4, wall: 'plaster', trim: 'graniteLight' });
  const E = edges(pts);
  const longest = Math.max(...E.map((e) => e.len));
  for (const e of E) {
    if (e.len < 5) continue;
    const n = Math.max(1, Math.floor((e.len - 1.5) / 4.6));
    const p = (e.len - 1.5) / n;
    onEdge(k, e, 0, 0);
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * p) / 2 + i * p;
      if (e.len === longest && i === Math.floor(n / 2)) {
        // the door: round arch, granite frame
        k.surround({ x: u, y: 0, w: 1.7, h: 3.0, arch: 'round' }, 0.35, 0.3, G, 0);
        k.box(1.7, 2.7, 0.08, 'wood', u, 0, -0.02, { mat: MAT.smooth });
      } else win(k, u, 0.9, 1.2, 1.9, 0, { bw: 0.22, depth: 0.2, trim: 'graniteLight', pane: 'glass', emit: 0.1, bars: true });
      manuelineWin(k, u, 4.1);
      win(k, u, 7.6, 1.1, 1.8, 0, { bw: 0.2, depth: 0.18, trim: 'graniteLight', pane: 'glass', emit: i % 2 ? 0.3 : 0.1 });
    }
    k.pop();
  }
}

function coimbras(k, { footprint }) {
  const O = footprint.outline;
  const casaP = footprint.part(/Casa dos Coimbras/);
  k.begin('mask');
  k.begin('main');
  churchBody(k, O);
  k.end('main');
  k.begin('height');
  tower(k);
  gallery(k);
  k.end('height');
  if (casaP) casa(k, casaP.pts);
  k.end('mask');
}
coimbras.metric = true;
coimbras.rule = {
  extent: [/tower/, /building/],
  view: 0.7,
  note: 'church body on the way outline (main), tower-chapel and gallery on their OSM parts (height group, 16 m), casa on its part; mask = all',
};

export default { coimbras };

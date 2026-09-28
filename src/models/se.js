// Sé de Braga (11th-18th c.), metric builder (1:1 metres).
//
// Local frame (fit.js): +z = the west front (galilee edge normal 258 deg),
// +x = south. The OSM outline (72 x 52 m) holds the three-nave church
// (front x -4.8 .. 15.4, 20 m wide), the transept band with the Capela dos
// Reis on its north side, the chevet, and the cloister on the north side of
// the nave. Separate OSM parts outside it: N.S. da Piedade, São Geraldo,
// São Nicolau, a small turret and the long range north-west of the front;
// each stands on its own polygon.
//
// Heights (data/dimensions.json): towers 29 m (vanes), tower parapet 25 m,
// galilee 10 m, nave ridge 18 m; three naves, six bays, three galilee
// arches. Tower width (7 m) and the stage heights come from the frontal
// photo scaled to the 22 m front.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT, pointedPath } from './kit.js';
import { win, pediment, cartouche, scrollCrest, bell, volute, shell } from './parts.js';
import { bbox, edges, offset, clean, centroid, obb } from './geom.js';
import { polyCornice, onEdge, roofOver, polyWindows } from './metric.js';

const G = 'graniteWarm';
const T = 'granite';
const D = 'graniteDark';

// Keep the part of a polygon where a*x + b*z <= c (Sutherland-Hodgman).
function clip(pts, a, b, c) {
  const out = [];
  const f = (p) => a * p[0] + b * p[1] - c;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const fp = f(p);
    const fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return clean(out);
}

// Sloped roof ring between two polygons with the same vertex count:
// `lo` at height y0 up to `hi` at y1 (cloister galleries, lean-tos).
function ringRoof(k, lo, hi, y0, y1, color) {
  const tri = [];
  const n = lo.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [lo[i][0], y0, lo[i][1]];
    const b = [lo[j][0], y0, lo[j][1]];
    const c = [hi[j][0], y1, hi[j][1]];
    const d = [hi[i][0], y1, hi[i][1]];
    // wind so the face looks up
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    void nx;
    if (ny >= 0) tri.push(a, b, c, a, c, d);
    else tri.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.flat()), 3));
  k.add(g, color, { flat: true });
}

// Points of an arch curve over an opening of width w whose jambs spring
// at `spring`: left springing -> crown -> right springing, radius offset
// by `off` (concentric rings). pointed: two arcs of radius w * pointed.
function arcPts(cx, spring, w, off, pointed, n = 12) {
  const pts = [];
  if (!pointed) {
    const r = w / 2 + off;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI - (i / n) * Math.PI;
      pts.push([cx + Math.cos(a) * r, spring + Math.sin(a) * r]);
    }
    return pts;
  }
  const R = w * pointed;
  const d = R - w / 2; // each arc is centred d beyond the axis, on the far side
  const aTop = Math.acos(d / R); // the crown is at angle PI - aTop from it
  const m = Math.ceil(n / 2);
  for (let i = 0; i <= m; i++) {
    const a = Math.PI - (i / m) * aTop; // left arc, centred at cx + d
    pts.push([cx + d + Math.cos(a) * (R + off), spring + Math.sin(a) * (R + off)]);
  }
  for (let i = m - 1; i >= 0; i--) {
    const a = Math.PI - (i / m) * aTop;
    pts.push([cx - d - Math.cos(a) * (R + off), spring + Math.sin(a) * (R + off)]);
  }
  return pts;
}

// Moulded archivolt: a band of width b round an opening (w, crown height
// h above y0), down the jambs to y0; extruded `depth` toward +z at z.
function archivolt(k, cx, y0, w, h, b, depth, color, z, pointed) {
  const spring = pointed ? y0 + h - Math.sqrt((w * pointed) ** 2 - (w * pointed - w / 2) ** 2) : y0 + h - w / 2;
  const outer = arcPts(cx, spring, w, b, pointed);
  const inner = arcPts(cx, spring, w, 0, pointed).reverse();
  const pts = [[cx - w / 2 - b, y0], ...outer, [cx + w / 2 + b, y0], [cx + w / 2, y0], ...inner, [cx - w / 2, y0]];
  k.extrude(new THREE.Shape(pts.map(([a, c]) => new THREE.Vector2(a, c))), depth, color, 0, 0, z, { mat: MAT.smooth });
  return spring;
}

// Late-Gothic lace under an arch: a thin band hanging from the intrados
// with a scalloped (cusped) lower edge, cusp depth c, from the springing up.
function cuspFringe(k, cx, spring, w, c, depth, color, z, pointed, n = 22) {
  const top = arcPts(cx, spring, w, 0, pointed, n);
  // cusp tips (even points) reach c below the intrados, the valleys between
  // them come back to within c / 4 of it
  const tips = arcPts(cx, spring, w, -c, pointed, n * 2);
  const valleys = arcPts(cx, spring, w, -c * 0.25, pointed, n * 2);
  const low = tips.map((p, i) => (i % 2 === 0 ? p : valleys[i]));
  const pts = [...top, ...low.reverse()];
  k.extrude(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), depth, color, 0, 0, z, { mat: MAT.smooth });
}

// Iron grille across an opening from y0 to y1, with a rail and a cresting
// of spikes and fleurons at the top.
function grille(k, x0, x1, y0, y1, z, pitch = 0.3) {
  const n = Math.max(2, Math.round((x1 - x0) / pitch));
  for (let i = 0; i <= n; i++) k.box(0.05, y1 - y0, 0.05, 'iron', x0 + ((x1 - x0) * i) / n, y0, z);
  k.box(x1 - x0, 0.08, 0.07, 'iron', (x0 + x1) / 2, y0 + 0.9, z);
  k.box(x1 - x0, 0.1, 0.08, 'iron', (x0 + x1) / 2, y1 - 0.1, z);
  for (let i = 0; i <= n; i += 2) {
    const x = x0 + ((x1 - x0) * i) / n;
    k.cone(0.07, 0.45, 4, 'iron', x, y1, z);
    if (i % 4 === 0) k.sphere(0.09, 'iron', x, y1 + 0.2, z, { seg: 4, rings: 2, flat: true });
  }
}

// Gothic pinnacle: square shaft, gablets, crocketed spire (height h).
function gPinnacle(k, h, color, x, y, z, s = 1) {
  const w = 0.5 * s;
  k.box(w, h * 0.35, w, color, x, y, z);
  for (let i = 0; i < 4; i++) k.cone(w * 0.55, h * 0.14, 4, color, x + Math.cos((i * Math.PI) / 2) * w * 0.3, y + h * 0.33, z + Math.sin((i * Math.PI) / 2) * w * 0.3, { sz: 0.4, ry: (i * Math.PI) / 2 });
  k.cone(w * 0.45, h * 0.6, 4, color, x, y + h * 0.35, z);
  for (const t of [0.5, 0.7]) k.box(w * 0.75 * (1.1 - t), h * 0.03, w * 0.75 * (1.1 - t), color, x, y + h * t, z, { ry: Math.PI / 4 });
  k.sphere(w * 0.14, color, x, y + h * 0.97, z, { seg: 4, rings: 2, flat: true });
}

// Pointed lancet window with a moulded surround on a face at z.
function lancet(k, x, y, w, h, z, o = {}) {
  const hh = { x, y, w, h, arch: 'pointed' };
  k.surround(hh, o.bw ?? 0.3, o.depth ?? 0.3, o.trim ?? 'granite', z);
  const s = new THREE.Shape();
  pointedPath(s, x, y, w, h);
  k.plane(s, 'glass', 0, 0, z + 0.04, { emit: o.emit, mat: MAT.flat });
  // mullion and a small tracery disc
  k.box(0.12, h * 0.72, 0.12, o.trim ?? 'granite', x, y, z + 0.1);
  k.cyl(w * 0.16, w * 0.16, 0.12, 8, o.trim ?? 'granite', x, y + h * 0.8 - 0.06, z + 0.1, { rx: Math.PI / 2 });
}

// Manueline twisted-rope moulding along x (length len) at (0, y, z).
function rope(k, len, y, z, color, r = 0.14) {
  const n = Math.max(2, Math.round(len / (r * 2.2)));
  for (let i = 0; i < n; i++) k.box(len / n + 0.02, r * 1.6, r * 1.6, color, -len / 2 + (i + 0.5) * (len / n), y, z, { rx: i % 2 ? 0.55 : -0.55 + Math.PI / 4, mat: MAT.smooth });
}

// Chapel on its OSM polygon: granite walls, cornice, buttresses, roof.
function chapel(k, pts, h, o = {}) {
  const p = clean(pts);
  k.prism(p, -1, h + 1, o.color ?? G);
  polyCornice(k, p, h - 0.5, corniceProfile('band', 0.5), T);
  for (const q of p) k.box(0.9, h, 0.9, T, q[0], 0, q[1]);
  for (const e of edges(p)) {
    if (e.len < 7.5) continue;
    onEdge(k, e, 0, 0);
    win(k, 0, h * 0.35, 1.2, h * 0.35, 0, { arch: 'round', trim: T, bw: 0.3, depth: 0.3, emit: o.emit });
    k.pop();
  }
  const b = bbox(p);
  roofOver(k, p, h, Math.min(3.5, Math.min(b.w, b.d) * 0.3), 'terracotta', 'hip', { over: 0.4 });
}

// One west tower: body, pedimented window, belfry, cornice, balustrade
// parapet, corner pinnacles, the baroque scroll crown with finial and vane.
function tower(k, x, z, w, o) {
  const { hBody, hPar, hTop, bells } = o;
  k.push({ x, z });
  k.box(w, hBody, w, G, 0, 0, 0);
  for (const qx of [1, -1]) k.box(0.5, hBody, 0.2, T, qx * (w / 2 - 0.25), 0, w / 2 + 0.05);
  // upper window: barred, triangular pediment (photo: 15-17.5 m)
  win(k, 0, 14.8, 1.3, 1.9, w / 2, { trim: T, bw: 0.25, depth: 0.2, head: 'tri', bars: true, sill: true });
  // lower window behind the terrace railing: pediment crowned by a pine cone
  win(k, 0, 10.4, 1.3, 1.7, w / 2, { trim: T, bw: 0.25, depth: 0.2, head: 'tri', bars: true });
  k.lathe([[0, 0], [0.22, 0.05], [0.3, 0.3], [0.26, 0.6], [0.12, 0.85], [0, 1]], 7, T, 0, 12.95, w / 2 + 0.3, { sh: 0.75, flat: true, mat: MAT.smooth });
  // belfry: openings through all four faces over a dark core
  const hF = hPar - hBody - 1.6;
  const holes = [];
  for (let i = 0; i < bells; i++) holes.push({ x: bells === 1 ? 0 : (i - 0.5) * 2.4, y: 0.5, w: 1.6, h: hF - 1.2, arch: 'round', pane: null });
  for (const [ry, len] of [[0, w], [Math.PI, w], [Math.PI / 2, w - 1.1], [-Math.PI / 2, w - 1.1]]) {
    k.push({ y: hBody, ry });
    k.wall(len, hF, 0.55, G, holes, 0, 0, w / 2 - 0.28);
    if (ry !== Math.PI) for (const hh of holes) k.surround(hh, 0.2, 0.15, T, w / 2); // back face unseen
    k.pop();
  }
  k.box(w - 1.05, hF, w - 1.05, 'dark', 0, hBody, 0);
  for (const hh of holes) bell(k, 1.6, hh.x, hBody + 1.4, w / 2 - 0.9);
  k.corniceRing(w, w, corniceProfile('classic', 0.6), T, 0, hBody - 0.1, 0);
  const yC = hBody + hF;
  k.corniceRing(w, w, corniceProfile('classic', 0.8), T, 0, yC, 0);
  for (const ry of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    k.push({ y: yC + 0.8, ry });
    // balustrade: plinth, rail, square balusters set diagonally
    const bl = w - 1.4;
    const bh = hPar - yC - 0.8;
    k.box(bl, 0.14, 0.26, T, 0, 0, w / 2 - 0.1);
    k.box(bl + 0.1, 0.16, 0.32, T, 0, bh - 0.16, w / 2 - 0.1);
    const nb = Math.round(bl / 0.42);
    for (let i = 0; i < nb; i++) k.box(0.15, bh - 0.3, 0.15, T, -bl / 2 + (i + 0.5) * (bl / nb), 0.14, w / 2 - 0.1, { ry: Math.PI / 4 });
    k.pop();
  }
  // corner obelisks on pedestals (photo: tall pointed spikes)
  for (const [qx, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = qx * (w / 2 - 0.3);
    const pz = qz * (w / 2 - 0.3);
    k.box(0.7, hPar - yC - 0.6, 0.7, T, px, yC + 0.8, pz);
    k.cone(0.34, 2.3, 4, T, px, hPar + 0.2, pz);
    k.sphere(0.1, T, px, hPar + 2.5, pz, { seg: 4, rings: 2, flat: true });
  }
  // a crowned cartouche rising from the middle of the front and outer
  // parapets (the faces seen from the square)
  for (const ry of [0, x < 0 ? -Math.PI / 2 : Math.PI / 2]) {
    k.push({ ry });
    cartouche(k, 1.2, 1.4, 0.3, 'graniteLight', 0, hPar - 0.6, w / 2 - 0.05, { scrolls: false });
    k.pop();
  }
  // the baroque crown: four S-scrolls rising from the parapet corners to
  // the central obelisk, curled into volutes at the foot
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Shape();
    s.moveTo(0.3, 0);
    s.lineTo(2.35, 0);
    s.quadraticCurveTo(2.5, 1.2, 1.4, 1.35);
    s.quadraticCurveTo(0.7, 1.5, 0.55, 2.7);
    s.lineTo(0.2, 2.7);
    s.quadraticCurveTo(0.3, 1.3, 1.25, 1.0);
    s.quadraticCurveTo(1.9, 0.8, 1.75, 0.35);
    s.lineTo(0.3, 0.35);
    s.closePath();
    k.push({ y: hPar, ry: Math.PI / 4 + (i * Math.PI) / 2, sy: 0.7 });
    k.extrude(s, 0.4, T, 0, 0, 0, { curve: 4, mat: MAT.smooth });
    k.pop();
    k.push({ y: hPar, ry: Math.PI / 4 + (i * Math.PI) / 2 });
    volute(k, 0.3, 0.5, T, 2.2, 0.3, 0, { dir: 1, turns: 1.3 });
    k.pop();
  }
  const yF = hPar + 1.7;
  k.box(0.9, 0.45, 0.9, T, 0, yF, 0);
  k.sphere(0.3, T, 0, yF + 0.72, 0, { seg: 8, rings: 5 });
  k.cone(0.26, hTop - 0.4 - (yF + 0.95), 4, T, 0, yF + 0.95, 0); // obelisk spire
  k.box(0.06, 0.45, 0.06, 'iron', 0, hTop - 0.45, 0);
  k.box(0.8, 0.3, 0.04, 'rust', 0.32, hTop - 0.35, 0);
  k.pop();
}

function seBraga(k, { footprint, dims }) {
  const H = dims?.height_m || {};
  const hTop = H.towers ?? 29;
  const hPar = H.tower_parapet ?? 25;
  const hGal = H.galilee ?? 10;
  const hRidge = H.nave_ridge ?? 18;
  const out = footprint.outline;
  const zF = footprint.box.z1; // 34.7, the galilee front
  const xL = -4.8;
  const xR = 15.4;
  const cx = (xL + xR) / 2; // church axis
  const W = xR - xL;
  const TW = 7;
  const zGal = zF - 5.7; // back of the galilee = the west wall
  const zT = zGal - TW / 2; // tower centres
  const hBody = 19.3;

  k.begin('main');
  // --- plinth on the whole outline (the ground falls a little to the west)
  k.prism(offset(out, 0.3), -1.2, 1.5, T);

  // --- nave (9.2 m) and aisles behind the west towers
  const zN0 = 5.7;
  const zN1 = zGal - TW;
  const nw = 9.2;
  const nEaves = hRidge - 3.8;
  k.box(nw, nEaves, zGal - zN0, G, cx, 0, (zGal + zN0) / 2);
  k.gableRoof(nw, zN1 - zN0 + 0.4, hRidge - nEaves, 'terracotta', cx, nEaves, (zN1 + zN0) / 2, { over: 0.4 });
  k.corniceRing(nw, zN1 - zN0, corniceProfile('band', 0.5), T, cx, nEaves - 0.5, (zN1 + zN0) / 2);
  const aEaves = 9;
  for (const sx of [-1, 1]) {
    const ax = sx < 0 ? (-5.4 + cx - nw / 2) / 2 : (15.2 + cx + nw / 2) / 2;
    const aw = sx < 0 ? cx - nw / 2 + 5.4 : 15.2 - cx - nw / 2;
    k.box(aw, aEaves, zN1 - zN0, G, ax, 0, (zN1 + zN0) / 2);
    // lean-to roof against the clerestory
    k.push({ x: ax, y: aEaves, z: (zN1 + zN0) / 2, rz: sx * 0.26 });
    k.box(aw + 1, 0.4, zN1 - zN0 + 0.6, 'terracotta', sx * 0.2, 0.2, 0, { mat: MAT.tile });
    k.pop();
    // aisle windows between buttresses; clerestory windows above
    const n = 4;
    for (let i = 0; i < n; i++) {
      const z = zN0 + 2 + (i + 0.5) * ((zN1 - zN0 - 2) / n);
      const xw = sx < 0 ? -5.4 : 15.2;
      // (the north aisle wall is hidden by the cloister: no windows there)
      if (sx > 0) {
        k.push({ x: xw, z, ry: sx * Math.PI / 2 });
        win(k, 0, 3.2, 1.1, 2.8, 0, { arch: 'round', trim: T, bw: 0.25, depth: 0.25 });
        k.box(0.9, aEaves, 0.7, T, 1.9, 0, 0.35);
        k.pop();
      }
      k.push({ x: cx + sx * nw / 2, z, ry: sx * Math.PI / 2 });
      win(k, 0, aEaves + 1.6, 0.9, 2.2, 0, { arch: 'round', trim: T, bw: 0.22, depth: 0.2 });
      k.pop();
    }
  }

  // --- west towers and the centre between them
  tower(k, xL + TW / 2, zT, TW, { hBody, hPar, hTop, bells: 2 });
  tower(k, xR - TW / 2, zT, TW, { hBody, hPar, hTop, bells: 1 });
  const cw = W - 2 * TW;
  const holes = [
    { x: -1.5, y: 10.4, w: 1.4, h: 3.1, pane: 'dark' },
    { x: 1.5, y: 10.4, w: 1.4, h: 3.1, pane: 'dark' },
  ];
  k.push({ x: cx });
  k.wall(cw, hBody, 1.2, G, holes, 0, 0, zGal - 0.6, { inset: 0.8 });
  for (const hh of holes) {
    k.surround(hh, 0.25, 0.2, T, zGal);
    // iron window grid
    for (let i = 1; i < 4; i++) k.box(0.05, hh.h, 0.05, 'iron', hh.x - hh.w / 2 + (hh.w * i) / 4, hh.y, zGal - 0.6);
    for (let i = 1; i < 6; i++) k.box(hh.w, 0.05, 0.05, 'iron', hh.x, hh.y + (hh.h * i) / 6, zGal - 0.6);
    const s = new THREE.Shape();
    s.moveTo(-1.1, 0);
    s.lineTo(1.1, 0);
    s.quadraticCurveTo(1.1, 0.8, 0, 0.8);
    s.quadraticCurveTo(-1.1, 0.8, -1.1, 0);
    k.extrude(s, 0.35, T, hh.x, hh.y + hh.h + 0.35, zGal + 0.15);
  }
  // the arms of the archbishop: a large crowned cartouche with a shell
  cartouche(k, 2.6, 3.2, 0.45, 'graniteLight', 0, 14.6, zGal + 0.1);
  shell(k, 0.5, 0.25, 'graniteLight', 0, 17.9, zGal + 0.15);
  // niche gable with Our Lady and the double archiepiscopal cross
  k.box(cw - 1.8, 4, 1.4, G, 0, hBody, zGal - 1);
  k.wall(cw - 1.8, 3.6, 0.4, G, [{ x: 0, y: 0.5, w: 1.2, h: 2.4, arch: 'round', pane: 'dark', inset: 0.3 }], 0, hBody, zGal - 0.1);
  k.surround({ x: 0, y: hBody + 0.5, w: 1.2, h: 2.4, arch: 'round' }, 0.2, 0.2, 'graniteLight', zGal + 0.1);
  shell(k, 0.4, 0.2, 'graniteLight', 0, hBody + 2.35, zGal - 0.1);
  for (const s of [-1, 1]) k.box(0.45, 3.6, 0.3, T, s * ((cw - 1.8) / 2 - 0.25), hBody, zGal + 0.2); // pilasters
  k.statue(1.6, 'graniteLight', 0, hBody + 0.6, zGal - 0.2, { pose: 'hold' });
  scrollCrest(k, cw - 1, 1.9, 0.5, T, 0, hBody + 3.8, zGal - 0.6);
  for (const s of [-1, 1]) volute(k, 0.4, 0.45, T, s * ((cw - 1) / 2 - 0.2), hBody + 4.4, zGal - 0.4, { dir: -s, turns: 1.4 });
  k.sphere(0.45, T, 0, hBody + 5.7, zGal - 0.6, { seg: 8, rings: 5 });
  k.box(0.2, 2.9, 0.2, 'iron', 0, hBody + 6.1, zGal - 0.6);
  k.box(1.4, 0.18, 0.18, 'iron', 0, hBody + 7.8, zGal - 0.6);
  k.box(1, 0.18, 0.18, 'iron', 0, hBody + 8.4, zGal - 0.6);
  k.pop();

  // --- galilee porch (1486-1501, photo assets/img/se-braga.jpg): three
  // slightly pointed arches, the centre one wider and taller, each under a
  // stepped archivolt with the late-Gothic lace of cusps on its intrados;
  // buttress piers with polychrome statues in niches under pinnacled
  // canopies (one more over the centre arch), stone balustrades and iron
  // grilles with a cresting in the arches, the iron railing of the terrace
  k.push({ x: cx, z: (zF + zGal) / 2 });
  const gd = zF - zGal;
  const PT = 0.62; // arch radius / span: a gently pointed arch
  const ops = [{ x: -6.5, w: 3.9, h: 6.6, pointed: true }, { x: 0, w: 5.8, h: 7.6, pointed: true }, { x: 6.5, w: 3.9, h: 6.6, pointed: true }];
  const zg = gd / 2; // the galilee front face
  {
    // the porch front: a wall with the three arched openings cut to the
    // outline of the outer archivolt order
    const pts = [[-W / 2, 0]];
    for (const o of ops) {
      const w = o.w + 1.3;
      const h = o.h + 0.65;
      const spring = h - Math.sqrt((w * PT) ** 2 - (w * PT - w / 2) ** 2);
      pts.push([o.x - w / 2, 0], ...arcPts(o.x, spring, w, 0, PT), [o.x + w / 2, 0]);
    }
    pts.push([W / 2, 0], [W / 2, hGal - 0.6], [-W / 2, hGal - 0.6]);
    k.extrude(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), 0.9, T, 0, 0, zg - 0.45);
  }
  for (const o of ops) {
    // three receding orders of the archivolt, the lace under the inner one
    archivolt(k, o.x, 0, o.w + 1.3, o.h + 0.65, 0.18, 0.25, T, zg + 0.1, PT);
    archivolt(k, o.x, 0, o.w + 0.8, o.h + 0.4, 0.25, 0.3, 'graniteLight', zg - 0.2, PT);
    const sp = archivolt(k, o.x, 0, o.w, o.h, 0.4, 0.5, T, zg - 0.55, PT);
    cuspFringe(k, o.x, sp, o.w, 0.34, 0.12, 'graniteLight', zg - 0.62, PT);
    // capitals of the jamb shafts
    for (const s of [-1, 1]) k.box(0.5, 0.25, 0.9, 'graniteLight', o.x + s * (o.w / 2 + 0.35), sp - 0.25, zg - 0.3);
  }
  for (const sx of [-1, 1]) k.box(0.8, hGal - 0.6, gd, T, sx * (W / 2 - 0.4), 0, 0);
  k.box(W - 1, hGal - 0.6, 0.6, T, 0, 0, -zg + 0.3); // back of the porch
  k.box(W + 0.3, 0.6, gd + 0.3, T, 0, hGal - 0.6, 0);
  k.cornice(W + 0.6, corniceProfile('classic', 0.4), T, 0, hGal - 0.6, zg + 0.1);
  k.box(W - 1, 0.1, gd - 1, 'graniteLight', 0, 0.05, 0, { mat: MAT.smooth });
  // the terrace railing: iron bars between two rails
  for (let i = 0; i <= 66; i++) k.box(0.04, 1, 0.04, 'iron', -(W - 0.4) / 2 + (i * (W - 0.4)) / 66, hGal, zg - 0.1);
  for (const y of [hGal + 0.1, hGal + 0.95]) k.box(W - 0.4, 0.07, 0.07, 'iron', 0, y, zg - 0.1);
  // buttress piers: statue niches with canopies, pinnacles over the parapet
  const piers = [[-9.6, 1.1], [-3.6, 1.3], [3.6, 1.3], [9.6, 1.1]];
  for (const [bx, bw] of piers) {
    k.box(bw, hGal - 0.6, 1.3, T, bx, 0, zg + 0.35);
    k.box(bw + 0.2, 0.5, 1.5, T, bx, 0, zg + 0.35); // plinth
    k.box(bw - 0.4, 2.1, 0.2, 'dark', bx, 5.3, zg + 0.92);
    k.box(0.8, 0.3, 0.7, 'graniteLight', bx, 5.0, zg + 1.2);
    k.statue(1.6, 'rose', bx, 5.3, zg + 1.2, { pose: ['pray', 'hold', 'down', 'raise'][Math.round(bx + 10) % 4] });
    k.frustum(bw, 1.0, 0.2, 0.3, 0.9, 'graniteLight', bx, 7.4, zg + 1.05); // canopy
    gPinnacle(k, 1.4, 'graniteLight', bx, 8.2, zg + 1.05, 0.9);
    gPinnacle(k, 2.2, T, bx, hGal, zg + 0.35, 1.2);
  }
  // a statue on a corbel over the crown of the centre arch
  k.box(0.9, 0.3, 0.6, 'graniteLight', 0, 8.6, zg + 0.35);
  k.statue(1.2, 'rose', 0, 8.9, zg + 0.35, { pose: 'pray' });
  // balustrades and grilles in the side arches; grille and gate in the centre
  for (const o of [ops[0], ops[2]]) {
    k.balustrade(o.w - 0.1, 0.9, T, o.x, 0, zg - 0.5, { cheap: true, d: 0.2, sp: 0.28 });
    grille(k, o.x - o.w / 2 + 0.1, o.x + o.w / 2 - 0.1, 0.9, 4.9, zg - 0.5);
  }
  for (const s of [-1, 1]) {
    k.balustrade(1.3, 0.9, T, s * 2.2, 0, zg - 0.5, { cheap: true, d: 0.2, sp: 0.28 });
    grille(k, s > 0 ? 1.55 : -2.85, s > 0 ? 2.85 : -1.55, 0.9, 4.9, zg - 0.5);
  }
  grille(k, -1.5, 1.5, 4.2, 5.2, zg - 0.5, 0.25); // cresting over the gate
  // the west portal inside: round-headed door under a Gothic canopy
  k.wall(4.2, 6.6, 0.3, T, [{ x: 0, y: 0.01, w: 2.3, h: 4.3, arch: 'round', pane: 'wood', inset: 0.2 }], 0, 0, -zg + 0.75);
  archivolt(k, 0, 0, 2.3, 4.3, 0.3, 0.3, 'graniteLight', -zg + 1.0, 0);
  k.frustum(2.6, 0.5, 0.2, 0.2, 1.2, 'graniteLight', 0, 4.8, -zg + 1.0);
  k.pop();

  // --- transept band (north arm shortened by the Capela dos Reis)
  const zT0 = -15.6;
  let band = clip(out, 0, 1, zN0); // z <= 5.7
  band = clip(band, 0, -1, -zT0); // z >= -15.6
  band = clip(band, -1, 0, 6.2); // x >= -6.2
  const tEaves = 13;
  k.prism(band, 0, tEaves, G);
  polyCornice(k, band, tEaves - 0.5, corniceProfile('band', 0.5), T);
  roofOver(k, band, tEaves, 4, 'terracotta', 'gable', { angle: 0, over: 0.4 });
  polyWindows(k, band, { only: (e) => e.len > 8 && Math.abs(e.nz) < 0.3, storeys: [5.5], bay: 6, margin: 4, w: 1.2, h: 3.4, win: { arch: 'round', trim: T, bw: 0.3, depth: 0.3 } });
  // south transept front: a big rose window
  k.cyl(1.6, 1.6, 0.4, 16, T, band.reduce((m, p) => Math.max(m, p[0]), -99) + 0.2, 8.5, -5, { rz: Math.PI / 2, smooth: true });
  // Capela dos Reis (Gothic, 14th c.) on its polygon, taller, buttressed
  const reis = footprint.part(/Reis/);
  if (reis) {
    // Gothic walls, stepped corner buttresses with pinnacles, tall pointed
    // lancets, a carved cresting on the cornice, a steep gable roof with
    // stone gable ends, coped, a cross on each apex
    const p = clean(reis.pts);
    k.prism(p, 0, 15, G);
    polyCornice(k, p, 14.5, corniceProfile('band', 0.5), T);
    for (const q of p) {
      k.box(1.5, 7.5, 1.5, T, q[0], 0, q[1]);
      k.frustum(1.5, 1.5, 1.1, 1.1, 0.6, T, q[0], 7.5, q[1]);
      k.box(1.1, 7, 1.1, T, q[0], 8.1, q[1]);
      gPinnacle(k, 3.2, T, q[0], 15, q[1], 1.6);
    }
    for (const e of edges(p)) {
      onEdge(k, e, 0, 0);
      if (e.len >= 6) lancet(k, 0, 4, 1.9, 7.5, 0, { trim: T, bw: 0.35, depth: 0.35, emit: 0.2 });
      // cresting: a row of small fleurons along the parapet
      const n = Math.floor(e.len / 0.9);
      for (let i = 1; i < n; i++) k.cone(0.16, 0.6, 4, T, -e.len / 2 + (i * e.len) / n, 15, 0.1);
      k.pop();
    }
    const b = obb(p);
    const rise = Math.min(b.W * 0.45, 5);
    roofOver(k, p, 15, rise, 'terracotta', 'gable', { over: 0.3 });
    k.push({ x: b.cx, y: 15, z: b.cz, ry: b.a });
    for (const s of [-1, 1]) {
      k.push({ x: s * (b.L / 2 + 0.1), ry: Math.PI / 2 });
      const tri = new THREE.Shape([new THREE.Vector2(-b.W / 2 - 0.2, 0), new THREE.Vector2(b.W / 2 + 0.2, 0), new THREE.Vector2(0, rise + 0.5)]);
      k.extrude(tri, 0.6, G, 0, 0, 0);
      for (const t of [-1, 1]) k.segment([t * (b.W / 2 + 0.3), 0.3, 0], [0, rise + 0.8, 0], 0.8, 0.3, T);
      k.box(0.2, 1.4, 0.2, T, 0, rise + 0.8, 0);
      k.box(0.8, 0.2, 0.2, T, 0, rise + 1.7, 0);
      k.pop();
    }
    k.pop();
  }

  // --- chevet: side chapels round the Manueline capela-mor
  let chev = clip(out, 0, 1, zT0);
  chev = chev.length > 2 ? chev : [];
  if (chev.length) {
    k.prism(chev, 0, 10, G);
    polyCornice(k, chev, 9.5, corniceProfile('band', 0.45), T);
    roofOver(k, chev, 10, 3, 'terracotta', 'hip', { over: 0.4 });
    // capela-mor on the axis: tall walls, Manueline pinnacles, big windows
    const cb = bbox(chev);
    const cm = [[cx - 5, zT0], [cx + 5, zT0], [cx + 5, cb.z0 + 1.5], [cx - 5, cb.z0 + 1.5]];
    k.prism(cm, 0, 15, G);
    k.gableRoof(10, zT0 - cb.z0 - 1.5, 3.2, 'terracotta', cx, 15, (zT0 + cb.z0 + 1.5) / 2, { over: 0.4 });
    // Manueline (João de Castilho, c. 1509): twisted-rope buttresses with
    // crocketed pinnacles, a rope moulding and a carved cresting round the
    // top, pointed windows in rope-moulded frames
    for (const q of cm) {
      // a twisted shaft: square drums turning a little each course
      k.box(1.5, 1.2, 1.5, T, q[0], 0, q[1]);
      for (let i = 0; i < 14; i++) k.box(1.1, 1.03, 1.1, 'graniteLight', q[0], 1.2 + i * 1.02, q[1], { ry: i * 0.4, mat: MAT.smooth });
      gPinnacle(k, 4, T, q[0], 15.5, q[1], 1.8);
    }
    for (const e of edges(cm)) {
      if (e.nz > 0.5) continue; // the west side meets the transept
      onEdge(k, e, 0, 0);
      rope(k, e.len - 1.2, 13.6, 0.12, 'graniteLight', 0.24);
      const n = Math.floor(e.len / 0.8);
      for (let i = 1; i < n; i++) {
        const u = -e.len / 2 + (i * e.len) / n;
        k.cone(i % 2 ? 0.14 : 0.2, i % 2 ? 0.5 : 0.8, 4, 'graniteLight', u, 15, 0.1);
      }
      k.pop();
    }
    for (const sx of [-1, 1]) {
      k.push({ x: cx + sx * 5, z: (zT0 + cb.z0) / 2, ry: sx * Math.PI / 2 });
      lancet(k, 0, 10.2, 1.6, 3.2, 0, { trim: 'graniteLight', bw: 0.3, depth: 0.3, emit: 0.2 });
      k.pop();
    }
    // two absidioles on the east face
    for (const dx of [-7.5, 7.5]) k.cyl(2.4, 2.4, 7.5, 10, G, cx + dx, 0, cb.z0 + 1.6, { t0: Math.PI / 2, tl: Math.PI });
  }

  // --- cloister on the north side of the nave: galleries round the garden
  let reg = clip(out, 1, 0, -5.4); // x <= -5.4
  reg = clip(reg, 0, -1, -5.4); // z >= 5.4
  const gpart = footprint.part('garden');
  if (gpart && reg.length > 2) {
    const gd0 = clean(gpart.pts);
    const galO = offset(gd0, 2.6);
    k.prism(reg, 0, 7, G, { holes: [galO] });
    k.prism(reg, 7, 0.4, 'terracotta', { holes: [galO], mat: MAT.tile });
    ringRoof(k, offset(gd0, -0.2), offset(gd0, 2.7), 4.6, 6.6, 'terracotta');
    for (const e of edges(gd0)) {
      onEdge(k, e, 0, 0.25);
      const n = Math.max(3, Math.round(e.len / 3));
      k.arcade(e.len, 4.6, 0.5, n, 2, 3.4, 'graniteLight', 0, 0, 0);
      // paired colonnettes with capitals against each pier
      for (let i = 1; i < n; i++) {
        const u = -e.len / 2 + (i * e.len) / n;
        for (const du of [-0.2, 0.2]) k.cyl(0.13, 0.15, 2.3, 6, 'granite', u + du, 0.3, 0.35);
        k.box(0.8, 0.25, 0.45, 'granite', u, 2.6, 0.35);
        k.box(0.8, 0.3, 0.45, 'granite', u, 0, 0.35);
      }
      k.pop();
    }
    k.prism(gd0, 0, 0.25, 'grass');
    const [gx, gz] = centroid(gd0);
    k.cyl(1.6, 1.8, 0.7, 12, T, gx, 0.25, gz);
    k.cyl(1.4, 1.4, 0.1, 12, 'water', gx, 0.85, gz);
    k.marker('fountain', gx, 0.95, gz, { kind: 'basin', name: 'cloister', r: 1.4 });
    k.lathe(PROFILES.urn, 8, T, gx, 0.9, gz, { sr: 1.2, sh: 1.6, smooth: true });
    for (const [dx, dz] of [[-4, -3], [4, 3]]) k.tree(gx + dx, 0.25, gz + dz, 6, { kind: 'cypress' });
  }
  k.end('main');

  // --- chapels and ranges on their own OSM parts, outside the outline
  const piedade = footprint.part(/Piedade/);
  if (piedade) chapel(k, piedade.pts, 7);
  const geraldo = footprint.part(/Geraldo/);
  if (geraldo) chapel(k, geraldo.pts, 11, { emit: 0.15 });
  const nicolau = footprint.part(/Nicolau/);
  if (nicolau) chapel(k, nicolau.pts, 10);
  const turret = footprint.part('tower');
  if (turret) {
    const p = clean(turret.pts);
    const [tx, tz] = centroid(p);
    k.prism(p, -1, 13, G);
    polyCornice(k, p, 11.6, corniceProfile('classic', 0.4), T);
    k.cone(2.6, 3, 4, 'terracotta', tx, 12, tz);
    k.lathe(PROFILES.finial, 6, T, tx, 15, tz, { sr: 0.4, sh: 1, flat: true });
  }
  // the long range north-west of the front (unnamed OSM church part)
  const range = footprint.parts.find((p) => p.tag === 'church' && !p.name && p.pts.length > 8);
  if (range) {
    const p = clean(range.pts);
    k.prism(p, -1, 11, 'plaster');
    k.prism(offset(p, 0.15), -1, 2, T);
    polyCornice(k, p, 9.5, corniceProfile('eave', 0.5), T);
    polyWindows(k, p, { storeys: [1.4, 5.2], bay: 6, w: 1.1, h: 2, win: { trim: T, bw: 0.25, depth: 0.2 } });
    k.prism(offset(p, 0.4), 10, 0.35, 'terracotta', { mat: MAT.tile });
    k.prism(offset(p, -3), 10.3, 1.6, 'terracotta', { mat: MAT.tile });
  }
}
seBraga.metric = true;
seBraga.rule = {
  extent: [/church/, /tower/],
  note: 'west front snapped to the galilee edge (258 deg); chapels and the NW range stand on their own OSM parts outside the outline',
};

export default { 'se-braga': seBraga };

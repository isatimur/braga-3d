// Museu Nogueira da Silva (house of the benefactor Nogueira da Silva, 1950s-
// 60s, architect Raul Rodrigues Lima), metric builder (1:1 metres).
//
// Frame (fit.js): +z = the south front on Avenida Central (178 deg), origin
// at the centre of the house outline (OSM synth part, 24.2 x 34.7 m). The
// French-style garden (OSM w952323813, 113 x 39 m) lies behind, on local -z.
// From data/dimensions.json (about 13 m) and nogueira-silva*.jpg: a white
// rendered front on a granite ground floor, four storeys of granite-framed
// windows with brown wooden shutters, a continuous iron balcony over the
// ground floor, three carved rosettes on the upper wall, a moulded main
// cornice under a roof-top iron railing with granite end pinnacles, and a
// set-back attic. Behind: a granite loggia and terrace over the garden,
// steps down to box parterres round a fountain, statues on pedestals along
// the west wall, a pergola and a tiled pavilion, cypresses and lawns.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win } from './parts.js';
import { bbox, edges, inside, offset } from './geom.js';
import { polyCornice } from './metric.js';
import { drapePoly, ribbon, lowTree } from './drape.js';

const T = 'granite';
const TD = 'graniteDark';
const W = 'plaster';
const HC = 12.2; // main cornice
const HTOP = 14; // rail of the attic

// carved rosette on the wall face z
function rosette(k, x, y, z) {
  k.add(new THREE.TorusGeometry(0.78, 0.12, 4, 16), 'graniteLight', { x, y, z: z + 0.1 });
  k.add(new THREE.TorusGeometry(0.5, 0.09, 4, 12), 'graniteLight', { x, y, z: z + 0.12 });
  k.add(new THREE.CircleGeometry(0.4, 10), 'graniteGrey', { x, y, z: z + 0.06 });
  k.sphere(0.15, 'graniteLight', x, y, z + 0.14, { seg: 6, rings: 4 });
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    k.sphere(0.13, 'graniteLight', x + Math.cos(a) * 0.86, y + Math.sin(a) * 0.86, z + 0.1, { seg: 5, rings: 3 });
  }
}

function front(k, O) {
  const b = bbox(O);
  const ZF = b.z1;
  const X0 = -8.9;
  const X1 = 12.1;
  const cx = (X0 + X1) / 2;
  const pitch = 2.5;
  const xc = (i) => cx + (i - 3.5) * pitch;
  // granite ground floor and plinth
  k.prism(offset(O, 0.12), -1.5, 4.5, TD);
  k.prism(offset(O, 0.1), 2.9, 0.35, T);
  // ground floor (0..3): doors and barred windows in granite frames
  for (let i = 0; i < 8; i++) {
    const x = xc(i);
    if (i === 1 || i === 5) {
      k.surround({ x, y: 0, w: 1.5, h: 2.4 }, 0.22, 0.2, T, ZF);
      k.box(1.5, 2.4, 0.1, 'wood', x, 0, ZF - 0.02);
    } else win(k, x, 0.9, 1.3, 1.6, ZF, { bw: 0.2, depth: 0.18, trim: T, pane: i % 3 === 0 ? 'white' : 'glass', bars: true, emit: 0.05 });
  }
  // continuous first-floor balcony
  k.box(X1 - X0 + 0.6, 0.3, 1.1, T, cx, 3.0, ZF + 0.45);
  k.balustrade(X1 - X0 + 0.4, 1.0, 'iron', cx, 3.3, ZF + 0.85, { cheap: true, d: 0.09, sp: 0.22 });
  // first floor (3.3..6.3): tall shuttered windows
  for (let i = 0; i < 8; i++) win(k, xc(i), 3.6, 1.25, 2.5, ZF, { bw: 0.2, depth: 0.2, trim: T, pane: 'wood', head: 'flat' });
  // string course under the second floor
  k.box(X1 - X0 + 0.3, 0.3, 0.35, T, cx, 6.35, ZF + 0.12);
  // second floor: windows at the left, three rosettes on the right
  for (const i of [0, 1, 2, 4, 6]) if (i < 3) win(k, xc(i), 7.0, 1.2, 2.0, ZF, { bw: 0.2, depth: 0.2, trim: T, pane: 'wood', head: 'flat' });
  for (const i of [3.5, 5.0, 6.5]) rosette(k, cx + (i - 3.5) * pitch, 7.6, ZF);
  // granite pilaster strips between the bays
  for (const x of [xc(2.5), xc(4.5), xc(6.5)]) k.box(0.35, HC - 3.3, 0.15, T, x, 3.3, ZF + 0.08);
  // third floor: shuttered windows under the cornice
  for (let i = 0; i < 8; i++) win(k, xc(i), 9.35, 1.15, 1.8, ZF, { bw: 0.18, depth: 0.18, trim: T, pane: 'wood', head: 'flat' });
  // main cornice and the roof-top railing with pinnacles
  k.cornice(X1 - X0 + 1.4, corniceProfile('classic', 0.7), T, cx, 11.5, ZF - 0.1);
  k.balustrade(X1 - X0 - 0.4, 1.0, 'iron', cx, HC, ZF - 0.4, { cheap: true, d: 0.09, sp: 0.22 });
  for (const x of [X0 + 0.3, X1 - 0.3]) {
    k.box(0.7, 1.1, 0.7, T, x, HC, ZF - 0.4);
    k.cone(0.3, 0.7, 4, T, x, HC + 1.1, ZF - 0.4);
  }
  // set-back attic
  k.box(17, 0.9, 9, W, cx, HC, ZF - 5.5);
  k.balustrade(16.6, 0.9, 'iron', cx, HC + 0.9, ZF - 1.3, { cheap: true, d: 0.08, sp: 0.22 });
  k.box(1.3, 1.5, 0.4, W, xc(1), HC, ZF - 1.0);
  win(k, xc(1), HC + 0.1, 0.9, 0.7, ZF - 0.7, { bw: 0.1, depth: 0.1, trim: T, pane: 'glass', emit: 0.1 });
  // service tank/lift head on the terrace
  k.box(3, 1.6, 3, W, cx - 3, HC, ZF - 12);
}

function sidesAndBack(k, O, ZF) {
  const rnd = k.rnd;
  for (const e of edges(O)) {
    if (e.len < 6 || e.nz > 0.7) continue;
    const n = Math.floor((e.len - 2) / 3.3);
    const p = (e.len - 2) / n;
    k.push({ x: e.mx + e.nx * 0.02, z: e.mz + e.nz * 0.02, ry: e.ry });
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * p) / 2 + i * p;
      if (e.nz < -0.7 && Math.abs(u) < 7.5) continue; // the loggia stands here
      for (const y of [4.0, 7.2, 9.6]) win(k, u, y, 1.2, y > 9 ? 1.6 : 2.0, 0, { bw: 0.18, depth: 0.16, trim: T, pane: 'glass', emit: rnd() > 0.7 ? 0.35 : 0.08 });
      win(k, u, 0.9, 1.2, 1.5, 0, { bw: 0.18, depth: 0.16, trim: T, pane: 'glass', bars: true });
    }
    k.pop();
  }
  polyCornice(k, O, 11.4, corniceProfile('classic', 0.55), T, { minLen: 4 });
  void ZF;
}

// loggia and terrace on the garden side (local -z)
function loggia(k, zb, xc) {
  const D = 4.2; // depth
  const Wd = 15;
  const y1 = 5.0; // terrace floor over the arcade
  // arcade: piers and round arches, seen from the garden
  k.push({ x: xc, z: zb - D });
  k.push({ ry: Math.PI });
  // wall pieces are drawn facing +z then turned to face the garden
  k.arcade(Wd, y1, 0.7, 5, 2.4, 3.8, T, 0, 0, -D / 2 + 0.35, { mat: MAT.ashlar, curve: 6 });
  k.pop();
  // back wall of the loggia, floor and terrace slab
  k.box(Wd, 0.3, D, 'sand', 0, y1 - 0.1, D / 2, { mat: MAT.smooth });
  k.box(Wd, 3.6, 0.15, 'dark', 0, 0.2, D - 0.1);
  for (let i = 0; i < 3; i++) k.box(1.6, 3.4, 0.08, 'wood', (i - 1) * 4.5, 0, D - 0.16);
  k.pop();
  // terrace parapet in front of the upper floor
  const zt = zb - D;
  k.balustrade(Wd + 0.8, 1.0, T, xc, y1 + 0.2, zt - 0.15, { ry: Math.PI, cheap: false, d: 0.3, sp: 0.42, posts: 5 });
  // steps down to the garden
  k.stairs(9, 3.2, 0.9, 6, T, xc, 0, zt - 0.3, { ry: Math.PI, below: 0.3 });
}

function garden(k, gp, ground, xa) {
  const rnd = k.rnd;
  const ins = (x, z) => inside(gp, x, z);
  const gb = bbox(gp);
  // lawn over the whole OSM garden
  drapePoly(k, gp, ground, 0.05, 'grass', { cell: 10, mat: MAT.leaf });
  // paved terrace behind the loggia (terracotta setts, as in the photos)
  const zt = -17.4 - 4.2;
  drapePoly(k, [[-11, -17.6], [11, -17.6], [11, zt - 6], [-11, zt - 6]], ground, 0.1, 0xb8664a, { cell: 6, mat: MAT.smooth });
  // main axis and cross walks (gravel)
  const walk = (a, b, w) => ribbon(k, [a, b], w, ground, 0.12, 'sand', { step: 6, mat: MAT.smooth });
  walk([xa, zt - 6], [xa, gb.z0 + 5], 3.2);
  for (const z of [-58, -84, -108]) walk([Math.max(gb.x0 + 6, -14), z], [Math.min(gb.x1 - 2, 17), z], 2.2);
  // box parterres either side of the axis, z -32..-52
  const bed = (cx, cz, w, d, flower) => {
    if (![[cx - w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz - d / 2]].every(([x, z]) => ins(x, z))) return false;
    const y = ground(cx, cz);
    k.box(w, 0.35, d, flower, cx, y + 0.02, cz, { mat: MAT.leaf });
    for (const [bw, bd, dx, dz] of [[w, 0.55, 0, d / 2 - 0.27], [w, 0.55, 0, -d / 2 + 0.27], [0.55, d, w / 2 - 0.27, 0], [0.55, d, -w / 2 + 0.27, 0]]) k.box(bw, 0.75, bd, 'hedge', cx + dx, y, cz + dz);
    k.box(w * 0.5, 0.42, 0.35, 'hedge', cx, y, cz);
    k.box(0.35, 0.42, d * 0.5, 'hedge', cx, y, cz);
    k.tree(cx, y, cz, 2.6, { kind: 'topiary', color: 'hedgeDark' in {} ? 'hedge' : 'hedge' });
    return true;
  };
  const flowers = ['flowerRed', 'flowerYellow', 'flowerPink', 'grass'];
  let f = 0;
  for (const cz of [-33, -46]) {
    for (const sx of [-1, 1]) bed(xa + sx * 6.2, cz, 8.4, 9.4, flowers[f++ % 4]);
  }
  // fountain basin with a figure at the crossing
  const fz = -58;
  const fy = ground(xa, fz);
  k.cyl(3.2, 3.4, 0.8, 16, TD, xa, fy, fz);
  k.cyl(2.85, 2.85, 0.12, 16, 'water', xa, fy + 0.66, fz);
  k.lathe(PROFILES.basin, 10, T, xa, fy, fz, { sr: 1.3, sh: 1.2, smooth: true });
  k.cyl(0.25, 0.4, 2.0, 8, T, xa, fy + 0.7, fz);
  k.statue(1.9, 'graniteLight', xa, fy + 2.7, fz, { pose: 'raise' });
  k.marker('fountain', xa, fy + 0.72, fz, { kind: 'basin', name: 'garden', r: 2.8 });
  // second parterre: four lawn panels with clipped yews, z -62..-80
  for (const sx of [-1, 1]) {
    for (const cz of [-70]) if (bed(xa + sx * 6.2, cz, 8.4, 12, sx < 0 ? 'flowerYellow' : 'flowerRed')) k.tree(xa + sx * 10.7, ground(xa + sx * 10.7, cz), cz, 5, { kind: 'cypress' });
  }
  // statues on pedestals along the west wall (nogueira-silva-4.jpg)
  for (let i = 0; i < 6; i++) {
    const z = -30 - i * 11;
    let x = gb.x0;
    for (let xx = gb.x0; xx < 0; xx += 0.5) if (ins(xx, z)) { x = xx; break; }
    x += 1.6;
    const y = ground(x, z);
    k.box(1.0, 0.9, 1.0, 'graniteLight', x, y, z);
    k.box(0.75, 1.2, 0.75, 'graniteLight', x, y + 0.9, z);
    k.statue(2.3, 'graniteLight', x, y + 2.1, z, { ry: Math.PI / 2, pose: i % 2 ? 'hold' : 'raise' });
  }
  // pergola along the east side (granite columns, wooden beams) and a tiled
  // pavilion at its end, z -92..-118
  const px = 12.8;
  const px0 = -97;
  const px1 = -117;
  if (ins(px, px0) && ins(px + 3, px1)) {
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const z = px0 + ((px1 - px0) * i) / n;
      const y = ground(px, z);
      for (const dx of [0, 3.6]) k.cyl(0.16, 0.2, 2.8, 8, T, px + dx, y, z, { smooth: true });
      k.box(4.2, 0.18, 0.2, 'wood', px + 1.8, y + 2.8, z);
    }
    for (const dx of [0, 3.6]) k.box(0.2, 0.2, Math.abs(px1 - px0) + 0.4, 'wood', px + dx, ground(px, px0) + 2.9, (px0 + px1) / 2);
    for (let j = 0; j < 9; j++) k.box(0.1, 0.12, 3.8, 'wood', px + 1.8, ground(px, px0) + 3.0, px0 - 0.5 - j * 2.4 / 1.2 * 0.5 + 0, { ry: 0 });
    const pz = px1 - 4.5;
    if (ins(px + 1.8, pz - 3)) {
      const yy = ground(px + 1.8, pz);
      k.box(5.6, 0.25, 5.6, TD, px + 1.8, yy, pz);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.cyl(0.16, 0.2, 2.9, 8, T, px + 1.8 + sx * 2.4, yy + 0.25, pz + sz * 2.4, { smooth: true });
      k.hipRoof(5.6, 5.6, 1.2, 'terracotta', px + 1.8, yy + 3.15, pz, { over: 0.5, mat: MAT.tile });
      k.box(1.6, 0.4, 0.5, 'wood', px + 1.8, yy + 0.25, pz - 2.4);
    }
  }
  // cypresses and trees round the edge, hedge along the garden boundary
  for (const e of edges(gp)) {
    if (e.len < 6) continue;
    k.push({ x: e.mx - e.nx * 0.7, z: e.mz - e.nz * 0.7, ry: e.ry });
    k.box(e.len - 0.6, 2.4, 1.2, 'hedge', 0, ground(e.mx, e.mz), 0);
    k.pop();
    const cnt = Math.floor(e.len / 9);
    for (let i = 0; i < cnt; i++) {
      const t = (i + 0.5) / cnt;
      const x = e.a[0] + (e.b[0] - e.a[0]) * t - e.nx * 2.2;
      const z = e.a[1] + (e.b[1] - e.a[1]) * t - e.nz * 2.2;
      if (z > -22 || !ins(x, z)) continue;
      const y = ground(x, z);
      if (rnd() < 0.5) k.tree(x, y, z, 9 + rnd() * 3, { kind: 'cypress' });
      else lowTree(k, x, y, z, 8 + rnd() * 3, { lobes: 1 });
    }
  }
  // benches on the axis
  for (const z of [-26, -66]) k.box(2.2, 0.5, 0.6, 'graniteLight', xa + 4.8, ground(xa, z) + 0.05, z);
}

function nogueira(k, { footprint }) {
  const O = footprint.outline;
  const ground = footprint.ground;
  const gardenP = footprint.part(/Jardim/);
  const ZF = bbox(O).z1;
  const zb = bbox(O).z0;
  k.begin('mask');
  k.begin('main');
  // walls up to the main cornice, white render
  k.prism(O, -1.5, HC - 0.2 + 1.5, W);
  front(k, O);
  sidesAndBack(k, O, ZF);
  // loggia stands against the back wall (outside the box of the outline
  // in z, inside the mask); flat roof of the house is at HC
  k.end('main');
  loggia(k, zb, 0);
  if (gardenP) garden(k, gardenP.pts, ground, 0);
  k.end('mask');
  void HTOP;
}
nogueira.metric = true;
nogueira.rule = {
  extent: [/Jardim/],
  view: 0.5,
  note: 'house on its OSM outline (main, 14 m to the roof rail), garden on its OSM part (lawn, parterres, fountain, statues, pergola); mask = house + garden',
};

export default { 'nogueira-silva': nogueira };

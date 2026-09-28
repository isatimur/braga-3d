// Mosteiro de São Martinho de Tibães, metric builder (1:1 metres).
//
// Local frame (fit.js): +z = west (the church front looks 270 deg), +x =
// south. The OSM monastery outline (111 x 91 m) lies south of the church;
// its north range runs 67 m west of the church front, which is the long
// white wing in the reference photo. The church (OSM part, 57.5 x 21 m)
// stands on the north edge with its capela-mor (15 m wide) at the east.
//
// The monastery is one rendered mass on the outline (the small jogs of the
// OSM outline straightened, within 4 m), cut by its courtyards: the
// Claustro do Cemitério (OSM garden against the church's south wall, open
// to it as a notch), the Claustro do Refeitório (OSM octagonal garden, a
// square cloister of 4 ranges x 6 bays round it), and a service courtyard
// in the south block (not in OSM; its size keeps the ranges 11-12 m deep).
// Roofs: tiled slopes from every eave to a ridge 4.4 m in, a flat tiled
// core above wide ranges. Fountains stand on the OSM water points.
//
// Heights (data/dimensions.json, photo estimates): towers 34 m (vanes),
// cupolas 31 m, nave ridge 20 m, wings 13 m.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win, cartouche, bellTower, wallFountain } from './parts.js';
import { bbox, edges, offset, clean, centroid, rect } from './geom.js';
import { polyCornice, onEdge } from './metric.js';

const G = 'granite';
const D = 'graniteDark';
const W = 'plaster';

// Sloped roof ring between two polygons with the same vertex count:
// `lo` at height y0 up to `hi` at y1.
function ringRoof(k, lo, hi, y0, y1, color) {
  const tri = [];
  const n = lo.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [lo[i][0], y0, lo[i][1]];
    const b = [lo[j][0], y0, lo[j][1]];
    const c = [hi[j][0], y1, hi[j][1]];
    const d = [hi[i][0], y1, hi[i][1]];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny >= 0) tri.push(a, b, c, a, c, d);
    else tri.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.flat()), 3));
  k.add(g, color, { flat: true, mat: MAT.tile });
}

// Cheap window: a recessed dark pane with a granite frame and sill.
function pane(k, u, y, w, h) {
  k.box(w + 0.44, h + 0.44, 0.12, G, u, y - 0.22, 0.06);
  k.box(w, h, 0.1, 'glass', u, y, 0.1);
}

// Windows along the edges of a polygon: storeys [y], bay pitch, cheap or
// framed windows (win()) per storey, optional iron balconies.
function facade(k, pts, o) {
  for (const e of edges(pts)) {
    if (e.len < 4) continue;
    if (o.only && !o.only(e)) continue;
    const n = Math.max(1, Math.floor((e.len - 2) / o.bay));
    const pitch = (e.len - 2) / n;
    onEdge(k, e, 0, o.out ?? 0);
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * pitch) / 2 + i * pitch;
      o.storeys.forEach((s) => {
        if (s.fine && i % 2 === 0) win(k, u, s.y, s.w, s.h, 0, { trim: G, bw: 0.25, depth: 0.22, balcony: s.balcony ? 'iron' : false });
        else pane(k, u, s.y, s.w, s.h);
      });
    }
    k.pop();
  }
}

// Fountain on a water point: octagonal basin, column, bowl, jet.
function fountain(k, x, z, r, h) {
  k.cyl(r, r + 0.15, 0.7, 8, G, x, 0, z);
  k.cyl(r - 0.2, r - 0.2, 0.1, 8, 'water', x, 0.6, z);
  k.cyl(0.25, 0.35, h, 8, G, x, 0.6, z);
  k.lathe(PROFILES.basin, 10, G, x, h * 0.55, z, { sr: r * 0.45, sh: 0.6, smooth: true });
  k.cyl(r * 0.36, r * 0.36, 0.08, 10, 'water', x, h * 0.55 + 0.55, z);
  k.lathe(PROFILES.urn, 8, G, x, h + 0.6, z, { sr: 0.5, sh: 0.9, smooth: true });
  k.cyl(0.05, 0.08, 0.9, 5, 'water', x, h + 1.4, z, { emit: 0.5 });
  k.marker('fountain', x, 0.7, z, { kind: 'tiered', r: r - 0.2, jet: h + 2.3 });
}

function tibaes(k, { footprint, dims }) {
  const H = dims?.height_m || {};
  const hRidge = H.nave_ridge ?? 20;
  const hWing = H.wings ?? 13;
  const eaves = hWing - 3.2; // wing eaves; the ridge reaches the real 13 m
  const rise = hWing - eaves;
  const inset = 4.4;

  // ---------------------------------------------------------- church
  const ch = footprint.part(/Igreja/);
  const cb = ch ? bbox(ch.pts) : { x0: -66.3, x1: -45.4, z0: -68.9, z1: -11.4 };
  const cx = (cb.x0 + cb.x1) / 2; // nave axis
  const CW = cb.x1 - cb.x0; // 21 m
  const zF = cb.z1; // front (west)
  const zNave0 = -55.6; // start of the capela-mor
  const TW = 6.5;
  const zT = zF - 1.6 - TW / 2;
  const nEaves = hRidge - 6;

  k.begin('mask');
  k.begin('church');
  k.begin('height');
  k.box(CW + 0.6, 1.2, zF - zNave0 + 0.6, G, cx, -0.8, (zF + zNave0) / 2);
  k.box(CW, nEaves, zF - 1.6 - zNave0, W, cx, 0, (zF - 1.6 + zNave0) / 2, { mat: MAT.render });
  k.corniceRing(CW, zF - 1.6 - zNave0, corniceProfile('classic', 0.6), G, cx, nEaves - 0.6, (zF - 1.6 + zNave0) / 2, { skip: [0] });
  k.gableRoof(CW, zF - 1.6 - zNave0, hRidge - nEaves, 'terracotta', cx, nEaves, (zF - 1.6 + zNave0) / 2, { over: 0.5 });
  // granite pilasters and windows on the north side (the visible one)
  const nb = 7;
  for (let i = 0; i <= nb; i++) {
    const z = zNave0 + ((zF - 1.6 - zNave0) * i) / nb;
    k.box(0.35, nEaves, 1.1, G, cb.x0 - 0.1, 0, z);
    if (i < nb) {
      const zm = z + (zF - 1.6 - zNave0) / nb / 2;
      k.push({ x: cb.x0, z: zm, ry: -Math.PI / 2 });
      win(k, 0, 8.5, 1.4, 2.8, 0, { arch: 'round', trim: G, bw: 0.3, depth: 0.3 });
      pane(k, 0, 3.2, 0.5, 0.8);
      k.pop();
    }
  }
  // capela-mor on its OSM part (narrower, at the east)
  const cm = [[cb.x0, cb.z0], [cb.x0 + 15, cb.z0], [cb.x0 + 15, zNave0], [cb.x0, zNave0]];
  k.prism(cm, -0.8, nEaves - 1.5 + 0.8, W, { mat: MAT.render });
  polyCornice(k, cm, nEaves - 2.1, corniceProfile('classic', 0.5), G);
  k.hipRoof(15, zNave0 - cb.z0, 4, 'terracotta', cb.x0 + 7.5, nEaves - 1.5, (cb.z0 + zNave0) / 2, { over: 0.4 });
  for (const q of cm) k.box(0.9, nEaves - 1.5, 0.9, G, q[0], 0, q[1]);
  // towers with bulbous granite caps
  for (const sx of [-1, 1]) {
    bellTower(k, {
      x: cx + sx * (CW / 2 - TW / 2),
      z: zT,
      w: TW,
      hBody: 16,
      hBelfry: 6.5,
      body: G,
      trim: D,
      cap: 'onion',
      capH: 4.8,
      urns: 'pinnacle',
      windows: 1,
      sideWindows: false,
      openings: 2,
      balustrade: false,
      lantern: false,
    });
    // low parapet round the tower top (cheaper than balusters)
    const tx = cx + sx * (CW / 2 - TW / 2);
    for (const [dx, dz, w, d] of [[0, TW * 0.44, TW * 0.9, 0.25], [0, -TW * 0.44, TW * 0.9, 0.25], [TW * 0.44, 0, 0.25, TW * 0.9], [-TW * 0.44, 0, 0.25, TW * 0.9]]) k.box(w, 0.9, d, D, tx + dx, 23.9, zT + dz);
  }
  // granite frontispiece: portal, niches with statues, windows, volute gable
  const FW = 12;
  const holes = [
    { x: 0, y: 0, w: 2.8, h: 5.2, arch: 'round', pane: 'dark' },
    { x: -2.2, y: 10.4, w: 1.1, h: 1.7, pane: 'glass' },
    { x: 0, y: 10.4, w: 1.1, h: 1.7, pane: 'glass' },
    { x: 2.2, y: 10.4, w: 1.1, h: 1.7, pane: 'glass' },
    { x: -2.2, y: 13, w: 1.1, h: 1.8, arch: 'round', pane: 'glass' },
    { x: 0, y: 13, w: 1.1, h: 1.8, arch: 'round', pane: 'glass' },
    { x: 2.2, y: 13, w: 1.1, h: 1.8, arch: 'round', pane: 'glass' },
  ];
  k.push({ x: cx });
  k.wall(FW, 16, 1.2, G, holes, 0, 0, zF - 0.6, { inset: 0.8 });
  for (const hh of holes) k.surround(hh, 0.25, 0.2, D, zF);
  for (const x of [-5.6, -3.4, 3.4, 5.6]) k.box(0.6, 16, 0.4, D, x, 0, zF + 0.15);
  for (const x of [-3.9, 0, 3.9]) {
    k.wall(1.8, 2.8, 0.4, G, [{ x: 0, y: 0.3, w: 1, h: 2, arch: 'round', pane: 'dark', inset: 0.3 }], x, 6.6, zF + 0.2);
    k.statue(1.5, 'graniteLight', x, 6.9, zF + 0.3, { seg: 5 });
  }
  k.cyl(0.8, 0.8, 0.3, 12, D, -3.9, 3.2, zF + 0.1, { rx: Math.PI / 2 });
  k.box(FW + 0.4, 0.6, 1, D, 0, 8.2, zF + 0.1);
  k.box(FW + 0.6, 0.7, 1.2, D, 0, 15.6, zF + 0.1);
  const gs = new THREE.Shape();
  gs.moveTo(-FW / 2, 0);
  gs.quadraticCurveTo(-3.2, 0.5, -3, 2.2);
  gs.lineTo(-1.6, 3.4);
  gs.lineTo(0, 3.9);
  gs.lineTo(1.6, 3.4);
  gs.lineTo(3, 2.2);
  gs.quadraticCurveTo(3.2, 0.5, FW / 2, 0);
  gs.closePath();
  k.extrude(gs, 1, G, 0, 16.3, zF - 0.5, { curve: 6 });
  cartouche(k, 1.3, 1.4, 0.3, D, 0, 17.2, zF + 0.05);
  for (const x of [-FW / 2, FW / 2, -3, 3]) k.pinnacle(1.9, G, x, 16.3, zF - 0.5);
  k.box(0.18, 2, 0.18, 'iron', 0, 20.2, zF - 0.5);
  k.box(1, 0.16, 0.16, 'iron', 0, 21.4, zF - 0.5);
  k.pop();
  k.end('height');
  k.end('church');

  // ---------------------------------------------------------- monastery
  k.begin('main');
  // outline, straightened; the Claustro do Cemitério is a notch against
  // the church wall
  const g6 = footprint.partsOf('garden').find((p) => bbox(p.pts).x0 < -40);
  const g8 = footprint.partsOf('garden').find((p) => p.pts.length >= 8);
  const b6 = g6 ? bbox(g6.pts) : { x0: -42, x1: -17.6, z0: -41, z1: -17 };
  const b8 = g8 ? bbox(g8.pts) : { x0: -27, x1: -8, z0: 16.5, z1: 40 };
  const n0 = b6.z0 - 3.5;
  const n1 = b6.z1 + 3.5;
  const nx1 = b6.x1 + 3.6;
  const M = [[-45.5, -55.6], [-5, -55.6], [-5, -16.5], [41.3, -16.5], [41.3, 55.6], [-45.5, 55.6], [-45.5, n1], [nx1, n1], [nx1, n0], [-45.5, n0]];
  const V8 = rect((b8.x0 + b8.x1) / 2, (b8.z0 + b8.z1) / 2, b8.x1 - b8.x0 + 7, b8.z1 - b8.z0 + 7);
  const VS = [[6, -4.5], [29.5, -4.5], [29.5, 43.5], [6, 43.5]];
  const holes2 = [V8, VS];
  k.prism(M, -1, eaves + 1, W, { holes: holes2, mat: MAT.render });
  k.prism(offset(M, 0.12), -1, 1.5, G, { holes: holes2.map((h) => offset(h, -0.12)) });
  k.prism(offset(M, 0.1), 5, 0.35, G, { holes: holes2.map((h) => offset(h, -0.1)) }); // floor band
  polyCornice(k, M, eaves - 0.5, corniceProfile('eave', 0.5), G);
  for (const hp of holes2) polyCornice(k, [...hp].reverse(), eaves - 0.5, corniceProfile('eave', 0.4), G);
  // corner quoins
  for (const q of M) k.box(0.7, eaves, 0.7, G, q[0], 0, q[1]);
  // roofs: slopes from every eave to a ridge `inset` in, flat core above
  ringRoof(k, offset(M, 0.5), offset(M, -inset), eaves - 0.3, eaves + rise, 'terracotta');
  for (const hp of holes2) ringRoof(k, offset(hp, -0.5), offset(hp, inset), eaves - 0.3, eaves + rise, 'terracotta');
  k.prism(offset(M, -inset), eaves, rise, 'terracotta', { holes: holes2.map((h) => offset(h, inset)), mat: MAT.tile });
  // facades: the north and west fronts in full, the rest simpler
  const main = (e) => e.nx < -0.9 || e.nz > 0.9;
  facade(k, M, { only: main, bay: 4.8, storeys: [{ y: 1.4, w: 0.9, h: 1.2 }, { y: 4.6, w: 1.2, h: 2.1 }, { y: 8.2, w: 1.2, h: 1.8, fine: true, balcony: true }] });
  facade(k, M, { only: (e) => !main(e), bay: 5.5, storeys: [{ y: 4.6, w: 1.1, h: 1.9 }, { y: 8.2, w: 1.1, h: 1.7 }] });
  for (const hp of holes2) facade(k, [...hp].reverse(), { bay: 5.5, storeys: [{ y: 5.2, w: 1.1, h: 1.8 }, { y: 8.4, w: 1.1, h: 1.6 }] });
  // portaria on the north front near the church: carved frame and cartouche
  k.push({ x: -45.5, z: -4, ry: -Math.PI / 2 });
  k.box(3, 4.2, 0.5, G, 0, 0, 0.25);
  k.box(1.8, 3.2, 0.2, 'dark', 0, 0, 0.45);
  cartouche(k, 2.2, 2.8, 0.4, 'ochre', 0, 4.4, 0.4, { inlay: 'gold' });
  k.pop();

  // --- Claustro do Cemitério: galleries round the garden against the church
  const gg6 = rect((b6.x0 + b6.x1) / 2, (b6.z0 + b6.z1) / 2, b6.x1 - b6.x0 + 0.4, b6.z1 - b6.z0 + 0.4);
  const gw6 = rect((b6.x0 + b6.x1) / 2 - 0.05, (b6.z0 + b6.z1) / 2, b6.x1 - b6.x0 + 7.1, b6.z1 - b6.z0 + 7.2);
  ringRoof(k, gg6, gw6, 4.8, 6.3, 'terracotta');
  for (const e of edges(gg6)) {
    onEdge(k, e, 0, 0);
    k.arcade(e.len, 4.8, 0.5, 7, 2.3, 3.6, 'graniteLight', 0, 0, 0);
    k.pop();
  }
  k.prism(g6 ? clean(g6.pts) : gg6, 0, 0.2, 'grass');
  // --- Claustro do Refeitório: 4 ranges x 6 bays round the octagonal garden
  const gg8 = rect((b8.x0 + b8.x1) / 2, (b8.z0 + b8.z1) / 2, b8.x1 - b8.x0 + 0.4, b8.z1 - b8.z0 + 0.4);
  ringRoof(k, gg8, offset(V8, 0.2), 4.8, 6.3, 'terracotta');
  for (const e of edges(gg8)) {
    onEdge(k, e, 0, 0);
    k.arcade(e.len, 4.8, 0.5, 6, 2.4, 3.6, 'graniteLight', 0, 0, 0);
    k.pop();
  }
  if (g8) {
    const p = clean(g8.pts);
    k.prism(p, 0, 0.2, 'grass');
    k.prism(offset(p, -1.2), 0.2, 0.5, 'hedge', { holes: [offset(p, -2)] });
  }
  k.prism(VS, 0, 0.12, 'sand');
  k.end('main');
  k.end('mask');

  // fountains on the OSM water points (cloisters, patio, the chafariz)
  for (const w of footprint.partsOf('water')) {
    const [x, z] = w.pts[0];
    if (x > 45) {
      // chafariz against the SW wing, outside
      wallFountain(k, 42.3, 0, 49.3, 3.4, { urns: true });
      continue;
    }
    if (z > -12 && z < 4) continue; // garden 7 lies under the roofed mass
    fountain(k, x, z, x < -25 ? 2.4 : 2, 2.2);
  }
  // cypresses in the cemetery cloister
  for (const [dx, dz] of [[-7, -7], [7, 7], [-7, 7], [7, -7]]) k.tree((b6.x0 + b6.x1) / 2 + dx, 0.2, (b6.z0 + b6.z1) / 2 + dz, 7, { kind: 'cypress' });

  // --- the adro in front of the church: raised terrace, granite stair
  const zA = zF + 13;
  k.prism([[cb.x0, zF], [cb.x1, zF], [cb.x1, zA], [cb.x0, zA]], -0.8, 2, 'graniteLight', { mat: MAT.smooth });
  k.wallLine([cb.x0, zF], [cb.x0, zA], 2.2, 0.8, D, -0.8);
  k.wallLine([cb.x0, zA], [cx - 4, zA], 2.2, 0.8, D, -0.8);
  k.wallLine([cx + 4, zA], [cb.x1, zA], 2.2, 0.8, D, -0.8);
  k.stairs(8, 3.6, 1.2, 8, G, cx, 0, zA + 1.8 - 0.4, { below: 0.8 });
  for (const sx of [-1, 1]) {
    k.box(0.8, 1.6, 0.8, G, cx + sx * 4.3, 0, zA + 3.4);
    k.sphere(0.45, 'graniteLight', cx + sx * 4.3, 2, zA + 3.4, { seg: 8, rings: 5 });
    k.segment([cx + sx * 3.9, 1, zA + 3.4], [cx + sx * 3.9, 2.2, zA - 0.2], 0.06, 0.06, 'iron');
  }
}
tibaes.metric = true;
tibaes.rule = {
  extent: [/Igreja/],
  view: -0.75,
  note: 'church on its OSM part north of the monastery; front W; camera from the NW, where the church front and the long north wing are seen together',
};

export default { tibaes };

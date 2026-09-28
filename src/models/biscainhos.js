// Palácio dos Biscainhos (17th-18th c., now a museum), metric builder. The
// OSM relation outline (49.5 x 36.4 m) is the palace: a front block on
// Rua dos Biscainhos (ENE, +z) around an inner courtyard, and a service
// wing running back (-z) along its east side. data/dimensions.json: two
// storeys of about 5.5 m, eaves 11 m, hipped roofs and pinnacles to 15 m.
// The baroque garden (OSM part) lies behind (-z, WSW) and is left to the
// ground layer; only the palace is modelled.
// From the photos: ochre render, granite pilasters, frames and cornices,
// iron balconies on the upper windows, a pedimented centre with obelisk
// pinnacles on the garden side, a granite loggia, the courtyard fountain.
import { corniceProfile, MAT } from './kit.js';
import { win, pediment } from './parts.js';
import { bbox } from './geom.js';
import { polyCornice, polyWindows } from './metric.js';

const O = 'ochre';
const T = 'granite';

function clipZ(pts, z0, keep = 1) {
  const out = [];
  const inside = (p) => (p[1] - z0) * keep >= 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (z0 - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, z0]);
    }
  }
  return out;
}

function biscainhos(k, { footprint, dims }) {
  const ol = footprint.outline;
  const ob = bbox(ol);
  const HE = dims?.height_m?.eaves ?? 11;
  const HT = dims?.height_m?.total ?? 15;
  const zCut = -5.5; // back of the front block, start of the service wing
  const main = clipZ(ol, zCut, 1);
  const wing = clipZ(ol, zCut + 0.2, -1);
  const mb = bbox(main);
  // inner courtyard, about 12 x 11 m
  const court = [[-8, 3], [4, 3], [4, 14], [-8, 14]];
  const cb = bbox(court);

  k.begin('main');
  // --- front block round the courtyard
  k.prism(main, -1.5, HE + 1.5, O, { holes: [court] });
  k.prism(main, -1.5, 2.2, T, { holes: [court], mat: MAT.ashlar }); // granite plinth
  polyCornice(k, main, HE - 0.6, corniceProfile('classic', 0.6), T, { minLen: 2 });
  polyCornice(k, main, 5.4, corniceProfile('band', 0.3), T, { minLen: 2 });
  // street and side fronts: two storeys, balconied upper windows
  polyWindows(k, main, {
    only: (e) => e.nz > -0.5,
    storeys: [1.4, 6.6],
    bay: 4.2,
    w: 1.4,
    h: 2.4,
    storey: (s) => (s === 0 ? { h: 2.2, bars: true } : { h: 2.8, balcony: 'iron', emit: 0.12 }),
    win: { trim: T, pane: 'glass', bw: 0.28, depth: 0.3 },
  });
  // granite pilasters at the corners of the street front
  for (const x of [-16.6, -3.5, 11.6]) k.box(0.8, HE, 0.35, T, x, 0, ob.z1 - 0.05);
  // street portal: arched door with a triangular pediment over it
  win(k, -3.5 + 7.6, 0.2, 2.4, 4.2, ob.z1, { arch: 'round', bw: 0.4, depth: 0.4, trim: T, pane: 'dark' });
  pediment(k, 3.8, 0.9, 0.4, T, 4.1, 5.0, ob.z1 + 0.3, { frame: 0.2 });

  // courtyard fronts: facing inward, arched doors, balconied windows above
  const sides = [
    { x: cb.cx, z: cb.z0, ry: 0, len: cb.w },
    { x: cb.cx, z: cb.z1, ry: Math.PI, len: cb.w },
    { x: cb.x0, z: cb.cz, ry: Math.PI / 2, len: cb.d },
    { x: cb.x1, z: cb.cz, ry: -Math.PI / 2, len: cb.d },
  ];
  sides.forEach((s, si) => {
    k.push({ x: s.x, z: s.z, ry: s.ry });
    const n = Math.max(2, Math.floor(s.len / 3.8));
    for (let i = 0; i < n; i++) {
      const u = -s.len / 2 + (i + 0.5) * (s.len / n);
      const door = si === 0 && (i === 1 || i === n - 2);
      win(k, u, door ? 0 : 1.2, door ? 1.6 : 1.3, door ? 3.8 : 2.2, 0, { arch: door ? 'round' : undefined, bw: 0.28, depth: 0.3, trim: T, pane: door ? 'brick' : 'glass', bars: !door });
      win(k, u, 6.6, 1.4, 2.8, 0, { arch: 'seg', bw: 0.28, depth: 0.3, trim: T, pane: 'glass', balcony: 'iron' });
    }
    k.pop();
  });
  polyCornice(k, court, HE - 0.6, corniceProfile('eave', 0.5), T);
  // cobbled courtyard with the baroque fountain
  k.prism(court, 0, 0.12, 'graniteLight', { mat: MAT.ashlar });
  const fx = cb.cx;
  const fz = cb.cz;
  k.cyl(2.3, 2.45, 0.7, 12, T, fx, 0, fz);
  k.cyl(2.05, 2.05, 0.1, 12, 'water', fx, 0.55, fz);
  k.marker('fountain', fx, 0.65, fz, { kind: 'basin', name: 'courtyard', r: 2.05 });
  k.lathe([[0, 0], [0.45, 0], [0.35, 0.7], [0.65, 1.1], [0.3, 1.5], [0.45, 2.1], [0.2, 2.5], [0.28, 2.8], [0, 3.3]], 8, 'graniteDark', fx, 0.1, fz, { flat: true });

  // --- roofs: hip roofs over the four ranges round the courtyard
  const rise = HT - 1 - HE; // ridge 1 m under the pinnacle tops
  const ranges = [
    [mb.x0 + 0.3, mb.x1 - 4.5, cb.z1, mb.z1 - 0.4],
    [mb.x0 + 0.3, cb.x0, cb.z0, cb.z1],
    [cb.x1, mb.x1 - 4.5, cb.z0, cb.z1],
    [mb.x0 + 0.3, mb.x1 - 1.8, mb.z0 + 0.3, cb.z0],
  ];
  for (const [x0, x1, z0, z1] of ranges) k.hipRoof(x1 - x0, z1 - z0, Math.min(rise, (Math.min(x1 - x0, z1 - z0) / 2) * 0.75), 'terracotta', (x0 + x1) / 2, HE, (z0 + z1) / 2, { over: 0.4 });
  // chimneys
  for (const [x, z] of [[-12, 19], [8, 19], [-14, -1]]) k.box(0.8, 3.2, 0.8, O, x, HE + 0.5, z);

  // --- garden front (-z): pedimented centre with obelisk pinnacles
  const zg = mb.z0;
  k.push({ x: -4, z: zg, ry: Math.PI });
  k.box(11, HE + 1.2, 0.6, O, 0, 0, 0.2);
  for (const sx of [-1, 1]) k.box(0.8, HE + 1.2, 0.4, T, sx * 5.3, 0, 0.5);
  pediment(k, 11.4, 2.2, 0.6, T, 0, HE + 1.2, 0.3, { tympanum: O, frame: 0.25 });
  for (const x of [-5.3, 0, 5.3]) k.pinnacle(x === 0 ? HT - HE - 3.3 : 2.4, T, x, x === 0 ? HE + 3.3 : HE + 1.2, 0.3);
  k.pop();
  polyWindows(k, main, { only: (e) => e.nz < -0.8, storeys: [1.4, 6.6], bay: 4.2, w: 1.4, h: 2.4, storey: (s) => (s === 1 ? { balcony: 'iron' } : {}), win: { trim: T, pane: 'glass', bw: 0.28, depth: 0.3 } });

  // --- service wing to the back: lower, with the granite loggia facing the garden
  const HW = 8.4;
  k.prism(wing, -1.5, HW + 1.5, O);
  polyCornice(k, wing, HW - 0.5, corniceProfile('eave', 0.5), T, { minLen: 2 });
  const wb = bbox(wing);
  k.hipRoof(wb.w - 2.4, wb.d, 2.6, 'terracotta', wb.cx + 0.4, HW, wb.cz, { over: 0.4 });
  polyWindows(k, wing, { only: (e) => e.nx > 0.5, storeys: [1.4, 5.4], bay: 4, w: 1.2, h: 2, win: { trim: T, pane: 'glass', bw: 0.25, depth: 0.25 } });
  // loggia: three granite arches on the garden (west) face of the wing
  const lx = wb.x0 + 0.1;
  const lz = zCut - 6;
  k.push({ x: lx, z: lz, ry: -Math.PI / 2 });
  k.arcade(9, 5.2, 0.7, 3, 2.3, 4.2, T, 0, 0, 0.3);
  k.box(9.2, 0.35, 1, T, 0, 5.2, 0.3);
  k.balustrade(9, 0.9, 'iron', 0, 5.55, 0.5, { cheap: true, d: 0.05, sp: 0.2 });
  k.pop();
  k.end('main');
}
biscainhos.metric = true;
biscainhos.rule = { note: 'palace only (OSM relation outline); street front ENE (+z), garden WSW left to the ground layer' };

export default { biscainhos };

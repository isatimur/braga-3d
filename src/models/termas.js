// Termas Romanas do Alto da Cividade (1st-4th c.), metric builder.
// OSM: the baths core (30.6 x 27.9 m, the outline) under the modern canopy,
// and a second ruins polygon east of it (the wider excavation with the
// palaestra, about 850 m2 excavated in all). Local frame: +z = ENE, the
// visitors' side with the raised timber walkway (Rua Dr. Rocha Peixoto).
// From data/dimensions.json (estimates): canopy 6 m, surviving walls up to
// 1.5 m. Room layout estimated from the reference photos: rubble walls of
// the rooms, two hypocaust floors with stacked-tile pilae, a plunge pool
// with steps, a small apse, column drums of the palaestra, rusted steel
// posts and two round Corten columns under a dark flat roof.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { offset, edges } from './geom.js';

const W = 'graniteWarm';

// Rubble wall a -> b with a broken top: blocks of uneven height.
function ruinWall(k, a, b, h, t = 0.9) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(len / 1.6));
  for (let i = 0; i < n; i++) {
    const f0 = i / n;
    const f1 = (i + 1) / n;
    const p = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0];
    const q = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1];
    k.wallLine(p, q, h * (0.55 + k.rnd() * 0.45), t, i % 4 === 1 ? 'graniteLight' : W, 0.1, { ext: 0.02 });
  }
}

function termas(k, { footprint, dims }) {
  const rnd = k.rnd;
  const core = footprint.outline;
  const wide = footprint.parts.find((p, i) => i > 0 && p.tag === 'ruins');
  const HC = dims?.height_m?.canopy ?? 6;
  const HW = dims?.height_m?.walls ?? 1.5;

  // --- the wider excavation (palaestra side): gravel, wall traces, drums
  if (wide) {
    k.prism(wide.pts, -0.3, 0.38, 'sand');
    for (const e of edges(wide.pts)) if (e.len > 3) ruinWall(k, e.a, e.b, 0.7, 0.7);
    for (let i = 0; i < 7; i++) {
      const x = 6 + i * 4.2;
      const z = -26 + (i % 2) * 0.3;
      k.box(1.3, 0.4, 1.3, 'granite', x, 0.08, z);
      k.cyl(0.42, 0.46, 0.5 + (i % 3) * 0.7, 10, 'graniteLight', x, 0.48, z);
    }
    for (const [x, z, h] of [[20, -12, 0.9], [26, -6, 0.6], [32, -12, 1.1], [14, -18, 0.8]]) ruinWall(k, [x - 4, z], [x + 4, z], h, 0.7);
    for (let i = 0; i < 6; i++) k.box(0.9 + rnd(), 0.4 + rnd() * 0.4, 0.8 + rnd(), 'graniteLight', 5 + rnd() * 30, 0.08, -30 + rnd() * 30, { ry: rnd() * 3 });
  }

  k.begin('main');
  // --- the baths core: floor, retaining edge of the excavation
  k.prism(core, -0.3, 0.42, 'earth');
  k.prism(offset(core, 0.5), -0.3, 1.1, 'graniteDark', { holes: [core] });
  // rooms (frigidarium, tepidarium, caldarium), service corridor
  const walls = [
    [[-15, -4], [15, -4], HW],
    [[-15, 6], [8, 6], HW * 0.7],
    [[-5, -10.4], [-5, 13.6], HW * 0.85],
    [[6, -4], [6, 13.6], HW],
    [[-10, 6], [-10, 13.6], HW * 0.55],
    [[-4.3, -13.7], [-4.3, -10.6], HW * 0.8],
    [[0.7, -13.7], [0.7, -10.6], HW * 0.8],
    [[-4.3, -13.7], [0.7, -13.7], HW * 0.6],
    [[10.5, -10.4], [10.5, -4], HW * 0.6],
  ];
  for (const [a, b, h] of walls) ruinWall(k, a, b, h);
  // hypocausts: stacked-tile pilae on a tiled floor
  const hypo = (x0, z0, nx, nz) => {
    k.box(nx * 1.1 + 0.4, 0.06, nz * 1.1 + 0.4, 'brick', x0 + (nx * 1.1) / 2 - 0.55, 0.12, z0 + (nz * 1.1) / 2 - 0.55, { mat: MAT.smooth });
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const h = 0.5 + rnd() * 0.35;
        k.box(0.42, h, 0.42, 'brick', x0 + i * 1.1, 0.18, z0 + j * 1.1, { ry: (rnd() - 0.5) * 0.3 });
      }
    }
  };
  hypo(7.2, -2.9, 7, 8);
  hypo(-14, -9.4, 8, 5);
  // plunge pool with steps
  k.box(8, 1.1, 0.7, W, 0.5, 0.1, 7.4);
  k.box(8, 1.1, 0.7, W, 0.5, 0.1, 12.6);
  k.box(0.7, 1.1, 5.9, W, -3.2, 0.1, 10);
  k.box(0.7, 1.1, 5.9, W, 4.2, 0.1, 10);
  k.box(6.7, 0.1, 4.5, 'graniteLight', 0.5, 0.12, 10, { mat: MAT.smooth });
  for (let i = 0; i < 3; i++) k.box(1, 0.3 + i * 0.3, 4.4, 'graniteLight', -2.3 + i * 0.9, 0.12, 10);
  // small apse on the caldarium wall
  {
    const s = new THREE.Shape();
    s.absarc(0, 0, 3.4, 0, Math.PI, false);
    s.absarc(0, 0, 2.6, Math.PI, 0, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: HW * 0.9, bevelEnabled: false, curveSegments: 10 });
    g.rotateX(-Math.PI / 2);
    k.add(g, W, { x: 0.5, y: 0.1, z: -4.3, ry: Math.PI, flat: true });
  }
  // column drums of a portico, fallen stones
  for (let i = 0; i < 4; i++) k.cyl(0.35, 0.38, 0.6 + (i % 3) * 0.45, 10, 'graniteLight', -13.5 + i * 2.6, 0.12, 4.5);
  for (let i = 0; i < 8; i++) k.box(0.7 + rnd() * 0.6, 0.35 + rnd() * 0.3, 0.6 + rnd() * 0.5, 'graniteLight', -13 + rnd() * 26, 0.12, -9 + rnd() * 20, { ry: rnd() * 3 });
  // drain channel
  k.box(0.6, 0.12, 12, 'graniteDark', 13.5, 0.12, 6.5);

  // --- canopy: rusted steel posts, beams, dark flat roof
  const cb = footprint.box;
  const xs = [-14.4, -4.8, 4.8, 14.4];
  const zs = [-9.8, 1.8, 13.2];
  for (const x of xs) for (const z of zs) k.box(0.45, HC - 0.6, 0.45, 'rust', x, 0, z);
  k.cyl(0.75, 0.75, HC - 0.6, 14, 'rust', -8, 0, -2, { smooth: true });
  k.cyl(0.75, 0.75, HC - 0.6, 14, 'rust', 9, 0, 9.5, { smooth: true });
  for (const z of zs) k.box(cb.w, 0.5, 0.35, 'rust', 0, HC - 1.1, z);
  for (const x of xs) k.box(0.35, 0.5, cb.d, 'rust', x, HC - 1.1, 0);
  for (let i = 1; i < 8; i++) k.box(0.18, 0.3, cb.d, 'iron', -cb.w / 2 + (i * cb.w) / 8, HC - 0.9, 0);
  k.prism(offset(core, 0.5), HC - 0.6, 0.6, 'slate', { bevel: 0.1 });

  // --- visitors' walkway along the ENE side (+z) and the west side
  const WY = 1.7;
  k.box(cb.w - 1, 0.18, 2.2, 'trunk', 0, WY, cb.z1 - 1.3);
  k.box(2.2, 0.18, cb.d - 6, 'trunk', cb.x0 + 1.3, WY, 1.5);
  for (let i = 0; i < 9; i++) k.box(0.15, WY, 0.15, 'rust', -14 + i * 3.5, 0, cb.z1 - 2.3);
  for (let i = 0; i < 6; i++) k.box(0.15, WY, 0.15, 'rust', cb.x0 + 2.3, 0, -9 + i * 4.2);
  // rails: posts and top rail
  for (let i = 0; i < 16; i++) k.box(0.05, 1, 0.05, 'iron', -14.5 + i * 1.95, WY + 0.18, cb.z1 - 2.35);
  k.box(cb.w - 1, 0.06, 0.06, 'iron', 0, WY + 1.15, cb.z1 - 2.35);
  k.box(0.06, 0.06, cb.d - 6, 'iron', cb.x0 + 2.35, WY + 1.15, 1.5);
  for (let i = 0; i < 12; i++) k.box(0.05, 1, 0.05, 'iron', cb.x0 + 2.35, WY + 0.18, -10 + i * 2.1);
  // steps down from the walkway to the floor (east end)
  k.push({ x: 13, z: cb.z1 - 4.6, ry: Math.PI });
  k.stairs(1.6, 2.6, WY, 9, 'trunk', 0, 0, 0);
  k.pop();
  k.end('main');
}
termas.metric = true;
termas.rule = {
  extent: ['ruins'],
  note: 'baths core under the canopy on the OSM outline; the second OSM ruins polygon (palaestra side) carries low wall traces',
};

export default { 'termas-romanas': termas };

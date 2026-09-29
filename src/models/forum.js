// Forum Braga (Barbosa & Guimarães, 2017-2018, in the 1981 Parque de
// Exposições), metric builder (1:1 metres).
//
// Frame (fit.js): +z = the long west entrance front (254.7 deg), origin at
// the centre of the OSM building (r19915703, 199.9 x 107.9 m). Parts: the
// outdoor zone with the 620-space car park (w591643569, west, local +z) and
// the Grande Auditório room outline (w1373821120, 1432 seats).
// From data/dimensions.json and the photos (forum-braga*.jpg): white
// rendered volumes; the pavilion 107.5 x 46.3 m, 11.5 to 14.5 m high
// across its width (the roof falls toward the back); the entrance as a deep
// recess under a white cantilevered soffit, its back wall of vertical
// thermo-timber slats (Lunawood) over a glazed ground floor; on the right a
// slatted upper box over the glazed foyer; the auditorium volume on its
// outline; the square with the blue FORUM letters, the reflecting pool,
// young birches in planters and concrete benches; flagpoles; the car park
// in rows. The ground rises 12 m toward the back (the park side) in the
// DEM: the pad levels only the main rectangle of the building (x -100..98,
// z -19.9..70 with the forecourt, 2 m falloff): along the back the pavilion wall itself
// holds the park ground (the OSM park touches the building there), and a
// granite retaining wall holds the higher ground at the south-east end and
// the front right, so the pad does not cut into Parque da Ponte.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { bbox, inside, offset, clean, edges } from './geom.js';
import { drapePoly, lowTree } from './drape.js';

const WHITE = 'white';
const TIMBER = 0x7d5638; // thermo-treated pine, weathered brown
const BLUE = 0x243a8c; // the FORUM letters

// Vertical timber slats facing +z on the plane z, from x0 to x1 and y0 to
// y1: front and side faces only (6 triangles a slat), a dark void behind.
function slats(k, x0, x1, y0, y1, z, o = {}) {
  const pitch = o.pitch ?? 0.36;
  const w = o.w ?? 0.14;
  const d = o.d ?? 0.12;
  const pos = [];
  const quad = (a, b, c, e) => pos.push(...a, ...b, ...c, ...a, ...c, ...e);
  const n = Math.floor((x1 - x0) / pitch);
  for (let i = 0; i <= n; i++) {
    const xa = x0 + i * pitch;
    const xb = xa + w;
    quad([xa, y0, z + d], [xb, y0, z + d], [xb, y1, z + d], [xa, y1, z + d]);
    quad([xa, y0, z], [xa, y0, z + d], [xa, y1, z + d], [xa, y1, z]);
    quad([xb, y0, z + d], [xb, y0, z], [xb, y1, z], [xb, y1, z + d]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const ry = o.ry ?? 0;
  k.add(g, o.color ?? TIMBER, { flat: true, mat: MAT.smooth, ry, x: o.x ?? 0, z: o.zOff ?? 0 });
  // the dark void behind: its centre turned like the slats
  const cx = (x0 + x1) / 2;
  const cz = z - 0.02;
  k.add(new THREE.PlaneGeometry(x1 - x0, y1 - y0), 'dark', {
    x: cx * Math.cos(ry) + cz * Math.sin(ry) + (o.x ?? 0),
    y: (y0 + y1) / 2,
    z: -cx * Math.sin(ry) + cz * Math.cos(ry) + (o.zOff ?? 0),
    ry,
    mat: MAT.flat,
  });
}

// The outline with a rectangular notch x0..x1 cut from its edge on the
// line z = zEdge back to z = zBack (the entrance recess).
function notch(poly, x0, x1, zEdge, zBack) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (Math.abs(a[1] - zEdge) > 1 || Math.abs(b[1] - zEdge) > 1) continue;
    if (Math.min(a[0], b[0]) > x0 || Math.max(a[0], b[0]) < x1) continue;
    const cut = a[0] < b[0] ? [[x0, zEdge], [x0, zBack], [x1, zBack], [x1, zEdge]] : [[x1, zEdge], [x1, zBack], [x0, zBack], [x0, zEdge]];
    return [...poly.slice(0, i + 1), ...cut, ...poly.slice(i + 1)];
  }
  return poly;
}

// Glazed band with slim mullions facing +z.
function glazing(k, x0, x1, y0, y1, z, emit = 0.3) {
  k.add(new THREE.PlaneGeometry(x1 - x0, y1 - y0), 'glass', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, emit, mat: MAT.flat });
  const n = Math.max(1, Math.round((x1 - x0) / 2.8));
  for (let i = 0; i <= n; i++) k.box(0.1, y1 - y0, 0.14, 'iron', x0 + ((x1 - x0) * i) / n, y0, z + 0.05);
  k.box(x1 - x0, 0.12, 0.16, 'iron', (x0 + x1) / 2, y1 - 0.12, z + 0.05);
}

// The FORUM letters (forum-braga-4.jpg): 3.6 m tall, steel plate, blue.
function letters(k, x, y, z) {
  const h = 3.6;
  const t = 0.42;
  const d = 0.55;
  k.push({ x, y, z });
  let u = -9;
  // F
  k.box(t, h, d, BLUE, u, 0, 0);
  k.box(1.9, t, d, BLUE, u + 0.95, h - t, 0);
  k.box(1.4, t, d, BLUE, u + 0.7, h * 0.52, 0);
  u += 3.2;
  // O (a thick ring)
  k.add(new THREE.TorusGeometry(h / 2 - t / 2, t / 2, 4, 20), BLUE, { x: u, y: h / 2, z: 0, sz: d / t });
  u += 3.4;
  // R
  k.box(t, h, d, BLUE, u - 1, 0, 0);
  k.add(new THREE.TorusGeometry(h * 0.24, t / 2, 4, 12, Math.PI), BLUE, { x: u - 0.2, y: h * 0.74, z: 0, rz: -Math.PI / 2, sz: d / t });
  for (const y of [h - t / 2, h * 0.5]) k.box(0.9, t, d, BLUE, u - 0.6, y - t / 2, 0);
  k.segment([u - 0.6, h * 0.5, 0], [u + 0.6, 0.1, 0], d, t, BLUE);
  u += 2.8;
  // U
  for (const s of [-1, 1]) k.box(t, h * 0.62, d, BLUE, u + s * 1.05, h * 0.38, 0);
  k.add(new THREE.TorusGeometry(1.05, t / 2, 4, 12, Math.PI), BLUE, { x: u, y: h * 0.38, z: 0, rz: Math.PI, sz: d / t });
  u += 3.4;
  // M
  for (const s of [-1, 1]) k.box(t, h, d, BLUE, u + s * 1.3, 0, 0);
  k.segment([u - 1.3, h, 0], [u, h * 0.35, 0], d, t, BLUE);
  k.segment([u + 1.3, h, 0], [u, h * 0.35, 0], d, t, BLUE);
  k.pop();
}

function forum(k, { footprint, dims }) {
  const rnd = k.rnd;
  const O = footprint.outline;
  const ground = footprint.ground;
  const raw = footprint.rawGround;
  const HMAX = dims?.height_m?.pavilion_max ?? 14.5;
  const HMIN = dims?.height_m?.pavilion_min ?? 11.5;
  const audP = footprint.part(/Audit/);
  const zone = footprint.part(/Zona Exterior/);
  const ZF = 47.6; // the front line of the pavilion block
  const ZP = 26.4; // pavilion front (46.3 m deep from the back at -19.9)
  const XP0 = -9.2; // pavilion 107.5 m long
  const XP1 = 98.3;
  const R0 = -6; // entrance recess
  const R1 = 50;
  const ZR = 36.6; // recess back wall

  k.begin('mask');
  k.begin('main');
  // --- base volume on the whole outline (congress centre, services)
  // (the entrance recess cut out of the outline's front edge)
  k.prism(notch(clean(O, 0.5), R0, R1, ZF, ZR), -1.5, 11 + 1.5, WHITE);
  k.prism(offset(O, 0.15), -1.5, 1.6, 'graniteGrey');
  // --- the pavilion: roof falling from 14.5 (front) to 11.5 (back)
  const sec = new THREE.Shape([new THREE.Vector2(-19.9, -1.5), new THREE.Vector2(ZP, -1.5), new THREE.Vector2(ZP, HMAX), new THREE.Vector2(-19.9, HMIN)]);
  const pg = new THREE.ExtrudeGeometry(sec, { depth: XP1 - XP0, bevelEnabled: false });
  pg.rotateY(-Math.PI / 2); // shape x -> z, extrusion -> -x
  k.add(pg, WHITE, { flat: true, x: XP1 });
  // roof: skylight strips and the parapet line
  for (let i = 0; i < 8; i++) {
    const x = XP0 + 8 + i * 12.5;
    k.segment([x, HMIN + 0.15, -18], [x, HMAX - 0.35, ZP - 2], 2.2, 0.3, 'glass', { emit: 0.25 });
  }
  // back (park side) and the SE end: slat bands high on the white wall
  slats(k, -97, 24, 4.5, 10.5, 0.2, { ry: Math.PI, zOff: -19.9, pitch: 0.42 });
  slats(k, -17, 17, 4, 10, 0.2, { ry: Math.PI / 2, x: XP1, pitch: 0.42 });
  // --- the front block (foyer) left and right of the entrance recess
  k.box(R0 + 15, HMAX + 1.5, ZF - ZP, WHITE, (-15 + R0) / 2, -1.5, (ZP + ZF) / 2);
  k.box(XP1 - R1, HMAX + 1.5, ZF - ZP, WHITE, (R1 + XP1) / 2, -1.5, (ZP + ZF) / 2);
  k.box(R1 - R0, HMAX + 1.5, ZR - ZP, WHITE, (R0 + R1) / 2, -1.5, (ZP + ZR) / 2);
  // the recess: white soffit falling from the front edge to the slat wall
  k.box(R1 - R0, 0.8, ZF - ZR, WHITE, (R0 + R1) / 2, HMAX - 0.8, (ZR + ZF) / 2);
  k.segment([(R0 + R1) / 2, HMAX - 0.9, ZF], [(R0 + R1) / 2, 9.4, ZR + 0.2], R1 - R0, 0.4, WHITE);
  slats(k, R0, R1, 3.7, 9.6, ZR, { pitch: 0.34 });
  glazing(k, R0 + 0.5, R1 - 0.5, 0, 3.7, ZR + 0.05, 0.4);
  k.box(R1 - R0, 0.12, ZF - ZR, 'graniteLight', (R0 + R1) / 2, -0.02, (ZR + ZF) / 2, { mat: MAT.smooth });
  // right block: slatted upper box over the glazed foyer, set back glazing
  slats(k, R1 + 1.2, XP1 - 0.8, 8.2, HMAX - 0.6, ZF + 0.05, { pitch: 0.34 });
  k.box(XP1 - R1, 0.6, 3.2, WHITE, (R1 + XP1) / 2, 7.6, ZF + 1.2);
  glazing(k, R1 + 1, XP1 - 1, 0, 5.6, ZF - 2.4, 0.35);
  k.box(XP1 - R1 - 1, 2.0, 0.3, WHITE, (R1 + XP1) / 2, 5.6, ZF - 0.1);
  // left block: a slat panel high up
  slats(k, -14, R0 - 1.5, 7, HMAX - 1.5, ZF + 0.05, { pitch: 0.34 });
  // congress centre entrance on the western bump: glazed, white frame
  glazing(k, -45.5, -15.8, 0, 4.2, 53.95, 0.35);
  k.box(31, 1, 3, WHITE, -30.6, 4.4, 55);
  slats(k, -45, -16.5, 6, 10.4, 53.95, { pitch: 0.4 });
  // --- the Grande Auditório volume on its outline, over the base
  if (audP) {
    const ap = clean(audP.pts, 0.8);
    k.prism(ap, 10.9, 15.2 - 10.9, WHITE);
    for (const e of edges(ap)) {
      if (e.len < 8) continue;
      k.push({ x: e.mx + e.nx * 0.02, z: e.mz + e.nz * 0.02, ry: e.ry });
      slats(k, -e.len / 2 + 1, e.len / 2 - 1, 11.6, 14.6, 0, { pitch: 0.5 });
      k.pop();
    }
  }
  // west and north faces of the congress block: window bands
  for (const e of edges(clean(O, 1))) {
    if (e.len < 14 || e.nz > 0.7 || (e.mx > -20 && e.nz < -0.7)) continue;
    k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
    k.add(new THREE.PlaneGeometry(e.len - 4, 2.4), 'glass', { y: 4.2, emit: 0.25, mat: MAT.flat });
    k.pop();
  }
  k.end('main');
  k.end('mask');

  // --- retaining wall holding the higher ground behind the pad (back and
  // the SE end), granite with a railing
  const wall = (a, b, off) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8));
    for (let i = 0; i < n; i++) {
      const p = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n];
      const q = [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n];
      const hp = raw(p[0] + off[0], p[1] + off[1]);
      const hq = raw(q[0] + off[0], q[1] + off[1]);
      if (Math.max(hp, hq) < 1) continue;
      const top = (hp + hq) / 2 + 0.4;
      k.box(Math.hypot(q[0] - p[0], q[1] - p[1]) + 0.2, top + 1, 0.9, 'graniteGrey', (p[0] + q[0]) / 2, -1, (p[1] + q[1]) / 2, { ry: Math.atan2(-(q[1] - p[1]), q[0] - p[0]) });
      k.box(Math.hypot(q[0] - p[0], q[1] - p[1]), 1, 0.06, 'iron', (p[0] + q[0]) / 2, top, (p[1] + q[1]) / 2, { ry: Math.atan2(-(q[1] - p[1]), q[0] - p[0]) });
    }
  };
  // (along the back the pavilion wall itself holds the park ground)
  wall([99.25, -19.9], [99.25, 70.9], [3, 0]);
  wall([99.25, 70.9], [30, 70.9], [0, 3]);

  // --- the square in front of the entrance: granite setts, the FORUM
  // letters, the reflecting pool, birches in planters, benches
  const sq = [[-15, ZF], [XP1, ZF], [XP1, 70.4], [-15, 70.4]];
  drapePoly(k, sq, ground, 0.12, 'graniteGrey', { cell: 8, mat: MAT.smooth });
  const lx = (R0 + R1) / 2;
  const lz = 64;
  const ly = ground(lx, lz) + 0.12;
  letters(k, lx, ly, lz);
  k.box(26, 0.35, 5, 'graniteDark', lx, ly - 0.25, lz + 4.5);
  k.box(25, 0.12, 4.4, 'water', lx, ly - 0.02, lz + 4.5, { emit: 0.25 });
  for (let i = 0; i < 9; i++) {
    const x = -10 + i * 7.2;
    const z = ZF + 6 + (i % 2) * 4;
    const y = ground(x, z) + 0.12;
    k.box(3.2, 0.25, 3.2, 'earth', x, y - 0.15, z);
    k.cyl(0.08, 0.12, 5.5, 4, 'white', x, y, z, { open: true });
    k.ico(1.4, 0, 'foliage', x, y + 5.6, z, { jitter: 0.25, sy: 1.5, soft: true });
    if (i % 2) k.box(4.2, 0.5, 0.9, 'graniteLight', x + 3.4, y, z - 2.5, { mat: MAT.smooth });
  }
  // flagpoles along the square (outside 'main')
  for (let i = 0; i < 7; i++) {
    const x = R1 - 4 - i * 3;
    const z = 71;
    const y = ground(x, z) + 0.1;
    k.cyl(0.06, 0.09, 12, 5, 'steel', x, y, z);
    k.box(0.04, 1.2, 1.8, i % 3 === 0 ? 0x2e7d4f : i % 3 === 1 ? 0xb8322e : 0x2f55a0, x, y + 10.5, z + 0.95);
  }

  // --- the outdoor zone and the car park in rows, draped
  if (zone) {
    const Z = clean(zone.pts, 0.8);
    drapePoly(k, Z, ground, 0.1, 0x55575a, { cell: 10, mat: MAT.smooth });
    const zb = bbox(Z);
    const quad = [];
    const cars = [];
    const inset = offset(Z, -2);
    for (let m = zb.z0 + 4; m + 10 < zb.z1; m += 16) {
      for (const [zr0, zr1] of [[m, m + 5], [m + 5, m + 10]]) {
        for (let x = zb.x0 + 2; x < zb.x1 - 2; x += 2.5) {
          if (!inside(inset, x, zr0) || !inside(inset, x, zr1) || !inside(inset, x + 2.5, zr0)) continue;
          quad.push([x, zr0, zr1]);
          if (rnd() < 0.3 && cars.length < 110) cars.push([x + 1.25, (zr0 + zr1) / 2]);
        }
      }
    }
    // stripes: one flat quad each (two triangles)
    const pos = [];
    for (const [x, z0, z1] of quad) {
      const y0 = ground(x, z0) + 0.16;
      const y1 = ground(x, z1) + 0.16;
      pos.push(x - 0.06, y0, z0, x - 0.06, y1, z1, x + 0.06, y1, z1, x - 0.06, y0, z0, x + 0.06, y1, z1, x + 0.06, y0, z0);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    k.add(sg, 'white', { flat: true, mat: MAT.flat });
    const paint = [0xd8d8d4, 0x2a2c30, 0x8a9096, 0x6b1f22, 0x1f3552, 0xb9b3a4, 0x3c4a3a];
    for (const [x, z] of cars) {
      const y = ground(x, z) + 0.12;
      const c = paint[Math.floor(rnd() * paint.length)];
      k.box(1.8, 0.8, 4.3, c, x, y + 0.2, z, { mat: MAT.metal });
      k.box(1.6, 0.6, 2.2, 0x30383e, x, y + 1.0, z - 0.2, { mat: MAT.metal });
    }
    // lamps and a row of trees round the car park
    for (const e of edges(Z)) {
      const n = Math.floor(e.len / 18);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = e.a[0] + (e.b[0] - e.a[0]) * t - e.nx * 3;
        const z = e.a[1] + (e.b[1] - e.a[1]) * t - e.nz * 3;
        const y = ground(x, z);
        if (i % 2) {
          k.cyl(0.08, 0.12, 9, 4, 'steel', x, y, z, { open: true });
          k.box(0.5, 0.25, 1.2, 'window', x, y + 9, z, { emit: 0.8 });
        } else lowTree(k, x, y, z, 9 + rnd() * 3, { lobes: 1 });
      }
    }
  }
}
forum.metric = true;
forum.rule = {
  extent: [/Zona Exterior/],
  // the retaining wall stands on the pad edge and hides the steep falloff
  // (the back edge is the pavilion's back wall: the park lawn meets it)
  // and a 22 m forecourt at the entrance level in front
  pad: { box: { x0: -100, x1: 98.8, z0: -19.9, z1: 70 }, margin: 0, fall: 2 },
  frame: { parts: [/Altice/], margin: 22 },
  view: 0.55,
  note: 'pad only on the main rectangle of the building (2 m falloff), back edge = the pavilion wall, retaining walls at the SE end: the DEM rises 12 m toward Parque da Ponte; mask = the building; the outdoor zone and car park draped',
};

export default { 'forum-braga': forum };

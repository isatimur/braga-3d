// Estádio Municipal de Braga (Eduardo Souto de Moura, 2003), metric builder.
// OSM: the site outline (238 x 125 m) = Stand 1 (NE, the free-standing east
// stand), the pitch, Stand 2 (SW, the west stand carved into the granite).
// Local frame: +z = NE (outer face of the east stand), the stands run along
// x (125 m), +x = NW (open end toward the city), -x = SE (the quarry face).
// From data/dimensions.json (AFA engineers' paper): roof 50 m high, 202 m
// span, two roofed bands of 55 m and a 95 m open middle, cable pairs every
// 3.75 m, a 0.24 m slab, 16 blades 1 m thick under the east stand, 18
// uprights in the west stand; pitch 105 x 68 m.
// Estimated from photos: two tiers per stand with a row of boxes between.
import * as THREE from 'three';
import { MAT } from './kit.js';

const CONC = 'graniteLight'; // exposed concrete
const ROCK = 'granite';

// Stepped seating tiers seen in the (z, y) plane, extruded along x.
function tiersShape(zs, pts) {
  const s = new THREE.Shape();
  s.moveTo(zs * pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(zs * pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

function steps(z0, y0, z1, y1, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const za = z0 + ((z1 - z0) * i) / n;
    const zb = z0 + ((z1 - z0) * (i + 1)) / n;
    const y = y0 + ((y1 - y0) * (i + 1)) / n;
    out.push([za, y], [zb, y]);
  }
  return out;
}

function estadio(k, { footprint, dims }) {
  const rnd = k.rnd;
  const E = dims?.elements ?? {};
  const g = footprint.ground;
  const ob = footprint.box;
  const X0 = -62.4;
  const X1 = 62;
  const SL = X1 - X0; // stand length along x, ~125 m
  const XC = (X0 + X1) / 2;
  const ZP = 44; // pitch edge (OSM stand / pitch boundary)
  const ZB = 118.5; // outer edge of the stands
  const PL = E.pitch_length_m ?? 105;
  const PW = E.pitch_width_m ?? 68;
  const H = dims?.height_m?.total ?? 50;
  const ROOF = H - 1.2; // roof slab level at the stand tops
  const ZT = 101; // stand top / roof anchor line (202 m span)
  const band = E.roof_covered_band_each_m ?? 55;
  const ZR = ZT - band; // inner edge of each roofed band (46 m)

  k.begin('main');
  // --- pitch and apron, mowing stripes and lines
  k.prism(footprint.part('pitch')?.pts ?? [[X0, -ZP], [X1, -ZP], [X1, ZP], [X0, ZP]], -0.6, 0.8, 'grass');
  for (let i = 0; i < 14; i++) k.box(PL / 14, 0.04, PW, i % 2 ? 'grass' : 'hedge', XC - PL / 2 + (i + 0.5) * (PL / 14), 0.2, 0, { mat: MAT.flat });
  const line = (w, d, x, z) => k.box(w, 0.05, d, 'white', XC + x, 0.21, z, { mat: MAT.flat });
  line(PL, 0.14, 0, PW / 2);
  line(PL, 0.14, 0, -PW / 2);
  line(0.14, PW, PL / 2, 0);
  line(0.14, PW, -PL / 2, 0);
  line(0.14, PW, 0, 0);
  k.add(new THREE.TorusGeometry(9.15, 0.08, 3, 40), 'white', { x: XC, y: 0.22, rx: Math.PI / 2, mat: MAT.flat });
  for (const sx of [-1, 1]) {
    line(0.14, 40.3, sx * (PL / 2 - 16.5), 0);
    for (const sz of [-1, 1]) line(16.5, 0.14, sx * (PL / 2 - 8.25), sz * 20.15);
    // goal: posts, crossbar, net box
    const gx = XC + sx * (PL / 2 + 0.1);
    for (const sz of [-1, 1]) k.box(0.12, 2.44, 0.12, 'white', gx, 0.2, sz * 3.66);
    k.box(0.12, 0.12, 7.32, 'white', gx, 2.6, 0);
    k.box(2, 2.4, 7.3, 'white', gx + sx * 1, 0.2, 0, { glass: true });
  }
  // track of dark rubber round the grass, advertising boards
  for (const sz of [-1, 1]) k.box(SL - 6, 0.9, 0.2, 'dark', XC, 0.2, sz * (PW / 2 + 5));

  // --- the two stands: lower tier, row of boxes, upper tier (two tiers)
  for (const zs of [1, -1]) {
    const prof = [
      [ZP + 2, -1],
      [ZP + 2, 1.4],
      ...steps(ZP + 3, 1.4, 70, 12, 16),
      [70, 16.2],
      ...steps(71.5, 16.2, ZT - 1, ROOF - 7, 22),
      [ZT, ROOF - 5.8],
      [ZT, ROOF - 13],
      [75, 14],
      [75, -1],
    ];
    k.extrude(tiersShape(zs, prof), SL, 'seat', XC, 0, 0, { ry: -Math.PI / 2, mat: MAT.smooth });
    // aisle stairs (yellow in the photos) and vomitories
    for (let i = 0; i < 9; i++) {
      const x = X0 + 8 + i * ((SL - 16) / 8);
      k.segment([x, 1.6, zs * (ZP + 3)], [x, 12.2, zs * 70], 1, 0.12, 'flowerYellow', { mat: MAT.flat });
      k.segment([x, 16.4, zs * 71.5], [x, ROOF - 6.8, zs * (ZT - 1)], 1, 0.12, 'flowerYellow', { mat: MAT.flat });
      if (i < 8) k.box(2.4, 2.6, 1.4, 'dark', x + (SL - 16) / 16, 12.1, zs * 70.2);
    }
    // box row: glazed band under the upper tier
    k.box(SL, 3.6, 0.3, 'glass', XC, 12.2, zs * 70.9, { emit: 0.15 });
    // front wall of the lower tier and the rail on top of the upper tier
    k.box(SL, 1.4, 0.4, CONC, XC, -0.2, zs * (ZP + 2), { mat: MAT.smooth });
    k.box(SL, 1.1, 0.4, CONC, XC, ROOF - 5.8, zs * (ZT - 0.2), { mat: MAT.smooth });
    // end walls closing the stands
    for (const ex of [X0, X1]) {
      k.extrude(tiersShape(zs, [[ZP + 2, -1], [ZP + 2, 2.4], [70, 13], [ZT, ROOF - 5], [ZT, -1]]), 0.8, CONC, ex, 0, 0, { ry: -Math.PI / 2, mat: MAT.smooth });
    }
  }

  // --- east stand (+z): 16 blades from the foundation to the roof, floors
  const nb = E.east_stand_blades ?? 16;
  for (let i = 0; i < nb; i++) {
    const x = X0 + 0.5 + (i * (SL - 1)) / (nb - 1);
    // 75,14 -> down to the ground -> along it -> up the back -> top -> back along the tier
    const ord = [[75, 14]];
    for (let z = 75; z < ZB - 1; z += 8.7) ord.push([z, Math.min(-1, g(x, z) - 1.5)]);
    ord.push([ZB, Math.min(-1, g(x, ZB) - 1.5)], [ZB, H], [ZT - 2, H], [ZT - 2, ROOF - 13]);
    const s = new THREE.Shape();
    s.moveTo(ord[0][0], ord[0][1]);
    for (let j = 1; j < ord.length; j++) s.lineTo(ord[j][0], ord[j][1]);
    s.closePath();
    k.extrude(s, 1, CONC, x, 0, 0, { ry: -Math.PI / 2, mat: MAT.smooth });
  }
  // concourse floors between the blades, glazed rooms, the roof-level square
  for (const y of [4, 13, 22, 31, 40]) {
    const zIn = y < 14 ? 76 : 76 + (y - 14) * 1.05;
    if (zIn > ZB - 4) continue;
    k.box(SL, 0.5, ZB - 1 - zIn, CONC, XC, y, (ZB - 1 + zIn) / 2, { mat: MAT.smooth });
    k.box(SL - 2, 0.9, 0.08, 'iron', XC, y + 0.5, ZB - 1);
    if (y < 30) k.box(SL - 2, 3.2, 0.2, 'glass', XC, y + 0.5, zIn + 3, { emit: 0.2 });
  }
  k.box(SL, 0.8, ZB - ZT + 2, CONC, XC, H - 0.8, (ZB + ZT) / 2 - 1, { mat: MAT.smooth });

  // --- west stand (-z): 18 uprights, the granite it is carved into
  const nu = E.west_stand_uprights ?? 18;
  for (let i = 0; i < nu; i++) {
    const x = X0 + 1 + (i * (SL - 2)) / (nu - 1);
    k.box(1, H - (ROOF - 13), 2.2, CONC, x, ROOF - 13, -(ZT + 1.2), { mat: MAT.smooth });
  }
  k.box(SL, 0.8, 6, CONC, XC, H - 0.8, -(ZT + 2.5), { mat: MAT.smooth }); // upper west square
  // the rock mass behind and under the upper tier, meeting the hillside
  const rockTop = (x) => Math.max(H - 3, g(x, -ZB) + 2);
  k.extrude(tiersShape(-1, [[75, -1], [75, 14], [ZT, ROOF - 13], [ZT + 4.5, ROOF - 13], [ZT + 4.5, H - 6], [ZB, H - 4], [ZB, -1]]), SL, ROCK, XC, 0, 0, { ry: -Math.PI / 2, mat: MAT.smooth });
  for (let i = 0; i < 22; i++) {
    const x = X0 + 3 + i * ((SL - 6) / 21) + (rnd() - 0.5) * 2;
    const z = -(ZT + 8 + rnd() * 8);
    k.ico(3 + rnd() * 2.5, 1, rnd() > 0.4 ? ROCK : 'graniteGrey', x, rockTop(x) - 2.5 + rnd() * 1.5, z, { jitter: 0.25, sy: 0.55, mat: MAT.smooth });
    if (i % 3 === 0) k.ico(2.2, 1, 'foliage', x + 1.5, rockTop(x) - 0.5, z - 2, { jitter: 0.3, sy: 0.5 });
  }

  // --- the roof: two slab bands hung on cable pairs, open middle
  const sag = (z) => ROOF - 4 * (1 - (z / ZT) ** 2); // parabola, anchors at +-ZT
  const nSeg = 6;
  for (const zs of [1, -1]) {
    for (let j = 0; j < nSeg; j++) {
      const za = ZR + (band * j) / nSeg;
      const zb = ZR + (band * (j + 1)) / nSeg;
      k.segment([XC, sag(za), zs * za], [XC, sag(zb), zs * zb], SL + 2, 0.24, 'white', { mat: MAT.smooth });
    }
    // steel edge beam at the inner edge of the band and the light rig
    k.box(SL + 2, 0.9, 0.5, 'steel', XC, sag(ZR) - 0.9, zs * ZR);
    for (let i = 0; i < 30; i++) k.box(0.9, 0.35, 0.4, 'window', X0 + 2 + i * ((SL - 4) / 29), sag(ZR) - 1.3, zs * (ZR + 0.3), { emit: 0.8 });
  }
  // cable pairs every 3.75 m across the whole 202 m span (every pair drawn)
  const pitch = E.cable_pair_spacing_m ?? 3.75;
  const nPairs = Math.floor(SL / pitch);
  const cz = [];
  for (let j = 0; j <= 10; j++) cz.push(-ZT + (2 * ZT * j) / 10);
  for (let i = 0; i <= nPairs; i++) {
    const xm = XC - (nPairs * pitch) / 2 + i * pitch;
    for (const dx of [-0.35, 0.35]) {
      for (let j = 0; j < cz.length - 1; j++) {
        const za = cz[j];
        const zb = cz[j + 1];
        // cables run just above the slab where it is roofed
        k.segment([xm + dx, sag(za) + 0.2, za], [xm + dx, sag(zb) + 0.2, zb], 0.09, 0.09, 'iron', { round: true, seg: 3 });
      }
    }
  }

  // --- open NW end: the scoreboard screen on its frame
  k.box(1, 7, 24, 'dark', X1 - 3, 3, 0, { emit: 0.05 });
  for (const sz of [-1, 1]) k.box(0.6, 10, 0.6, 'iron', X1 - 3, -1, sz * 12);
  // --- SE end: the granite quarry face behind the goal
  // benches of cut rock stepping back and up (quarry faces), broken blocks
  for (let i = 0; i < 9; i++) {
    const z = -ZP + 4 + i * ((2 * ZP - 8) / 8);
    const h = 14 + rnd() * 10 + (1 - Math.abs(z) / ZP) * 8;
    const c = i % 3 ? ROCK : 'graniteGrey';
    k.frustum(7.5, 11 + rnd() * 2, 3.5 + rnd(), 9, h, c, X0 + 4, -1, z, { ry: (rnd() - 0.5) * 0.2, mat: MAT.smooth });
    k.ico(4 + rnd() * 2, 1, rnd() > 0.5 ? 'graniteLight' : ROCK, X0 + 5.5, h * (0.35 + rnd() * 0.4), z + (rnd() - 0.5) * 4, { jitter: 0.3, sy: 0.9, sx: 0.6, mat: MAT.smooth });
    k.ico(3 + rnd() * 1.5, 1, ROCK, X0 + 3.5, h - 1, z + (rnd() - 0.5) * 3, { jitter: 0.3, sy: 0.6, mat: MAT.smooth });
    if (i % 2) k.ico(2.4, 1, 'foliage', X0 + 3, h + 0.5, z + 2, { jitter: 0.3, sy: 0.45 });
    k.ico(1.2 + rnd(), 0, 'graniteLight', X0 + 8.5 + rnd() * 1.5, 0, z + (rnd() - 0.5) * 6, { jitter: 0.3, sy: 0.7, mat: MAT.smooth });
  }
  k.end('main');
  void ob;
}
estadio.metric = true;
estadio.rule = {
  base: { part: 'pitch', stat: 'mean' },
  pad: { parts: ['pitch'] },
  view: 0.9,
  note: 'base on the pitch, pad only under the pitch; the east stand blades reach down to the real ground, the west stand backs into the rock',
};

export default { 'estadio-braga': estadio };

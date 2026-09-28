// Santuário de Nossa Senhora do Sameiro, metric builder (1:1 metres).
//
// Local frame (fit.js): +z = the west front, which looks down the esplanade
// toward Braga; origin at the centre of the church's OSM outline. The front
// is the flat 19.6 m end of that outline (edge normal 280 deg; the long axis
// of the whole outline, 258 deg in dimensions.json, is skewed by the rounded
// side bodies and the polygonal east end).
//
// On the outline, west to east: the two granite bell towers with the
// frontispiece between them, the nave, the white round side bodies ending
// in granite pavilions, the crossing with the drum, the white ribbed dome,
// the lantern and the crowned cross, the polygonal chevet. In front: the
// church podium with its stair, and the esplanade over the crypt (OSM part
// 'Cripta') with the two 20 m column pedestals, lamps and the balustrade
// along its view edge.
//
// Heights (data/dimensions.json, photo estimates): towers 35 m, total 42 m
// (cross), dome springing 26 m above the esplanade, dome ~12 m across,
// nave ridge 20 m, pedestals 20 m. The church floor stands on a 2.5 m
// podium. The front, read off assets/img/sameiro.jpg (square-on from the
// stair, scaled so the tower spires end at 35 m):
//   frontispiece: arched door between paired fluted columns, entablature
//     at 7.7 m, the great arched window with its tracery over a balustraded
//     balcony between paired pilasters, main cornice at 16.8 m, pediment
//     with the arms and a tall cross;
//   towers: two stacked rose windows, an arched window with a balcony,
//     main cornice, clock stage, belfry with a bell over a balustrade,
//     cornice with a small pediment on each face, an attic with four flame
//     finials round a drum pierced by an oculus per face, an ogee stone cap
//     and a slender ringed spire to 35 m;
//   dome: white render on the drum, a balustrade ring with urns at the
//     springing, eight ribs, the star medallion over the front, a colonnaded
//     lantern with tall windows inside its own balustrade, a stepped cupola,
//     the gold crown ring and orb, the cross at 42 m.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win, pediment, cartouche, bell, flutedColumn, flameUrn, shell } from './parts.js';
import { bbox, edges, offset, clean, centroid } from './geom.js';
import { polyCornice, onEdge } from './metric.js';

const G = 'granite';
const GL = 'graniteLight'; // carved and dressed parts
const TAU = Math.PI * 2;

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

// Balustrade on a circle: plinth, rail, turned balusters, optional urns on
// piers every `urns` balusters.
function ringBalustrade(k, x, y, z, r, h, n, color, o = {}) {
  k.cyl(r + 0.18, r + 0.18, h * 0.16, 32, color, x, y, z, { open: true, smooth: true });
  k.cyl(r + 0.22, r + 0.22, h * 0.16, 32, color, x, y + h * 0.84, z, { open: true, smooth: true });
  k.cyl(r + 0.28, r + 0.28, h * 0.05, 32, color, x, y + h, z, { smooth: true });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (o.urns && i % o.urns === 0) {
      k.box(h * 0.32, h, h * 0.32, color, px, y, pz, { ry: -a });
      k.urn(h * 0.8, color, px, y + h * 1.05, pz, { seg: 6 });
    } else {
      // two stacked frusta: the swelling of a turned baluster, 16 triangles
      k.cyl(0.07, 0.12, h * 0.34, 4, color, px, y + h * 0.16, pz, { open: true });
      k.cyl(0.12, 0.07, h * 0.34, 4, color, px, y + h * 0.5, pz, { open: true });
    }
  }
}

// Straight light balustrade along x (plinth, rail, 4-sided balusters,
// piers every `pier` metres). Cheap enough for long terrace edges.
function lineBalustrade(k, len, h, color, x, y, z, o = {}) {
  const sp = o.sp ?? 0.5;
  const n = Math.max(2, Math.round(len / sp));
  k.box(len, h * 0.16, 0.42, color, x, y, z);
  k.box(len + 0.1, h * 0.14, 0.5, color, x, y + h * 0.86, z);
  for (let i = 0; i < n; i++) {
    const bx = x - len / 2 + (i + 0.5) * (len / n);
    k.cyl(0.07, 0.11, h * 0.7, 4, color, bx, y + h * 0.16, z, { open: true });
  }
  if (o.pier) {
    const np = Math.max(1, Math.round(len / o.pier));
    for (let i = 0; i <= np; i++) k.box(0.55, h * 1.1, 0.55, color, x - len / 2 + (i * len) / np, y, z);
  }
}

// Clock face on a wall face at z (facing +z): moulded ring, white dial,
// hour marks, two hands.
function clock(k, x, y, z, r) {
  k.cyl(r + 0.16, r + 0.16, 0.2, 16, GL, x, y - 0.1, z + 0.02, { rx: Math.PI / 2, smooth: true });
  k.cyl(r, r, 0.08, 16, 'white', x, y - 0.04, z + 0.14, { rx: Math.PI / 2, smooth: true, mat: MAT.smooth });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    k.box(0.05, r * 0.2, 0.03, 'dark', x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8 - r * 0.1, z + 0.2, { rz: a - Math.PI / 2 });
  }
  k.box(0.05, r * 0.7, 0.03, 'dark', x + r * 0.12, y, z + 0.22, { rz: -0.35 });
  k.box(0.05, r * 0.5, 0.03, 'dark', x - r * 0.16, y, z + 0.23, { rz: 2.1 });
}

// Round rose window with a moulded frame and a dark tracery grid.
function rose(k, x, y, z, r) {
  k.cyl(r + 0.18, r + 0.18, 0.25, 14, GL, x, y - 0.12, z + 0.02, { rx: Math.PI / 2, smooth: true, mat: MAT.smooth });
  k.cyl(r, r, 0.06, 14, 'glass', x, y - 0.03, z + 0.15, { rx: Math.PI / 2, smooth: true });
  for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) k.box(0.06, r * 2, 0.05, GL, x, y - r, z + 0.2, { rz: a });
}

// Paired pilasters (the Sameiro front is articulated by pairs): two
// strips, bases and capitals, from y to y + h at x, face at z.
function pilasters(k, x, y, h, z, o = {}) {
  const w = o.w ?? 0.55;
  const gap = o.gap ?? 0.28;
  for (const s of o.single ? [0] : [-1, 1]) {
    const px = x + s * (w / 2 + gap / 2);
    k.box(w, h, 0.32, G, px, y, z + 0.16);
    k.box(w + 0.18, 0.3, 0.46, G, px, y, z + 0.23);
    // capital with a band of leaves (Corinthian by the photo)
    if (!o.plain) k.frustum(w, 0.34, w + 0.24, 0.5, 0.45, GL, px, y + h - 0.6, z + 0.2, { mat: MAT.smooth });
    k.box(w + 0.3, 0.16, 0.56, GL, px, y + h - 0.16, z + 0.26, { mat: MAT.smooth });
  }
}

// One bell tower at (x, z), plan w x w, floor at y = 0 inside the push.
// Levels (above the church floor): entablature 7.7, main cornice 16.8,
// clock stage, belfry 19.9-25.4, crown to hTop.
function tower(k, x, z, w, y0, hTop, hEnt, hCor) {
  k.push({ x, y: y0, z });
  const f = w / 2; // front face
  // plinth and body
  k.box(w + 0.7, 1.1, w + 0.7, G, 0, -0.3, 0);
  k.box(w, hCor, w, G, 0, 0, 0);
  // corner pilasters on the front and the outer side
  for (const s of [-1, 1]) {
    pilasters(k, s * (f - 0.45), 0.8, hEnt - 1.4, f, { single: true, w: 0.7 });
    pilasters(k, s * (f - 0.45), hEnt + 0.5, hCor - hEnt - 1.1, f, { single: true, w: 0.7 });
    k.push({ ry: s * Math.PI / 2 });
    // turned a quarter: local x = -s * ... is the front corner of that side
    pilasters(k, -s * (f - 0.45), 0.8, hEnt - 1.4, f, { single: true, w: 0.7 });
    pilasters(k, -s * (f - 0.45), hEnt + 0.5, hCor - hEnt - 1.1, f, { single: true, w: 0.7 });
    k.pop();
  }
  k.corniceRing(w + 0.2, w + 0.2, corniceProfile('classic', 0.55), G, 0, hEnt - 0.3, 0);
  k.box(w + 0.35, 0.4, w + 0.35, G, 0, hEnt - 0.7, 0);
  // two stacked rose windows, the arched window with its balcony
  rose(k, 0, 2.3, f, 0.5);
  rose(k, 0, 3.75, f, 0.5);
  win(k, 0, 9.6, 1.7, 4.4, f, { arch: 'round', trim: GL, bw: 0.32, depth: 0.3, pane: 'glass' });
  k.box(2.6, 0.3, 0.9, G, 0, 9.0, f + 0.45);
  lineBalustrade(k, 2.4, 0.9, GL, 0, 9.3, f + 0.7, { sp: 0.3 });
  // main cornice
  k.box(w + 0.3, 0.6, w + 0.3, G, 0, hCor - 0.9, 0);
  k.corniceRing(w + 0.3, w + 0.3, corniceProfile('classic', 0.8), G, 0, hCor - 0.3, 0);
  // clock stage
  const yC = hCor + 0.5;
  const cw = w - 0.4;
  const hCS = 2.3;
  k.box(cw, hCS, cw, G, 0, yC, 0);
  for (const s of [-1, 1]) k.box(0.6, hCS, 0.25, G, s * (cw / 2 - 0.3), yC, cw / 2 + 0.12);
  clock(k, 0, yC + hCS / 2, cw / 2, 0.55);
  k.corniceRing(cw + 0.2, cw + 0.2, corniceProfile('classic', 0.45), G, 0, yC + hCS, 0);
  // belfry: arched opening per face over a balustrade, paired pilasters
  const yB = yC + hCS + 0.45;
  const hF = 4.8;
  const bw = w - 0.5;
  const t = 0.6;
  for (const [ry, len] of [[0, bw], [Math.PI, bw], [Math.PI / 2, bw - 2 * t], [-Math.PI / 2, bw - 2 * t]]) {
    k.push({ y: yB, ry });
    const hole = { x: 0, y: 0.8, w: 1.8, h: 3.3, arch: 'round', pane: null };
    k.wall(len, hF, t, G, [hole], 0, 0, bw / 2 - t / 2);
    k.surround(hole, 0.2, 0.15, GL, bw / 2);
    k.box(0.4, 0.5, 0.25, GL, 0, hole.y + hole.h + 0.05, bw / 2 + 0.12);
    lineBalustrade(k, 1.9, 0.8, GL, 0, 0.1, bw / 2 - 0.1, { sp: 0.3 });
    for (const s of [-1, 1]) pilasters(k, s * (bw / 2 - 0.55), 0, hF - 0.1, bw / 2, { w: 0.34, gap: 0.14, plain: true });
    k.pop();
  }
  k.box(bw - 2 * t, hF, bw - 2 * t, 'dark', 0, yB, 0);
  bell(k, 1.4, 0, yB + 1.4, 0.3);
  k.corniceRing(bw + 0.2, bw + 0.2, corniceProfile('classic', 0.6), G, 0, yB + hF - 0.1, 0);
  // small pediment on each face
  const yP = yB + hF + 0.5;
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    k.push({ ry });
    pediment(k, bw - 0.6, 0.85, 0.4, G, 0, yP, bw / 2 - 0.3, { frame: 0.2 });
    k.pop();
  }
  // crown: attic, flame finials, pierced drum, ogee cap, ringed spire
  k.box(bw - 1.1, 0.6, bw - 1.1, G, 0, yP, 0);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    k.box(0.6, 0.5, 0.6, G, sx * (bw / 2 - 0.4), yP, sz * (bw / 2 - 0.4));
    flameUrn(k, 2.0, G, sx * (bw / 2 - 0.4), yP + 0.5, sz * (bw / 2 - 0.4), { seg: 5 });
  }
  const yD = yP + 0.6;
  const rD = 1.35;
  const hDr = 1.6;
  k.cyl(rD, rD + 0.05, hDr, 12, G, 0, yD, 0, { smooth: true });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k.push({ ry: a });
    k.cyl(0.42, 0.42, 0.25, 10, GL, 0, yD + hDr / 2 - 0.12, rD - 0.02, { rx: Math.PI / 2, smooth: true });
    k.cyl(0.26, 0.26, 0.1, 10, 'dark', 0, yD + hDr / 2 - 0.05, rD + 0.1, { rx: Math.PI / 2 });
    k.pop();
  }
  k.cyl(rD + 0.3, rD + 0.25, 0.3, 12, G, 0, yD + hDr, 0, { smooth: true });
  const yO = yD + hDr + 0.3;
  // ogee cap: bulge then waist (the stone bell of the photo)
  // (a tall bell tapering into the spire, not a dome: photo sameiro.jpg)
  k.lathe([[0, 0], [1.45, 0], [1.48, 0.08], [1.3, 0.2], [1.0, 0.4], [0.7, 0.6], [0.5, 0.78], [0.55, 0.86], [0.42, 1], [0, 1]], 12, G, 0, yO, 0, { sr: 1, sh: 2.1, smooth: true });
  const yS = yO + 2.1;
  const hS = hTop - y0 - yS;
  // slender eight-sided spire, a stack of rings like a pine cone, a knob
  k.cone(0.4, hS - 0.3, 8, G, 0, yS, 0);
  for (const u of [0.08, 0.3, 0.52]) k.cyl(0.44 * (1 - u) + 0.05, 0.48 * (1 - u) + 0.05, 0.16, 8, G, 0, yS + hS * u, 0);
  k.sphere(0.2, G, 0, yS + hS - 0.2, 0, { seg: 8, rings: 5 });
  k.pop();
}

function sameiro(k, { footprint, dims }) {
  const H = dims?.height_m || {};
  const hTotal = H.total ?? 42;
  const hTowers = H.towers ?? 35;
  const out = footprint.outline;
  const b = footprint.box;
  const zF = b.z1; // front face (27.5)
  const F = 2.5; // church floor above the esplanade
  // heights above the floor, from the frontal photo
  const hEnt = 7.7; // first entablature
  const hCor = 16.8; // main cornice (frontispiece and tower bodies)
  const hPed = 19.8; // pediment apex
  const hSide = 12.2; // side bodies
  const hNave = H.nave_ridge ?? 20;
  const TW = 5.8; // tower width
  // the flat front end of the outline (19.6 m): the towers stand at its ends
  const frontHalf = Math.max(...out.filter(([, z]) => z > zF - 1).map(([x]) => Math.abs(x)));
  const xT = frontHalf - TW / 2; // tower centre (both sides, mirrored)
  const zT = zF - TW / 2 - 0.1;
  const CW = 2 * (xT - TW / 2); // frontispiece width (8 m)

  k.begin('main');
  // --- podium (plinth under the whole church, on the real outline)
  k.prism(offset(out, 0.6), -0.5, F + 0.5, G);
  k.prism(offset(out, 0.9), F - 0.35, 0.35, GL, { bevel: 0.08 });

  // --- nave behind the front (z 8.5 .. front block)
  const nave = [[-9.3, 8.5], [9.3, 8.5], [9.3, zF - TW], [-9.3, zF - TW]];
  const eaves = hNave - 4.5; // ridge at the real 20 m above the esplanade
  k.prism(nave, F, eaves - F, G);
  polyCornice(k, nave, eaves - 0.7, corniceProfile('classic', 0.7), G);
  k.gableRoof(18.6, zF - TW - 8.5, 4.5, 'terracotta', 0, eaves, (8.5 + zF - TW) / 2, { over: 0.5 });
  for (const sx of [-1, 1]) {
    k.push({ x: sx * 9.3, ry: sx * Math.PI / 2 });
    win(k, sx * -15, F + 6, 1.6, 4, 0, { arch: 'round', trim: G, bw: 0.35, depth: 0.3 });
    k.pop();
  }

  // --- side bodies: white drums on the outline, granite pavilions at the ends
  for (const sx of [-1, 1]) {
    // outline beyond the nave on this side, forward of the chevet
    let side = clip(out, -sx, 0, -9.3); // sx*x >= 9.3
    side = clip(side, 0, -1, 7.5); // z >= -7.5
    if (side.length < 3) continue;
    const pav = clip(side, -sx, 0, -15); // sx*x >= 15
    const drum = clip(side, sx, 0, 15.2);
    k.prism(drum, F, hSide, 'white', { mat: MAT.render });
    polyCornice(k, drum, F + hSide - 0.6, corniceProfile('classic', 0.55), G);
    k.prism(offset(drum, -0.2), F + hSide, 0.5, 'lead');
    // balustrade along the curved outer edges of the drum
    for (const e of edges(drum)) {
      if (e.len < 1.5 || Math.abs(e.nx * sx) < 0.2) continue;
      onEdge(k, e, F + hSide + 0.4, -0.3);
      lineBalustrade(k, e.len, 1, GL, 0, 0, 0, { sp: 0.7 });
      k.pop();
      // granite pilasters on the white drum
      onEdge(k, e, F, 0.1);
      k.box(0.8, hSide, 0.3, G, -e.len / 2, 0, 0);
      k.pop();
    }
    // oval medallion (the Marian monogram) on the drums, facing the front
    const dc = centroid(drum);
    k.cyl(0.9, 0.9, 0.3, 12, GL, dc[0], F + 6.5, dc[1] + 4.5, { rx: Math.PI / 2, sy: 1.4, mat: MAT.smooth });
    if (pav.length > 2) {
      k.prism(pav, F, hSide - 0.3, G);
      polyCornice(k, pav, F + hSide - 0.9, corniceProfile('classic', 0.6), G);
      // pediment on the outer edge, crosses and finials
      let oe = null;
      for (const e of edges(pav)) if (!oe || e.nx * sx > oe.nx * sx) oe = e;
      onEdge(k, oe, F + hSide - 0.3, 0.1);
      pediment(k, oe.len + 0.6, 2.3, 0.8, G, 0, 0, 0, { frame: 0.35 });
      k.box(1.1, 1.8, 0.2, 'dark', 0, -7, 0.05);
      win(k, 0, -8.5, 1.3, 3.4, 0.05, { arch: 'round', trim: G, bw: 0.3, depth: 0.3 });
      for (const u of [-oe.len / 2, oe.len / 2]) flameUrn(k, 1.8, G, u, 0, 0);
      k.box(0.25, 3, 0.25, G, 0, 2.3, 0);
      k.box(1.4, 0.25, 0.25, G, 0, 4.4, 0);
      k.pop();
      const [pcx, pcz] = centroid(pav);
      k.hipRoof(Math.max(2, bbox(pav).w - 1), Math.max(2, bbox(pav).d - 1), 1.6, 'terracotta', pcx, F + hSide - 0.3, pcz, { over: 0.3 });
    }
  }

  // --- chevet: polygonal east end on the outline
  const chevet = clip(out, 0, 1, -7.5); // z <= -7.5
  const hCh = 15;
  k.prism(chevet, F, hCh, G);
  polyCornice(k, chevet, F + hCh - 0.7, corniceProfile('classic', 0.7), G);
  const cb = bbox(chevet);
  k.hipRoof(cb.w - 8, cb.d - 2, 4, 'terracotta', 0, F + hCh, cb.cz + 1, { over: 0.4 });
  for (const e of edges(chevet)) {
    if (e.len < 8 || e.nz > 0.5) continue;
    onEdge(k, e, 0, 0);
    for (const u of [-e.len / 4, e.len / 4]) win(k, u, F + 7, 1.6, 4.2, 0, { arch: 'round', trim: G, bw: 0.35, depth: 0.3 });
    k.pop();
  }

  // --- crossing, drum, dome, lantern, crowned cross
  const DZ = 0.3;
  const R = 5.8; // drum radius (dome ~12 m across)
  const hDrum = 2.6;
  const ySpring = H.dome_springing ?? 26; // above the esplanade
  const yD = ySpring - hDrum - 0.8; // drum base
  k.box(18.6, yD - F, 16, G, 0, F, DZ);
  k.corniceRing(18.6, 16, corniceProfile('classic', 0.7), G, 0, yD - 0.7, DZ);
  k.cyl(R + 0.5, R + 0.7, 0.8, 28, G, 0, yD, DZ, { smooth: true });
  k.cyl(R, R, hDrum, 28, 'white', 0, yD + 0.8, DZ, { smooth: true, mat: MAT.render });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    k.box(0.7, hDrum, 0.4, 'white', Math.cos(a) * R, yD + 0.8, DZ + Math.sin(a) * R, { ry: -a + Math.PI / 2, mat: MAT.render });
    if (i % 2) k.box(1.1, 1.8, 0.2, 'dark', Math.cos(a + 0.26) * (R + 0.02), yD + 1.2, DZ + Math.sin(a + 0.26) * (R + 0.02), { ry: -(a + 0.26) + Math.PI / 2 });
  }
  // springing: moulded cornice and the balustrade ring with urns
  k.cyl(R + 0.7, R + 0.3, 0.4, 28, 'white', 0, ySpring - 0.4, DZ, { smooth: true, mat: MAT.render });
  k.cyl(R + 0.8, R + 0.8, 0.12, 28, 'white', 0, ySpring, DZ, { smooth: true, mat: MAT.render });
  ringBalustrade(k, 0, ySpring + 0.12, DZ, R + 0.35, 1.1, 48, 'white', { urns: 6 });
  const hDome = 7.2;
  const rDome = R - 0.2;
  const yDm = ySpring + 0.12;
  k.dome(rDome, 'white', 0, yDm, DZ, { seg: 32, rings: 14, sy: hDome / rDome, smooth: true, mat: MAT.render });
  // eight ribs, standing proud of the shell
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    k.add(new THREE.TorusGeometry(rDome + 0.02, 0.2, 4, 14, Math.PI / 2), 'plaster', { x: 0, y: yDm, z: DZ, ry: a, sy: hDome / (rDome + 0.02), mat: MAT.render });
  }
  // the star medallion on the west face of the dome: an eight-point star
  // with a round window, tilted to the shell
  {
    const th = 0.62;
    const sy = yDm + hDome * Math.sin(th);
    const sz = DZ + rDome * Math.cos(th) + 0.05;
    const tilt = Math.atan((Math.sin(th) / hDome) / (Math.cos(th) / rDome));
    const star = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + Math.PI / 2;
      const r = i % 2 ? 0.55 : 1.05;
      star.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    k.push({ x: 0, y: sy, z: sz, rx: -tilt });
    k.extrude(new THREE.Shape(star), 0.2, GL, 0, 0, 0, { mat: MAT.smooth });
    k.cyl(0.42, 0.42, 0.14, 12, 'dark', 0, -0.07, 0.12, { rx: Math.PI / 2 });
    k.pop();
  }
  // lantern: plinth, balustrade, eight columns with tall windows between,
  // cornice, stepped cupola, gold crown ring, orb, cross
  const yL = yDm + hDome - 0.5;
  k.cyl(2.5, 2.7, 0.7, 20, 'white', 0, yL, DZ, { smooth: true, mat: MAT.render });
  ringBalustrade(k, 0, yL + 0.7, DZ, 2.45, 0.9, 26, 'white');
  const rL = 1.45;
  const hL = 3.0;
  k.cyl(rL - 0.12, rL - 0.12, hL, 16, 'white', 0, yL + 0.7, DZ, { smooth: true, mat: MAT.render });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    k.cyl(0.14, 0.17, hL, 8, 'white', Math.cos(a) * rL, yL + 0.7, DZ + Math.sin(a) * rL, { smooth: true, mat: MAT.render });
    const a2 = a + TAU / 16;
    k.box(0.55, hL - 0.9, 0.08, 'glass', Math.cos(a2) * (rL - 0.07), yL + 1.05, DZ + Math.sin(a2) * (rL - 0.07), { ry: -a2 + Math.PI / 2 });
  }
  const yK = yL + 0.7 + hL;
  k.cyl(rL + 0.35, rL + 0.2, 0.45, 16, 'white', 0, yK, DZ, { smooth: true, mat: MAT.render });
  k.lathe([[0, 0], [1.4, 0], [1.4, 0.18], [1.1, 0.22], [1.05, 0.42], [0.8, 0.46], [0.75, 0.66], [0.52, 0.7], [0.48, 0.86], [0.3, 0.9], [0.3, 1], [0, 1]], 16, 'white', 0, yK + 0.45, DZ, { sr: 1, sh: 2.0, smooth: true, mat: MAT.render });
  const yC = yK + 0.45 + 2.0;
  const crownR = 0.6;
  for (const ry of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) k.add(new THREE.TorusGeometry(crownR, 0.06, 4, 16, Math.PI), 'gold', { x: 0, y: yC, z: DZ, ry });
  k.add(new THREE.TorusGeometry(crownR, 0.08, 4, 18), 'gold', { x: 0, y: yC, z: DZ, rx: Math.PI / 2 });
  k.sphere(0.25, 'gold', 0, yC + crownR + 0.1, DZ, { seg: 8, rings: 5 });
  k.box(0.16, hTotal - (yC + crownR + 0.3), 0.16, 'gold', 0, yC + crownR + 0.3, DZ);
  k.box(1.1, 0.16, 0.16, 'gold', 0, hTotal - 1.0, DZ);

  // --- the front: towers
  for (const sx of [-1, 1]) tower(k, sx * xT, zT, TW, F, hTowers, hEnt, hCor);

  // --- frontispiece: door, great arched window over its balcony, columns
  const doorH = { x: 0, y: 0, w: 2.6, h: 4.5, arch: 'round', pane: 'wood' };
  const winH = { x: 0, y: hEnt + 1.7, w: 3.1, h: 5.9, arch: 'round', pane: 'glass', emit: 0.25 };
  k.wall(CW, hCor, 1.2, G, [doorH, winH], 0, F, zF - 0.6, { inset: 0.8 });
  for (const hh of [doorH, winH]) {
    k.surround({ ...hh, y: hh.y + F }, 0.3, 0.25, GL, zF);
    k.surround({ ...hh, y: hh.y + F, w: hh.w + 0.6, h: hh.h + 0.3 }, 0.14, 0.4, G, zF);
    k.box(0.45, 0.65, 0.5, GL, 0, F + hh.y + hh.h + 0.1, zF + 0.3, { mat: MAT.smooth }); // keystone
  }
  // tracery of the great window: mullions and transoms
  for (const x of [-0.78, 0, 0.78]) k.box(0.08, winH.h - 0.4, 0.06, GL, x, F + winH.y, zF - 0.35);
  for (let i = 1; i < 6; i++) k.box(winH.w, 0.07, 0.06, GL, 0, F + winH.y + i * 0.95, zF - 0.35);
  // door leaves
  for (const s of [-1, 1]) for (const yy of [0.4, 2.1]) k.box(1.0, 1.4, 0.06, 'wood', s * 0.62, F + yy, zF - 0.78, { jit: 0.06 });
  // lower order: paired fluted columns on pedestals
  const pairs = [-2.55, 2.55];
  for (const px of pairs) {
    for (const s of [-1, 1]) {
      const x = px + s * 0.47;
      k.box(0.8, 0.9, 0.8, G, x, F, zF + 0.45);
      flutedColumn(k, hEnt - 1.7, 0.3, G, x, F + 0.9, zF + 0.45, { flutes: 12, capital: 'corinthian' });
    }
  }
  // entablature with the frieze of consoles, breaking over the columns
  k.box(CW + 0.4, 0.5, 1.1, G, 0, F + hEnt - 0.8, zF + 0.3);
  for (let i = 0; i < 7; i++) k.box(0.3, 0.35, 0.3, GL, -3 + i, F + hEnt - 0.3, zF + 0.85, { mat: MAT.smooth });
  for (const px of pairs) k.box(1.8, 0.8, 0.5, G, px, F + hEnt - 0.8, zF + 0.95);
  k.cornice(CW + 0.8, corniceProfile('classic', 0.45), G, 0, F + hEnt, zF + 0.4);
  for (const px of pairs) k.cornice(2.2, corniceProfile('classic', 0.45), G, px, F + hEnt, zF + 1.15);
  // balcony of the great window on consoles, balustrade
  k.box(3.8, 0.35, 1.3, G, 0, F + hEnt + 0.45, zF + 0.6);
  for (const s of [-1, 0.33, -0.33, 1]) k.box(0.3, 0.5, 0.9, G, s * 1.6, F + hEnt - 0.05, zF + 0.9);
  lineBalustrade(k, 3.6, 1.05, GL, 0, F + hEnt + 0.8, zF + 1.0, { sp: 0.3, pier: 1.8 });
  // upper order: paired pilasters
  for (const px of pairs) pilasters(k, px, F + hEnt + 0.45, hCor - hEnt - 1.35, zF, { w: 0.55, gap: 0.3 });
  // main cornice across the front and the towers
  k.box(CW + 0.2, 0.6, 1.3, G, 0, F + hCor - 0.9, zF);
  k.cornice(CW + 0.8, corniceProfile('classic', 0.6), G, 0, F + hCor - 0.3, zF + 0.4);
  // pediment with the arms, acroteria, the tall cross
  pediment(k, CW + 0.6, hPed - hCor - 0.3, 0.9, G, 0, F + hCor + 0.3, zF - 0.3, { frame: 0.4 });
  cartouche(k, 1.3, 1.5, 0.35, GL, 0, F + hCor + 0.55, zF + 0.15);
  for (const s of [-1, 1]) flameUrn(k, 1.3, G, s * (CW / 2 - 0.2), F + hCor + 0.3, zF - 0.1);
  k.box(0.7, 0.6, 0.7, G, 0, F + hPed - 0.05, zF - 0.3);
  k.box(0.28, 4.2, 0.28, G, 0, F + hPed + 0.5, zF - 0.3);
  k.box(1.9, 0.28, 0.28, G, 0, F + hPed + 3.4, zF - 0.3);
  for (const [dx, dy] of [[0, 4.8], [0.95, 3.54], [-0.95, 3.54]]) k.sphere(0.13, G, dx, F + hPed + dy, zF - 0.3, { seg: 6, rings: 4 });
  // the angel by the door, on its pedestal
  k.box(0.9, 1.2, 0.9, G, 2.55 + 1.35, F, zF + 0.9);
  k.statue(1.9, GL, 2.55 + 1.35, F + 1.2, zF + 0.9, { pose: 'pray' });
  k.end('main');

  // --- the podium stair and the esplanade over the crypt
  const zS = zF + 1.6; // top of the stair (front landing)
  k.prism([[-14, zF - 0.2], [14, zF - 0.2], [14, zS], [-14, zS]], -0.3, F + 0.3, G);
  k.stairs(28, 6, F - 0.15, 16, G, 0, 0.15, zS + 3, { below: 0.5 });
  for (const sx of [-1, 1]) {
    // cheek walls with a coping and the triple lamps on them
    k.box(1.2, 1.3, 7.6, G, sx * 14.6, 0, zS + 2.2);
    k.box(1.45, 0.2, 7.8, GL, sx * 14.6, 1.3, zS + 2.2);
    k.lamp(4.2, sx * 14.6, 1.5, zS + 5.4, { globe: true, color: 'lampGreen' });
    k.lamp(4.2, sx * 14.6, 1.5, zS - 0.4, { globe: true, color: 'lampGreen' });
    // clipped hedges at the foot of the stair
    k.box(3, 1.3, 3.2, 'hedge', sx * 17.5, 0.15, zS + 4.5);
  }
  const crypt = footprint.part(/Cripta/);
  if (crypt) {
    const cp = clean(crypt.pts);
    k.prism(cp, -0.6, 0.75, GL, { mat: MAT.smooth });
    // paved forecourt between the church and the crypt terrace
    k.prism([[-30, zS + 5.8], [30, zS + 5.8], [30, 42], [-30, 42]], -0.6, 0.73, GL, { mat: MAT.smooth });
    // along the terrace edges: the view edge (west, toward Braga) gets
    // the balustrade with piers, the others a plain parapet
    for (const e of edges(cp)) {
      if (e.mz < 45 && Math.abs(e.mx) < 32) continue;
      if (e.nz > 0.85 && e.len > 2) {
        onEdge(k, e, 0.15, -0.3);
        lineBalustrade(k, e.len + 0.2, 1.05, GL, 0, 0, 0, { sp: 0.75, pier: 6 });
        k.pop();
        continue;
      }
      k.wallLine(e.a, e.b, 1.1, 0.5, G, 0.15, { ext: 0.3 });
      onEdge(k, e, 1.25, -0.25);
      k.box(e.len + 0.3, 0.2, 0.8, GL, 0, 0, 0);
      k.pop();
    }
    // the two 20 m column pedestals with their statues, flanking the axis
    const hP = H.pedestals ?? 20;
    for (const sx of [-1, 1]) {
      const x = sx * 15;
      const z = 52;
      k.box(4.2, 0.4, 4.2, G, x, 0.15, z);
      k.box(3.6, 2.2, 3.6, G, x, 0.55, z);
      k.corniceRing(3.6, 3.6, corniceProfile('classic', 0.35), G, x, 2.4, z);
      k.box(2.9, 0.9, 2.9, G, x, 2.75, z, { bevel: 0.1 });
      flutedColumn(k, hP - 7.3, 0.95, G, x, 3.65, z, { flutes: 16, capital: 'corinthian' });
      k.box(2.2, 0.6, 2.2, G, x, hP - 3.65, z);
      k.statue(3.05, GL, x, hP - 3.05, z, { seg: 8, pose: sx < 0 ? 'raise' : 'pray' });
    }
    // globe lamps along the axis and round the forecourt
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) k.lamp(4.5, sx * 7, 0.15, 48 + i * 14, { globe: true, color: 'lampGreen' });
    // trees on the terrace wings
    for (let i = 0; i < 10; i++) {
      const t = (i + 0.5) / 10;
      const x = -70 + t * 140;
      if (Math.abs(x) < 24) continue;
      k.tree(x, 0.15, 58 + Math.abs(x) * 0.25 + (k.rnd() - 0.5) * 4, 9 + k.rnd() * 3, { lobes: 1 });
    }
  }
}
sameiro.metric = true;
sameiro.rule = {
  front: 279,
  extent: [/Cripta/],
  note: 'front = the flat 19.6 m west end of the outline (normal 280 deg); model = church + esplanade over the crypt, all level (padded)',
};

export default { sameiro };

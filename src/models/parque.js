// Parque da Ponte, metric builder (1:1 metres), draped on the terrain.
//
// Frame (fit.js): +z = 72 deg (the park's long axis, snapped to an outline
// edge), +x = about 342 deg (NNW), origin at the centre of the OSM park
// outline (r19915700, 237 x 370 m in this frame, 5.3 ha). The site falls
// about 17 m from its south-west corner to the Rio Este on the east edge,
// so every piece stands on footprint.ground (the visible terrain). Only
// the lake is padded (base = mean ground under the lake), so its water,
// drawn by the nature layer (OSM w22660782, no islands in OSM), lies level.
// Drawn on the OSM parts: the lawns, the 27 footpaths as gravel ribbons,
// the São João da Ponte chapel (1616, 20 x 11 m, 10 m), the iron bandstand
// on its rock base (8 m, 7 m high), the amphitheatre (31 m), the Estufa
// greenhouse and the park pavilions, the three water points (fountains),
// the lake kerb, the jetty with the kayaks and a rock outcrop at the lake
// end (photos), the perimeter wall with railings and the granite bank on
// the river side, benches and lamps along the paths, the granite cross,
// and about 230 trees (planes and limes along the paths, sequoias and
// cedars round the lake): the park outline keeps OSM trees out of the
// nature layer, so the park plants its own. The Rio Este part duplicates
// the nature water and is not drawn.
// Assumption: the chapel portal is on its clean south-west gable (the
// edge B-C of the OSM polygon, toward the park walks); the niche with the
// twisted columns and St John (parque-ponte-5.jpg) is on the other gable.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { pediment, bell } from './parts.js';
import { bbox, centroid, inside, offset, edges, clean, obb, polyLength, along } from './geom.js';
import { drapePoly, ribbon, lowTree, lowConifer } from './drape.js';

const GRAVEL = 0xcdbf9f; // saibro, the light gravel of the walks
const G = 'granite';

// Distance from (x, z) to a polyline.
function distLine(line, x, z) {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const ex = bx - ax;
    const ez = bz - az;
    const L2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return d;
}

// ------------------------------------------------------------ the chapel
function chapel(k, P, ground) {
  const pts = clean(P.pts, 0.5);
  const gs = pts.map(([x, z]) => ground(x, z));
  const y0 = Math.max(...gs) + 0.25;
  const yb = Math.min(...gs) - 1.2;
  // the front gable: the short edge nearest 10.6 m (B-C)
  const E = edges(pts);
  const fe = E.reduce((b, e) => (Math.abs(e.len - 10.6) < Math.abs(b.len - 10.6) ? e : b), E[0]);
  const b = obb(pts);
  const L = b.L;
  const W = fe.len;
  const WALL = 6.6;
  k.prism(offset(pts, 0.25), yb, y0 - yb + 0.3, G); // plinth and skirt
  k.begin('height');
  k.prism(pts, y0, WALL, 'plaster');
  k.push({ x: fe.mx, y: y0, z: fe.mz, ry: fe.ry });
  // in this frame: the front at z = 0, the nave along -z, x across
  for (const s of [-1, 1]) {
    k.box(0.6, WALL, 0.6, G, s * (W / 2 - 0.2), 0, -0.2);
    k.box(0.6, WALL, 0.6, G, s * (W / 2 - 0.2), 0, -L + 0.3);
  }
  k.cornice(W + 0.4, corniceProfile('eave', 0.45), G, 0, WALL - 0.45, 0);
  k.push({ z: -L / 2 });
  k.corniceRing(W, L, corniceProfile('eave', 0.45), G, 0, WALL - 0.45, 0, { skip: [0, Math.PI] });
  k.gableRoof(W, L, 2.6, 'terracotta', 0, WALL, 0, { over: 0.35, mat: MAT.tile });
  k.pop();
  // gable walls with granite raking copings
  for (const [z, ry] of [[0.02, 0], [-L + 0.02, Math.PI]]) {
    k.push({ z, ry });
    const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, 2.6)]);
    k.extrude(tri, 0.4, 'plaster', 0, WALL, -0.2);
    pediment(k, W + 0.3, 2.7, 0.5, G, 0, WALL - 0.05, 0.05, { frame: 0.35, tympanum: 'plaster' });
    k.pop();
  }
  // portal (dated 1616) with its pediment, a window above, the bell gable
  k.surround({ x: 0, y: 0, w: 1.8, h: 3.3 }, 0.35, 0.3, G, 0);
  k.box(1.8, 3.3, 0.08, 'wood', 0, 0, 0.02);
  k.box(1.4, 0.35, 0.06, 'graniteDark', 0, 3.75, 0.32); // the date stone
  pediment(k, 2.9, 0.75, 0.35, G, 0, 4.1, 0.3, { frame: 0.2 });
  k.surround({ x: 0, y: 5.4, w: 0.9, h: 1.1 }, 0.22, 0.2, G, 0);
  k.box(0.9, 1.1, 0.05, 'glass', 0, 5.4, 0.02, { emit: 0.2 });
  const yg = WALL + 1.8; // the bell gable stands on the front apex
  k.box(1.6, 1.0, 0.55, G, 0, yg - 0.4, 0);
  const bg = new THREE.Shape();
  bg.moveTo(-0.8, 0);
  bg.lineTo(0.8, 0);
  bg.lineTo(0.8, 0.6);
  bg.lineTo(0, 1.0);
  bg.lineTo(-0.8, 0.6);
  bg.closePath();
  bg.holes.push(new THREE.Path([new THREE.Vector2(-0.4, 0.1), new THREE.Vector2(-0.4, 0.55), new THREE.Vector2(0, 0.75), new THREE.Vector2(0.4, 0.55), new THREE.Vector2(0.4, 0.1)].reverse()));
  k.extrude(bg, 0.45, G, 0, yg + 0.5, 0);
  bell(k, 0.5, 0, yg + 0.62, 0);
  k.box(0.1, 10 - (yg + 1.5), 0.1, 'iron', 0, yg + 1.5, 0); // cross to 10 m
  k.box(0.45, 0.08, 0.08, 'iron', 0, 9.72, 0);
  // side windows
  for (const s of [-1, 1]) {
    k.push({ x: s * (W / 2 + 0.02), z: -L / 2, ry: (s * Math.PI) / 2 });
    for (const u of [-4, 4]) {
      k.surround({ x: u, y: 3.2, w: 1.0, h: 1.6 }, 0.22, 0.18, G, 0);
      k.box(1.0, 1.6, 0.05, 'glass', u, 3.2, 0.02, { emit: 0.2 });
    }
    k.pop();
  }
  // rear gable: the niche with twisted columns and St John on a granite base
  k.push({ z: -L, ry: Math.PI });
  k.box(3.6, 2.6, 0.6, 'graniteGrey', 0, 0, 0.3);
  k.box(3.8, 0.3, 0.8, G, 0, 2.6, 0.35);
  for (const s of [-1, 1]) for (const r of [1.55, 0.95]) {
    k.lathe([[0, 0], [0.22, 0], [0.18, 0.2], [0.24, 0.35], [0.18, 0.5], [0.24, 0.65], [0.18, 0.8], [0.22, 1], [0, 1]], 6, G, s * r, 2.9, 0.35, { sh: r > 1 ? 2.9 : 2.2, sr: 1, flat: true });
  }
  k.box(3.8, 0.35, 0.7, G, 0, 5.8, 0.35);
  k.box(0.9, 1.6, 0.1, 'graniteDark', 0, 3.2, 0.05);
  k.statue(1.5, 'graniteGrey', 0, 3.05, 0.35, { pose: 'hold', seg: 6 });
  k.pop();
  k.pop();
  k.end('height');
}

// --------------------------------------------------------- the bandstand
function bandstand(k, P, ground) {
  const [cx, cz] = centroid(P.pts);
  const r = bbox(P.pts).w / 2;
  const y = ground(cx, cz);
  const rnd = k.rnd;
  // rock base (boulders round a core)
  k.cyl(r * 0.95, r, 1.9, 8, 'graniteGrey', cx, y - 1, cz);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    k.ico(0.9 + rnd() * 0.4, 0, rnd() > 0.5 ? 'graniteGrey' : G, cx + Math.cos(a) * (r - 0.3), y + 0.2 + rnd() * 0.4, cz + Math.sin(a) * (r - 0.3), { jitter: 0.25, sy: 0.75, mat: MAT.smooth });
  }
  // granite parapet with the azulejo band, iron balustrade
  const yf = y + 0.9;
  k.cyl(r - 0.35, r - 0.3, 1.0, 8, G, cx, yf, cz, { ry: Math.PI / 8 });
  k.cyl(r - 0.25, r - 0.25, 0.5, 8, 'azulejo', cx, yf + 0.3, cz, { ry: Math.PI / 8, mat: MAT.azulejo, open: true });
  k.cyl(r - 0.2, r - 0.2, 0.15, 8, G, cx, yf + 1.0, cz, { ry: Math.PI / 8 });
  k.cyl(r - 0.45, r - 0.45, 0.9, 8, 'lampGreen', cx, yf + 1.15, cz, { ry: Math.PI / 8, open: true });
  // eight green cast-iron columns, the flared octagonal roof, the fringe
  const rc = r - 0.6;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.cyl(0.09, 0.12, 3.6, 5, 'lampGreen', cx + Math.cos(a) * rc, yf + 1.15, cz + Math.sin(a) * rc);
  }
  const yr = yf + 4.75;
  k.cyl(r + 0.3, r + 0.3, 0.3, 8, 'cream', cx, yr, cz, { ry: Math.PI / 8 }); // lace fringe
  k.lathe([[0, 0], [r + 0.5, 0], [r + 0.3, 0.2], [r * 0.55, 1.0], [0.35, 1.45], [0.2, 1.55], [0, 1.55]], 8, 'steel', cx, yr + 0.3, cz, { flat: true, mat: MAT.metal });
  k.cyl(0.05, 0.08, 7 - (yr + 1.85 - y), 4, 'iron', cx, yr + 1.85, cz); // finial to 7 m
  // stair with a white railing
  k.stairs(1.4, 1.6, 1.0, 5, G, cx + r + 0.6, y, cz, { ry: -Math.PI / 2, below: 0.5 });
}

// ------------------------------------------------------ the amphitheatre
function amphitheatre(k, P, ground) {
  const [cx, cz] = centroid(P.pts);
  const R = Math.min(bbox(P.pts).w, bbox(P.pts).d) / 2;
  const gs = P.pts.map(([x, z]) => ground(x, z));
  const y = gs.reduce((a, v) => a + v, 0) / gs.length;
  const steps = 6;
  const r0 = R * 0.38;
  // stepped half ring facing the stage (lathe of a stepped profile)
  const prof = [new THREE.Vector2(r0, -1.2), new THREE.Vector2(r0, 0.3)];
  for (let s = 0; s < steps; s++) {
    const ra = r0 + ((R - r0) * s) / steps;
    const rb = r0 + ((R - r0) * (s + 1)) / steps;
    prof.push(new THREE.Vector2(ra, 0.3 + (s + 1) * 0.45), new THREE.Vector2(rb, 0.3 + (s + 1) * 0.45));
  }
  prof.push(new THREE.Vector2(R, -1.2));
  const face = Math.atan2(-cx, -cz); // open toward the park centre
  const lg = new THREE.LatheGeometry(prof.reverse(), 14, face + Math.PI * 0.35, Math.PI * 1.3);
  k.add(lg, 'graniteLight', { x: cx, y, z: cz, flat: true, mat: MAT.ashlar });
  // the stage: a paved half disc toward the open side
  k.cyl(r0, r0, 0.4, 14, G, cx, y - 0.1, cz, { smooth: true });
  k.cyl(R * 0.9, R * 0.9, 0.12, 14, 'sand', cx, y - 0.2, cz, { smooth: true, t0: face - Math.PI * 0.35, tl: Math.PI * 0.7, mat: MAT.smooth });
}

// -------------------------------------------- pavilions and the greenhouse
function pavilion(k, P, ground, h) {
  const pts = clean(P.pts, 0.5);
  const gs = pts.map(([x, z]) => ground(x, z));
  const y0 = Math.max(...gs) + 0.15;
  const yb = Math.min(...gs) - 1;
  k.prism(pts, yb, y0 - yb + h, 'plaster');
  k.prism(offset(pts, 0.2), yb, y0 - yb + 0.8, G);
  for (const e of edges(pts)) {
    if (e.len < 3) continue;
    k.push({ x: e.mx + e.nx * 0.03, y: y0, z: e.mz + e.nz * 0.03, ry: e.ry });
    const n = Math.max(1, Math.floor(e.len / 3.2));
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * 3.2) / 2 + i * 3.2;
      k.box(1.5, Math.min(2.2, h - 1.6), 0.08, 'glass', u, 0.9, 0, { emit: 0.2 });
    }
    k.pop();
  }
  const b = obb(pts);
  k.push({ x: b.cx, z: b.cz, ry: b.a });
  k.hipRoof(b.L, b.W, Math.min(2.4, b.W * 0.28), 'terracotta', 0, y0 + h, 0, { over: 0.6, mat: MAT.tile });
  k.pop();
}

function greenhouse(k, P, ground) {
  const pts = clean(P.pts, 0.5);
  const gs = pts.map(([x, z]) => ground(x, z));
  const y0 = Math.max(...gs) + 0.1;
  const yb = Math.min(...gs) - 1;
  const b = obb(pts);
  const H = 5.5;
  k.prism(pts, yb, y0 - yb + 0.8, 'white'); // base wall
  k.push({ x: b.cx, y: y0 + 0.8, z: b.cz, ry: b.a });
  k.box(b.L - 0.4, H - 0.8, b.W - 0.4, 'glass', 0, 0, 0, { glass: true });
  const s = new THREE.Shape([new THREE.Vector2(-b.W / 2, 0), new THREE.Vector2(b.W / 2, 0), new THREE.Vector2(0, 2.4)]);
  k.extrude(s, b.L, 'glass', 0, H - 0.8, 0, { ry: Math.PI / 2, glass: true });
  // white iron glazing bars and the ridge
  const n = Math.max(3, Math.round(b.L / 2.2));
  for (let i = 0; i <= n; i++) {
    const u = -b.L / 2 + (i * b.L) / n;
    for (const sz of [-1, 1]) k.box(0.12, H - 0.8, 0.12, 'white', u, 0, sz * (b.W / 2 - 0.2));
    for (const sz of [-1, 1]) k.segment([u, H - 0.8, sz * (b.W / 2)], [u, H + 1.6, 0], 0.1, 0.1, 'white');
  }
  k.box(b.L + 0.4, 0.2, 0.25, 'white', 0, H + 1.55, 0);
  k.pop();
}

// ----------------------------------------------------------------- park
function parque(k, { footprint, dims }) {
  const rnd = k.rnd;
  const O = footprint.outline;
  const ground = footprint.ground;
  k.groundLine = (x, z) => ground(x, z);
  const lake = footprint.part(/Lago/);
  const chapelP = footprint.part(/Capela/);
  const estufa = footprint.part(/Estufa/);
  const buildings = footprint.parts.filter((p) => p.tag === 'building');
  const others = footprint.parts.filter((p) => p.tag === 'other');
  const bandP = others.find((p) => bbox(p.pts).w < 12);
  const amphP = others.find((p) => bbox(p.pts).w > 20);
  const paths = footprint.parts.filter((p) => p.tag === 'path' && p.pts.length >= 2);
  const inO = (x, z) => inside(O, x, z);

  // --- lawns on the outline, the lake and the buildings left out
  const holes = [lake, chapelP, ...buildings].filter(Boolean).map((p) => p.pts);
  drapePoly(k, O, ground, 0.3, 'grass', { cell: 9, holes, mat: MAT.leaf });

  // --- footpaths: light gravel ribbons, clipped to the park
  for (const p of paths) {
    const len = polyLength(p.pts);
    const w = len > 120 ? 4 : len > 40 ? 3 : 2.2;
    ribbon(k, p.pts, w, ground, 0.42, GRAVEL, { keep: inO, step: 5, mat: MAT.smooth });
  }

  // --- the lake: granite kerb at the water (nature water lies ~0.8 m
  // above the pad level), the jetty with kayaks, the rock outcrop
  if (lake) {
    const ring = clean(lake.pts, 0.8);
    k.prism(offset(ring, 1.0), -0.8, 2.0, 'graniteLight', { holes: [ring] });
    const [lx, lz] = centroid(ring);
    // jetty on the lake's longest edge (parque-ponte-4.jpg)
    const E = edges(ring);
    const je = E.reduce((a, e) => (e.len > a.len ? e : a), E[0]);
    k.push({ x: je.mx, y: 0, z: je.mz, ry: je.ry + Math.PI });
    k.box(3.2, 0.25, 11, 'wood', 0, 0.95, 5.5, { mat: MAT.smooth });
    for (const [u, v] of [[-1.4, 2], [1.4, 2], [-1.4, 9], [1.4, 9]]) k.cyl(0.12, 0.12, 1.2, 5, 'wood', u, -0.2, v);
    k.pop();
    const kay = [0xd9582c, 0xe0762a, 0xd4492a, 0xe39a2a];
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.2;
      const x = lx + (je.mx - lx) * t + (rnd() - 0.5) * 12;
      const z = lz + (je.mz - lz) * t + (rnd() - 0.5) * 12;
      if (!inside(ring, x, z)) continue;
      k.box(3.4, 0.35, 0.8, kay[i], x, 0.72, z, { ry: rnd() * 3, mat: MAT.smooth });
    }
    // rocks and a leaning tree at the far end (the photo's right end)
    const far = ring.reduce((a, p) => (Math.hypot(p[0] - je.mx, p[1] - je.mz) > Math.hypot(a[0] - je.mx, a[1] - je.mz) ? p : a), ring[0]);
    const rx = far[0] + (lx - far[0]) * 0.12;
    const rz = far[1] + (lz - far[1]) * 0.12;
    for (let i = 0; i < 9; i++) k.ico(1.2 + rnd() * 1.4, 0, rnd() > 0.5 ? 'graniteGrey' : G, rx + (rnd() - 0.5) * 7, 0.4 + rnd() * 0.8, rz + (rnd() - 0.5) * 7, { jitter: 0.3, sy: 0.7, mat: MAT.smooth });
    lowTree(k, rx, 1.2, rz, 9, { spread: 0.35 });
  }

  // --- chapel (the height of the site), bandstand, amphitheatre, pavilions
  k.begin('mask');
  if (chapelP) chapel(k, chapelP, ground);
  k.end('mask');
  if (bandP) bandstand(k, bandP, ground);
  if (amphP) amphitheatre(k, amphP, ground);
  for (const p of buildings) {
    if (p === estufa) greenhouse(k, p, ground);
    else pavilion(k, p, ground, Math.max(3, (p.height_m ?? 5) - 2.2));
  }
  // granite cross (cruzeiro) in front of the chapel
  if (chapelP) {
    const [cx, cz] = centroid(chapelP.pts);
    const x = cx - 18;
    const z = cz - 10;
    const y = ground(x, z);
    k.box(2.2, 0.5, 2.2, G, x, y - 0.2, z);
    k.box(1.4, 0.5, 1.4, G, x, y + 0.3, z);
    k.cyl(0.22, 0.28, 3.6, 8, G, x, y + 0.8, z);
    k.box(0.3, 1.4, 0.3, G, x, y + 4.4, z);
    k.box(1.1, 0.3, 0.3, G, x, y + 5.0, z);
  }

  // --- fountains on the OSM water points: granite basin, a jet marker
  for (const p of footprint.parts.filter((q) => q.tag === 'water' && q.pts.length === 1)) {
    const [x, z] = p.pts[0];
    if (!inO(x, z)) continue;
    const y = ground(x, z);
    k.lathe(PROFILES.basin, 10, G, x, y - 0.2, z, { sr: 1.5, sh: 0.9, smooth: true });
    k.cyl(1.3, 1.3, 0.06, 12, 'water', x, y + 0.5, z, { smooth: true });
    k.cyl(0.18, 0.25, 1.2, 6, G, x, y + 0.2, z);
    k.marker('fountain', x, y + 0.55, z, { kind: 'basin', r: 1.3 });
  }

  // --- the perimeter: low granite wall with railings, the river bank
  const ring = clean(O, 3);
  for (const e of edges(ring)) {
    const n = Math.max(1, Math.ceil(e.len / 12));
    const river = e.nx > 0.5 && e.mx > 90; // the east side over the Rio Este
    for (let i = 0; i < n; i++) {
      const a = [e.a[0] + ((e.b[0] - e.a[0]) * i) / n, e.a[1] + ((e.b[1] - e.a[1]) * i) / n];
      const c = [e.a[0] + ((e.b[0] - e.a[0]) * (i + 1)) / n, e.a[1] + ((e.b[1] - e.a[1]) * (i + 1)) / n];
      const ya = ground(a[0], a[1]);
      const yc = ground(c[0], c[1]);
      const hw = river ? 1.6 : 0.7;
      k.segment([a[0], ya + hw / 2 - 0.4, a[1]], [c[0], yc + hw / 2 - 0.4, c[1]], river ? 0.9 : 0.5, hw + 0.8, river ? 'graniteGrey' : G, { ext: 0.3 });
      k.segment([a[0], ya + hw + 0.55, a[1]], [c[0], yc + hw + 0.55, c[1]], 0.05, 1.0, 'iron');
    }
  }

  // --- benches and lamps along the walks
  let nb = 0;
  let nl = 0;
  for (const p of paths) {
    const len = polyLength(p.pts);
    if (len < 25) continue;
    for (let d = 12; d < len - 6; d += 26) {
      const [x, z] = along(p.pts, d / len);
      const [x2, z2] = along(p.pts, Math.min(1, (d + 1) / len));
      if (!inO(x, z)) continue;
      const a = Math.atan2(-(z2 - z), x2 - x);
      const side = (Math.floor(d / 26) % 2 ? 1 : -1) * (len > 120 ? 2.9 : 2.3);
      const bx = x + Math.sin(a) * side;
      const bz = z + Math.cos(a) * side;
      const y = ground(bx, bz) + 0.3;
      if (nl < 70 && Math.floor(d / 26) % 2 === 0) {
        k.cyl(0.07, 0.1, 3.8, 4, 'lampGreen', bx, y, bz, { open: true });
        k.box(0.36, 0.5, 0.36, 'window', bx, y + 3.8, bz, { emit: 0.8 });
        k.cone(0.34, 0.3, 4, 'lampGreen', bx, y + 4.3, bz);
        nl++;
      } else if (nb < 60) {
        k.push({ x: bx, y, z: bz, ry: a + (side > 0 ? Math.PI : 0) });
        k.box(1.8, 0.1, 0.5, 'wood', 0, 0.42, 0);
        k.box(1.8, 0.45, 0.08, 'wood', 0, 0.6, -0.24);
        k.box(1.6, 0.42, 0.4, 'iron', 0, 0, 0, { sx: 1 });
        k.pop();
        nb++;
      }
    }
  }

  // --- trees: planes and limes along the walks, sequoias and cedars round
  // the lake, a few in the open lawns
  const lakeOff = lake ? offset(clean(lake.pts, 0.8), 4.5) : null;
  const blocked = [
    ...(lakeOff ? [lakeOff] : []),
    ...[chapelP, ...buildings, bandP, amphP].filter(Boolean).map((p) => offset(clean(p.pts, 0.5), 3.5)),
  ];
  const trees = [];
  const free = (x, z, gap) => inO(x, z) && !blocked.some((h) => inside(h, x, z)) && !trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < gap) && paths.every((p) => distLine(p.pts, x, z) > 2.8);
  const plant = (x, z, kind, h) => {
    trees.push([x, z]);
    const y = ground(x, z) + 0.2;
    if (kind === 'conifer') lowConifer(k, x, y, z, h, { spread: 0.13 });
    else lowTree(k, x, y, z, h, { spread: 0.28, bole: 0.48, color: rnd() > 0.35 ? 'foliage' : 'foliageDark' });
  };
  for (const p of paths) {
    const len = polyLength(p.pts);
    const w = len > 120 ? 4 : len > 40 ? 3 : 2.2;
    for (let d = 5; d < len; d += 12) {
      const [x, z] = along(p.pts, d / len);
      const [x2, z2] = along(p.pts, Math.min(1, (d + 1) / len));
      const a = Math.atan2(-(z2 - z), x2 - x);
      for (const s of [-1, 1]) {
        const off = w / 2 + 2.6 + rnd() * 1.5;
        const tx = x + Math.sin(a) * off * s;
        const tz = z + Math.cos(a) * off * s;
        if (trees.length < 200 && free(tx, tz, 8)) plant(tx, tz, 'broad', 15 + rnd() * 8);
      }
    }
  }
  if (lake) {
    const ring = offset(clean(lake.pts, 0.8), 8);
    const L = polyLength([...ring, ring[0]]);
    for (let d = 0; d < L; d += 14) {
      const [x, z] = along([...ring, ring[0]], d / L);
      const jx = x + (rnd() - 0.5) * 5;
      const jz = z + (rnd() - 0.5) * 5;
      if (free(jx, jz, 7)) plant(jx, jz, rnd() > 0.45 ? 'conifer' : 'broad', 22 + rnd() * 10);
    }
  }
  const ob = bbox(O);
  for (let t = 0; t < 500 && trees.length < 235; t++) {
    const x = ob.x0 + rnd() * ob.w;
    const z = ob.z0 + rnd() * ob.d;
    if (free(x, z, 11)) plant(x, z, rnd() > 0.8 ? 'conifer' : 'broad', 14 + rnd() * 10);
  }
  k.treeCount = trees.length;
  void dims;
}
parque.metric = true;
parque.rule = {
  base: { part: /Lago/, stat: 'mean' },
  pad: { parts: [/Lago/] },
  heightRel: true,
  view: 0.5,
  note: 'draped on the real slope; pad only under the lake (level water); height = the chapel above its floor (heightRel); mask = chapel only (the pavilions and chapel are out of the city mass; clears the Forum mask)',
};

export default { 'parque-ponte': parque };

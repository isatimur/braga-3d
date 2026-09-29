// Colégio Leonardo da Vinci (private school, licence n.º 259 of 1990), metric
// builder (1:1 metres).
//
// Frame (fit.js): +z = the street front of the sede on Rua Conselheiro Bento
// Miguel (347 deg, the north edge of the outline), origin at the centre of
// the sede outline. OSM maps only the school node, so the outline and the
// buildings are Microsoft ML footprints (ODbL): the sede (50.8 x 31.4 m),
// a small annex, the polo house on the Santa Margarida side (16.5 x 14.6 m,
// about 50 m behind the sede, local -z) and its outbuilding. Two flat parts
// are sketched: the yard between the sede and the polo, and the polo garden
// east of the house (up to the Colégio Dom Diogo de Sousa boundary).
// No free photos exist. From the school's own photos (reference only) and
// aerial imagery: the sede is an older rendered house with tiled hip roofs
// on the street, with lower school wings behind it (white flat roofs) and a
// hall under long white roofs; the yard has a red rubber floor, a blue shade
// sail and a small green court under nets. The polo house has three tall
// storeys of five bays, faced with lilac-and-white azulejos between granite
// pilasters, string courses and a deep eave cornice, white sash windows,
// iron balconettes, a hip roof; its front (assumed east) opens on a walled
// garden of clipped box balls and cones, with a lamp post, a big broadleaf
// tree and a conifer; beyond it the orchard and vegetable beds of the polo.
// Heights (data/dimensions.json, estimates): sede 10.5 m, hall 10.5 m,
// polo eaves 12 m, ridge 14.5 m (the 'height' group).
// Registry: the type 'school-ldv' is wired in src/models.js at merge time.
import * as THREE from 'three';
import { corniceProfile, MAT } from './kit.js';
import { win } from './parts.js';
import { edges, offset, bbox, inside, clean, centroid, area } from './geom.js';
import { polyCornice, roofOver } from './metric.js';
import { drapePoly, clipRect, lowTree, lowConifer } from './drape.js';

const RENDER = 'plaster'; // white render of the sede
const TRIM = 'ochre'; // ochre plinth band and cornice of the sede
const BLUE = 0x2f6fb5; // school blue: the shade sail, the name board
const FRAME = 0x3a3d42; // dark window frames of the school wings
const AZUL = 0xc3bbd8; // lilac-and-white azulejo face of the polo house
const RUBBER = 0xb04a3e; // red rubber floor of the yard
const TURF = 0x4f8a45; // synthetic turf
const STOREY = 3.2;

// Flat pane on a wall face (2 triangles), facing +z of the current push.
function pane(k, x, y, w, h, z, color, emit = 0) {
  k.add(new THREE.PlaneGeometry(w, h), color, { x, y: y + h / 2, z, emit, mat: MAT.flat });
}

// The polygon's box turned onto its edge whose outward normal is nearest
// (dx, dz): centre, yaw (Kit ry), width along that edge, depth across it.
function rectFrame(pts, dx, dz) {
  let best = null;
  for (const e of edges(pts)) {
    const s = (e.nx * dx + e.nz * dz) * Math.min(1, e.len / 4);
    if (!best || s > best.s) best = { e, s };
  }
  const { nx, nz, ry } = best.e;
  const ux = nz;
  const uz = -nx; // local x of the push, in plan
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, z] of pts) {
    const u = x * ux + z * uz;
    const v = x * nx + z * nz;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const um = (u0 + u1) / 2;
  const vm = (v0 + v1) / 2;
  return { cx: um * ux + vm * nx, cz: um * uz + vm * nz, ry, W: u1 - u0, D: v1 - v0 };
}

// Punched windows on every edge of a polygon, one row per storey: a dark
// frame, the glass and a white sill. o.skip(e) leaves an edge blank,
// o.gap(e, u, s) one bay.
function gridWindows(k, pts, storeys, o = {}) {
  const rnd = k.rnd;
  const bay = o.bay ?? 3.2;
  const w = o.w ?? 1.4;
  const h = o.h ?? 1.6;
  for (const e of edges(pts)) {
    if (e.len < bay || (o.skip && o.skip(e))) continue;
    const n = Math.max(1, Math.floor((e.len - 1.4) / bay));
    const pitch = (e.len - 1.4) / n;
    k.push({ x: e.mx + e.nx * 0.03, y: o.y0 ?? 0, z: e.mz + e.nz * 0.03, ry: e.ry });
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * pitch) / 2 + i * pitch;
      storeys.forEach((y, s) => {
        if (o.gap && o.gap(e, u, s)) return;
        pane(k, u, y - 0.06, w + 0.16, h + 0.12, 0.02, o.frame ?? FRAME);
        pane(k, u, y, w, h, 0.05, 'glass', rnd() > 0.7 ? 0.35 : 0.1);
        k.box(w + 0.3, 0.1, 0.22, 'white', u, y - 0.12, 0.08);
      });
    }
    k.pop();
  }
}

// Vertical cladding ribs on every edge of a polygon (the white hall).
function ribs(k, pts, y0, y1, pitch = 0.9) {
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const e of edges(pts)) {
    const n = Math.floor(e.len / pitch);
    const ex = -e.nz; // along the edge, counter-clockwise seen from the outside
    const ez = e.nx;
    for (let i = 1; i < n; i++) {
      const t = -e.len / 2 + i * pitch;
      const px = e.mx + ex * t + e.nx * 0.02;
      const pz = e.mz + ez * t + e.nz * 0.02;
      const d = 0.07;
      const hw = 0.05;
      const a = [px - ex * hw, pz - ez * hw];
      const b = [px + ex * hw, pz + ez * hw];
      const ao = [a[0] + e.nx * d, a[1] + e.nz * d];
      const bo = [b[0] + e.nx * d, b[1] + e.nz * d];
      quad([ao[0], y0, ao[1]], [bo[0], y0, bo[1]], [bo[0], y1, bo[1]], [ao[0], y1, ao[1]]);
      quad([a[0], y0, a[1]], [ao[0], y0, ao[1]], [ao[0], y1, ao[1]], [a[0], y1, a[1]]);
      quad([bo[0], y0, bo[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [bo[0], y1, bo[1]]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  // wind outward whatever the polygon's orientation
  const ccw = area(pts) > 0;
  if (!ccw) {
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 9) for (let j = 0; j < 3; j++) [a[i + 3 + j], a[i + 6 + j]] = [a[i + 6 + j], a[i + 3 + j]];
  }
  k.add(g, 'white', { flat: true, mat: MAT.smooth });
}

// ------------------------------------------------------------ the sede
function sede(k, O) {
  const b = bbox(O);
  const zc = b.z1 - 15; // the old house on the street is about 15 m deep
  const front = clean(clipRect(O, b.x0 - 1, zc, b.x1 + 1, b.z1 + 1), 0.3);
  const rear = clean(clipRect(O, b.x0 - 1, b.z0 - 1, b.x1 + 1, zc), 0.3);
  const cut = (e) => Math.abs(e.mz - zc) < 0.3 && e.nz < -0.9; // edge against the wings
  // --- the house: three storeys, ochre plinth and eave cornice, tiled hip roof
  const EAVE = 8.4;
  k.prism(front, -1.5, EAVE + 1.5, RENDER);
  k.prism(offset(front, 0.12), -1.5, 2.2, TRIM);
  polyCornice(k, front, EAVE - 0.5, corniceProfile('eave', 0.5), TRIM);
  roofOver(k, front, EAVE, 2.1, 'terracotta', 'hip', { over: 0.55 });
  const fb = bbox(front);
  for (const [x, z] of [[fb.cx - fb.w * 0.28, fb.cz + 1], [fb.cx + fb.w * 0.3, fb.cz - 2]]) k.box(0.8, 2.2, 0.8, RENDER, x, EAVE + 0.2, z);
  const fe = edges(front).find((e) => e.nz > 0.9 && e.len > 10);
  const ex = fe ? fe.mx : fb.cx;
  gridWindows(k, front, [1.2, 4.1, 6.8], {
    bay: 3.1,
    w: 1.25,
    h: 1.75,
    skip: cut,
    gap: (e, u, s) => e === fe && s === 0 && Math.abs(u) < 3.2,
  });
  // entrance on the street: glazed doors, a flat canopy on two posts, the
  // blue name board, three steps
  const zf = fb.z1;
  pane(k, ex, 0.35, 3.0, 2.6, zf + 0.04, 'glass', 0.35);
  k.box(3.4, 0.14, 0.12, FRAME, ex, 2.95, zf + 0.06);
  k.box(0.12, 2.7, 0.12, FRAME, ex, 0.35, zf + 0.06);
  k.box(6.4, 0.3, 2.6, 'white', ex, 3.25, zf + 1.3);
  for (const s of [-1, 1]) k.box(0.18, 3.25, 0.18, 'steel', ex + s * 2.9, 0, zf + 2.4);
  k.box(6.4, 0.6, 0.1, BLUE, ex, 3.3, zf + 2.62, { emit: 0.05 });
  for (let i = 0; i < 9; i++) k.box(0.34, 0.26, 0.04, 'white', ex - 2.4 + i * 0.6, 3.46, zf + 2.69);
  for (let i = 0; i < 3; i++) k.box(5 - i * 0.4, 0.12, 1.6 - i * 0.4, 'graniteLight', ex, i * 0.12, zf + 0.8 - i * 0.2, { mat: MAT.smooth });

  // --- the wings behind: the hall under long white roofs on the east side
  // (local -x), two-storey classroom wings with flat white roofs on the west
  const rb = bbox(rear);
  const xs = rb.x0 + rb.w * 0.55;
  const hall = clean(clipRect(rear, rb.x0 - 1, rb.z0 - 1, xs, zc), 0.3);
  const wing = clean(clipRect(rear, xs, rb.z0 - 1, rb.x1 + 1, zc), 0.3);
  if (hall.length >= 3) {
    k.prism(hall, -1.5, 9.5 + 1.5, 'white');
    k.prism(offset(hall, 0.1), -1.5, 2.3, 'graniteGrey');
    ribs(k, hall, 0.8, 9.4);
    roofOver(k, hall, 9.5, 1.0, 'white', 'gable', { over: 0.4 });
    // high window band on the long sides
    for (const e of edges(hall)) {
      if (e.len < 10 || cut(e)) continue;
      k.push({ x: e.mx + e.nx * 0.1, z: e.mz + e.nz * 0.1, ry: e.ry });
      pane(k, 0, 6.3, e.len - 3, 1.2, 0, 'glass', 0.25);
      k.pop();
    }
  }
  if (wing.length >= 3) {
    const H = 7.2;
    k.prism(wing, -1.5, H + 1.5, RENDER);
    k.prism(offset(wing, 0.12), -1.5, 2.2, TRIM);
    gridWindows(k, wing, [1.1, 1.1 + STOREY], { bay: 3.0, skip: cut });
    k.prism(offset(wing, -0.3), H - 0.1, 0.3, 'white'); // the white roof membrane
    k.prism(wing, H, 0.7, RENDER, { holes: [offset(wing, -0.3)] }); // parapet
    const wc = centroid(wing);
    k.box(3, 1.6, 2, 'steel', wc[0], H, wc[1]); // plant on the roof
  }
}

// ------------------------------------------------------------ the yard
function yard(k, P, ground) {
  const y = ground(...centroid(P));
  const b = bbox(P);
  // west half (+x): red rubber floor under the blue shade sail and the
  // climbing frame; east half (-x): the small green court under nets
  const west = clean(clipRect(P, b.cx, b.z0 - 1, b.x1 + 1, b.z1 + 1), 0.2);
  const east = clean(clipRect(P, b.x0 - 1, b.z0 - 1, b.cx, b.z1 + 1), 0.2);
  k.prism(P, y - 0.3, 0.36, RUBBER, { mat: MAT.smooth });
  if (east.length >= 3) {
    const t = offset(east, -0.6);
    k.prism(t, y + 0.06, 0.03, TURF, { mat: MAT.leaf });
    const tb = bbox(t);
    // lines and the two small goals at the ends (along z)
    k.box(tb.w - 1.2, 0.02, 0.1, 'white', tb.cx, y + 0.1, tb.cz);
    for (const s of [-1, 1]) {
      const gz = tb.cz + s * (tb.d / 2 - 1.2);
      const gx = tb.cx;
      for (const d of [-1, 1]) k.box(0.08, 1.2, 0.08, 'white', gx + d * 0.9, y + 0.09, gz);
      k.box(1.9, 0.08, 0.08, 'white', gx, y + 1.29, gz);
      k.box(1.9, 0.02, 0.1, 'white', gx, y + 0.1, gz - s * 1.2);
    }
    // net posts and the cable ring over the court
    const tops = [];
    for (const [x, z] of offset(east, -0.3)) {
      k.cyl(0.06, 0.07, 5, 4, 'lampGreen', x, y, z);
      tops.push([x, y + 5, z]);
    }
    for (let i = 0; i < tops.length; i++) k.segment(tops[i], tops[(i + 1) % tops.length], 0.04, 0.04, 'lampGreen');
  }
  if (west.length >= 3) {
    const wb = bbox(west);
    // blue shade sail on four masts, tilted
    const c = [[wb.x0 + 0.6, wb.z0 + 0.8, 3.4], [wb.x1 - 0.6, wb.z0 + 0.8, 4.2], [wb.x1 - 0.6, wb.z1 - 0.8, 3.4], [wb.x0 + 0.6, wb.z1 - 0.8, 4.2]];
    for (const [x, z, h] of c) {
      if (!inside(offset(P, 0.5), x, z)) continue;
      k.cyl(0.07, 0.09, h, 4, 'steel', x, y, z);
    }
    const g = new THREE.BufferGeometry();
    const p = c.map(([x, z, h]) => [x, y + h, z]);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p[0], ...p[2], ...p[1], ...p[0], ...p[3], ...p[2], ...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]]), 3));
    k.add(g, BLUE, { flat: true, mat: MAT.smooth });
    // climbing frame: a small tower with a roof and a slide
    const [fx, fz] = [wb.cx + 0.6, wb.cz];
    k.box(1.6, 0.12, 1.6, 'wood', fx, y + 1.2, fz);
    for (const [dx, dz] of [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]]) k.box(0.1, 2.4, 0.1, 'wood', fx + dx, y, fz + dz);
    k.frustum(1.9, 1.9, 0.1, 0.1, 0.8, 0xd8b43a, fx, y + 2.4, fz);
    k.segment([fx, y + 1.3, fz - 0.8], [fx, y + 0.3, fz - 3.2], 0.6, 0.08, 0xd8b43a);
  }
}

// ------------------------------------------------------------ the polo house
function poloHouse(k, P, ground) {
  // the front (with the garden) faces east: local -x of the site
  const F = rectFrame(clean(P, 0.5), -1, 0);
  const W = F.W;
  const D = F.D;
  const y0 = ground(F.cx, F.cz);
  const EAVE = 12;
  const G = 'graniteLight';
  k.push({ x: F.cx, y: y0, z: F.cz, ry: F.ry });
  // body: azulejo faces, granite plinth, corner pilasters, string courses
  k.box(W, EAVE + 1.5, D, AZUL, 0, -1.5, 0, { mat: MAT.azulejo });
  k.box(W + 0.2, 2.4, D + 0.2, G, 0, -1.5, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.85, EAVE - 0.9, 0.85, G, sx * (W / 2 - 0.35), 0.9, sz * (D / 2 - 0.35));
  k.corniceRing(W, D, corniceProfile('band', 0.4), G, 0, 4.3, 0);
  k.corniceRing(W, D, corniceProfile('band', 0.4), G, 0, 8.3, 0);
  k.corniceRing(W, D, corniceProfile('eave', 0.75), G, 0, EAVE - 0.75, 0);
  k.hipRoof(W, D, 2.5, 'terracotta', 0, EAVE, 0, { over: 0.7, mat: MAT.tile });
  k.box(0.9, 1.6, 0.9, G, W * 0.25, EAVE + 1.1, -D * 0.2); // chimney
  // the five-bay front: pilasters framing the middle bay
  const zf = D / 2;
  const p = (W - 2) / 5;
  for (const s of [-1, 1]) k.box(0.7, EAVE - 0.9, 0.2, G, s * (p / 2 + 0.2), 0.9, zf + 0.08);
  const rows = [
    { y: 1.5, h: 2.1 },
    { y: 5.0, h: 2.6, balcony: true },
    { y: 9.0, h: 2.2, balcony: true },
  ];
  const sash = (u, y, w, h, z) => {
    k.box(0.08, h, 0.06, 'white', u, y, z);
    k.box(w, 0.08, 0.06, 'white', u, y + h * 0.62, z);
  };
  const railing = (u, y, w, z) => {
    k.box(w + 0.5, 0.16, 0.7, G, u, y - 0.16, z + 0.3);
    k.box(w + 0.4, 0.06, 0.06, 'iron', u, y + 0.95, z + 0.62);
    for (let i = 0; i <= 4; i++) k.box(0.05, 0.95, 0.05, 'iron', u - (w + 0.3) / 2 + (i * (w + 0.3)) / 4, y, z + 0.62);
  };
  for (let i = 0; i < 5; i++) {
    const u = (i - 2) * p;
    rows.forEach((r, s) => {
      const mid = i === 2;
      if (mid && s === 0) return; // the door
      const w = mid ? 1.3 : 1.2;
      win(k, u, r.y, w, r.h, zf, { bw: 0.22, depth: 0.16, trim: G, pane: 'glass', emit: k.rnd() > 0.6 ? 0.3 : 0.1, arch: mid ? 'round' : undefined });
      sash(u, r.y, w, r.h, zf + 0.1);
      if (r.balcony && (mid || s === 1)) railing(u, r.y, w, zf);
    });
  }
  // round-headed arch over the middle window of the first floor
  k.surround({ x: 0, y: 4.75, w: 2.3, h: 3.3, arch: 'round' }, 0.22, 0.12, G, zf + 0.02);
  // the door with its granite frame, the landing, steps and iron railing
  k.surround({ x: 0, y: 0.9, w: 1.7, h: 3.1 }, 0.3, 0.2, G, zf);
  pane(k, 0, 0.9, 1.7, 3.1, zf + 0.05, 'wood');
  pane(k, 0, 3.0, 1.5, 0.9, zf + 0.07, 'glass', 0.35);
  k.box(4.6, 0.9, 1.9, G, 0, 0, zf + 0.95);
  for (let i = 0; i < 3; i++) k.box(2.2, 0.3, 0.45, G, 0, i * 0.3, zf + 2.1 + (2 - i) * 0.45);
  for (const s of [-1, 1]) {
    k.box(0.06, 0.9, 1.8, 'iron', s * 2.25, 0.9, zf + 0.95);
    k.box(1.2, 0.9, 0.06, 'iron', s * 1.65, 0.9, zf + 1.87);
  }
  // sides and back: three bays, the same storeys
  for (const [ry, len, off] of [[Math.PI / 2, D, W / 2], [-Math.PI / 2, D, W / 2], [Math.PI, W, D / 2]]) {
    k.push({ x: Math.sin(ry) * off, z: Math.cos(ry) * off, ry });
    const n = ry === Math.PI ? 5 : 3;
    const q = (len - 2) / n;
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * q) / 2 + i * q;
      rows.forEach((r) => {
        win(k, u, r.y, 1.1, r.h - 0.2, 0, { bw: 0.2, depth: 0.14, trim: G, pane: 'glass', emit: k.rnd() > 0.7 ? 0.3 : 0.08 });
        sash(u, r.y, 1.1, r.h - 0.2, 0.1);
      });
    }
    k.pop();
  }
  k.pop();
  return { F, y0, zf };
}

// ------------------------------------------------------------ the polo garden
function poloGarden(k, Gp, house, ground) {
  const rnd = k.rnd;
  const { F, y0, zf } = house;
  const g = clean(Gp, 0.4);
  drapePoly(k, g, ground, 0.06, 'grass', { cell: 8, mat: MAT.leaf });
  // the walled box garden in front of the door (house frame)
  const L = 13;
  const Wg = Math.min(F.W + 1.5, 17);
  k.push({ x: F.cx, y: y0, z: F.cz, ry: F.ry });
  k.box(2.2, 0.1, L, 'graniteLight', 0, 0.02, zf + 2.6 + L / 2, { mat: MAT.smooth });
  for (const s of [-1, 1]) {
    k.box(0.6, 2.4, L + 2.6, 'graniteGrey', s * (Wg / 2), 0, zf + (L + 2.6) / 2); // side walls
    k.box(0.8, 0.12, L + 2.6, 'graniteLight', s * (Wg / 2), 2.4, zf + (L + 2.6) / 2);
    // clipped box: low hedges, balls on square bases, cones by the steps
    const hx = s * 2.4;
    k.box(Wg / 2 - 3.2, 0.5, L - 1, 'hedge', s * (Wg / 4 + 1.1), 0, zf + 3 + (L - 1) / 2, { mat: MAT.leaf });
    for (let i = 0; i < 2; i++) {
      const z = zf + 5 + i * 5.5;
      k.box(2.2, 0.7, 2.2, 'hedge', hx + s * 1.4, 0.4, z, { mat: MAT.leaf });
      k.ico(1.25, 1, 'hedge', hx + s * 1.4, 2.25, z, { soft: true, sy: 0.85 });
    }
    k.tree(s * 1.6, 0, zf + 3.4, 2.4, { kind: 'topiary', color: 'hedge' });
    k.lamp(4, s * 1.4, 0, zf + 9, { globe: true, color: 'iron' });
  }
  // the big broadleaf on the left of the path, a conifer on the right
  lowTree(k, Wg / 2 - 2.2, 0.4, zf + 12, 13, { spread: 0.34 });
  lowConifer(k, -Wg / 2 + 2, 0.4, zf + 10.5, 12, { spread: 0.22 });
  k.pop();
  // orchard trees and vegetable beds in the rest of the plot (the polo's
  // pomar and horta), clear of the walled garden and the house
  const b = bbox(g);
  const inHouseFrame = (x, z) => {
    const dx = x - F.cx;
    const dz = z - F.cz;
    const c = Math.cos(F.ry);
    const s = Math.sin(F.ry);
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    return Math.abs(u) < Wg / 2 + 1.2 && v < zf + L + 3.5;
  };
  let n = 0;
  for (let t = 0; t < 300 && n < 9; t++) {
    const x = b.x0 + rnd() * b.w;
    const z = b.z0 + rnd() * b.d;
    if (!inside(offset(g, -2.5), x, z) || inHouseFrame(x, z)) continue;
    lowTree(k, x, ground(x, z), z, 4.5 + rnd() * 2, { spread: 0.36, lobes: 1, color: rnd() > 0.5 ? 'foliage' : 'foliageDark' });
    n++;
  }
  let m = 0;
  for (let t = 0; t < 200 && m < 4; t++) {
    const x = b.x0 + rnd() * b.w;
    const z = b.z0 + rnd() * b.d;
    if (!inside(offset(g, -2), x, z) || inHouseFrame(x, z)) continue;
    k.box(1.2, 0.3, 4, 'earth', x, ground(x, z), z, { ry: F.ry, mat: MAT.smooth });
    k.box(0.9, 0.35, 3.6, 'foliage', x, ground(x, z) + 0.3, z, { ry: F.ry, mat: MAT.leaf, jit: 0.1 });
    m++;
  }
  // the boundary with Colégio Dom Diogo de Sousa: granite base, mesh fence
  for (const e of edges(g)) {
    if (e.nx > -0.5) continue; // only the east side (local -x)
    const a = [e.a[0], ground(e.a[0], e.a[1]), e.a[1]];
    const c = [e.b[0], ground(e.b[0], e.b[1]), e.b[1]];
    k.segment([a[0], a[1] + 0.3, a[2]], [c[0], c[1] + 0.3, c[2]], 0.35, 0.6, 'graniteGrey', { ext: 0.3 });
    k.segment([a[0], a[1] + 2.2, a[2]], [c[0], c[1] + 2.2, c[2]], 0.05, 0.05, 'lampGreen');
    const np = Math.max(1, Math.floor(e.len / 3));
    for (let i = 0; i <= np; i++) {
      const t = i / np;
      k.box(0.07, 1.9, 0.07, 'lampGreen', a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t + 0.6, a[2] + (c[2] - a[2]) * t);
    }
  }
}

// A plain low annex on its footprint: white render, a door and windows.
function annex(k, P, ground, h) {
  const pts = clean(P.pts, 0.4);
  const y0 = ground(...centroid(pts));
  k.prism(pts, y0 - 1.2, h + 1.2, RENDER);
  k.prism(offset(pts, -0.2), y0 + h, 0.15, 'lead');
  k.prism(pts, y0 + h, 0.45, RENDER, { holes: [offset(pts, -0.2)] });
  gridWindows(k, pts, [1.0], { bay: 3.2, w: 1.2, h: 1.3, y0 });
}

export function buildLeonardo(k, { footprint, dims }) {
  const ground = footprint.ground;
  const O = footprint.outline;
  const hTot = dims?.height_m?.total ?? 14.5;
  k.groundLine = (x, z) => ground(x, z);

  k.begin('mask');
  k.begin('main');
  sede(k, O);
  k.end('main');
  k.end('mask');

  const an = footprint.part(/Anexo do recreio/);
  if (an) annex(k, an, ground, 4);
  const yd = footprint.part(/Recreio/);
  if (yd) yard(k, yd.pts, ground);

  const polo = footprint.part(/^Polo/);
  if (polo) {
    k.begin('height');
    const house = poloHouse(k, polo.pts, ground);
    k.end('height');
    const gd = footprint.part(/Jardim/);
    if (gd) poloGarden(k, gd.pts, house, ground);
  }
  const pa = footprint.part(/Anexo do polo/);
  if (pa) annex(k, pa, ground, 3.5);
  // a flagpole by the street door (outside 'main': the sede is 10.5 m)
  const fb = bbox(O);
  k.cyl(0.05, 0.08, Math.min(9, hTot * 0.6), 5, 'steel', fb.x1 - 2, 0, fb.z1 + 1.2);
}
buildLeonardo.metric = true;
buildLeonardo.rule = {
  extent: ['building', 'other', 'garden'],
  view: 0.6,
  note: 'sede (main, Microsoft footprint) on Rua Conselheiro Bento Miguel; the polo house 50 m behind it is the height group (ridge 14.5 m); yard and polo garden sketched; the whole campus padded',
};

export default { 'leonardo-da-vinci': buildLeonardo };

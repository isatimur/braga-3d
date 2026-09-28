// Santuário do Bom Jesus do Monte, metric builder (1:1 metres).
//
// Local frame (fit.js): +z = the WSW front of the basilica, looking down
// the escadório toward Braga; origin at the centre of the basilica's OSM
// outline; y = 0 = the Adro (the terrace in front of the church). Every
// element stands on its OSM part: the basilica on its outline, the Adro,
// the Terreiro de Moisés, the Três Virtudes and Cinco Sentidos zigzags
// (their fountains on the OSM water points of the stair axis, x ~ 0), the
// Cinco Chagas loop, the straight Escadório do Pórtico, the Via Sacra
// path down through the woods to the Pórtico, the 17 chapels, the hotels,
// the two funicular tracks with their cars, the lake behind the church.
//
// The stair climbs the real slope: its landings follow footprint.ground
// (the EU-DEM surface the map shows) with a lift that fades from the
// raised Terreiro (6 m below the Adro) to the foot of the Escadório do
// Pórtico. Only the Adro, the basilica and the Terreiro are padded (the
// pad profile below). The DEM (110 m cells) gives the Pórtico -> Adro rise
// as ~106 m against the published 116 m; the model follows the DEM so its
// foot meets the ground the map draws.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win, pediment, cartouche, bell } from './parts.js';
import { bbox, centroid, edges, offset, clean } from './geom.js';
import { polyCornice, roofOver } from './metric.js';

const G = 'granite';
const GD = 'graniteDark';
const GG = 'graniteGrey';
const TAU = Math.PI * 2;

const T_LEVEL = -6; // Terreiro de Moisés below the Adro

// Pad profile (local metres -> level rel. the Adro): the Adro and the
// basilica level at 0, easing down under the Adro's front wall to 1.5 m
// below the Terreiro floor (so the coarse terrain mesh never shows through
// the paving).
function padLevel(x, z) {
  if (z <= 30) return 0;
  if (z >= 60) return T_LEVEL - 1.5;
  return ((z - 30) / 30) * (T_LEVEL - 1.5);
}

// Wall in a vertical plane along z at x: top from (zA, yA) to (zB, yB),
// solid down to yBot, thickness t; optional coping.
function sideWall(k, x, zA, zB, yA, yB, yBot, t, color, coping = G) {
  const s = new THREE.Shape([new THREE.Vector2(zA, yBot), new THREE.Vector2(zB, yBot), new THREE.Vector2(zB, yB), new THREE.Vector2(zA, yA)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  g.rotateY(-Math.PI / 2); // shape x -> z, extrusion -> x
  k.add(g, color, { flat: true, x });
  if (coping) k.segment([x, yA + 0.12, zA], [x, yB + 0.12, zB], t + 0.3, 0.3, coping);
}

// Wall in a vertical plane across x at z: top from (xA, yA) to (xB, yB).
function crossWall(k, z, xA, xB, yA, yB, yBot, t, color, coping = G) {
  const s = new THREE.Shape([new THREE.Vector2(xA, yBot), new THREE.Vector2(xB, yBot), new THREE.Vector2(xB, yB), new THREE.Vector2(xA, yA)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  k.add(g, color, { flat: true, z });
  if (coping) k.segment([xA, yA + 0.12, z], [xB, yB + 0.12, z], t + 0.3, 0.3, coping);
}

// Flight climbing along -x (dir = -1) or +x (dir = +1): run from x0 to x1,
// strip centred on z with depth w, from y0 up by rise, solid down to yBot.
function flightX(k, x0, x1, z, w, y0, rise, yBot) {
  const run = Math.abs(x1 - x0);
  const n = Math.max(4, Math.round(rise / 0.2));
  const dir = Math.sign(x1 - x0);
  k.push({ x: (x0 + x1) / 2, y: y0, z, ry: dir > 0 ? -Math.PI / 2 : Math.PI / 2 });
  k.stairs(w, run, rise, n, 'graniteLight', 0, 0, 0, { below: y0 - yBot });
  k.pop();
}

// Flight climbing toward -z from zB (bottom) to zA (top), width w at x.
function flightZ(k, x, zA, zB, w, yB, rise, yBot) {
  const run = zB - zA;
  const n = Math.max(4, Math.round(rise / 0.24)); // long flights: coarser treads
  k.stairs(w, run, rise, n, 'graniteLight', x, yB, (zA + zB) / 2, { below: yB - yBot });
}

// Obelisk pinnacle (the stair's granite finials, photo bom-jesus.jpg): a
// pedestal with its cap moulding, a tapering four-sided shaft, a ball and
// a spike on top.
function obelisk(k, h, color, x, y, z) {
  const pw = h * 0.26;
  k.frustum(pw, pw, pw * 1.18, pw * 1.18, h * 0.25, color, x, y, z, { noBottom: true }); // pedestal flaring to its cap
  k.frustum(pw * 0.62, pw * 0.62, pw * 0.2, pw * 0.2, h * 0.55, color, x, y + h * 0.25, z, { noBottom: true });
  k.sphere(h * 0.065, color, x, y + h * 0.86, z, { seg: 5, rings: 3, flat: true });
  k.cone(h * 0.025, h * 0.08, 4, color, x, y + h * 0.92, z);
}

// Fountain on the riser of the stair spine (faces +z), after the photos:
// a granite panel between scrolled pilasters, a shell crest, the allegory
// on top, a mask whose sense spouts water into a moulded basin.
// sense: 'sight' (the eyes), 'hearing' (the ears), 'smell' (the nose),
// 'taste' (the mouth), 'touch' (a jug in the hands), or a virtue
// ('faith' | 'hope' | 'charity': a single spout). A 'fountain' marker sits
// at the basin centre (the app names it fountain-<n>).
const SPOUTS = {
  sight: [[-0.1, 0.06], [0.1, 0.06]],
  hearing: [[-0.26, 0], [0.26, 0]],
  smell: [[0, 0]],
  taste: [[0, -0.12]],
  touch: [[0.42, -0.3]],
  // the Five Wounds: five jets from the shield of the Cinco Chagas
  chagas: [[-0.3, 0.25], [0.3, 0.25], [0, 0], [-0.3, -0.25], [0.3, -0.25]],
};
function stairFountain(k, x, y, z, h, sense = 'faith') {
  const pw = 2.8;
  k.box(pw, h * 0.86, 0.5, GG, x, y, z + 0.25);
  // pilasters with a scroll console at the top
  for (const s of [-1, 1]) {
    k.box(0.36, h * 0.86, 0.3, GG, x + s * (pw / 2 - 0.18), y, z + 0.6);
    k.segment([x + s * (pw / 2 - 0.18), y + h * 0.86 - 0.5, z + 0.75], [x + s * (pw / 2 - 0.05), y + h * 0.86, z + 0.95], 0.34, 0.3, GG);
  }
  k.box(pw + 0.4, 0.28, 0.9, GG, x, y + h * 0.86, z + 0.35);
  k.frustum(1.1, 0.8, 0.7, 0.6, 0.5, GG, x, y + h * 0.86 + 0.28, z + 0.45, { noBottom: true });
  k.statue(1.8, 'graniteLight', x, y + h * 0.86 + 0.78, z + 0.45, { seg: 6, pose: sense === 'touch' ? 'hold' : sense === 'faith' || sense === 'moses' ? 'raise' : undefined });
  // the mask and its spouts
  const my = y + h * 0.5;
  k.sphere(0.27, GG, x, my, z + 0.55, { seg: 6, rings: 4, sz: 0.45, sy: 1.2, flat: true, mat: MAT.smooth });
  const basinZ = z + 1.35;
  const basinY = y + 0.75;
  for (const [dx, dy] of SPOUTS[sense] || [[0, -0.1]]) {
    const p0 = [x + dx, my + dy, z + 0.72];
    const p1 = [x + dx * 0.6, basinY + 0.35, basinZ - 0.2];
    const pm = [(p0[0] + p1[0]) / 2, p0[1] + 0.05, (p0[2] + p1[2]) / 2 + 0.15];
    k.segment(p0, pm, 0.07, 0.07, 'water', { emit: 0.5 });
    k.segment(pm, p1, 0.07, 0.07, 'water', { emit: 0.5 });
  }
  if (sense === 'touch') k.lathe(PROFILES.urn, 6, GG, x + 0.42, my - 0.55, z + 0.62, { sr: 0.4, sh: 0.4, flat: true });
  // moulded basin with its water
  k.lathe(PROFILES.basin, 8, GG, x, y, basinZ, { sr: 1.05, sh: 0.85, smooth: true, sz: 0.75 });
  k.cyl(0.95, 0.95, 0.08, 8, 'water', x, basinY, basinZ, { sz: 0.72 });
  k.marker('fountain', x, basinY + 0.05, basinZ, { kind: 'stair', sense, jets: (SPOUTS[sense] || [0]).length, r: 0.9 });
}

// Via Sacra chapel on its OSM polygon: white walls, granite corners,
// cornice, a stone cupola with a lantern, a door toward (tx, tz).
function chapel(k, poly, ground, tx, tz) {
  const pts = clean(poly, 1.1); // round chapels: drop every other OSM vertex
  const gs = pts.map(([x, z]) => ground(x, z));
  const y0 = Math.max(...gs) + 0.3;
  const yb = Math.min(...gs) - 1.5;
  const [cx, cz] = centroid(pts);
  const b = bbox(pts);
  const r = Math.min(b.w, b.d) / 2;
  const h = 5.2;
  k.prism(pts, yb, y0 - yb + h, 'plaster');
  if (pts.length <= 4) for (const p of pts) k.box(0.45, h, 0.45, G, p[0] + (cx - p[0]) * 0.04, y0, p[1] + (cz - p[1]) * 0.04);
  // cornice: a projecting granite band, then the drum of the cupola
  k.prism(offset(pts, 0.35), y0 + h, 0.45, G);
  k.prism(offset(pts, -0.1), y0 + h + 0.45, 0.35, G);
  k.dome(r * 0.85, 'graniteLight', cx, y0 + h + 0.8, cz, { seg: 6, rings: 3, sy: 0.8, smooth: true, mat: MAT.smooth });
  k.cyl(r * 0.18, r * 0.2, 1, 6, G, cx, y0 + h + 0.8 + r * 0.66, cz);
  k.cone(0.28, 1.2, 6, G, cx, y0 + h + 1.8 + r * 0.66, cz);
  // door on the edge facing the path
  let best = null;
  for (const e of edges(pts)) {
    const d = Math.hypot(e.mx - tx, e.mz - tz);
    if (e.len > 1.6 && (!best || d < best.d)) best = { e, d };
  }
  if (best) {
    const e = best.e;
    // granite portal: step, jambs, lintel with a cornice and a small
    // pediment; wooden leaves with the iron grille through which the
    // pilgrims see the tableau inside
    k.push({ x: e.mx, y: y0, z: e.mz, ry: e.ry });
    k.box(1.3, 2.7, 0.1, 'wood', 0, 0, 0.02);
    k.box(0.9, 1.1, 0.06, 'iron', 0, 1.2, 0.08); // the grille
    k.surround({ x: 0, y: 0, w: 1.3, h: 2.75 }, 0.3, 0.3, G, 0.02);
    pediment(k, 2.1, 0.5, 0.3, G, 0, 3.15, 0.14, { frame: 0.14 });
    k.pop();
  }
}

// Plain context building (hotel, house) on an OSM polygon on the slope.
function house(k, poly, ground, h, color = 'plaster') {
  const pts = clean(poly, 0.6);
  if (pts.length < 3) return;
  const gs = pts.map(([x, z]) => ground(x, z));
  const y0 = gs.reduce((a, v) => a + v, 0) / gs.length;
  const yb = Math.min(...gs) - 1;
  k.prism(pts, yb, y0 - yb + h, color);
  k.prism(offset(pts, 0.3), y0 + h - 0.45, 0.45, G); // eaves band
  // a glazed band per storey on each side longer than 6 m
  for (const e of edges(pts)) {
    if (e.len < 6) continue;
    k.push({ x: e.mx + e.nx * 0.05, y: y0, z: e.mz + e.nz * 0.05, ry: e.ry });
    if (e.len >= 14) for (let s = 0; s < Math.max(1, Math.floor(h / 3.3)); s++) k.box(e.len - 2, 1.6, 0.1, 'glass', 0, 1.2 + s * 3.2, 0);
    k.pop();
  }
  const b = bbox(pts);
  roofOver(k, pts, y0 + h, Math.min(3.2, Math.min(b.w, b.d) * 0.22), 'terracotta', 'hip');
}

// ------------------------------------------------------------ basilica
// Carlos Amarante, 1784-1811. On the real outline: front block 24.2 m wide
// (twin towers 6.4 m square, 34 m to the finials), nave to the transept
// (arms to 34.3 m), crossing dome with drum and lantern (28 m), chancel
// with the rounded east end. Facade pediment 22 m, nave ridge 18 m, four
// 6 m portal columns (data/dimensions.json).
function basilica(k, fp, dims) {
  const H = dims?.height_m || {};
  const hTower = H.towers ?? 34;
  const hPed = H.facade_pediment ?? 22;
  const hRidge = H.nave_ridge ?? 18;
  const hDome = H.dome ?? 28;
  const out = fp.outline;
  const zF = fp.box.z1; // front face, 27.5
  const xL = -12.4;
  const xR = 11.6;
  const fw = xR - xL; // 24 m
  const xc = (xL + xR) / 2;
  const TW = 6.4;
  const plinth = 1.2; // the church floor stands 1.2 m above the Adro
  // --- walls on the real outline (front block, transept, chancel)
  k.prism(out, -3, 3 + plinth, G);
  const eaves = hRidge - 3.4;
  const nave = out.filter(([, z]) => z > 2).concat([[xR, 2.3], [xL, 2.2]]);
  k.prism(clean([[xL, 2.2], [xR, 2.3], [xR, zF - TW], [xL, zF - TW]]), plinth, eaves - plinth, 'plaster');
  const transept = [[-17, -6], [-15, -8.3], [15, -8.3], [17, -6], [17, 0], [15, 2.3], [-15, 2.3], [-17, 0]];
  k.prism(transept, plinth, eaves - 1 - plinth, 'plaster');
  const chancel = out.filter(([, z]) => z < -7.5);
  k.prism(clean(chancel), plinth, eaves - 2.2 - plinth, 'plaster');
  void nave;
  // granite pilasters on the corners of each block, cornices
  for (const [x, z] of [[xL, 2.2], [xR, 2.3], [-17, -1.5], [17, -1.5], [-17, -4.5], [17, -4.5], [-7, -8.3], [7, -8.3], [-7, -24.8], [7, -24.8]]) k.box(0.9, eaves - 1, 0.9, G, x, plinth, z);
  polyCornice(k, clean([[xL, 2.2], [xR, 2.3], [xR, zF - TW], [xL, zF - TW]]), eaves - 0.7, corniceProfile('classic', 0.7), G);
  polyCornice(k, transept, eaves - 1.6, corniceProfile('classic', 0.6), G);
  polyCornice(k, clean(chancel), eaves - 2.8, corniceProfile('classic', 0.6), G);
  // roofs: nave gable to the ridge, transept gable across, chancel hip
  k.gableRoof(fw - 1, zF - TW - 2.2, hRidge - eaves, 'terracotta', xc, eaves, (2.2 + zF - TW) / 2, { over: 0.4 });
  k.gableRoof(10.6, 33, hRidge - eaves - 0.6, 'terracotta', 0, eaves - 1, -3, { ry: Math.PI / 2, over: 0.4 });
  k.hipRoof(14, 19, 2.6, 'terracotta', 0, eaves - 2.2, -17.5, { over: 0.4 });
  // nave windows: round-headed, two per side between the towers and transept
  for (const sx of [-1, 1]) {
    const xw = sx > 0 ? xR : xL;
    k.push({ x: xw, ry: (sx * Math.PI) / 2 });
    for (const zz of [7.5, 15]) win(k, -sx * zz, 7.2, 1.7, 3.6, 0, { arch: 'round', bw: 0.35, depth: 0.3, trim: G });
    k.pop();
    k.push({ x: sx * 17, ry: (sx * Math.PI) / 2 });
    win(k, -sx * -3, 6.6, 2.2, 4.6, 0, { arch: 'round', bw: 0.4, depth: 0.3, trim: G });
    k.pop();
  }
  // --- crossing: octagonal drum, ribbed dome, lantern, cross (to hDome)
  const DY = hRidge - 0.5;
  const DR = 5.2;
  k.cyl(DR, DR, 3.6, 8, 'plaster', 0, DY, -3, { ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    k.box(0.5, 3.6, 0.5, G, Math.cos(a) * DR * 0.97, DY, -3 + Math.sin(a) * DR * 0.97);
    const b2 = a + Math.PI / 8;
    k.box(1, 1.8, 0.15, 'glass', Math.cos(b2) * DR * 0.93, DY + 0.9, -3 + Math.sin(b2) * DR * 0.93, { ry: -b2 + Math.PI / 2 });
  }
  k.cyl(DR + 0.35, DR + 0.35, 0.5, 8, G, 0, DY + 3.6, -3, { ry: Math.PI / 8 });
  const domeH = hDome - (DY + 4.1) - 3.4;
  k.dome(DR - 0.2, 'lead', 0, DY + 4.1, -3, { seg: 16, rings: 6, sy: domeH / (DR - 0.2), smooth: true });
  k.cyl(0.9, 1, 1.6, 8, G, 0, DY + 4.1 + domeH - 0.3, -3);
  k.cone(1.05, 0.8, 8, G, 0, DY + 4.1 + domeH + 1.3, -3);
  k.box(0.14, hDome - (DY + 4.1 + domeH + 2.1), 0.14, 'iron', 0, DY + 4.1 + domeH + 2.1, -3);
  k.box(0.7, 0.12, 0.12, 'iron', 0, hDome - 0.5, -3);

  // --- the front: centre between the towers
  const cx0 = xL + TW;
  const cx1 = xR - TW;
  const CW = cx1 - cx0; // 11.2 m
  const ccx = (cx0 + cx1) / 2;
  const L1 = 9.6; // first cornice
  const L2 = 18.4; // main cornice under the pediment
  k.push({ x: ccx });
  const holes = [
    { x: 0, y: 0, w: 2.6, h: 5.2, arch: 'round', pane: 'dark' },
    { x: -3.6, y: 1.6, w: 1.3, h: 2.6, pane: 'glass' },
    { x: 3.6, y: 1.6, w: 1.3, h: 2.6, pane: 'glass' },
    { x: 0, y: 11.2, w: 2.8, h: 5, arch: 'round', pane: 'glass', emit: 0.25 },
    { x: -3.6, y: 11.6, w: 1.3, h: 2.8, pane: 'glass' },
    { x: 3.6, y: 11.6, w: 1.3, h: 2.8, pane: 'glass' },
  ];
  k.wall(CW, L2 - plinth, 1.2, 'plaster', holes, 0, plinth, zF - 0.6, { inset: 0.8 });
  for (const hh of holes) k.surround({ ...hh, y: hh.y + plinth }, 0.3, 0.25, G, zF);
  // four portal columns (6 m) and pilasters above
  for (const x of [-4.9, -1.9, 1.9, 4.9]) {
    k.box(1, 0.8, 1, G, x, plinth, zF + 0.5);
    k.column(6, 0.36, G, x, plinth + 0.8, zF + 0.5, { seg: 7, smooth: true });
    k.box(0.7, L2 - L1 - 0.8, 0.35, G, x, L1 + 0.8, zF + 0.15);
  }
  // balcony on the first cornice with the balustrade and statues
  k.box(CW + 0.8, 0.8, 2, G, 0, L1, zF + 0.6);
  k.balustrade(CW, 1.1, G, 0, L1 + 0.8, zF + 1.3, { cheap: true, d: 0.28, sp: 0.6 });
  for (const x of [-4.9, 4.9]) k.statue(1.9, 'graniteLight', x, L1 + 0.8, zF + 1.3, { seg: 6 });
  // main cornice, pediment with the arms, the cross
  k.box(CW + 0.6, 0.7, 1.4, G, 0, L2, zF + 0.1);
  k.cornice(CW + 1, corniceProfile('classic', 0.55), G, 0, L2 + 0.7, zF + 0.3);
  pediment(k, CW + 0.4, hPed - L2 - 1.4, 0.9, G, 0, L2 + 1.25, zF - 0.1, { tympanum: 'plaster', frame: 0.4 });
  cartouche(k, 1.8, 1.9, 0.4, G, 0, L2 + 1.5, zF + 0.4);
  k.box(0.9, 0.9, 0.9, G, 0, hPed - 0.1, zF - 0.1);
  k.box(0.25, 2.2, 0.25, 'iron', 0, hPed + 0.8, zF - 0.1);
  k.box(1.3, 0.2, 0.2, 'iron', 0, hPed + 2.2, zF - 0.1);
  for (const sx of [-1, 1]) k.urn(1.2, G, sx * (CW / 2 - 0.3), L2 + 1.2, zF + 0.1, { seg: 5 });
  k.pop();
  // steps up from the Adro across the front
  for (let i = 0; i < 4; i++) k.box(CW + 3 - i * 0.5, 0.3, 3.2 - i * 0.7, G, ccx, i * 0.3, zF + 1.6 - i * 0.35);

  // --- twin towers: two storeys, belfry with bells, cornice with urns,
  // octagonal crown with a cupola, lantern and finial (to hTower)
  for (const tx of [xL + TW / 2, xR - TW / 2]) {
    const tz = zF - TW / 2;
    k.push({ x: tx, z: tz });
    k.box(TW + 0.4, 1.4, TW + 0.4, G, 0, plinth - 0.2, 0);
    k.box(TW, 19.5 - plinth, TW, 'plaster', 0, plinth, 0);
    for (const [qx, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.box(0.8, 19.5 - plinth, 0.8, G, qx * (TW / 2 - 0.3), plinth, qz * (TW / 2 - 0.3));
    k.box(TW + 0.3, 0.6, TW + 0.3, G, 0, L1, 0);
    win(k, 0, 3.4, 1.3, 2.6, TW / 2, { bw: 0.3, depth: 0.25, trim: G, pane: 'glass' });
    win(k, 0, 12, 1.3, 2.6, TW / 2, { bw: 0.3, depth: 0.25, trim: G, pane: 'glass', head: 'tri' });
    // clock
    k.cyl(0.85, 0.85, 0.25, 10, G, 0, 16.9, TW / 2 + 0.1, { rx: Math.PI / 2, smooth: true });
    k.cyl(0.65, 0.65, 0.12, 10, 'white', 0, 16.9, TW / 2 + 0.22, { rx: Math.PI / 2, smooth: true });
    k.corniceRing(TW, TW, corniceProfile('band', 0.55), G, 0, 19.5, 0);
    // belfry: an arched opening per face over a dark core, a bell
    const bY = 20.05;
    const hF = 5.6;
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      k.push({ y: bY, ry });
      k.wall(TW, hF, 0.8, 'plaster', [{ x: 0, y: 0.8, w: 2.2, h: 3.9, arch: 'round', pane: null }], 0, 0, TW / 2 - 0.4);
      if (ry === 0) k.surround({ x: 0, y: 0.8, w: 2.2, h: 3.9, arch: 'round' }, 0.28, 0.2, G, TW / 2);
      for (const sx of [-1, 1]) k.box(0.7, hF, 0.3, G, sx * (TW / 2 - 0.35), 0, TW / 2 + 0.1);
      k.pop();
    }
    k.box(TW - 1.6, hF, TW - 1.6, 'dark', 0, bY, 0);
    bell(k, 1.5, 0, bY + 1.4, TW / 2 - 1.2);
    k.corniceRing(TW, TW, corniceProfile('classic', 0.6), G, 0, bY + hF, 0);
    const cY = bY + hF + 0.6; // 26.25
    for (const [qx, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.box(0.7, 0.8, 0.7, G, qx * (TW / 2 - 0.35), cY, qz * (TW / 2 - 0.35));
      k.cyl(0.18, 0.32, 1.1, 6, G, qx * (TW / 2 - 0.35), cY + 0.8, qz * (TW / 2 - 0.35));
      k.cone(0.2, 0.5, 4, G, qx * (TW / 2 - 0.35), cY + 1.9, qz * (TW / 2 - 0.35));
    }
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      k.push({ y: cY, ry });
      k.box(TW - 1.4, 0.8, 0.25, G, 0, 0, TW / 2 - 0.35);
      k.pop();
    }
    // octagonal crown with openings, cupola, lantern, finial
    const oR = TW * 0.36;
    k.cyl(oR, oR + 0.1, 2.6, 8, 'plaster', 0, cY, 0, { ry: Math.PI / 8 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.box(0.35, 2.6, 0.35, G, Math.cos(a) * oR, cY, Math.sin(a) * oR);
      if (i % 2 === 0) k.box(0.7, 1.5, 0.1, 'dark', Math.cos(a + Math.PI / 8) * oR * 0.95, cY + 0.5, Math.sin(a + Math.PI / 8) * oR * 0.95, { ry: -(a + Math.PI / 8) + Math.PI / 2 });
    }
    k.cyl(oR + 0.35, oR + 0.35, 0.35, 8, G, 0, cY + 2.6, 0, { ry: Math.PI / 8 });
    k.lathe(PROFILES.bellCap, 8, G, 0, cY + 2.95, 0, { sr: oR * 0.95, sh: 1.9, smooth: true });
    k.cyl(0.35, 0.42, 0.9, 6, G, 0, cY + 4.8, 0);
    k.lathe(PROFILES.finial, 6, G, 0, cY + 5.7, 0, { sr: 0.6, sh: hTower - (cY + 5.7), flat: true });
    k.pop();
  }
}

// ------------------------------------------------------------ the builder
function bomJesus(k, { footprint: fp, dims }) {
  const rnd = k.rnd;
  const ground = fp.ground;
  k.groundLine = (x, z) => ground(x, z);
  const gAxis = (z, half = 11) => Math.max(ground(-half, z), ground(0, z), ground(half, z));

  // --- designed stair levels: the DEM on the axis plus a lift that fades
  // from the raised Terreiro (z 80) to the foot (z 214)
  const Z_TOP = 82.3;
  const Z_FOOT = 214;
  const liftTop = T_LEVEL - fp.rawGround(0, Z_TOP);
  const lev = (z) => {
    const t = THREE.MathUtils.clamp((z - Z_TOP) / (Z_FOOT - Z_TOP), 0, 1);
    const want = fp.rawGround(0, z) + liftTop + (0.4 - liftTop) * t;
    return Math.min(T_LEVEL, Math.max(want, gAxis(z) + 0.4));
  };

  k.begin('main');
  basilica(k, fp, dims);
  k.end('main');

  // --- Adro: the paved terrace in front of the church, balustrade, statues
  const adro = fp.part(/Adro do Bom Jesus/);
  if (adro) {
    const pts = clean(adro.pts);
    k.prism(pts, -6, 6, G);
    k.prism(pts, -0.05, 0.1, 'graniteLight', { mat: MAT.smooth });
    const front = edges(pts).filter((e) => e.nz > 0.8 && e.len > 20);
    for (const e of front) {
      k.push({ x: e.mx, y: 0, z: e.mz - e.nz * 0.3, ry: e.ry });
      // parapet with a granite coping and piers
      k.box(e.len - 1, 1, 0.4, 'plaster', 0, 0, 0);
      k.box(e.len - 0.6, 0.2, 0.65, G, 0, 1, 0);
      for (let i = 0; i <= 6; i++) k.box(0.7, 1.15, 0.7, G, -(e.len - 1) / 2 + (i * (e.len - 1)) / 6, 0, 0);
      for (let i = 0; i <= 6; i++) {
        if (i === 3) continue;
        const u = -(e.len - 1) / 2 + (i * (e.len - 1)) / 6;
        k.statue(2, 'graniteLight', u, 1.15, 0, { seg: 5 });
      }
      k.pop();
    }
    for (const sx of [-1, 1]) for (const z of [30, 40]) k.lamp(4.5, sx * 20, 0, z, { color: 'iron' });
  }

  // --- Terreiro de Moisés, with the Moses fountain and two stairs up
  const tm = fp.part(/Terreiro de Moisés/);
  if (tm) {
    const pts = clean(tm.pts);
    const yb = Math.min(...pts.map(([x, z]) => ground(x, z))) - 2;
    k.prism(pts, yb, T_LEVEL - yb, 'plaster');
    k.prism(pts, T_LEVEL - 0.05, 0.1, 'graniteLight', { mat: MAT.smooth });
    for (const e of edges(pts)) {
      if (e.nz < 0.5 && Math.abs(e.nx) < 0.8) continue;
      if (e.len < 2) continue;
      k.push({ x: e.mx, y: T_LEVEL, z: e.mz, ry: e.ry });
      k.box(e.len + 0.3, 1.1, 0.45, 'plaster', 0, 0, -0.2);
      k.box(e.len + 0.5, 0.25, 0.7, G, 0, 1.1, -0.2);
      k.pop();
    }
    // retaining wall of the Adro with the Moses fountain in the middle
    k.box(26, -T_LEVEL + 1.1, 1.2, 'plaster', 0, T_LEVEL, 50.4);
    k.box(26.4, 0.3, 1.5, G, 0, 1.1, 50.4);
    stairFountain(k, 0, T_LEVEL, 51, 5, 'moses');
    // the two stairs from the Terreiro up to the Adro (OSM: x +-7..14)
    for (const sx of [-1, 1]) {
      flightZ(k, sx * 10.5, 49.2, 57.8, 3, T_LEVEL, -T_LEVEL, T_LEVEL - 2);
      sideWall(k, sx * 8.8, 49.2, 57.8, 1.1, T_LEVEL + 1.1, T_LEVEL - 1, 0.4, 'plaster');
      sideWall(k, sx * 12.2, 49.2, 57.8, 1.1, T_LEVEL + 1.1, T_LEVEL - 1, 0.4, 'plaster');
    }
    for (const [x, z] of [[-13, 62], [13, 62], [-13, 74], [13, 74]]) {
      k.box(1.1, 1.3, 1.1, G, x, T_LEVEL, z);
      k.statue(2, 'graniteLight', x, T_LEVEL + 1.3, z, { seg: 6 });
    }
  }
  // chapels of São Pedro and Maria Madalena flank the top of the stair
  for (const re of [/Capela de São Pedro/, /Capela de Maria Madalena/]) {
    const p = fp.part(re);
    if (p) chapel(k, p.pts, ground, 0, 84);
  }

  // --- zigzag: bands of two flights per side, a fountain on each riser
  // of the central spine, white walls with granite copings, pinnacles
  const XI = 1.8;
  const XO = 8.4;
  const XS = 10.6;
  // topExtra / bottomExtra: landings beyond the first / last band (m)
  // senses: the fountain of each band, top band first
  const zigzag = (bounds, statues, topExtra, bottomExtra, senses = []) => {
    {
      // top landing: the upper half of the first band and above
      const z0 = bounds[0] - topExtra;
      const z1 = (bounds[0] + bounds[1]) / 2;
      const L = lev(bounds[0]);
      const yb = gAxis(z1) - 2;
      k.box(XO * 2, L - yb, z1 - z0, 'graniteLight', 0, yb, (z0 + z1) / 2);
      // bottom landing below the last band, full width
      const zb = bounds[bounds.length - 1];
      const Lb = lev(zb);
      const yb2 = gAxis(zb + bottomExtra) - 2;
      k.box(XS * 2 - 0.6, Lb - yb2, bottomExtra, 'graniteLight', 0, yb2, zb + bottomExtra / 2);
    }
    for (let i = 0; i < bounds.length - 1; i++) {
      const zHi = bounds[i]; // upper edge (uphill)
      const zLo = bounds[i + 1];
      const D = zLo - zHi;
      const zMid = (zHi + zLo) / 2;
      const Lt = lev(zHi);
      const Lb = lev(zLo);
      const R = Lt - Lb;
      const Lm = Lb + R / 2;
      const yBot = Math.min(ground(-XS, zLo), ground(XS, zLo), ground(0, zLo)) - 2;
      // central landings: at Lb spanning the lower half of this band
      k.box(XI * 2, Lb - yBot, D / 2, 'graniteLight', 0, yBot, zMid + D / 4);
      // the riser under the Lt landing, with the fountain of the sense/virtue
      stairFountain(k, 0, Lb, zMid, Math.min(3.4, R + 0.4), senses[i]);
      for (const sx of [-1, 1]) {
        // lower flight outward (strip zMid..zLo), upper flight inward (zHi..zMid)
        flightX(k, sx * XI, sx * XO, zMid + D / 4, D / 2, Lb, R / 2, yBot);
        flightX(k, sx * XO, sx * XI, zHi + D / 4, D / 2, Lm, R / 2, yBot);
        // side landing, white on its faces
        k.box(XS - XO, Lm - yBot, D, 'white', (sx * (XO + XS)) / 2, yBot, zMid);
        k.box(XS - XO + 0.3, 0.25, D + 0.1, GG, (sx * (XO + XS)) / 2, Lm - 0.2, zMid);
        // walls: front of the lower flight "/", divider under the upper "\"
        crossWall(k, zLo - 0.2, sx * XI, sx * XO, Lb + 1.1, Lm + 1.1, yBot, 0.5, 'white', GG);
        crossWall(k, zMid, sx * XI, sx * XO, Lt + 1.1, Lm + 1.1, Lb, 0.5, 'white', GG);
        // outer wall of the side landing
        sideWall(k, sx * (XS - 0.25), zHi, zLo, Lm + 1.1, Lm + 1.1, yBot, 0.5, 'white', GG);
        // pinnacles at the corners, a statue on the side landing
        obelisk(k, 2.6, GG, sx * XO, Lm + 1.35, zLo - 0.2);
        // the spine end of the parapet: another obelisk by the fountain
        obelisk(k, 2.3, GG, sx * (XI + 0.2), Lb + 1.35, zLo - 0.2);
        if (statues) {
          // the biblical figures on the side landings, on their pedestals
          k.box(0.8, 0.5, 0.8, GG, sx * (XS - 0.3), Lm + 1.35, zMid);
          k.statue(1.9, GG, sx * (XS - 0.3), Lm + 1.85, zMid, { seg: 4, ry: sx * -0.6 });
        }
      }
    }
  };
  // Três Virtudes: 3 bands, fountains at the OSM points z 85.8, 92.8, 99.7
  const V = [82.3, 89.3, 96.25, 103.2];
  // (pilgrims climb Faith, Hope, Charity)
  zigzag(V, true, 2.6, 3.45, ['charity', 'hope', 'faith']);
  // straight central flight (OSM z 101.9 - 115.4) between the two zigzags
  const zC0 = 103.2 + 3.45;
  const zC1 = 115.1;
  flightZ(k, 0, zC0, zC1, 4.4, lev(118.5), lev(103.2) - lev(118.5), gAxis(zC1) - 2);
  sideWall(k, -2.45, zC0, zC1, lev(103.2) + 1.1, lev(118.5) + 1.1, gAxis(zC1) - 2, 0.5, 'white', GG);
  sideWall(k, 2.45, zC0, zC1, lev(103.2) + 1.1, lev(118.5) + 1.1, gAxis(zC1) - 2, 0.5, 'white', GG);
  // Cinco Sentidos: 5 bands, fountains at z 121.8 .. 148.7
  const Sn = [118.5, 125.2, 131.9, 138.6, 145.3, 152];
  // (climbing: Sight, Hearing, Smell, Taste, Touch)
  zigzag(Sn, true, 3.4, 3.35, ['touch', 'taste', 'smell', 'hearing', 'sight']);
  // Cinco Chagas: the loop of side flights round the fountain wall
  {
    const zTop = 155.35;
    const zBot = 167.8;
    const Ltop = lev(152);
    const Lbot = lev(zBot + 3);
    const yBot = gAxis(zBot + 3) - 2;
    k.box(XS * 2 - 1, Lbot - yBot, zBot + 3.2 - zTop, 'graniteLight', 0, yBot, (zTop + zBot + 3.2) / 2);
    crossWall(k, zTop, -6.2, 6.2, Ltop + 1.1, Ltop + 1.1, Lbot, 0.8, 'white', GG);
    stairFountain(k, 0, Lbot, zTop + 0.4, 4.2, 'chagas');
    for (const sx of [-1, 1]) {
      flightZ(k, sx * 7.6, zTop, zBot, 2.6, Lbot, Ltop - Lbot, yBot);
      sideWall(k, sx * 9.1, zTop, zBot, Ltop + 1.1, Lbot + 1.1, yBot, 0.4, 'white', GG);
      sideWall(k, sx * 6.1, zTop, zBot, Ltop + 1.1, Lbot + 1.1, Lbot, 0.4, 'white', GG);
      obelisk(k, 2.4, GG, sx * 9.1, Lbot + 1.3, zBot);
      obelisk(k, 2.4, GG, sx * 9.1, Ltop + 1.3, zTop);
    }
    // basin of the Cinco Chagas (OSM water part)
    const wat = fp.parts.find((p) => p.tag === 'water' && p.pts.length > 5 && Math.abs(centroid(p.pts)[1] - 157) < 4);
    if (wat) {
      k.prism(clean(offset(wat.pts, 0.5)), Lbot, 0.7, G);
      k.prism(clean(wat.pts), Lbot + 0.45, 0.2, 'water');
    }
  }
  // Escadório do Pórtico: the straight flight between chapels (z 171 - 205)
  {
    const zA = 171;
    const zB = 205;
    const LA = lev(zA);
    const LB = lev(zB + 4);
    const yBot = Math.min(gAxis(zB), gAxis(zA)) - 2;
    flightZ(k, 0, zA, zB, 5.4, LB, LA - LB, yBot);
    for (const sx of [-1, 1]) {
      sideWall(k, sx * 3, zA, zB, LA + 1.1, LB + 1.1, yBot, 0.6, 'white', G);
      for (let i = 0; i <= 4; i += 2) {
        const z = zA + ((zB - zA) * i) / 4;
        const y = LA + ((LB - LA) * i) / 4;
        obelisk(k, 2.4, G, sx * 3, y + 1.3, z);
      }
    }
    // foot landing with its gate piers
    const Lf = lev(Z_FOOT);
    const yF = gAxis(Z_FOOT) - 1.5;
    k.box(12, Math.max(0.4, LB - yF), Z_FOOT - zB, 'graniteLight', 0, yF, (zB + Z_FOOT) / 2);
    for (const sx of [-1, 1]) {
      k.box(1.4, 3.2, 1.4, G, sx * 3.4, Lf, Z_FOOT - 0.8);
      k.urn(1.3, G, sx * 3.4, Lf + 3.2, Z_FOOT - 0.8);
    }
  }
  // chapels beside the stair and along the Via Sacra, on their polygons
  for (const p of fp.partsOf('church')) {
    // (the two drawn above; the Via Sacra's «Aparição de Jesus a Maria
    // Madalena» chapel is a different one and stays)
    if (/Basílica|Capela de São Pedro|Capela de Maria Madalena/.test(p.name || '')) continue;
    const [cx, cz] = centroid(p.pts);
    chapel(k, p.pts, ground, cx > 0 ? cx - 6 : cx + 6, cz);
  }

  // --- Via Sacra: the zigzag path from the foot down to the Pórtico,
  // through the OSM stair points in the woods
  const path = [[0, 214], [11, 219.3], [41, 229.6], [61.6, 236.7], [94, 248], [89.9, 258.5], [53.3, 254.5], [22, 262], [26.4, 276.5], [41, 283.9], [54.6, 290.4], [67.5, 296.5], [82, 302], [92, 309], [60, 318], [20, 325], [16, 345], [28.4, 368], [29.3, 383.5]];
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1];
    const [x1, z1] = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 16));
    for (let j = 0; j < n; j++) {
      const a = [x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n];
      const b = [x0 + ((x1 - x0) * (j + 1)) / n, z0 + ((z1 - z0) * (j + 1)) / n];
      k.segment([a[0], ground(a[0], a[1]) + 0.05, a[1]], [b[0], ground(b[0], b[1]) + 0.05, b[1]], 3, 0.5, 'sand', { mat: MAT.smooth, ext: 0.4 });
    }
  }
  // the Pórtico (1723): gate with pinnacled piers on its OSM polygon
  const po = fp.part(/Pórtico/);
  if (po) {
    const pts = clean(po.pts);
    const [cx, cz] = centroid(pts);
    const e = edges(pts).reduce((a, b) => (b.len > a.len ? b : a));
    const y = Math.max(...pts.map(([x, z]) => ground(x, z)));
    k.push({ x: cx, y, z: cz, ry: e.nz > 0 ? e.ry : e.ry + Math.PI });
    k.box(e.len + 1, 1.2, 3.4, G, 0, -1, 0);
    k.gate(e.len, 6.4, 1.6, [{ x: 0, w: 3.4, h: 5.2 }], G, 0, 0, 0);
    k.box(e.len + 0.6, 0.6, 2, G, 0, 6.4, 0);
    pediment(k, 4.4, 1.3, 0.8, G, 0, 7, 0, { frame: 0.25 });
    cartouche(k, 1.3, 1.4, 0.3, G, 0, 7.2, 0.5);
    for (const sx of [-1, 1]) {
      k.box(1.6, 7, 2, G, sx * (e.len / 2 - 0.5), 0, 0);
      k.pinnacle(3.2, G, sx * (e.len / 2 - 0.5), 7, 0);
    }
    k.pop();
  }

  // --- funicular (1882, water balance): two tracks on the OSM lines, the
  // masonry bed following the slope, two cars at opposite ends, stations
  const tracks = [
    [[-29.0, 77.5], [-32.9, 148.1], [-33.7, 161.1], [-42.1, 314.0]],
    [[-32.0, 77.2], [-36.1, 146.8], [-36.9, 159.7], [-45.5, 313.8]],
  ];
  const trackY = (x, z) => Math.max(ground(x, z), ground(x - 3, z), ground(x + 3, z)) + 0.9;
  const samples = tracks.map((tr) => {
    const out = [];
    for (let i = 1; i < tr.length; i++) {
      const [x0, z0] = tr[i - 1];
      const [x1, z1] = tr[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 12));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const x = x0 + ((x1 - x0) * j) / n;
        const z = z0 + ((z1 - z0) * j) / n;
        out.push([x, trackY(x, z), z]);
      }
    }
    return out;
  });
  // keep the profile falling steadily downhill (running minimum)
  for (const s of samples) for (let i = 1; i < s.length; i++) s[i][1] = Math.min(s[i][1], s[i - 1][1]);
  for (let i = 1; i < samples[0].length; i++) {
    const a0 = samples[0][i - 1];
    const a1 = samples[0][i];
    const b0 = samples[1][Math.min(i - 1, samples[1].length - 1)];
    const b1 = samples[1][Math.min(i, samples[1].length - 1)];
    // bed under both tracks
    const mid0 = [(a0[0] + b0[0]) / 2, Math.min(a0[1], b0[1]) - 0.5, (a0[2] + b0[2]) / 2];
    const mid1 = [(a1[0] + b1[0]) / 2, Math.min(a1[1], b1[1]) - 0.5, (a1[2] + b1[2]) / 2];
    k.segment(mid0, mid1, 6.2, 1.2, GG, { ext: 0.3 });
    const gMin = Math.min(ground(mid1[0], mid1[2]), ground(mid0[0], mid0[2]));
    if (mid1[1] - gMin > 1.2) k.box(5.6, mid1[1] - gMin + 0.5, 0.8, G, mid1[0], gMin - 0.5, mid1[2]);
  }
  for (const s of samples) {
    for (let i = 0; i < s.length - 1; i += 3) {
      const j = Math.min(i + 3, s.length - 1);
      for (const dx of [-0.6, 0.6]) k.segment([s[i][0] + dx, s[i][1] + 0.2, s[i][2]], [s[j][0] + dx, s[j][1] + 0.2, s[j][2]], 0.12, 0.14, 'rust', { ext: 0.1 });
    }
  }
  // no cars here: life.js runs the two cars on the real OSM tracks
  // bottom station (OSM building at the lower end) and the top station
  const bot = fp.parts.find((p) => p.tag === 'building' && centroid(p.pts)[1] > 300 && centroid(p.pts)[0] < -20);
  if (bot) house(k, bot.pts, ground, 6, 'cream');
  house(k, [[-38.5, 68], [-25.5, 68], [-25.5, 76.5], [-38.5, 76.5]], ground, 5.5, 'cream');

  // --- hotels and houses of the sanctuary on their OSM polygons
  for (const p of fp.partsOf('building')) {
    if (/Pórtico/.test(p.name || '') || p === bot) continue;
    // the far hotels (beyond the chapels and stairs) are left out
    const [bx, bz] = centroid(p.pts);
    if (bx > 100 || bx < -120 || bz < -120) continue;
    house(k, p.pts, ground, /Colunata/.test(p.name || '') ? 6 : 9, rnd() > 0.5 ? 'plaster' : 'cream');
  }
  // Terreiro dos Evangelistas (paved, with its fountain)
  const ev = fp.part(/Terreiro dos Evangelistas/);
  // (the square itself is level in reality but lies on a 30 % slope of the
  // coarse DEM: only its fountain is drawn, the chapels stand round it)
  if (ev) {
    const [cx, cz] = centroid(clean(ev.pts));
    const y = ground(cx, cz);
    k.cyl(3.4, 3.6, 0.8 + 1.5, 14, G, cx, y - 1.5, cz);
    k.cyl(3.1, 3.1, 0.15, 14, 'water', cx, y + 0.6, cz);
    k.column(3, 0.3, G, cx, y + 0.2, cz, { seg: 8 });
    k.statue(1.8, 'graniteLight', cx, y + 3.2, cz, { seg: 6 });
    k.marker('fountain', cx, y + 0.7, cz, { kind: 'basin', name: 'Terreiro dos Evangelistas', r: 3.1 });
  }
  // ponds of the park (the large lake behind the basilica spans 23 m of
  // DEM slope and cannot lie level on it: left to the terrain layer)
  for (const p of fp.partsOf('water')) {
    if (p.pts.length < 6 || Math.abs(centroid(p.pts)[1] - 157) < 4) continue;
    const pts = clean(p.pts);
    const gs = pts.map(([x, z]) => ground(x, z));
    const [px, pz] = centroid(pts);
    if (Math.max(...gs) - Math.min(...gs) > 4 || px > 112 || px < -200 || pz < -140) continue;
    const y = Math.min(...gs);
    k.prism(offset(pts, 0.4), y - 4, 4.7, G);
    k.prism(pts, y - 0.4, 1.05, 'water');
  }

  // --- woods and clipped shrubs on the slope beside the stair
  let placed = 0;
  for (let i = 0; i < 400 && placed < 2; i++) {
    const x = (rnd() - 0.5) * 150;
    const z = 60 + rnd() * 300;
    if (Math.abs(x) < 16 && z < 215) continue; // the stair
    if (x < -20 && x > -52) continue; // the funicular
    if (path.some(([px, pz], j) => j && Math.hypot(px - x, pz - z) < 7)) continue;
    const h = 11 + rnd() * 7;
    k.tree(x, ground(x, z) - 0.3, z, h, { lobes: rnd() > 0.7 ? 2 : 1, spread: 0.26 });
    placed++;
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const z = 90 + i * 40;
      const x = sx * (12.4 + rnd() * 1.2);
      k.tree(x, ground(x, z) - 0.2, z, 3.2, { kind: 'topiary' });
    }
  }
}
bomJesus.metric = true;
bomJesus.rule = {
  base: { part: /Adro do Bom Jesus/, stat: 'mean' },
  view: 0.3, // the close-up looks up the escadório at the front
  frame: { x0: -40, x1: 40, z0: -30, z1: 170, y0: -40 }, // basilica, Adro and the zigzags
  pad: { parts: [/Basílica/, /Adro do Bom Jesus/, /Terreiro de Moisés/], level: padLevel },
  // the sanctuary proper: basilica, terraces, stairs, chapels, funicular,
  // Pórtico (the far hotels and the park lake are left to the city layer)
  extent: [/Capela/, /Escadórios/, /Terreiro/, /Adro/, /Elevador/, /Pórtico/, /Colunata/, 'stairs', 'church', 'square', 'funicular'],
  note: 'whole sanctuary on its OSM parts; only the Adro, basilica and Terreiro are padded; the stair and the Via Sacra climb the DEM',
};

export default { 'bom-jesus': bomJesus };

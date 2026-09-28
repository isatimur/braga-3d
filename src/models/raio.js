// Palácio do Raio (1754-55, André Soares), metric builder. The OSM outline
// (32.4 x 30.7 m) is the whole palace; its 27.6 m NE edge is the tiled
// front (+z). data/dimensions.json: 2 storeys, 7 bays, 11 windows (7 upper,
// 4 lower) and 3 doors, cornice 11.7 m, balustrade 14 m, crest about 16 m.
// The front range (about 13 m deep) carries the azulejo front; the rear
// parts of the outline are lower rendered wings with hip roofs.
import * as THREE from 'three';
import { corniceProfile, MAT } from './kit.js';
import { cartouche } from './parts.js';
import { bbox } from './geom.js';
import { polyCornice, roofOver, polyWindows } from './metric.js';

const G = 'graniteWarm';
const T = 'granite';

// Keep the part of a polygon on one side of the line z = z0 (keep: +1 = z >= z0).
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

function raio(k, { footprint, dims }) {
  const ol = footprint.outline;
  const ob = bbox(ol);
  // the front edge: the longest edge facing +z
  const zF = ob.z1;
  const fx = ol.filter((p) => Math.abs(p[1] - zF) < 0.5).map((p) => p[0]);
  const x0 = Math.min(...fx);
  const x1 = Math.max(...fx);
  const cx = (x0 + x1) / 2;
  const W = x1 - x0; // 27.6
  const HC = dims?.height_m?.cornice ?? 11.7;
  const HB = dims?.height_m?.balustrade ?? 14;
  const HT = dims?.height_m?.total ?? 16;
  const DEPTH = 13;
  const front = clipZ(ol, zF - DEPTH, 1);
  const rear = clipZ(ol, zF - DEPTH + 0.3, -1);

  k.begin('main');
  // --- rear wings: rendered, granite frames, hip roofs
  const HR = 9.5;
  k.prism(rear, -1.5, HR + 1.5, 'plaster');
  polyCornice(k, rear, HR - 0.5, corniceProfile('eave', 0.5), T);
  polyWindows(k, rear, { only: (e) => e.nz < 0.7, storeys: [1.4, 5.8], bay: 3.6, w: 1.2, h: 2.1, win: { trim: T, pane: 'glass' } });
  const rb = bbox(rear);
  // two roofs over the two rear lobes (west and east of the notch)
  roofOver(k, clipX(rear, cx - 1, -1), HR, 3, 'terracotta', 'hip');
  roofOver(k, clipX(rear, cx - 1, 1), HR, 3, 'terracotta', 'hip');
  void rb;

  // --- front range: body behind the tiled front wall
  const body = front.map(([x, z]) => [x, Math.min(z, zF - 1.1)]);
  k.prism(body, -1.5, HC + 1.5, 'plaster');
  polyCornice(k, body, HC - 0.6, corniceProfile('classic', 0.6), T, { minLen: 3 });
  polyWindows(k, body, { only: (e) => Math.abs(e.nx) > 0.8, storeys: [1.4, 6.8], bay: 3.8, w: 1.3, h: 2.4, win: { trim: T, pane: 'glass' } });
  // low hip roof set back behind the crowning balustrade (hidden from the street)
  roofOver(k, body.map(([x, z]) => [x * 0.94 + cx * 0.06, Math.min(z, zF - 2.4)]), HC + 0.2, 2.3, 'terracotta', 'hip', { over: 0 });

  // --- the tiled front wall with real openings
  const bays = [-10.6, -7.3, -3.9, 0, 3.9, 7.3, 10.6];
  const holes = [];
  bays.forEach((x, i) => {
    if (i === 3) holes.push({ x, y: 0, w: 2.1, h: 4.3, arch: 'round', pane: 'doorBlue' });
    else if (i === 1 || i === 5) holes.push({ x, y: 0, w: 1.95, h: 4.0, pane: 'doorBlue' });
    else holes.push({ x, y: 1.2, w: 1.5, h: 2.7, pane: 'glass' });
    holes.push({ x, y: 6.8, w: 1.55, h: 2.6, arch: 'round', pane: 'glass', emit: 0.12 });
  });
  k.push({ x: cx });
  k.wall(W - 2.6, HC - 0.6, 1.1, 'azulejo', holes, 0, 0, zF - 0.55, { inset: 0.7 });
  // rococo surrounds: frame, curling head with a shell, ears at the sill
  for (const hh of holes) {
    k.surround(hh, 0.24, 0.18, G, zF, { sill: hh.y > 0.5 });
    const top = hh.y + hh.h + 0.22;
    const w = hh.w + 0.7;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.quadraticCurveTo(-w / 2 - 0.25, 0.8, -w * 0.18, 0.7);
    s.quadraticCurveTo(0, 1.4, w * 0.18, 0.7);
    s.quadraticCurveTo(w / 2 + 0.25, 0.8, w / 2, 0);
    s.closePath();
    k.extrude(s, 0.26, G, hh.x, top, zF + 0.1, { curve: 5 });
    if (hh.pane === 'glass') {
      // white sashes
      k.box(0.07, hh.h, 0.05, 'white', hh.x, hh.y, zF - 0.62);
      k.box(hh.w, 0.07, 0.05, 'white', hh.x, hh.y + hh.h * 0.62, zF - 0.62);
    }
    if (hh.y > 0.5) for (const sx of [-1, 1]) k.box(0.3, 0.55, 0.22, G, hh.x + sx * (hh.w / 2 + 0.15), hh.y - 0.8, zF + 0.1);
  }
  // corner pilasters with capitals, plinth, floor band
  for (const sx of [-1, 1]) {
    k.box(1.3, HC - 0.6, 0.5, T, sx * (W / 2 - 0.65), 0, zF - 0.2);
    k.box(1.5, 0.5, 0.6, T, sx * (W / 2 - 0.65), HC - 1.5, zF - 0.2);
  }
  k.box(W, 0.7, 0.5, T, 0, -0.4, zF - 0.2);
  k.box(W - 2.4, 0.22, 0.4, T, 0, 5.7, zF - 0.1);
  // blue iron balconies (three bays a side) and the stone centre balcony
  for (const sx of [-1, 1]) {
    const bx = sx * 7.25;
    k.box(9.4, 0.22, 0.9, T, bx, 6.55, zF + 0.4);
    k.balustrade(9.4, 1.0, 'doorBlue', bx, 6.77, zF + 0.8, { cheap: true, d: 0.06, sp: 0.16 });
    for (const x of [-3.4, 0, 3.4]) for (let j = 0; j < 3; j++) k.ico(0.12, 0, 'flowerRed', bx + x - 0.4 + j * 0.4, 7.9, zF + 0.8, { jit: 0.1 });
  }
  k.box(2.9, 0.3, 1.2, T, 0, 6.45, zF + 0.55);
  k.balustrade(2.8, 1.0, T, 0, 6.75, zF + 1.0, { cheap: true, d: 0.14, sp: 0.25 });
  // carved centre bay: pilasters with atlantes, cartouche over the door
  for (const sx of [-1, 1]) {
    k.box(0.5, HC - 0.6, 0.35, G, sx * 1.55, 0, zF + 0.05);
    k.statue(1.3, 'graniteLight', sx * 1.35, 6.8, zF + 0.35, { seg: 6 });
  }
  k.box(3.0, 0.8, 0.5, G, 0, 4.8, zF + 0.1, { mat: MAT.smooth });
  cartouche(k, 0.9, 1.0, 0.25, 'graniteLight', 0, 4.9, zF + 0.3);

  // --- entablature, cornice, crowning balustrade with urns, central crest
  k.box(W + 0.2, 0.5, 0.8, T, 0, HC - 0.6, zF - 0.1);
  k.cornice(W + 0.4, corniceProfile('classic', 0.55), T, 0, HC - 0.1, zF - 0.2);
  const BY = HC + 0.35;
  const segs = [[-W / 2 + 1, -2.6], [2.6, W / 2 - 1]];
  for (const [a, c] of segs) k.balustrade(c - a, HB - BY, T, (a + c) / 2, BY, zF - 0.35, { cheap: true, d: 0.26, sp: 0.36 });
  for (const px of [-W / 2 + 0.7, -W / 2 + 1.5, -9, -5.6, 5.6, 9, W / 2 - 1.5, W / 2 - 0.7]) {
    k.box(0.6, HB - BY, 0.6, T, px, BY, zF - 0.35);
    k.urn(1.0, T, px, HB, zF - 0.35, { seg: 7 });
  }
  // crest: curved gable with the arms, two star oculi, finial
  const cs = new THREE.Shape();
  cs.moveTo(-3.4, 0);
  cs.quadraticCurveTo(-3.5, 1.4, -1.9, 1.5);
  cs.quadraticCurveTo(-0.9, 1.6, -0.7, 2.5);
  cs.lineTo(0.7, 2.5);
  cs.quadraticCurveTo(0.9, 1.6, 1.9, 1.5);
  cs.quadraticCurveTo(3.5, 1.4, 3.4, 0);
  cs.closePath();
  k.extrude(cs, 0.6, G, 0, BY, zF - 0.3, { curve: 6 });
  cartouche(k, 1.2, 1.5, 0.3, 'graniteLight', 0, BY + 0.2, zF + 0.05);
  for (const sx of [-1, 1]) {
    k.cyl(0.42, 0.42, 0.12, 12, 'white', sx * 1.9, BY + 0.75, zF + 0.02, { rx: Math.PI / 2 });
    k.cyl(0.2, 0.2, 0.08, 5, 'doorBlue', sx * 1.9, BY + 0.75, zF + 0.1, { rx: Math.PI / 2 });
  }
  k.box(0.9, 0.7, 0.6, G, 0, BY + 2.5, zF - 0.3);
  k.lathe([[0, 0], [0.4, 0], [0.45, 0.25], [0.25, 0.45], [0.35, 0.7], [0.15, 1], [0, 1]], 8, G, 0, BY + 3.2, zF - 0.3, { sh: HT - BY - 3.2, flat: true });
  k.pop();
  k.end('main');
}

// Keep the part of a polygon on one side of the line x = x0 (keep: +1 = x >= x0).
function clipX(pts, x0, keep = 1) {
  return clipZ(pts.map(([x, z]) => [z, x]), x0, keep).map(([z, x]) => [x, z]);
}

raio.metric = true;
raio.rule = { view: 0.3, note:'the azulejo front is the 27.6 m NE edge of the OSM outline; rear wings on the rest of the outline' };

export default { 'palacio-raio': raio };

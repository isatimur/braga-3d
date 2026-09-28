// Theatro Circo (1915, João de Moura Coutinho), metric builder. The OSM
// outline (52.8 x 40.5 m) is the whole theatre block; the 32.8 m ENE edge
// on Avenida da Liberdade is the front (+z). data/dimensions.json: facade
// cornice 17 m, fly tower 28 m (24 m stage-to-grid), stage 14 m wide and
// 11.9 m deep, 5 facade bodies, 9 doors.
// Bodies along the front, left to right: the rounded one-storey corner
// pavilion with its terrace, the rose left wing, the granite centre with
// the THEATRO CIRCO frieze and the crest, the rose right wing. Behind: the
// auditorium under a slate roof and the tall fly tower at the rear (WSW).
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { win, segPediment, cartouche } from './parts.js';
import { bbox, offset } from './geom.js';
import { polyCornice, polyWindows } from './metric.js';

const R = 'rose';
const G = 'graniteGrey';

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
const clipX = (pts, x0, keep = 1) => clipZ(pts.map(([x, z]) => [z, x]), x0, keep).map(([z, x]) => [x, z]);

function theatro(k, { footprint, dims }) {
  const ol = footprint.outline;
  const ob = bbox(ol);
  const zF = ob.z1; // front face
  const fx = ol.filter((p) => Math.abs(p[1] - zF) < 0.5).map((p) => p[0]);
  const x0 = Math.min(...fx); // -12.4: the front edge after the rounded corner
  const x1 = Math.max(...fx); // 20.2
  const HC = dims?.height_m?.facade_cornice ?? 17;
  const HF = dims?.height_m?.fly_tower ?? 28;
  const cx = (x0 + x1) / 2; // axis of the centre body
  const CW = 12.8; // centre body
  const DEPTH = 12;
  const zR = zF - DEPTH; // back of the front range

  k.begin('main');
  // --- front range: rose wings, the corner pavilion on the rounded corner
  const range = clipZ(ol, zR, 1);
  const upper = clipX(range, ob.x0 + 5.2, 1).map(([x, z]) => [x, Math.min(z, zF - 0.6)]);
  const corner = clipX(range, ob.x0 + 5.4, -1);
  k.prism(upper, -2.5, HC + 2.5, R);
  k.prism(offset(upper, 0.12), -2.5, 8.5, G, { mat: MAT.ashlar }); // granite ground storey
  k.box(ob.x1 - ob.x0 - 5, 0.5, 0.5, G, (ob.x0 + 5.2 + ob.x1) / 2, 8.5, zF - 0.1);
  polyCornice(k, upper, HC - 0.8, corniceProfile('classic', 0.8), G, { minLen: 3 });
  // slate mansard with dormers over the wings
  const ub = bbox(upper);
  k.frustum(ub.w - 1.2, ub.d - 1.2, ub.w - 4.4, ub.d - 4.4, 2.6, 'slate', ub.cx, HC, ub.cz);
  k.box(ub.w - 4.4, 0.4, ub.d - 4.4, 'lead', ub.cx, HC + 2.6, ub.cz);
  // the rounded corner pavilion: one granite storey and a balustraded terrace
  k.prism(corner, -2.5, 10, G, { mat: MAT.ashlar });
  polyCornice(k, corner, 7.2, corniceProfile('classic', 0.45), 'graniteLight');
  k.prism(offset(corner, 0.25), 7.5, 0.3, 'graniteLight');
  for (const e of edgesOf(corner)) {
    if (e.len < 1.5 || e.nx > 0.5) continue;
    k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
    k.balustrade(e.len - 0.4, 1.0, 'graniteLight', 0, 7.8, 0, { cheap: true, d: 0.2, sp: 0.3 });
    if (e.len > 3) win(k, 0, 1.2, 1.9, 3.8, 0, { arch: 'round', bw: 0.35, depth: 0.3, trim: 'graniteLight', pane: 'dark' });
    k.pop();
  }

  // --- front wings: three bays each, arched doors below, tall windows above
  const wings = [[x0, cx - CW / 2], [cx + CW / 2, x1]];
  for (const [a, b] of wings) {
    const w = b - a;
    const m = (a + b) / 2;
    k.push({ x: m });
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + (i + 0.5) * (w / 3);
      win(k, x, 0.6, 1.9, 4.6, zF, { arch: 'round', bw: 0.35, depth: 0.3, trim: 'graniteLight', pane: i === 1 ? 'dark' : 'glass' });
      win(k, x, 9.6, 1.5, 3.6, zF - 0.6, { bw: 0.3, depth: 0.3, trim: G, pane: 'glass', sill: true });
      segPediment(k, 2.4, 0.5, 0.3, G, x, 13.6, zF - 0.4);
      win(k, x, 14.2, 1.2, 1.5, zF - 0.6, { bw: 0.25, depth: 0.25, trim: G, pane: 'glass' });
      k.box(1.6, 1.7, 1.6, 'slate', x, HC + 0.3, zF - 1.6);
      k.box(0.9, 1.0, 0.1, 'glass', x, HC + 0.6, zF - 0.78);
      k.cone(1.2, 0.8, 4, 'slate', x, HC + 2.0, zF - 1.6, { sz: 0.7 });
    }
    for (const sx of [-1, 1]) k.box(0.8, HC - 8.6, 0.35, G, sx * (w / 2 - 0.4), 8.6, zF - 0.45);
    k.pop();
  }
  // side face on the street to the left: windows over the granite storey
  polyWindows(k, upper, { only: (e) => e.nx < -0.8, storeys: [9.6, 14.2], bay: 4.2, w: 1.4, h: 2.8, win: { trim: G, pane: 'glass' } });

  // --- centre body: granite, three arched doors, balcony, three tall windows
  k.push({ x: cx });
  const zc = zF + 0.4;
  k.prism([[-CW / 2, zR + 1], [CW / 2, zR + 1], [CW / 2, zc], [-CW / 2, zc]], -2.5, HC + 2.5, G, { mat: MAT.ashlar });
  const ops = [-3.9, 0, 3.9];
  for (const x of ops) {
    win(k, x, 0.4, 2.2, 5.2, zc, { arch: 'round', bw: 0.4, depth: 0.4, trim: 'graniteLight', pane: 'dark' });
    k.box(1.4, 0.9, 0.1, 'gold', x, 3.4, zc + 0.05, { emit: 0.3 });
    win(k, x, 7.4, 2.2, 5.6, zc, { arch: 'round', bw: 0.35, depth: 0.35, trim: 'graniteLight', pane: 'glass', emit: 0.18 });
  }
  for (const x of [-5.9, -1.95, 1.95, 5.9]) k.column(8.5, 0.34, 'graniteLight', x, 6.4, zc + 0.35, { seg: 10, smooth: true });
  k.box(CW + 0.6, 0.35, 1.4, G, 0, 6.4, zc + 0.6);
  k.balustrade(CW, 1.0, 'iron', 0, 6.75, zc + 1.2, { cheap: true, d: 0.06, sp: 0.18 });
  // frieze with the name, cornice, parapet
  k.box(CW + 0.3, 2.0, 0.8, G, 0, 14.4, zc + 0.1);
  k.box(8.2, 0.7, 0.1, 'gold', 0, 15.0, zc + 0.52, { emit: 0.35 });
  k.cornice(CW + 1.2, corniceProfile('classic', 0.8), G, 0, HC - 0.6, zc);
  k.box(CW, 1.2, 0.8, G, 0, HC + 0.2, zc - 0.2);
  // crest: segmental pediment with the cartouche, corner pedestals with finials
  segPediment(k, 7, 1.3, 0.9, G, 0, HC + 1.4, zc - 0.2);
  cartouche(k, 1.6, 1.8, 0.4, 'graniteLight', 0, HC + 1.5, zc + 0.3);
  for (const sx of [-1, 1]) {
    k.box(1.3, 2.4, 1.3, G, sx * (CW / 2 - 0.65), HC + 0.2, zc - 0.2);
    k.lathe(PROFILES.finial, 8, 'graniteLight', sx * (CW / 2 - 0.65), HC + 2.6, zc - 0.2, { sr: 1.2, sh: 1.4, flat: true });
    k.urn(1.1, 'graniteLight', sx * 2.8, HC + 1.4, zc - 0.1, { seg: 8 });
    // the masks (comedy, tragedy) over the outer pilasters
    k.sphere(0.45, 'graniteLight', sx * (CW / 2 - 0.65), 12.4, zc + 0.35, { seg: 8, rings: 5 });
  }
  k.pop();

  // --- auditorium under a hipped slate roof
  const zA = zF - DEPTH - 25; // front of the fly tower
  const aud = clipZ(clipZ(ol, zR + 0.2, -1), zA, 1);
  const HA = 19;
  k.prism(aud, -2.5, HA + 2.5, R);
  k.prism(offset(aud, 0.1), -2.5, 7, G, { mat: MAT.ashlar });
  polyCornice(k, aud, HA - 0.7, corniceProfile('band', 0.7), G, { minLen: 3 });
  const ab = bbox(aud);
  k.frustum(ab.w, ab.d, ab.w - 8, ab.d - 8, 4, 'slate', ab.cx, HA, ab.cz);
  polyWindows(k, aud, { only: (e) => Math.abs(e.nx) > 0.8, storeys: [2.2, 10.5], bay: 4.5, w: 1.3, h: 2.6, win: { trim: G, pane: 'glass' } });

  // --- fly tower and the stage block at the rear
  const back = clipZ(ol, zA + 0.2, -1);
  const bb = bbox(back);
  k.prism(back, -2.5, 16.5, R);
  polyCornice(k, back, 15.4, corniceProfile('band', 0.6), G, { minLen: 3 });
  k.prism(offset(back, -0.4), 16, 0.4, 'lead');
  // the fly tower: 20 m wide, centred on the stage axis, dark metal cladding
  const FW = 20;
  const fly = [[cx - FW / 2, bb.z0 + 0.3], [cx + FW / 2, bb.z0 + 0.3], [cx + FW / 2, zA + 2], [cx - FW / 2, zA + 2]];
  k.prism(fly, 14, HF - 14 - 0.6, 'slate', { mat: MAT.slate });
  k.prism(offset(fly, 0.2), HF - 0.6, 0.6, 'lead', { bevel: 0.1 });
  for (let i = 1; i < 10; i++) k.box(0.12, HF - 14.6, 0.1, 'steel', cx - FW / 2 + i * 2, 14, zA + 2.05);
  k.end('main');
}

function edgesOf(pts) {
  const out = [];
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const ccw = area > 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ex = (b[0] - a[0]) / len;
    const ez = (b[1] - a[1]) / len;
    const nx = ccw ? ez : -ez;
    const nz = ccw ? -ex : ex;
    out.push({ len, nx, nz, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2, ry: Math.atan2(nx, nz) });
  }
  return out;
}

theatro.metric = true;
theatro.rule = { note: 'front on Avenida da Liberdade (ENE, +z); fly tower at the WSW rear' };

export default { 'theatro-circo': theatro };
void THREE;

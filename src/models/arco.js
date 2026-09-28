// Arco da Porta Nova (1773, André Soares), metric builder. OSM has only a
// node and a wall line; footprints.json synthesizes the 8 x 3 m rectangle
// on it. data/dimensions.json: opening 3.7 m wide x 7.1 m to the keystone,
// entablature 8.5 m, four pinnacles to about 12 m, the crowning statue to
// 13.5 m. Both faces are carved; the richer (west) face is +z.
// Plan: two 2.1 m piers with paired pilasters, the round arch between them,
// entablature, concave scrolled pediments over the piers rising to the
// central crest with the city arms and the statue on its cloud, and two
// obelisk pinnacles on each pier.
import * as THREE from 'three';
import { corniceProfile, PROFILES, MAT } from './kit.js';
import { cartouche } from './parts.js';

const G = 'graniteWarm';
const T = 'granite';

function arco(k, { footprint, dims }) {
  const b = footprint.box;
  const W = b.w; // 7.9
  const D = b.d; // 3.0
  const OW = dims?.elements?.arch_opening_width_m ?? 3.7;
  const OH = dims?.height_m?.arch_opening ?? 7.1;
  const EY = dims?.height_m?.cornice ?? 8.5; // top of the entablature
  const PY = dims?.height_m?.pinnacles ?? 12;
  const HT = dims?.height_m?.total ?? 13.5;
  const PW = (W - OW) / 2; // pier width, 2.1 m
  const xP = OW / 2 + PW / 2; // pier centre

  k.begin('main');
  // body: the gate with its round opening, a little inside the box so the
  // mouldings stay within the 8 x 3 m footprint
  const bodyD = D - 0.5;
  k.gate(W - 0.3, EY - 1.0, bodyD, [{ x: 0, w: OW, h: OH }], G, 0, -0.4, 0);
  // plinth course on both piers
  for (const sx of [-1, 1]) k.box(PW - 0.1, 2.0, D - 0.1, T, sx * xP, -0.4, 0);

  for (const f of [1, -1]) {
    const zf = f * (bodyD / 2);
    k.push({ ry: f > 0 ? 0 : Math.PI });
    const rich = f > 0;
    // archivolt, impost blocks and keystone
    k.surround({ x: 0, y: 0, w: OW, h: OH }, 0.32, 0.14, T, bodyD / 2);
    for (const sx of [-1, 1]) k.box(0.55, 0.35, 0.3, T, sx * (OW / 2 + 0.12), OH - OW / 2 - 0.1, bodyD / 2 + 0.1);
    k.box(0.55, 0.9, 0.35, T, 0, OH - 0.25, bodyD / 2 + 0.12);
    // paired pilasters on each pier, with capitals
    for (const sx of [-1, 1]) {
      for (const px of [OW / 2 + 0.38, W / 2 - 0.42]) {
        k.box(0.5, EY - 2.8, 0.18, T, sx * px, 1.6, bodyD / 2 + 0.09);
        k.box(0.66, 0.3, 0.26, T, sx * px, EY - 1.4, bodyD / 2 + 0.13);
        k.box(0.62, 0.4, 0.24, T, sx * px, 1.2, bodyD / 2 + 0.12);
      }
      // rusticated ashlar between the pilasters: staggered blocks
      for (let i = 0; i < 8; i++) {
        const n = i % 2 ? 2 : 3;
        for (let j = 0; j < n; j++) k.box(0.62 / n - 0.03, 0.62, 0.05, T, sx * (xP - 0.31 + (j + 0.5) * (0.62 / n)), 1.65 + i * 0.66, bodyD / 2 + 0.025, { jit: 0.06 });
      }
      // carved roundel under the capitals
      k.cyl(0.26, 0.26, 0.12, 10, T, sx * xP, EY - 2.1, bodyD / 2 + 0.06, { rx: Math.PI / 2 });
      if (rich) {
        k.box(0.8, 1.1, 0.1, 'graniteLight', sx * xP, EY - 3.5, bodyD / 2 + 0.05, { mat: MAT.smooth });
        // wall lantern on an iron arm
        k.box(0.05, 0.05, 0.22, 'iron', sx * (OW / 2 + 0.25), 3.2, bodyD / 2 + 0.11);
        k.cyl(0.09, 0.07, 0.26, 6, 'window', sx * (OW / 2 + 0.25), 2.92, bodyD / 2 + 0.2, { emit: 0.9 });
        k.cone(0.11, 0.1, 6, 'iron', sx * (OW / 2 + 0.25), 3.18, bodyD / 2 + 0.2);
      }
    }
    k.pop();
    void zf;
  }
  // entablature: architrave, frieze, bevelled cornice with breaks over the piers
  k.box(W - 0.2, 0.45, bodyD + 0.2, T, 0, EY - 1.0, 0);
  k.box(W - 0.3, 0.2, bodyD + 0.1, 'graniteLight', 0, EY - 0.55, 0, { mat: MAT.smooth });
  k.prism([[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]], EY - 0.35, 0.35, T, { bevel: 0.1 });

  // dentils under the cornice on both faces
  for (const f of [1, -1]) for (let i = 0; i < 30; i++) k.box(0.12, 0.14, 0.1, T, -W / 2 + 0.2 + i * ((W - 0.4) / 29), EY - 0.49, f * (bodyD / 2 + 0.1));
  // concave scrolled pediments over the piers
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(sx * (W / 2 - 0.05), 0);
    s.lineTo(sx * (W / 2 - 0.05), 0.35);
    s.quadraticCurveTo(sx * (OW / 2 + 0.6), 0.5, sx * (OW / 2 - 0.1), 1.6);
    s.lineTo(sx * (OW / 2 - 0.55), 1.6);
    s.lineTo(sx * (OW / 2 - 0.55), 0);
    s.closePath();
    k.extrude(s, D - 0.9, T, 0, EY, 0, { curve: 6 });
    // volute ends: carved spirals on both faces
    for (const f of [1, -1]) {
      k.cyl(0.24, 0.24, 0.16, 12, T, sx * (OW / 2 - 0.2), EY + 1.55, f * ((D - 0.9) / 2 + 0.08), { rx: Math.PI / 2 });
      k.cyl(0.12, 0.12, 0.1, 10, 'graniteLight', sx * (OW / 2 - 0.2), EY + 1.55, f * ((D - 0.9) / 2 + 0.18), { rx: Math.PI / 2 });
    }
  }
  // two obelisk pinnacles on each pier (pedestal, needle, ball finial)
  for (const sx of [-1, 1]) {
    for (const px of [2.55, 3.45]) {
      const x = sx * px;
      k.box(0.72, 1.25, 0.72, T, x, EY, 0);
      k.box(0.84, 0.16, 0.84, T, x, EY + 1.25, 0);
      k.cyl(0.07, 0.3, PY - EY - 1.75, 4, T, x, EY + 1.41, 0);
      k.sphere(0.14, T, x, PY - 0.2, 0, { seg: 10, rings: 6 });
      k.cyl(0.36, 0.36, 0.12, 10, T, x, EY + 1.41, 0);
    }
  }
  // central crest: plinth, framed arms with the towers of the city, crown
  k.box(2.6, 1.0, 1.6, G, 0, EY, 0);
  k.frustum(2.4, 1.4, 1.7, 1.1, 1.8, G, 0, EY + 1.0, 0);
  for (const f of [1, -1]) {
    k.push({ ry: f > 0 ? 0 : Math.PI });
    const rich = f > 0;
    cartouche(k, rich ? 1.5 : 1.2, rich ? 2.1 : 1.7, 0.3, 'graniteLight', 0, EY + 0.7, 0.72, { crown: T });
    // scroll ears of the crest
    for (const sx of [-1, 1]) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(sx * 1.25, 0);
      s.quadraticCurveTo(sx * 1.4, 0.9, sx * 0.55, 1.7);
      s.quadraticCurveTo(sx * 0.3, 1.9, 0, 1.6);
      s.closePath();
      k.extrude(s, 0.3, T, sx * 0.9, EY + 0.9, 0.75, { curve: 5 });
      if (rich) for (let i = 0; i < 3; i++) {
        // the small towers of the arms of Braga
        k.box(0.22, 0.4, 0.22, T, sx * (0.95 + i * 0.26), EY + 1.3 + i * 0.1, 0.95);
        k.cone(0.15, 0.28, 4, T, sx * (0.95 + i * 0.26), EY + 1.7 + i * 0.1, 0.95);
      }
    }
    k.pop();
  }
  // cloud and the statue of Our Lady / the archangel with the spear
  k.ico(0.65, 1, 'graniteLight', 0, EY + 3.05, 0, { jitter: 0.2, sy: 0.6 });
  k.statue(HT - EY - 3.75, 'graniteLight', 0, EY + 3.35, 0, { seg: 12 });
  for (const sx of [-1, 1]) k.box(0.5, 0.12, 0.12, 'graniteLight', sx * 0.3, EY + 4.25, 0.1, { rz: sx * 0.9 }); // wings
  k.box(0.05, 1.5, 0.05, 'iron', 0.3, HT - 1.5, 0.05, { rz: -0.06 });
  k.end('main');

  // the street through the arch: granite setts between two kerbs
  k.box(OW - 0.1, 0.08, D - 0.1, 'graniteDark', 0, -0.02, 0, { mat: MAT.ashlar });
  void PROFILES;
  void corniceProfile;
}
arco.metric = true;
arco.rule = { note: 'OSM rectangle 8 x 3 m synthesized on the gate line; the west face (+z) carries the richer carving; flanking houses come from the city layer' };

export default { 'arco-porta-nova': arco };

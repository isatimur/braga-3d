// Fonte do Pelicano, Praça do Município (Braga): a small fountain that is
// not a landmark (no label, no card), drawn by src/monuments.js.
//
// Sources (cities/braga.json monuments[].sources):
// - OSM way 471758019 (amenity=fountain, "Fonte do Pelicano"): the basin
//   outline. It is a circle of 4.55 m radius with four round lobes (1.4 m
//   radius, centres 4.6 m out) on the axes, turned 11 deg anticlockwise
//   from east (least-squares fit: mean 0.04 m, at most 0.22 m from the 53
//   OSM points).
// - pt.wikipedia "Fonte do Pelicano": Mannerist-Joanine fountain by
//   Marceliano de Araújo; a raised central bowl and four smaller ones, a
//   sculpture group on top, set in a quatrefoil tank on a circular base of
//   two steps (the tank and the steps are 20th-century, Cortez Marques).
// - Wikimedia Commons photos (CC BY-SA 3.0/4.0): "Braga Fonte do
//   Pelicano.jpg" (Júlio Reis), "Braga-Fonte do Pelicano-06-2011-gje.jpg"
//   (Gerd Eichmann), "Câmara Municipal de Braga e Fonte do Pelicano.JPG"
//   (Béria Lima de Rodríguez). Heights are estimates from these photos:
//   rim 0.5 m over the base, the moulded foot and shaft 1.3 m, the lobed
//   bowl to 2.3 m, the carved group of four shields and cherubs, the
//   armillary sphere and the crowned pelican feeding its young, about
//   5 m over the water; four cherubs on globes on balusters in the lobes,
//   throwing arcs of water to the centre.
//
// Frame: metres, origin = the basin centre at the local ground, +x east,
// +z south (the world's axes: no turn). STREET: the calçada of the square
// lies 0.43 m over the terrain here (measured in walk mode, the street
// layer's carpet); the steps and the rim stand on it.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { cartouche } from './parts.js';

const TAU = Math.PI * 2;
const STREET = 0.43;
const R0 = 4.55; // the round body of the tank
const LOBE_R = 1.4;
const LOBE_D = 4.6;
const TURN = (11 * Math.PI) / 180; // lobe axis, anticlockwise from east
const STONE = 'graniteLight';
const DARK = 'granite';
const WATER = 0x2f5f72;
const SPRAY = 0xe6f0f4;

// the lobe directions in the model frame (+z south: north is -z)
const LOBES = [0, 1, 2, 3].map((i) => {
  const a = TURN + (i * Math.PI) / 2;
  return [Math.cos(a), -Math.sin(a)];
});

// Distance from the centre to the tank's outer face along (dx, dz), plus d.
function radiusAt(dx, dz, d = 0) {
  let r = R0;
  for (const [lx, lz] of LOBES) {
    const c = dx * lx + dz * lz; // cos of the angle to the lobe axis
    const s2 = 1 - c * c;
    const disc = LOBE_R * LOBE_R - LOBE_D * LOBE_D * s2;
    if (c > 0 && disc >= 0) r = Math.max(r, LOBE_D * c + Math.sqrt(disc));
  }
  return r + d;
}

// The tank outline offset by d metres (outward > 0), n points, CCW in x/z.
export function tankOutline(d = 0, n = 72) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const r = radiusAt(dx, dz, d);
    out.push([dx * r, dz * r]);
  }
  return out;
}

const ring = (r, n = 40) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r]);

// Crowned pelican feeding its young on its breast, facing +z, feet at y.
function pelican(k, x, y, z, ry) {
  k.push({ x, y, z, ry });
  const c = 'graniteGrey';
  // feet on the sphere, a tall body
  k.sphere(0.27, c, 0, 0.5, 0, { seg: 9, rings: 7, sy: 1.55, sz: 1.05, mat: MAT.smooth });
  // the neck bowed forward and the head turned down to the breast
  k.segment([0, 0.82, 0.04], [0, 1.08, 0.12], 0.13, 0.13, c, { mat: MAT.smooth });
  k.sphere(0.12, c, 0, 1.12, 0.16, { seg: 7, rings: 5, mat: MAT.smooth });
  k.segment([0, 1.08, 0.26], [0, 0.78, 0.34], 0.06, 0.08, c, { mat: MAT.smooth });
  // crown
  k.cyl(0.08, 0.06, 0.09, 6, c, 0, 1.22, 0.15);
  // half-raised wings: flat ellipsoids from the shoulders, tips up and out
  for (const s of [-1, 1]) k.sphere(0.42, c, s * 0.3, 0.62, -0.06, { seg: 8, rings: 5, sx: 0.16, sz: 0.55, rz: s * 0.45, mat: MAT.smooth });
  // the young at the breast
  for (const s of [-1, 1]) k.sphere(0.09, c, s * 0.12, 0.66, 0.26, { seg: 6, rings: 4, sy: 1.3 });
  k.pop();
}

// An arc of water from p0 down to p1 (peak `lift` over the straight line).
function stream(k, p0, p1, lift, w = 0.045) {
  const N = 6;
  const at = (t) => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t + lift * 4 * t * (1 - t), p0[2] + (p1[2] - p0[2]) * t];
  for (let i = 0; i < N; i++) k.segment(at(i / N), at((i + 1) / N), w, w, SPRAY, { emit: 0.6, mat: MAT.water });
}

export function pelicanoFountain(k) {
  // --- the circular base: two low steps up from the calçada
  const P = STREET + 0.24; // the platform the tank stands on
  k.prism(ring(7.6, 48), -0.4, STREET + 0.12 + 0.4, DARK, { curve: 4 });
  k.prism(ring(6.9, 48), STREET + 0.12, 0.12, STONE);
  // --- the quatrefoil tank: wall, a rounded coping, the water
  const RT = P + 0.5; // rim top
  const W = RT - 0.14; // water level
  const inner = tankOutline(-0.42);
  k.prism(tankOutline(0), P - 0.05, RT - 0.12 - (P - 0.05), STONE, { holes: [inner] });
  k.prism(tankOutline(0.07), RT - 0.12, 0.12, DARK, { holes: [tankOutline(-0.46)] });
  k.prism(inner, P - 0.05, W - (P - 0.05), WATER, { emit: 0.12, mat: MAT.water });

  // --- the central fountain (the older, weathered granite of the 18th-
  //     century piece): moulded foot, shaft, the lobed bowl
  const OLD = 'graniteGrey';
  k.lathe([[0, 0], [1.0, 0], [1.0, 0.12], [0.86, 0.22], [0.92, 0.36], [0.7, 0.48], [0.55, 0.55], [0, 0.55]], 16, OLD, 0, W - 0.1, 0, { smooth: true, mat: MAT.smooth });
  k.cyl(0.42, 0.48, 0.75, 12, OLD, 0, W + 0.45, 0, { smooth: true, mat: MAT.smooth });
  k.cyl(0.55, 0.55, 0.1, 12, OLD, 0, W + 1.2, 0, { smooth: true });
  const yb = W + 1.3; // the bowl's foot
  k.lathe([[0, 0], [0.55, 0], [0.75, 0.18], [1.25, 0.45], [1.7, 0.72], [1.82, 0.95], [1.75, 1.05], [1.6, 1.0], [0, 0.95]], 12, OLD, 0, yb, 0, { smooth: true, mat: MAT.smooth });
  k.cyl(1.58, 1.58, 0.04, 12, WATER, 0, yb + 0.9, 0, { emit: 0.12, mat: MAT.water });
  // the overflow: thin falls from the bowl's four lips into the tank
  for (let i = 0; i < 4; i++) {
    const a = TURN + Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 1.8;
    const z = -Math.sin(a) * 1.8;
    for (const s of [-0.12, 0, 0.12]) {
      const sx = -z * s;
      const sz = x * s;
      k.segment([x + sx, yb + 0.98, z + sz], [x * 1.1 + sx, W, z * 1.1 + sz], 0.035, 0.035, SPRAY, { emit: 0.5, mat: MAT.water });
    }
  }
  // --- the carved group on the bowl: four shields, four cherubs
  const yg = yb + 0.95;
  k.cyl(0.55, 0.7, 0.95, 8, DARK, 0, yg, 0, { mat: MAT.smooth });
  for (let i = 0; i < 4; i++) {
    const a = TURN + (i * Math.PI) / 2;
    k.push({ ry: a + Math.PI / 2 });
    cartouche(k, 0.75, 1.05, 0.16, 'graniteGrey', 0, yg + 0.02, 0.6);
    k.pop();
    const d = TURN + Math.PI / 4 + (i * Math.PI) / 2;
    k.statue(0.62, 'graniteGrey', Math.cos(d) * 0.78, yg + 0.25, -Math.sin(d) * 0.78, { ry: Math.PI / 2 - d, pose: 'raise', seg: 5 });
  }
  // --- the armillary sphere and the pelican
  const ys = yg + 0.95;
  k.cyl(0.2, 0.3, 0.3, 8, DARK, 0, ys, 0);
  k.sphere(0.4, 'graniteGrey', 0, ys + 0.68, 0, { seg: 10, rings: 7, mat: MAT.smooth });
  k.add(new THREE.TorusGeometry(0.43, 0.035, 4, 16), DARK, { y: ys + 0.68, rx: Math.PI / 2 + 0.4 });
  k.add(new THREE.TorusGeometry(0.43, 0.035, 4, 16), DARK, { y: ys + 0.68, ry: 0.5 });
  pelican(k, 0, ys + 1.02, 0, Math.PI - TURN);

  // --- the four cherubs on globes in the lobes, throwing water inward
  for (const [lx, lz] of LOBES) {
    const x = lx * LOBE_D;
    const z = lz * LOBE_D;
    k.cyl(0.6, 0.5, 0.3, 10, DARK, x, W - 0.15, z, { smooth: true });
    k.cyl(0.55, 0.55, 0.03, 10, WATER, x, W + 0.13, z, { emit: 0.12, mat: MAT.water });
    k.lathe([[0, 0], [0.32, 0], [0.32, 0.1], [0.2, 0.16], [0.3, 0.42], [0.24, 0.55], [0.12, 0.72], [0.16, 0.82], [0.26, 0.9], [0.26, 1], [0, 1]], 8, STONE, x, W + 0.1, z, { sh: 1.1, smooth: true, mat: MAT.smooth });
    k.sphere(0.33, STONE, x, W + 1.52, z, { seg: 9, rings: 6, mat: MAT.smooth });
    k.statue(0.72, 'graniteGrey', x, W + 1.8, z, { ry: Math.atan2(-x, -z), pose: 'hold', seg: 5 });
    stream(k, [x * 0.95, W + 2.25, z * 0.95], [x * 0.55, W, z * 0.55], 0.55);
  }
}
pelicanoFountain.metric = true;
// the walker and the crowd keep out of the tank (and its coping)
pelicanoFountain.outline = () => tankOutline(0.15, 48);

export default { 'fonte-pelicano': pelicanoFountain };

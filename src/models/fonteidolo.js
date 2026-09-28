// Fonte do Ídolo (1st c. rock sanctuary), metric builder.
// OSM: the interpretation centre built over the fountain in 2001-2004
// (33.4 x 6.8 m), below street level on Rua do Raio. Local frame: +z = ENE,
// the long side toward Rua do Raio. From data/dimensions.json (estimates):
// centre 5 m high, carved outcrop about 3 m long and 1.5 m high, a togate
// figure of 1.2 m in a niche. Estimated from the photos: granite plinth,
// Corten cladding (the Bracara Augusta map plate), a glazed front and a
// skylight over the rock chamber, so the carved rock shows from above.
import { MAT } from './kit.js';
import { rect, offset } from './geom.js';

function fonteIdolo(k, { footprint, dims }) {
  const rnd = k.rnd;
  const out = footprint.outline;
  const b = footprint.box;
  const H = dims?.height_m?.centre_building ?? 5;
  const HR = dims?.height_m?.carved_rock ?? 1.5;
  const HF = dims?.height_m?.figure ?? 1.2;
  const RL = dims?.elements?.rock_length_m ?? 3;
  const zF = b.z1; // front face (ENE)
  // rock chamber under the skylight, open to the glazed front
  const CH = rect(-2, 0.1, 10, zF * 2 - 0.4 - 1.2, 0).map(([x, z]) => [x, z + 0.55]);
  const chZ0 = -2.95;
  const chZ1 = zF - 0.3;
  const chamber = [[-7, chZ0], [3, chZ0], [3, chZ1], [-7, chZ1]];
  void CH;

  k.begin('main');
  // --- the building: granite plinth, concrete body round the chamber
  k.prism(out, -0.8, 2.2, 'graniteDark', { holes: [chamber] });
  k.prism(out, 1.4, H - 1.8, 'graniteLight', { holes: [chamber] });
  k.prism(chamber, -0.8, 0.9, 'earth'); // chamber floor
  // Corten cladding on the front: panels with standing seams
  for (let i = 0; i < 22; i++) {
    const x = b.x0 + 0.8 + i * 1.5;
    if (x > -7.2 && x < 3.2) continue;
    k.box(1.46, H - 1.8, 0.08, 'rust', x + 0.73, 1.4, zF + 0.04, { mat: MAT.smooth });
    k.box(0.06, H - 1.8, 0.14, 'rust', x, 1.4, zF + 0.07);
  }
  // back and end faces get the Corten band too
  k.box(b.w - 1.2, 1.2, 0.08, 'rust', 0, H - 1.6, b.z0 + 0.08, { mat: MAT.smooth });
  // the Bracara Augusta map plate: a grid of cut squares
  k.box(3.4, 2.4, 0.1, 'rust', 9.5, 1.8, zF + 0.12, { mat: MAT.smooth });
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) k.box(0.34, 0.34, 0.06, 'bronze', 8.3 + i * 0.4, 2.1 + j * 0.4, zF + 0.19);
  // glazed front of the chamber with mullions, entrance door (east)
  k.box(10, H - 0.9, 0.06, 'glass', -2, 0.1, chZ1, { glass: true });
  for (let i = 0; i <= 8; i++) k.box(0.1, H - 0.9, 0.14, 'iron', -7 + i * 1.25, 0.1, chZ1);
  k.box(10.2, 0.14, 0.16, 'iron', -2, 2.2, chZ1);
  k.box(1.8, 2.4, 0.1, 'glass', 13, 0.1, zF + 0.05, { glass: true });
  k.box(2.1, 0.2, 0.3, 'iron', 13, 2.5, zF + 0.1);
  // flat roof with the skylight over the chamber, parapet rail
  k.prism(offset(out, 0.15), H - 0.4, 0.4, 'lead', { holes: [chamber] });
  k.box(10, 0.06, chZ1 - chZ0, 'glass', -2, H - 0.2, (chZ0 + chZ1) / 2, { glass: true });
  for (let i = 1; i < 8; i++) k.box(0.1, 0.18, chZ1 - chZ0, 'iron', -7 + i * 1.25, H - 0.3, (chZ0 + chZ1) / 2);
  // low steel upstand along the roof edge (the street is level with it)
  k.box(b.w - 1, 0.25, 0.12, 'rust', 0, H, zF - 0.1);
  // roof-light rooflets over the gallery wings
  for (const x of [-13, 8]) k.box(3, 0.35, 2.4, 'glass', x, H, -0.3, { glass: true });
  // strip lights under the roof in the chamber
  for (const x of [-5.5, -2, 1.5]) k.box(2, 0.1, 0.2, 'window', x, H - 0.55, 0.2, { emit: 0.9 });

  // --- inside: the carved outcrop, the niche with the figure, the spring
  const RX = -2.2; // centre of the carved rock
  for (let i = 0; i < 5; i++) {
    k.ico(0.9 + rnd() * 0.5, 4, i % 2 ? 'graniteWarm' : 'granite', RX - RL / 2 + i * (RL / 4), HR * 0.45, -2.1 + rnd() * 0.3, { jitter: 0.18, sy: 0.9, mat: MAT.smooth });
  }
  k.box(RL, HR * 0.8, 1.2, 'graniteWarm', RX, 0.1, -2.1, { mat: MAT.smooth });
  // niche with the togate figure, inscription panel, the god's head
  k.box(0.9, 1.5, 0.3, 'dark', RX - 0.7, 0.35, -1.45);
  k.statue(HF, 'graniteLight', RX - 0.7, 0.3, -1.3, { seg: 7 });
  k.box(1.2, 0.6, 0.1, 'graniteLight', RX + 0.6, 0.9, -1.48, { mat: MAT.smooth });
  for (let i = 0; i < 3; i++) k.box(1, 0.05, 0.04, 'graniteDark', RX + 0.6, 1 + i * 0.16, -1.42);
  k.sphere(0.2, 'graniteLight', RX + 1.25, 1.3, -1.5, { seg: 8, rings: 5 });
  // spring basin below the rock
  k.box(2.4, 0.4, 1, 'granite', RX, 0.1, -0.9);
  k.box(2.1, 0.08, 0.75, 'water', RX, 0.45, -0.9);
  k.marker('fountain', RX, 0.53, -0.9, { kind: 'spring', r: 0.8 });
  // timber walkway with a rail in front of the rock
  k.box(9, 0.15, 1.4, 'trunk', -2, 0.45, 1.3);
  for (let i = 0; i < 10; i++) k.box(0.04, 0.9, 0.04, 'iron', -6.4 + i * 1, 0.6, 0.65);
  k.box(9, 0.05, 0.05, 'iron', -2, 1.5, 0.65);
  // outcrop continuing on either side, under the building walls
  for (let i = 0; i < 6; i++) k.ico(0.7 + rnd() * 0.4, 2, 'granite', -6.4 + i * 1.8, 0.2, -2.6 + rnd() * 0.3, { jitter: 0.25, sy: 0.6, mat: MAT.smooth });
  // steps down from the street at the east end
  k.push({ x: 14.4, z: 0.3, ry: -Math.PI / 2 });
  k.stairs(2.4, 2.6, 1.4, 8, 'granite', 0, 0, 0);
  k.pop();
  k.end('main');
}
fonteIdolo.metric = true;
fonteIdolo.rule = { view: 0, note: 'interpretation centre on the OSM outline; the carved rock sits in a chamber under a skylight, inside the outline' };

export default { 'fonte-idolo': fonteIdolo };

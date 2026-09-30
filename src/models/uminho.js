// Universidade do Minho, Campus de Gualtar, metric builder.
//
// Frame (fit.js): the campus polygon (way 165563981, 815 x 763 m, 40 ha),
// +z toward the main entrance at the Rotunda da Universidade do Minho
// (azimuth 180, snapped to an outline edge), origin at the centre of its box.
// The campus climbs about 60 m, so the model is draped: every building
// stands on footprint.ground(x, z), the base is the lowest ground under the
// Instituto para a Bio-Sustentabilidade (the 19.2 m, six-level tower of the
// campus, measured from its own floor with rule.heightRel).
// Every OSM building part is drawn on its polygon with its real levels
// (height_m of the part: levels x 3.2 m, else the estimate): the long
// teaching blocks, Complexo Pedagógico 1-3, the institutes, the canteen, the
// sports complex, the Escola de Medicina (a courtyard block, see the
// aerial photo), the walkways (layer 1) and the old farmhouses along the
// west lane (pitched terracotta roofs). 1970s-2000s concrete and white
// render, ribbon glazing (aEmit), flat dark roofs.
// Also drawn: the pitches (football, courts), gardens and ponds, the 194
// footpaths, the boundary hedge on the outline, the paved concourse between
// Escola de Ciências and Complexo Pedagógico 1, trees along the paths, the
// Prometeu sculpture.
// Assumption: the star-shaped part w463605176 stands for the Biblioteca
// Geral (no OSM part is named library). Mask = the Bio tower only; the
// campus outline masks the city buildings inside it.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { ribbonWindows } from './parts.js';
import { offset, bbox, centroid, inside, clean, obb, along, polyLength, area } from './geom.js';
import { drapePoly, ribbon, lowTree, lowConifer } from './drape.js';
import { roofOver } from './metric.js';

const CONCRETE = 0xb4b3aa;
const CONCRETE_DARK = 0x9b9a92;
const WHITE = 'plaster';
const PITCH = 0x5f8a3f;
const COURT_A = 0x5f7aa6;

// Where a building stands on the slope: its floor and its footing.
function footing(pts, ground) {
  const c = centroid(pts);
  const gs = pts.map(([x, z]) => ground(x, z));
  gs.push(ground(c[0], c[1]));
  const max = Math.max(...gs);
  const min = Math.min(...gs);
  const mean = gs.reduce((a, v) => a + v, 0) / gs.length;
  return { y0: mean * 0.5 + max * 0.5, yb: min - 1.0 };
}

// Shared block: walls to the roof, dark deck, ribbon windows.
function block(k, P, ground, o = {}) {
  const pts = clean(P.pts, 0.5);
  if (pts.length < 3) return null;
  const h = o.h ?? P.height_m ?? 7;
  const { y0, yb } = footing(pts, ground);
  const wall = o.wall ?? CONCRETE;
  const top = y0 + h;
  k.prism(pts, yb, top - 0.12 - yb, wall, { mat: MAT.render });
  k.prism(pts, top - 0.12, 0.12, 'lead');
  const storeys = Math.max(1, Math.round((h - 0.4) / 3.2));
  const a = Math.abs(area(pts));
  if (o.windows !== false && a > 60) {
    ribbonWindows(k, pts, y0, { storeys, first: o.first ?? 1.1, storey: 3.2, h: 1.5, margin: 1.4, minLen: a > 900 ? 9 : 6, emit: 0.13, trim: o.trim ?? CONCRETE_DARK });
  }
  return { pts, y0, yb, top };
}

// The Bio-Sustentabilidade tower: 6 levels, the height group starts at its floor.
function bioTower(k, P, ground) {
  const pts = clean(P.pts, 0.3);
  const { y0, yb } = footing(pts, ground);
  const H = 19.2;
  k.prism(pts, yb, y0 - yb, CONCRETE, { mat: MAT.render }); // footing, outside the height group
  k.begin('height');
  k.prism(pts, y0, H - 0.12, WHITE);
  k.prism(pts, y0 + H - 0.12, 0.12, 'lead');
  ribbonWindows(k, pts, y0, { storeys: 6, first: 1.1, storey: 3.2, h: 1.6, margin: 1.2, minLen: 4, emit: 0.15 });
  const b = bbox(pts);
  k.box(4.2, 1.2, 3.4, WHITE, b.cx, y0 + H - 0.12, b.cz); // lift head
  k.end('height');
  return { y0 };
}

// The Escola de Medicina: a concrete square with an inner court (aerial photo),
// a glazed band under the cantilever on the front, planted court.
function medicina(k, P, ground) {
  const pts = clean(P.pts, 0.5);
  const { y0, yb } = footing(pts, ground);
  const h = 10.4;
  const inner = offset(pts, -17);
  k.prism(pts, yb, y0 + h - 0.12 - yb, CONCRETE, { mat: MAT.render, holes: [inner] });
  k.prism(pts, y0 + h - 0.12, 0.12, 'lead', { holes: [inner] });
  ribbonWindows(k, pts, y0, { storeys: 3, first: 1.1, storey: 3.2, h: 1.7, margin: 3, minLen: 10, emit: 0.13, trim: CONCRETE_DARK });
  ribbonWindows(k, inner, y0, { storeys: 3, first: 1.0, storey: 3.2, h: 2.0, margin: 2, minLen: 8, emit: 0.16, flip: true });
  // roof lights and plant on the deck (aerial photo)
  const b = bbox(pts);
  k.box(9, 0.6, 3, WHITE, b.cx - 24, y0 + h, b.cz - 8);
  k.box(5, 0.3, 5, 'glass', b.cx + 24, y0 + h, b.cz + 6, { emit: 0.2 });
  // court: lawn and a few slender trees
  const cy = ground(b.cx, b.cz);
  k.prism(inner, cy - 0.5, 0.6, 'grass', { mat: MAT.leaf });
  const ib = bbox(inner);
  for (let i = 0; i < 6; i++) lowTree(k, ib.x0 + ib.w * (0.25 + (i % 3) * 0.25), cy + 0.1, ib.z0 + ib.d * (i < 3 ? 0.4 : 0.65), 7.5, { spread: 0.2 });
}

// Walkway roof (OSM layer 1): a slab on posts along its outline.
function walkway(k, P, ground) {
  const pts = clean(P.pts, 0.5);
  if (pts.length < 3) return;
  const { y0 } = footing(pts, ground);
  const b = obb(pts);
  k.prism(pts, y0 + 3.3, 0.3, 'graniteLight', { mat: MAT.smooth });
  const n = Math.min(pts.length, 8);
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    const g = ground(x, z);
    k.box(0.28, 3.3 + (y0 - g), 0.28, 'steel', x, g, z, { mat: MAT.metal });
  }
  return b;
}

// Old farmhouse on the west lane: white walls, pitched terracotta roof.
function farmhouse(k, P, ground) {
  const pts = clean(P.pts, 0.4);
  if (pts.length < 3) return;
  const { y0, yb } = footing(pts, ground);
  const h = Math.min(P.height_m ?? 6, 6.4);
  k.prism(pts, yb, y0 + h - yb, WHITE);
  roofOver(k, pts, y0 + h, 2.2, 'terracotta', 'hip', { over: 0.4 });
}

// Sculpture Prometeu (José Rodrigues, 1992): slanted dark plates on a base.
function prometeu(k, P, ground) {
  const [x, z] = P.pts[0];
  const g = ground(x, z);
  k.cyl(2.2, 2.4, 0.5, 8, 'graniteLight', x, g, z);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    k.box(0.5, 3.6 - i * 0.4, 1.4, 'steel', x + Math.cos(a) * 0.7, g + 0.5, z + Math.sin(a) * 0.7, { rz: 0.14 * (i % 2 ? 1 : -1), ry: a, mat: MAT.metal });
  }
  k.box(0.6, 0.6, 0.6, 'rust', x, g + 3.6, z, { ry: 0.6, rx: 0.4 });
}

function pitch(k, P, ground, football) {
  const pts = clean(P.pts, 0.5);
  const b = obb(pts);
  drapePoly(k, pts, ground, 0.16, football ? PITCH : COURT_A, { cell: football ? 14 : 20, mat: football ? MAT.leaf : MAT.smooth });
  // white lines: the edge and the halfway line, draped
  const c = Math.cos(b.a);
  const s = Math.sin(b.a);
  const at = (u, v) => [b.cx + u * c + v * s, b.cz - u * s + v * c];
  const hu = b.L / 2 - 1.2;
  const hv = b.W / 2 - 1.2;
  const loop = [at(-hu, -hv), at(hu, -hv), at(hu, hv), at(-hu, hv), at(-hu, -hv)];
  ribbon(k, loop, 0.14, ground, 0.24, 'white', { step: 10, mat: MAT.smooth });
  ribbon(k, [at(0, -hv), at(0, hv)], 0.14, ground, 0.24, 'white', { step: 10, mat: MAT.smooth });
  if (football) {
    ribbon(k, [at(-hu, -hv * 0.5), at(-hu + 12, -hv * 0.5), at(-hu + 12, hv * 0.5), at(-hu, hv * 0.5)], 0.14, ground, 0.24, 'white', { step: 6, mat: MAT.smooth });
    ribbon(k, [at(hu, -hv * 0.5), at(hu - 12, -hv * 0.5), at(hu - 12, hv * 0.5), at(hu, hv * 0.5)], 0.14, ground, 0.24, 'white', { step: 6, mat: MAT.smooth });
    for (const sgn of [-1, 1]) {
      const [gx, gz] = at(sgn * hu, 0);
      const g = ground(gx, gz);
      k.push({ x: gx, y: g, z: gz, ry: b.a });
      for (const d of [-3.6, 3.6]) k.box(0.12, 2.4, 0.12, 'white', 0, 0, d);
      k.box(0.12, 0.12, 7.3, 'white', 0, 2.4, 0);
      k.pop();
    }
  }
}

function uminho(k, { footprint }) {
  const ground = footprint.ground;
  k.groundLine = (x, z) => ground(x, z);
  const rnd = k.rnd;
  const P = footprint.parts;
  const campus = P[0];
  const buildings = P.filter((p) => p.tag === 'building');
  const bio = P.find((p) => p.osm === 'w448580564');

  // --- boundary hedge on the outline (the campus box is its extent)
  const loop = [...clean(footprint.outline, 0.3), footprint.outline[0]];
  ribbon(k, loop, 1.8, ground, 0.1, 'hedge', { step: 14, mat: MAT.leaf });

  // --- buildings
  k.begin('mask');
  if (bio) bioTower(k, bio, ground);
  k.end('mask');
  let farms = 0;
  for (const p of buildings) {
    if (p === bio) continue;
    const a = Math.abs(area(p.pts));
    const c = centroid(p.pts);
    if (p.osm === 'r11336430') medicina(k, p, ground);
    else if (p.layer === 1) walkway(k, p, ground);
    else if (a < 320 && c[0] > -165 && c[0] < -60 && c[1] < 30) {
      farmhouse(k, p, ground);
      farms++;
    } else if (p.osm === 'w463605176') block(k, p, ground, { wall: WHITE, first: 1.4 }); // the library
    else if (/Pedagógico|Ciências|Letras|Enfermagem|Economia/.test(p.name || '')) block(k, p, ground, { wall: rnd() > 0.4 ? CONCRETE : WHITE });
    else block(k, p, ground, { wall: a > 900 ? CONCRETE : WHITE });
  }

  // --- pitches, gardens, water
  const pitches = P.filter((p) => p.tag === 'pitch');
  for (const p of pitches) pitch(k, p, ground, /Futebol/.test(p.name || ''));
  for (const p of P.filter((q) => q.tag === 'garden')) drapePoly(k, clean(p.pts, 0.5), ground, 0.14, 'grass', { cell: 20, mat: MAT.leaf });
  for (const p of P.filter((q) => q.tag === 'water')) {
    if (p.pts.length < 3) continue;
    const pts = clean(p.pts, 0.4);
    if (p.closed === false || Math.abs(area(pts)) < 30) ribbon(k, p.pts, 3.5, ground, 0.2, 'water', { step: 5, mat: MAT.water, emit: 0.2 });
    else drapePoly(k, pts, ground, 0.2, 'water', { cell: 12, mat: MAT.water, emit: 0.2 });
  }

  // --- concourse between Escola de Ciências and Complexo Pedagógico 1
  drapePoly(k, [[31, 221], [124, 221], [124, 237.5], [31, 237.5]], ground, 0.22, 'graniteLight', { cell: 16, mat: MAT.smooth });
  for (let i = 0; i < 6; i++) k.lamp(5, 40 + i * 15, ground(40 + i * 15, 229) + 0.2, 229);
  for (let i = 0; i < 5; i++) k.box(2.2, 0.45, 0.6, 'graniteLight', 44 + i * 16, ground(44 + i * 16, 226) + 0.2, 226);

  // --- footpaths
  const paths = P.filter((p) => p.tag === 'path' && polyLength(p.pts) > 8);
  for (const p of paths) ribbon(k, p.pts, 2.6, ground, 0.3, 'graniteGrey', { step: 8, mat: MAT.smooth });

  // --- trees: along the paths near the buildings, on the west woodland edge
  let n = 0;
  const near = (x, z) => buildings.some((p) => {
    const c = centroid(p.pts);
    return Math.hypot(c[0] - x, c[1] - z) < 60 && inside(offset(clean(p.pts, 0.5), 3), x, z);
  });
  for (const p of paths) {
    const L = polyLength(p.pts);
    if (L < 40) continue;
    for (let t = 0; t < 2 && n < 70; t++) {
      const [x, z] = along(p.pts, 0.2 + t * 0.5 + rnd() * 0.2);
      const xx = x + (rnd() - 0.5) * 9;
      const zz = z + (rnd() - 0.5) * 9;
      if (!inside(campus.pts, xx, zz) || near(xx, zz)) continue;
      if (rnd() > 0.85) lowConifer(k, xx, ground(xx, zz), zz, 10 + rnd() * 3);
      else lowTree(k, xx, ground(xx, zz), zz, 8 + rnd() * 4);
      n++;
    }
  }
  // pinewood on the north-west slope (aerial photo shows dense pines)
  for (let i = 0; i < 40; i++) {
    const x = -215 + rnd() * 70;
    const z = -200 + rnd() * 120;
    if (!inside(campus.pts, x, z) || buildings.some((p) => inside(offset(clean(p.pts, 0.5), 5), x, z))) continue;
    lowConifer(k, x, ground(x, z), z, 11 + rnd() * 4);
  }
  const pro = P.find((p) => p.tag === 'monument');
  if (pro) prometeu(k, pro, ground);
}

uminho.metric = true;
uminho.rule = {
  base: { part: /Bio-Sustentabilidade/, stat: 'min' },
  pad: { parts: [/Bio-Sustentabilidade/], margin: 5 },
  heightRel: true,
  frame: { parts: [/^Escola de Ciências$/, /Pedagógico 1/, /Letras/], margin: 25 },
  view: 0.7,
  note: 'draped on the real slope (60 m); pad only under the Bio tower; height = the Bio-Sustentabilidade tower above its floor (heightRel); extent = the campus outline; camera frames the central teaching blocks',
};

export default { 'uminho-gualtar': uminho };

// Jardim da Avenida Central, metric builder.
// Frame: the avenue's long axis (87 deg, no façade) is +z, running east from
// the Praça da República; x across the lawns. The OSM outline is the lawn
// strip itself (409 x 70 m with the cut-outs of the paved crossings).
// From data/dimensions.json: two rows of lime trees ~15 m, the octagonal
// iron bandstand (Coreto, OSM part) 7.9 m across x 8 m, three granite
// pyramids 4 m (the three sacred mounts), four monuments 4 m on their OSM
// points. The planting is restrained, as on the real avenue: lawns edged
// with granite kerbs, box and shrub clumps, a few low beds in muted colours
// (deep red begonia, white, soft lilac), globe lamps on square posts. One
// small basin with jets east of the bandstand is an estimate (not in OSM).
import * as THREE from 'three';
import { MAT } from './kit.js';
import { bbox, inside, offset, centroid } from './geom.js';

const TAU = Math.PI * 2;
const LAWN = 0x5f7a3c;
const BEGONIA = 0x6a3134;
const WHITE_BED = 0xcdc9bd;
const LILAC = 0x8a809c;
const SHRUB = 0x41603a;
const SPRAY = 0xe6f0f4;

// Lawn intervals [x0, x1] across the outline at z.
function spans(pts, z, xa, xb, step = 0.5) {
  const out = [];
  let s = null;
  for (let x = xa; x <= xb; x += step) {
    const inn = inside(pts, x, z);
    if (inn && s == null) s = x;
    if (!inn && s != null) {
      out.push([s, x - step]);
      s = null;
    }
  }
  if (s != null) out.push([s, xb]);
  return out;
}

function avenida(k, { footprint, dims }) {
  const rnd = k.rnd;
  const O = footprint.outline;
  const b = footprint.box;
  const hTree = dims?.height_m?.trees ?? 15;
  const hPyr = dims?.height_m?.pyramids ?? 4;
  const hMon = dims?.height_m?.monuments ?? 4;
  const hBand = dims?.height_m?.bandstand ?? 8;

  k.begin('mask');
  // --- lawns on the real outline, granite kerb round them
  k.prism(O, -0.5, 0.9, LAWN, { mat: MAT.leaf });
  k.prism(offset(O, 0.35), -0.5, 1.0, 'granite', { holes: [O] });
  k.end('mask');

  // --- two rows of lime trees along the lawn edges, lamps between
  let n = 0;
  for (let z = b.z0 + 5; z < b.z1 - 3; z += 10.5) {
    for (const [x0, x1] of spans(O, z, b.x0, b.x1)) {
      if (x1 - x0 < 7) continue;
      for (const x of [x0 + 2.6, x1 - 2.6]) {
        const h = hTree * (1.02 + rnd() * 0.12);
        k.tree(x + (rnd() - 0.5) * 0.8, 0.4, z + (rnd() - 0.5) * 1.5, h, { lobes: 1, spread: 0.27, color: rnd() > 0.5 ? 'foliage' : 'foliageDark' });
      }
      if (n++ % 2 === 0) {
        for (const x of [x0 - 1.2, x1 + 1.2]) {
          k.box(0.26, 5, 0.26, 'steel', x, 0, z + 4.2, { mat: MAT.metal });
          k.sphere(0.4, 0xefdca0, x, 5.35, z + 4.2, { seg: 8, rings: 5, emit: 0.8 });
        }
      }
      // shrub clumps and low box hedges inside the rows
      if (x1 - x0 > 14 && rnd() > 0.35) {
        k.ico(1.3 + rnd() * 0.6, 1, SHRUB, x0 + 5.5, 1.0, z + 3, { jitter: 0.2, sy: 0.7, mat: MAT.leaf });
        k.ico(1.2 + rnd() * 0.6, 1, SHRUB, x1 - 5.5, 1.0, z - 2, { jitter: 0.2, sy: 0.7, mat: MAT.leaf });
      }
    }
  }

  // --- a few low beds on the wide east lawn, box-edged, muted colours
  const beds = [BEGONIA, WHITE_BED, LILAC, BEGONIA, WHITE_BED, LILAC];
  let bi = 0;
  for (let z = 20; z < 190 && bi < beds.length; z += 30) {
    const sp = spans(O, z, b.x0, b.x1).find(([x0, x1]) => x1 - x0 > 16);
    if (!sp) continue;
    const cx = (sp[0] + sp[1]) / 2;
    const w = Math.min(7, (sp[1] - sp[0]) * 0.3);
    k.box(w + 0.8, 0.55, 11.5, 'hedge', cx, 0.4, z);
    k.box(w, 0.62, 10.7, beds[bi++], cx, 0.4, z, { jit: 0.06, mat: MAT.leaf });
    k.tree(cx, 0.4, z - 6.8, 2, { kind: 'topiary', color: 'hedge' });
    k.tree(cx, 0.4, z + 6.8, 2, { kind: 'topiary', color: 'hedge' });
  }

  // --- three granite pyramids on the lawn axis
  let pi = 0;
  for (const z of [48, 98, 150]) {
    const sp = spans(O, z, b.x0, b.x1).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
    if (!sp) continue;
    const cx = (sp[0] + sp[1]) / 2;
    k.box(3.4, 0.5, 3.4, 'granite', cx, 0.4, z);
    k.cone(1.35, hPyr - 0.9, 4, 'graniteLight', cx, 0.9, z, { mat: MAT.ashlar });
    pi++;
  }
  void pi;

  // --- the four monuments on their OSM points
  for (const m of footprint.partsOf('monument')) {
    const [x, z] = m.pts[0];
    k.box(1.8, 0.4, 1.8, 'granite', x, 0.4, z);
    k.box(1.2, hMon * 0.45, 1.2, 'graniteLight', x, 0.8, z, { mat: MAT.smooth });
    k.box(1.4, 0.25, 1.4, 'granite', x, 0.8 + hMon * 0.45, z);
    k.statue(hMon * 0.48, 'bronze', x, 1.05 + hMon * 0.45, z, { seg: 6 });
  }

  // --- the Coreto (1868 iron bandstand) on its OSM octagon
  const C = footprint.part(/Coreto/);
  if (C) {
    const [cx, cz] = centroid(C.pts);
    const r = bbox(C.pts).w / 2;
    const rot = Math.PI / 8;
    k.cyl(r + 0.5, r + 0.6, 0.35, 8, 'granite', cx, 0, cz, { ry: rot });
    k.cyl(r, r, 2.3, 8, 'white', cx, 0.35, cz, { ry: rot });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.box(0.55, 2.4, 0.55, 'graniteLight', cx + Math.cos(a) * r * 0.96, 0.35, cz + Math.sin(a) * r * 0.96);
      k.cyl(0.08, 0.1, 3.4, 5, 'steel', cx + Math.cos(a) * (r - 0.4), 2.75, cz + Math.sin(a) * (r - 0.4));
    }
    k.cyl(r + 0.1, r + 0.1, 0.25, 8, 'graniteLight', cx, 2.6, cz, { ry: rot });
    // iron railing
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU + rot;
      const a1 = ((i + 1) / 8) * TAU + rot;
      const R = r / Math.cos(Math.PI / 8);
      k.segment([cx + Math.cos(a0) * R * 0.97, 3.75, cz + Math.sin(a0) * R * 0.97], [cx + Math.cos(a1) * R * 0.97, 3.75, cz + Math.sin(a1) * R * 0.97], 0.08, 0.9, 'steel', { mat: MAT.metal });
    }
    // roof: flat iron cone with the lace fringe, cupola, finial
    k.cone(r + 1.2, 1.1, 8, 'steel', cx, 6.15, cz, { ry: rot, mat: MAT.metal });
    k.cyl(r + 1.2, r + 1.2, 0.35, 8, 'steel', cx, 5.8, cz, { ry: rot, open: true, mat: MAT.metal });
    k.dome(1.4, 'steel', cx, 7.1, cz, { seg: 8, rings: 3, smooth: true });
    k.box(0.08, hBand - 7.9, 0.08, 'iron', cx, 7.9, cz);
  }

  // --- small basin with jets east of the bandstand (estimate)
  const fz = 30;
  const fsp = spans(O, fz, b.x0, b.x1).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
  if (fsp) {
    const fx = (fsp[0] + fsp[1]) / 2;
    k.cyl(4, 4.2, 0.7, 20, 'granite', fx, 0.4, fz, { smooth: true });
    k.cyl(3.6, 3.6, 0.1, 20, 'water', fx, 0.95, fz, { smooth: true, emit: 0.3 });
    k.marker('fountain', fx, 1.05, fz, { kind: 'jet', r: 3.6, jet: 3.2 });
    k.cone(0.22, 3.2, 5, SPRAY, fx, 1, fz, { emit: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.cone(0.12, 1.4, 4, SPRAY, fx + Math.cos(a) * 2.2, 1, fz + Math.sin(a) * 2.2, { emit: 0.45 });
    }
  }
  void THREE;
}
avenida.metric = true;
// base at the bandstand: the west end meets the Praça's paving at the same
// level (the lowest point, at the far east end, would sink it ~1 m)
avenida.rule = { base: { part: 'garden', stat: 'mean' }, note: 'linear garden, no front: +z along the 87 deg axis; lawns on the OSM outline; base at the Coreto so the west end meets the Praça' };

export default { 'avenida-central': avenida };

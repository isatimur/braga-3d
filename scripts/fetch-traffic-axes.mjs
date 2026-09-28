// The main traffic axes of Braga -> data/traffic-axes.json
//
//   node scripts/fetch-traffic-axes.mjs
//
// roads.json carries no street names, so src/traffic-model.js tags its lanes
// by distance to these OSM corridors: Avenida da Liberdade, the EN 101
// through the city, and the A 11 / Circular Sul (CSB) / EN 14 approaches.
// Polylines are simplified to 25 m and coded as integers:
// "lat,lon lat,lon;..." in 1e-4 degrees from (41.5 N, -8.5 E).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { overpass } from './geo-lib.mjs';

const OUT = resolve(import.meta.dirname, '../data/traffic-axes.json');
const els = await overpass(
  '[out:json][timeout:90];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](41.50,-8.51,41.59,-8.35););out tags geom;',
  { label: 'axes' },
);
const K = Math.cos((41.55 * Math.PI) / 180);
function dp(pts, tol) {
  const xy = pts.map((p) => [p[1] * 111320 * K, p[0] * 110574]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let bi = -1;
    let bd = tol;
    const dx = xy[b][0] - xy[a][0];
    const dy = xy[b][1] - xy[a][1];
    const L = dx * dx + dy * dy || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const u = Math.max(0, Math.min(1, ((xy[i][0] - xy[a][0]) * dx + (xy[i][1] - xy[a][1]) * dy) / L));
      const d = Math.hypot(xy[i][0] - xy[a][0] - u * dx, xy[i][1] - xy[a][1] - u * dy);
      if (d > bd) {
        bd = d;
        bi = i;
      }
    }
    if (bi > 0) {
      keep[bi] = 1;
      st.push([a, bi], [bi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
const AXES = {
  liberdade: (t) => t.name === 'Avenida da Liberdade' && /primary|secondary|tertiary/.test(t.highway),
  n101: (t) => /EN 101/.test(t.ref || ''),
  a11: (t) => /A 11|CSB|EN 14/.test(t.ref || '') || /Circular Sul de Braga/.test(t.name || ''),
};
const out = { source: 'OpenStreetMap (ODbL) via Overpass', built: new Date().toISOString().slice(0, 10), coding: 'lat,lon in 1e-4 deg from 41.5,-8.5', axes: {} };
for (const [id, test] of Object.entries(AXES)) {
  const lines = els.filter((w) => w.tags && test(w.tags) && w.geometry?.length > 1).map((w) => dp(w.geometry.map((p) => [p.lat, p.lon]), 25));
  out.axes[id] = lines.map((l) => l.map((p) => `${Math.round((p[0] - 41.5) * 1e4)},${Math.round((p[1] + 8.5) * 1e4)}`).join(' ')).join(';');
  console.log(`[axes] ${id}: ${lines.length} ways, ${lines.reduce((s, l) => s + l.length, 0)} points`);
}
writeFileSync(OUT, JSON.stringify(out));
console.log(`[axes] -> ${OUT}`);

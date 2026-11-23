// terrain.js: heightAt is the drawn ground. It must read the same triangles
// the ground mesh draws (scene.js createGround), so that a road, a plaza or a
// house placed at heightAt is never under the ground and never in the air.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProjection, METRES_PER_UNIT } from '../src/geo.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const roads = load('roads.json');
const make = () => createProjection(roads.origin, roads.bbox, [], load('terrain.json')).terrain;

// The mesh as scene.js builds it: a vertex at every pair of grid lines with
// the height groundMeshAt, each quad split along the (x1, z0)-(x0, z1) diagonal.
function meshAt(T, x, z) {
  const { xs, zs } = T.groundAxes();
  let i = 0;
  while (i < xs.length - 2 && xs[i + 1] <= x) i++;
  let j = 0;
  while (j < zs.length - 2 && zs[j + 1] <= z) j++;
  const u = (x - xs[i]) / (xs[i + 1] - xs[i]);
  const v = (z - zs[j]) / (zs[j + 1] - zs[j]);
  const a = T.groundMeshAt(xs[i], zs[j]);
  const b = T.groundMeshAt(xs[i + 1], zs[j]);
  const c = T.groundMeshAt(xs[i], zs[j + 1]);
  const d = T.groundMeshAt(xs[i + 1], zs[j + 1]);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

// A fixed scatter of points over the core and a ring of surroundings.
function points(T, n) {
  const c = T.core;
  const out = [];
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const w = c.x1 - c.x0;
  const h = c.zS - c.zN;
  for (let k = 0; k < n; k++) out.push({ x: c.x0 - 0.2 * w + rnd() * 1.4 * w, z: c.zN - 0.2 * h + rnd() * 1.4 * h });
  return out;
}

test('heightAt lies on the triangles of the drawn ground', () => {
  const T = make();
  let worst = 0;
  for (const p of points(T, 20000)) worst = Math.max(worst, Math.abs(T.heightAt(p.x, p.z) - meshAt(T, p.x, p.z)));
  assert.ok(worst * METRES_PER_UNIT < 0.001, `largest gap ${(worst * METRES_PER_UNIT).toFixed(4)} m`);
});

test('heightAt follows the ground when a pad is added later', () => {
  const T = make();
  const c = T.core;
  const cx = (c.x0 + c.x1) / 2 + 37;
  const cz = (c.zN + c.zS) / 2 - 21;
  const before = T.heightAt(cx, cz); // fills the vertex heights
  T.addPad({ cx, cz, ux: 1, uz: 0, hu: 30, hv: 30, fall: 10, y: before + 5 });
  assert.ok(Math.abs(T.heightAt(cx, cz) - (before + 5)) < 0.01, 'the pad centre is at the pad height');
  let worst = 0;
  for (let k = 0; k < 400; k++) {
    const x = cx - 60 + (k % 20) * 6;
    const z = cz - 60 + Math.floor(k / 20) * 6;
    worst = Math.max(worst, Math.abs(T.heightAt(x, z) - meshAt(T, x, z)));
  }
  assert.ok(worst * METRES_PER_UNIT < 0.001, `largest gap near the pad ${(worst * METRES_PER_UNIT).toFixed(4)} m`);
});

test('heightAt keeps the DEM value at the DEM nodes', () => {
  const T = make();
  const b = T.bounds;
  for (let k = 0; k < 200; k++) {
    const x = b.x0 + ((b.x1 - b.x0) * ((k * 7) % (b.cols - 1))) / (b.cols - 1);
    const z = b.zN + ((b.zS - b.zN) * ((k * 11) % (b.rows - 1))) / (b.rows - 1);
    assert.ok(Math.abs(T.heightAt(x, z) - T.rawAt(x, z)) * METRES_PER_UNIT < 0.01, `node ${k}`);
  }
});

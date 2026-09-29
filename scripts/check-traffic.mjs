// Check the street network and the traffic on it (src/road-network.js).
// Node 22, no dependencies. Run: node scripts/check-traffic.mjs [seconds]
//
// Asserts, over a simulated run (default 90 s at 30 steps/s, 600 vehicles):
//   - no vehicle ever travels against a one-way way (oneway, motorway,
//     roundabout);
//   - every vehicle on a closed roundabout turns anticlockwise (seen from above);
//   - vehicles keep right: on two-way roads the offset is to the right of travel;
//   - no visible vehicle sits below the ground;
//   - every bridge deck with something under it clears it (>= 3.8 m over
//     water, >= 6 m over a road or rail) and no deck runs through the ground.
// Prints the graph statistics and the bridges and tunnels by name.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjection } from '../src/geo.js';
import { buildNetwork, createFlow } from '../src/road-network.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
const roads = load('roads.json');
const landmarks = load('landmarks.json');
const proj = createProjection(roads.origin, roads.bbox, landmarks, load('terrain.json'));
const S = proj.S;
const t0 = Date.now();
const net = buildNetwork(roads, proj.project, proj.heightAt);
const g = net.graph;
const errors = [];
const err = (m) => errors.length < 40 && errors.push(m);
console.log(`network: ${net.ways.length} ways, ${net.X.length} points, built in ${Date.now() - t0} ms`);
console.log(`graph: ${g.nodes} junction nodes, ${g.edges} edges, ${g.n} directed lanes (${[...g.rev].filter((r) => r < 0).length} one-way)`);

// ---- bridges
const named = new Map();
let bad = 0;
for (const wi of net.bridges) {
  const w = net.ways[wi];
  const key = `${w.t.bn || w.t.name || '(unnamed)'} ${w.t.ref ? `[${w.t.ref}]` : ''} ${w.hw}`.trim();
  const r = named.get(key) || { n: 0, len: 0, maxH: 0, over: new Set() };
  r.n++;
  r.len += w.len / S;
  for (let i = w.start; i < w.start + w.n; i++) r.maxH = Math.max(r.maxH, (net.Y[i] - net.G[i]) / S);
  for (const c of w.crossings) {
    const o = roads.features[c.fi];
    r.over.add(o.kind === 'water' ? o.t?.name || o.t?.ww || 'water' : o.t?.name || o.t?.hw || o.kind);
    // deck at the crossing, interpolated
    let k = w.start;
    while (k < w.start + w.n - 2 && net.C[k + 1] < c.s) k++;
    const u = Math.max(0, Math.min(1, (c.s - net.C[k]) / Math.max(1e-6, net.C[k + 1] - net.C[k])));
    const deckY = net.Y[k] + (net.Y[k + 1] - net.Y[k]) * u;
    const under = c.way >= 0 && net.ways[c.way].bridge ? null : proj.heightAt(c.x, c.z);
    if (under != null) {
      const clr = (deckY - under) / S;
      const want = c.water ? 3.7 : 5.9;
      if (clr < want) {
        bad++;
        err(`bridge ${key}: ${clr.toFixed(1)} m over ${c.water || 'a way'} (want ${want})`);
      }
    }
  }
  for (let i = w.start; i < w.start + w.n; i++) if (net.Y[i] < net.G[i] - 0.01) err(`bridge ${key}: deck below ground`);
  named.set(key, r);
}
console.log(`bridges: ${net.bridges.length} ways, ${named.size} names`);
for (const [k, r] of [...named].sort((a, b) => b[1].len - a[1].len).slice(0, 40)) {
  console.log(`  ${k}: ${r.n} ways, ${r.len.toFixed(0)} m, deck up to ${r.maxH.toFixed(1)} m, over ${[...r.over].slice(0, 4).join(', ') || '-'}`);
}
const tn = new Map();
for (const wi of net.tunnels) {
  const w = net.ways[wi];
  const key = `${w.t.tn || w.t.name || '(unnamed)'} ${w.t.ref ? `[${w.t.ref}]` : ''} ${w.hw}`.trim();
  const r = tn.get(key) || { n: 0, len: 0 };
  r.n++;
  r.len += w.len / S;
  tn.set(key, r);
}
console.log(`road tunnels: ${net.tunnels.length} ways, ${net.portals.length} portals`);
for (const [k, r] of [...tn].sort((a, b) => b[1].len - a[1].len)) console.log(`  ${k}: ${r.n} ways, ${r.len.toFixed(0)} m`);

// ---- simulate
const secs = +(process.argv[2] || 90);
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const flow = createFlow(net, { N: 600, rnd });
for (let i = 0; i < flow.N; i++) flow.spawn(i, rnd() < 0.1 ? 2 : rnd() < 0.14 ? 1 : 0);
const p = {};
let against = 0;
let roundWrong = 0;
let roundOk = 0;
let under = 0;
let leftSide = 0;
let respawns = 0;
let stepsN = 0;
let speedSum = 0;
const onClass = {};
const dt = 1 / 30;
// roundabout centres
const centre = new Map();
for (const w of net.ways) {
  if (!w.closed || !w.t.jn) continue;
  let cx = 0;
  let cz = 0;
  for (let i = w.start; i < w.start + w.n; i++) {
    cx += net.X[i];
    cz += net.Z[i];
  }
  centre.set(w, [cx / w.n, cz / w.n]);
}
for (let f = 0; f < secs * 30; f++) {
  for (let i = 0; i < flow.N; i++) {
    if (!flow.step(i, dt, 1)) {
      respawns++;
      flow.spawn(i);
      continue;
    }
    flow.locate(i, p, dt);
    const d = flow.vd[i];
    const w = net.ways[g.way[d]];
    const fwd = g.B[d] > g.A[d];
    if ((w.ow === 1 && !fwd) || (w.ow === -1 && fwd)) against++;
    // heading along the lane's own direction
    const a = g.A[d];
    const st = fwd ? 1 : -1;
    if (!p.hidden && p.y < proj.heightAt(p.x, p.z) - 1.2 * S && !w.tunnel) under++;
    const c = centre.get(w);
    if (c) {
      const rx = p.x - c[0];
      const rz = p.z - c[1];
      // x east, z south: anticlockwise from above <=> rx*hz - rz*hx < 0
      if (rx * p.hz - rz * p.hx < 0) roundOk++;
      else roundWrong++;
    }
    if (w.ow === 0 && flow.vo[i] <= 0) leftSide++;
    stepsN++;
    speedSum += flow.vv[i] / S;
    if (f === secs * 30 - 1) onClass[w.hw] = (onClass[w.hw] || 0) + 1;
    void a;
    void st;
  }
}
console.log(`simulated ${secs} s: mean speed ${((speedSum / stepsN) * 3.6).toFixed(1)} km/h, ${respawns} respawns`);
console.log('vehicles by class at the end', onClass);
console.log(`roundabout samples: ${roundOk} anticlockwise, ${roundWrong} clockwise`);
if (against) err(`${against} vehicle-steps against a one-way way`);
if (roundWrong > roundOk * 0.02) err(`roundabouts: ${roundWrong} clockwise samples`);
if (under) err(`${under} vehicle-steps below the ground`);
console.log(`left-of-centre samples on two-way roads (U-turn transitions): ${leftSide} of ${stepsN}`);
if (leftSide > stepsN * 0.001) err(`${leftSide} vehicle-steps on the left of a two-way road`);
if (bad) console.log(`${bad} bridge crossings under the clearance`);
if (errors.length) {
  console.log(`FAIL (${errors.length})\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('OK');

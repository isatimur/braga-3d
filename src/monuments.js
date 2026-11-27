// Small modelled objects that are not landmarks: no label, no card, no
// focus of their own (a fountain on a square). cities/<id>.json monuments:
//   [{ id, model, name, lat, lon, osm, sources }]
// The model comes from src/models.js buildMonument(model): metres, +x
// east, +z south, origin at the object's centre on the ground. It shares
// the landmarks' stone material (water, granite detail, the focus dim).
// Returns { group, polys, items }: polys are the plans (world units, the
// shape of the building footprints) the walker and the crowd keep out of.
import * as THREE from 'three';
import { S } from './geo.js';
import { buildMonument } from './models.js';

export function buildMonuments({ list = [], project, heightAt, material }) {
  const group = new THREE.Group();
  group.name = 'monuments';
  const polys = [];
  const items = [];
  for (const m of list) {
    const b = buildMonument(m.model || m.id);
    if (!b) {
      console.info(`[braga] monument ${m.id}: no model '${m.model || m.id}'`);
      continue;
    }
    const c = project(m.lat, m.lon);
    const g = b.geometry;
    g.scale(S, S, S);
    g.computeBoundingSphere();
    // not a landmark: lid -1 (the shader's focus treats it as any other)
    g.setAttribute('aLid', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(-1), 1));
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(c.x, heightAt(c.x, c.z), c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `monument-${m.id}`;
    mesh.userData.monument = m.id;
    group.add(mesh);
    const poly = b.outline.map(([x, z]) => ({ x: c.x + x * S, z: c.z + z * S }));
    if (poly.length > 2) polys.push(poly);
    items.push({ id: m.id, mesh, poly });
  }
  return { group, polys, items };
}

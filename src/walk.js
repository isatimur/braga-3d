// Walk mode (src/main.js startMode('walk')): the visitor stands in the street
// at eye height and walks.
//
//   W / S, ↑ / ↓   forward, back        A / D, ← / →   step left, right
//   Shift          run                   drag           look around
//   phone          the stick walks, a drag on the map looks around
//
// This file owns the camera while it is active: main.js calls update()
// instead of the orbit rig, and lowers its ground floor and near plane (EYE
// and NEAR below). The walker does not pass through buildings
// (walk-collide.js, on the outlines main.js hands over). The orbit target
// rides a few metres ahead of the walker, so the tiles, the crowd and the
// labels that follow "where the camera looks" keep working.
import * as THREE from 'three';
import { t } from './i18n.js';
import { METRES_PER_UNIT } from './geo.js';
import { createCollider } from './walk-collide.js';
import { createFigure } from './walk-figure.js';

const M = 1 / METRES_PER_UNIT; // world units per metre
export const EYE = 1.7 * M; // eye height above the ground
export const NEAR = 0.3 * M; // near plane while walking
const SPEED = 1.4 * M; // walk, units per second
const RUN = 4.2 * M;
const BODY = 0.45 * M; // body radius
const FOV = 62; // the orbit camera's 38 degrees is a telephoto at eye level
const LOOK = 0.0042; // radians per pixel
const PITCH = 1.25; // look up and down limit, radians
const AHEAD = 12 * M; // the orbit target rides this far ahead
const BACK = 4.6 * M; // third person: the camera's distance from the head
const HEAD = 1.62 * M; // third person: the point the camera turns about
const TILT = 0.3; // third person: the camera sits this far above level, radians
const CLOSE = 1.6 * M; // third person: with less room than this the camera looks from the eyes
const PLACE_M = 25; // a place this near offers its card

// distance from a point to an outline ([{x, z}]), world units
function outlineDistance(pts, x, z) {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j].x, az = pts[j].z;
    const dx = pts[i].x - ax, dz = pts[i].z - az;
    const len = dx * dx + dz * dz;
    const k = len > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k));
  }
  return best;
}

const KEYS = {
  KeyW: ['z', 1], ArrowUp: ['z', 1], KeyS: ['z', -1], ArrowDown: ['z', -1],
  KeyD: ['x', 1], ArrowRight: ['x', 1], KeyA: ['x', -1], ArrowLeft: ['x', -1],
};

// places: () => [{ i, name, x, z, outline }] (world units), read at start;
// onPlace(i): the visitor asked for that place's card (the mode has ended)
// street: () => the built street layer ({ lanes, spots }) or null
export function createWalk({ camera, scene, rig, heightAt, dom, polys, places = () => [], street = () => null, water = () => null, reducedMotion = false, bounds = null, onEnter, onExit, onPlace }) {
  // Open water blocks the walker, but not where a street, a sidewalk or a
  // paved square is drawn over it (a bridge, a quay).
  let wet = null;
  let wetRings = null;
  const wetAt = (x, z) => {
    const rings = water();
    if (rings !== wetRings) {
      wetRings = rings;
      wet = rings?.length ? createCollider(rings) : null;
    }
    return !!wet && wet.inside(x, z) && !pavedAt(x, z);
  };
  let collider = createCollider(polys, 8, wetAt);
  let seatCount = 0;
  let solidCount = 0; // furniture obstacles in the collider
  // The street layer may arrive after this module, or be switched off. At
  // each start: seated people and their tables become obstacles, and the
  // walk lanes (where the crowd walks) say where a street is.
  // The paving sits above the terrain (about 0.6 m in Braga: kerbs and the
  // graded street). The walk lanes carry that surface height, so the walker
  // stands on the mean of the lane points around; with none within 8 m, on
  // the terrain plus the usual lift.
  const CELL = 2; // world units
  let laneGrid = null;
  let laneY = null;
  let lift = 0;
  function readLanes() {
    const lanes = street()?.lanes;
    if (!lanes?.X?.length || laneY === lanes.Y) return;
    laneY = lanes.Y;
    laneGrid = new Map();
    const lifts = [];
    for (let k = 0; k < lanes.X.length; k++) {
      const key = Math.floor(lanes.X[k] / CELL) * 65536 + Math.floor(lanes.Z[k] / CELL);
      let bucket = laneGrid.get(key);
      if (!bucket) laneGrid.set(key, (bucket = []));
      bucket.push(lanes.X[k], lanes.Z[k], lanes.Y[k]);
      if (k % 9 === 0) lifts.push(lanes.Y[k] - heightAt(lanes.X[k], lanes.Z[k]));
    }
    lifts.sort((a, b) => a - b);
    lift = Math.max(0, lifts[lifts.length >> 1] || 0);
  }
  // What the walker stands on is what is drawn: the top triangle under the
  // feet among the terrain, the town ground, the carriageways, the sidewalks
  // and the paved squares. The triangles within 1.2 km are indexed in 4 m
  // cells, and again when the walker nears the edge of that index. A surface
  // more than 0.6 m over the feet is not a step (a deck overhead, a wall).
  const WALKABLE = /^(ground|street-plate|sidewalks|street-(?!water|lamps)[a-z]+|calcada-squares|roundabout-islands)$/;
  const SURF_R = 300; // world units
  const STEP_UP = 0.6 * M;
  let surf = null; // { tri: Float32Array, grid: Map, x, z, key }
  function readSurface(x, z) {
    const meshes = [];
    scene.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && WALKABLE.test(o.name) && o.geometry?.attributes?.position) meshes.push(o);
    });
    const key = meshes.map((o) => o.geometry.uuid).join();
    if (surf && surf.key === key && Math.hypot(x - surf.x, z - surf.z) < SURF_R * 0.6) return;
    const tri = [];
    const paved = [];
    const terrainTri = [];
    const grid = new Map();
    for (const o of meshes) {
      const hard = o.name !== 'ground' && o.name !== 'street-plate' ? 1 : 0;
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const p = o.geometry.attributes.position.array, ix = o.geometry.index?.array;
      const n = ix ? ix.length : p.length / 3;
      const v = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let k = 0; k < n; k += 3) {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let c = 0; c < 3; c++) {
          const a = (ix ? ix[k + c] : k + c) * 3;
          const px = p[a], py = p[a + 1], pz = p[a + 2];
          const wx = e[0] * px + e[4] * py + e[8] * pz + e[12];
          const wz = e[2] * px + e[6] * py + e[10] * pz + e[14];
          v[c * 3] = wx;
          v[c * 3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
          v[c * 3 + 2] = wz;
          if (wx < x0) x0 = wx;
          if (wx > x1) x1 = wx;
          if (wz < z0) z0 = wz;
          if (wz > z1) z1 = wz;
        }
        if (x1 < x - SURF_R || x0 > x + SURF_R || z1 < z - SURF_R || z0 > z + SURF_R) continue;
        // a wall or a kerb face has no area from above
        if (Math.abs((v[5] - v[8]) * (v[0] - v[6]) + (v[6] - v[3]) * (v[2] - v[8])) < 1e-9) continue;
        const at = tri.length;
        tri.push(...v);
        paved.push(hard);
        terrainTri.push(o.name === 'ground' ? 1 : 0);
        for (let i = Math.floor(x0); i <= Math.floor(x1); i++) {
          for (let j = Math.floor(z0); j <= Math.floor(z1); j++) {
            const g = i * 65536 + j;
            let bucket = grid.get(g);
            if (!bucket) grid.set(g, (bucket = []));
            bucket.push(at);
          }
        }
      }
    }
    surf = tri.length ? { tri: new Float32Array(tri), paved, terrain: terrainTri, grid, x, z, key } : null;
  }
  // a street, a sidewalk or a paved square is drawn at (x, z)
  function pavedAt(x, z) {
    const bucket = surf?.grid.get(Math.floor(x) * 65536 + Math.floor(z));
    if (!bucket) return false;
    const t = surf.tri;
    for (const a of bucket) {
      if (!surf.paved[a / 9]) continue;
      const x1 = t[a], z1 = t[a + 2], x2 = t[a + 3], z2 = t[a + 5], x3 = t[a + 6], z3 = t[a + 8];
      const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      const u = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / den;
      const v = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / den;
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return true;
    }
    return false;
  }
  // the drawn surface under (x, z): the highest one the walker can step on
  // from `from`; with none in reach, the lowest one above. The terrain is
  // never overhead: where a road was laid lower than the drawn hillside, the
  // walker stands on the hillside, not under it.
  function surfaceAt(x, z, from) {
    const bucket = surf?.grid.get(Math.floor(x) * 65536 + Math.floor(z));
    if (!bucket) return null;
    const t = surf.tri;
    let best = -Infinity, over = Infinity, land = -Infinity;
    for (const a of bucket) {
      const x1 = t[a], z1 = t[a + 2], x2 = t[a + 3], z2 = t[a + 5], x3 = t[a + 6], z3 = t[a + 8];
      const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      const u = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / den;
      const v = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / den;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y = u * t[a + 1] + v * t[a + 4] + (1 - u - v) * t[a + 7];
      if (surf.terrain[a / 9] && y > land) land = y;
      if (y <= from + STEP_UP) { if (y > best) best = y; } else if (y < over) over = y;
    }
    const s = best > -Infinity ? best : over < Infinity ? over : null;
    return s == null || land > s ? (land > -Infinity ? land : s) : s;
  }
  let feetY = null; // the surface the walker stood on last
  let surfClock = 0;
  function ground(x, z) {
    const s = surfaceAt(x, z, feetY ?? laneGround(x, z));
    return s ?? laneGround(x, z);
  }
  function laneGround(x, z) {
    if (!laneGrid) return heightAt(x, z);
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    let sum = 0, weight = 0;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        const bucket = laneGrid.get(i * 65536 + j);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k += 3) {
          const d2 = (bucket[k] - x) ** 2 + (bucket[k + 1] - z) ** 2;
          if (d2 > CELL * CELL) continue;
          const w = 1 / (d2 + 0.02);
          sum += bucket[k + 2] * w;
          weight += w;
        }
      }
    }
    return weight > 0 ? sum / weight : heightAt(x, z) + lift;
  }
  // half sizes (metres) of the furniture a walker cannot pass through; an
  // umbrella is only its pole
  const SOLID = { tall: 0.2, lantern: 0.2, bench: 0.45, bollard: 0.15, table: 0.4, umbrella: 0.08, tree: 0.3 };
  function readStreet() {
    readLanes();
    const sp = street()?.spots;
    const n = sp ? sp.x.length : 0;
    if (n === seatCount) return;
    seatCount = n;
    const extra = [];
    const r = 0.55 * M; // a chair and a share of its table
    for (let k = 0; k < n; k++) {
      if (!sp.sit[k]) continue;
      const x = sp.x[k], z = sp.z[k];
      extra.push([[x - r, z - r], [x + r, z - r], [x + r, z + r], [x - r, z + r]]);
    }
    // street furniture: a small square about each post, bench, table and tree
    const F = street()?.furniture || {};
    const before = extra.length;
    for (const [type, half] of Object.entries(SOLID)) {
      const a = F[type] || [];
      for (let k = 0; k < a.length; k += 6) {
        const x = a[k], z = a[k + 2], h = half * M * (a[k + 4] || 1);
        extra.push([[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]]);
      }
    }
    solidCount = extra.length - before;
    collider = createCollider([...polys, ...extra], 8, wetAt);
  }
  // People and vehicles are bodies too: the walker cannot stand inside one.
  // Their places come from the instance matrices the crowd and the traffic
  // draw this frame (the drawn ones, so what the walker sees is what stops
  // them). A person is a circle, a vehicle a capsule along its heading. The
  // walker is pushed out, but never into a wall.
  const MOVERS = [
    { name: 'people', half: 0, rad: 0.28 * M },
    { name: 'traffic', half: 1.5 * M, rad: 1.0 * M },
  ];
  let bumps = 0;
  let touching = false;
  function shove() {
    let px = pos.x, pz = pos.z;
    let hit = false;
    for (const mv of MOVERS) {
      if (mv.root === undefined || (mv.root && !mv.root.parent)) mv.root = scene.getObjectByName(mv.name) || undefined;
      const root = mv.root;
      if (!root || !root.visible) continue;
      const reach = mv.half + mv.rad + BODY;
      root.traverse((o) => {
        if (!o.isInstancedMesh || !o.visible || o.name === 'traffic-lights') return;
        const e = o.instanceMatrix.array;
        for (let k = 0, b = 0; k < o.count; k++, b += 16) {
          let cx = e[b + 12], cz = e[b + 14];
          if (Math.abs(cx - px) > reach || Math.abs(cz - pz) > reach) continue;
          if (mv.half > 0) {
            // +z of the vehicle is its travel direction
            let hx = e[b + 8], hz = e[b + 10];
            const hl = Math.hypot(hx, hz) || 1;
            hx /= hl;
            hz /= hl;
            const t = THREE.MathUtils.clamp((px - cx) * hx + (pz - cz) * hz, -mv.half, mv.half);
            cx += hx * t;
            cz += hz * t;
          }
          let dx = px - cx, dz = pz - cz;
          let d = Math.hypot(dx, dz);
          const min = mv.rad + BODY;
          if (d >= min) continue;
          if (d < 1e-4) { dx = Math.sin(yaw + 1.57); dz = -Math.cos(yaw + 1.57); d = 1; }
          px += (dx / d) * (min - d);
          pz += (dz / d) * (min - d);
          hit = true;
        }
      });
    }
    if (hit && !touching) bumps++;
    touching = hit;
    if (!hit || collider.blocked(px, pz, BODY)) return;
    pos.x = px;
    pos.z = pz;
  }
  // the free walk-lane point nearest to (x, z), within 600 m; null without lanes
  function laneNear(x, z) {
    const lanes = street()?.lanes;
    if (!lanes?.X?.length) return null;
    // Up to 600 m: the opening view looks at a point that is often a park or
    // a roof far from a pavement, and a walk that starts in a field is a bad
    // first step. Farther out the visitor chose that place: start there.
    let best = -1, bestD = (600 * M) ** 2;
    for (let k = 0; k < lanes.X.length; k++) {
      const d = (lanes.X[k] - x) ** 2 + (lanes.Z[k] - z) ** 2;
      if (d < bestD && !collider.blocked(lanes.X[k], lanes.Z[k], BODY)) { bestD = d; best = k; }
    }
    return best < 0 ? null : { x: lanes.X[best], z: lanes.Z[best] };
  }
  const figure = createFigure();
  figure.root.visible = false;
  scene.add(figure.root);
  let view = 'third'; // 'third' | 'first'
  let back = BACK; // the camera's current distance, eased
  let faceYaw = 0; // where the figure faces
  let spots = [];
  let near = null; // the place within reach, or null
  let nearClock = 0;
  const pos = { x: 0, z: 0 };
  let yaw = 0; // 0 looks north (-z), positive turns east
  let pitch = 0;
  let eyeY = 0;
  let active = false;
  let fov0 = camera.fov;
  let walked = 0; // metres, for tests
  const held = new Set();
  const stick = { x: 0, z: 0 };
  const vel = { x: 0, z: 0 };
  const _look = new THREE.Vector3();

  // ------------------------------------------------------------ HUD
  const root = document.createElement('div');
  root.className = 'walk-hud';
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="walk-exit">${t('Наверх')}</button>
    <button type="button" class="walk-view" aria-pressed="false">${t('От первого лица')}</button>
    <button type="button" class="walk-place" hidden></button>
    <p class="walk-hint walk-hint-keys">${t('WASD — идти, мышь — смотреть, Shift — бегом, V — вид')}</p>
    <p class="walk-hint walk-hint-touch">${t('Стик — идти, проведите по экрану — смотреть')}</p>
    <div class="walk-stick" role="group" aria-label="${t('Направление шага')}"><span class="walk-stick-knob"></span></div>`;
  document.body.appendChild(root);
  root.querySelector('.walk-exit').addEventListener('click', () => stop());
  const viewBtn = root.querySelector('.walk-view');
  function setView(next) {
    view = next === 'first' ? 'first' : 'third';
    viewBtn.setAttribute('aria-pressed', String(view === 'first'));
    figure.root.visible = active && view === 'third';
    back = BODY; // the camera eases out from the head
  }
  viewBtn.addEventListener('click', () => setView(view === 'first' ? 'third' : 'first'));
  const placeBtn = root.querySelector('.walk-place');
  placeBtn.addEventListener('click', () => {
    const spot = near;
    if (!spot) return;
    stop();
    onPlace?.(spot.i);
  });
  const stickEl = root.querySelector('.walk-stick');
  const knob = root.querySelector('.walk-stick-knob');
  let stickPointer = null;
  const setStick = (e) => {
    const rect = stickEl.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    let dx = (e.clientX - (rect.left + rect.width / 2)) / radius;
    let dy = (e.clientY - (rect.top + rect.height / 2)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    if (Math.hypot(dx, dy) < 0.12) dx = dy = 0;
    stick.x = dx;
    stick.z = -dy;
    knob.style.transform = `translate(calc(-50% + ${dx * radius}px), calc(-50% + ${dy * radius}px))`;
  };
  const releaseStick = (e) => {
    if (e && e.pointerId !== stickPointer) return;
    stickPointer = null;
    stick.x = stick.z = 0;
    knob.style.transform = '';
  };
  stickEl.addEventListener('pointerdown', (e) => {
    if (stickPointer != null) return;
    e.preventDefault();
    stickPointer = e.pointerId;
    try {
      stickEl.setPointerCapture(e.pointerId);
    } catch {
      // a pointer that is already gone (or a scripted one): the stick still works
    }
    setStick(e);
  });
  stickEl.addEventListener('pointermove', (e) => e.pointerId === stickPointer && setStick(e));
  stickEl.addEventListener('pointerup', releaseStick);
  stickEl.addEventListener('pointercancel', releaseStick);
  stickEl.addEventListener('lostpointercapture', releaseStick);

  // ------------------------------------------------------------ look
  let lookPointer = null;
  let lastX = 0, lastY = 0;
  const onDown = (e) => {
    if (!active || lookPointer != null) return;
    lookPointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onMove = (e) => {
    if (!active || e.pointerId !== lookPointer) return;
    yaw += (e.clientX - lastX) * LOOK;
    pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lastY) * LOOK, -PITCH, PITCH);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e) => {
    if (e.pointerId === lookPointer) lookPointer = null;
  };
  dom.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // ------------------------------------------------------------ keys
  // keyup is read here always, so a key never sticks; keydown comes from
  // the dispatcher in main.js (onKey), after the dialogs had their turn
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  function onKey(e) {
    if (!active) return false;
    if (e.key === 'Escape') {
      stop();
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.code === 'KeyV' && !e.repeat) {
      setView(view === 'first' ? 'third' : 'first');
      return true;
    }
    if (KEYS[e.code] || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      held.add(e.code);
      e.preventDefault();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ mode
  // at: { x, z } world units; default: where the orbit camera looks
  function start(at = null, heading = null) {
    if (active) return true;
    const from = at || rig.controls.target;
    readStreet();
    // a pavement or a pedestrian street first; any free ground otherwise
    const free = laneNear(from.x, from.z) || collider.freeNear(from.x, from.z, BODY);
    if (!free) return false; // no street within reach
    pos.x = free.x;
    pos.z = free.z;
    if (heading != null) yaw = heading;
    else {
      const dx = rig.controls.target.x - camera.position.x;
      const dz = rig.controls.target.z - camera.position.z;
      yaw = Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, -dz) : 0;
    }
    pitch = 0;
    vel.x = vel.z = 0;
    walked = 0;
    held.clear();
    releaseStick();
    readSurface(pos.x, pos.z);
    surfClock = 2;
    feetY = null;
    feetY = ground(pos.x, pos.z);
    eyeY = feetY + EYE;
    rig.cancelFlight?.();
    rig.controls.enabled = false;
    fov0 = camera.fov;
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    active = true;
    root.hidden = false;
    faceYaw = yaw;
    spots = places();
    near = null;
    nearClock = 0;
    placeBtn.hidden = true;
    setView(view);
    onEnter?.();
    place(0);
    return true;
  }

  function stop() {
    if (!active) return;
    active = false;
    root.hidden = true;
    figure.root.visible = false;
    held.clear();
    releaseStick();
    lookPointer = null;
    camera.fov = fov0;
    camera.updateProjectionMatrix();
    rig.controls.enabled = true;
    // back up: 160 m behind and 110 m above the walker, looking at the spot
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const base = heightAt(pos.x, pos.z);
    const target = new THREE.Vector3(pos.x, base, pos.z);
    const up = new THREE.Vector3(pos.x - fx * 160 * M, base + 110 * M, pos.z - fz * 160 * M);
    rig.controls.target.copy(target);
    rig.flyTo(up, target, reducedMotion ? 0.01 : 1.4);
    onExit?.();
  }

  function place(dt) {
    feetY = ground(pos.x, pos.z);
    const want = feetY + EYE;
    // steps and kerbs ease in; a first frame snaps
    eyeY = dt > 0 ? eyeY + (want - eyeY) * Math.min(1, dt * 12) : want;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    camera.up.set(0, 1, 0);
    const feet = eyeY - EYE;
    figure.root.position.set(pos.x, feet, pos.z);
    figure.root.rotation.y = -faceYaw;
    if (view === 'first') {
      const c = Math.cos(pitch);
      camera.position.set(pos.x, eyeY, pos.z);
      _look.set(pos.x + fx * c, eyeY + Math.sin(pitch), pos.z + fz * c);
    } else {
      // the camera turns about the head: behind the walker, a little above
      // level; it comes closer when a house stands in the way
      const e = THREE.MathUtils.clamp(TILT - pitch, 0.02, 1.3);
      const ce = Math.cos(e), se = Math.sin(e);
      let reach = BACK;
      for (let k = 1; k <= 12; k++) {
        const d = (BACK * k) / 12;
        if (collider.blocked(pos.x - fx * ce * d, pos.z - fz * ce * d, BODY * 0.6)) {
          reach = Math.max(BODY, (BACK * (k - 1)) / 12);
          break;
        }
      }
      back = reach < back || dt <= 0 ? Math.min(back, reach) : back + (reach - back) * Math.min(1, dt * 4);
      if (dt <= 0) back = reach;
      const headY = feet + HEAD;
      // a wall right behind: no room for the camera, so it looks from the
      // eyes and the figure hides until there is room again
      const tight = back < CLOSE;
      figure.root.visible = !tight;
      if (tight) {
        const c = Math.cos(pitch);
        camera.position.set(pos.x, eyeY, pos.z);
        _look.set(pos.x + fx * c, eyeY + Math.sin(pitch), pos.z + fz * c);
      } else {
        const cx = pos.x - fx * ce * back, cz = pos.z - fz * ce * back;
        camera.position.set(cx, Math.max(headY + se * back, ground(cx, cz) + 0.3), cz);
        _look.set(pos.x, feet + 1.3 * M, pos.z); // the chest: the whole figure stays in view
      }
    }
    camera.lookAt(_look);
    const ax = pos.x + fx * AHEAD, az = pos.z + fz * AHEAD;
    rig.controls.target.set(ax, heightAt(ax, az), az);
  }

  function update(dt) {
    if (!active) return false;
    let ix = stick.x, iz = stick.z;
    for (const code of held) {
      const k = KEYS[code];
      if (!k) continue;
      if (k[0] === 'x') ix += k[1];
      else iz += k[1];
    }
    const n = Math.hypot(ix, iz);
    if (n > 1) { ix /= n; iz /= n; }
    const speed = held.has('ShiftLeft') || held.has('ShiftRight') ? RUN : SPEED;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    // forward (fx, fz); right (-fz, fx)
    const wx = (fx * iz - fz * ix) * speed;
    const wz = (fz * iz + fx * ix) * speed;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 10);
    vel.x += (wx - vel.x) * k;
    vel.z += (wz - vel.z) * k;
    let stepM = 0;
    if (Math.abs(vel.x) + Math.abs(vel.z) > 1e-5) {
      let dx = vel.x * dt, dz = vel.z * dt;
      const next = collider.move(pos.x, pos.z, dx, dz, BODY);
      if (bounds) {
        next.x = THREE.MathUtils.clamp(next.x, bounds.x0, bounds.x1);
        next.z = THREE.MathUtils.clamp(next.z, Math.min(bounds.zN, bounds.zS), Math.max(bounds.zN, bounds.zS));
      }
      stepM = Math.hypot(next.x - pos.x, next.z - pos.z) * METRES_PER_UNIT;
      walked += stepM;
      if (next.hit) { vel.x *= 0.5; vel.z *= 0.5; }
      pos.x = next.x;
      pos.z = next.z;
    }
    shove();
    // the figure turns to where it walks; standing, it keeps its last heading
    if (n > 0.1 && stepM > 1e-4) {
      const want = Math.atan2(vel.x, -vel.z);
      const d = Math.atan2(Math.sin(want - faceYaw), Math.cos(want - faceYaw));
      faceYaw += d * Math.min(1, dt * 10);
    }
    figure.step(stepM, dt, speed === RUN);
    // the surface index follows the walker and what the scene has loaded
    surfClock -= dt;
    if (surfClock <= 0) {
      surfClock = 2;
      readSurface(pos.x, pos.z);
    }
    // a place within reach offers its card (checked three times a second)
    nearClock -= dt;
    if (nearClock <= 0) {
      nearClock = 0.33;
      let best = null, bestD = PLACE_M * M;
      for (const s of spots) {
        if (Math.abs(s.x - pos.x) > 120 || Math.abs(s.z - pos.z) > 120) continue; // 480 m
        const d = s.outline ? (collider.inside(pos.x, pos.z) ? 0 : outlineDistance(s.outline, pos.x, pos.z)) : Math.hypot(s.x - pos.x, s.z - pos.z);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best !== near) {
        near = best;
        placeBtn.hidden = !near;
        if (near) placeBtn.textContent = `${near.name} ›`;
      }
    }
    place(dt);
    return true;
  }

  return {
    start,
    stop,
    update,
    onKey,
    get active() {
      return active;
    },
    // tests and debugging
    get state() {
      return {
        x: +pos.x.toFixed(3), z: +pos.z.toFixed(3), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3),
        eyeM: +((eyeY - ground(pos.x, pos.z)) * METRES_PER_UNIT).toFixed(2),
        liftM: +((ground(pos.x, pos.z) - heightAt(pos.x, pos.z)) * METRES_PER_UNIT).toFixed(2),
        walkedM: +walked.toFixed(1), inside: collider.inside(pos.x, pos.z), buildings: collider.count,
        view, near: near ? near.i : null, seats: seatCount, solids: solidCount, bumps, touching, lanes: street()?.lanes?.X?.length || 0,
        blocked: collider.blocked(pos.x, pos.z, BODY * 0.9),
        camM: +(Math.hypot(camera.position.x - pos.x, camera.position.z - pos.z) * METRES_PER_UNIT).toFixed(2),
        camInside: collider.inside(camera.position.x, camera.position.z),
        figure: figure.root.visible,
      };
    },
    setView,
    // tests: put the walker at a point (world units); false when it is blocked
    teleport(x, z) {
      if (collider.blocked(x, z, BODY)) return false;
      pos.x = x;
      pos.z = z;
      nearClock = 0;
      readSurface(x, z);
      feetY = null;
      return true;
    },
    // tests: the drawn bodies of a kind ('people', 'traffic') as [x, z] pairs
    bodies(name) {
      const out = [];
      scene.getObjectByName(name)?.traverse((o) => {
        if (!o.isInstancedMesh || !o.visible || o.name === 'traffic-lights') return;
        const e = o.instanceMatrix.array;
        for (let k = 0; k < o.count; k++) out.push([e[k * 16 + 12], e[k * 16 + 14]]);
      });
      return out;
    },
    // tests: hold a direction without a keyboard ({x, z} in -1..1), turn
    setInput(x = 0, z = 0) {
      stick.x = x;
      stick.z = z;
    },
    turn(toYaw, toPitch = 0) {
      yaw = toYaw;
      pitch = toPitch;
    },
  };
}

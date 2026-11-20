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
export function createWalk({ camera, scene, rig, heightAt, dom, polys, places = () => [], street = () => null, reducedMotion = false, bounds = null, onEnter, onExit, onPlace }) {
  let collider = createCollider(polys);
  let seatCount = 0;
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
  function ground(x, z) {
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
    collider = createCollider([...polys, ...extra]);
  }
  // the free walk-lane point nearest to (x, z), within 80 m; null without lanes
  function laneNear(x, z) {
    const lanes = street()?.lanes;
    if (!lanes?.X?.length) return null;
    let best = -1, bestD = (80 * M) ** 2;
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
    eyeY = ground(pos.x, pos.z) + EYE;
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
    const want = ground(pos.x, pos.z) + EYE;
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
    // the figure turns to where it walks; standing, it keeps its last heading
    if (n > 0.1 && stepM > 1e-4) {
      const want = Math.atan2(vel.x, -vel.z);
      const d = Math.atan2(Math.sin(want - faceYaw), Math.cos(want - faceYaw));
      faceYaw += d * Math.min(1, dt * 10);
    }
    figure.step(stepM, dt, speed === RUN);
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
        view, near: near ? near.i : null, seats: seatCount, lanes: street()?.lanes?.X?.length || 0,
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
      return true;
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

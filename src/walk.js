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

const KEYS = {
  KeyW: ['z', 1], ArrowUp: ['z', 1], KeyS: ['z', -1], ArrowDown: ['z', -1],
  KeyD: ['x', 1], ArrowRight: ['x', 1], KeyA: ['x', -1], ArrowLeft: ['x', -1],
};

export function createWalk({ camera, rig, heightAt, dom, polys, reducedMotion = false, bounds = null, onEnter, onExit }) {
  const collider = createCollider(polys);
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
    <p class="walk-hint walk-hint-keys">${t('WASD — идти, мышь — смотреть, Shift — бегом')}</p>
    <p class="walk-hint walk-hint-touch">${t('Стик — идти, проведите по экрану — смотреть')}</p>
    <div class="walk-stick" role="group" aria-label="${t('Направление шага')}"><span class="walk-stick-knob"></span></div>`;
  document.body.appendChild(root);
  root.querySelector('.walk-exit').addEventListener('click', () => stop());
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
    const free = collider.freeNear(from.x, from.z, BODY);
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
    eyeY = heightAt(pos.x, pos.z) + EYE;
    rig.cancelFlight?.();
    rig.controls.enabled = false;
    fov0 = camera.fov;
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    active = true;
    root.hidden = false;
    onEnter?.();
    place(0);
    return true;
  }

  function stop() {
    if (!active) return;
    active = false;
    root.hidden = true;
    held.clear();
    releaseStick();
    lookPointer = null;
    camera.fov = fov0;
    camera.updateProjectionMatrix();
    rig.controls.enabled = true;
    // back up: 160 m behind and 110 m above the walker, looking at the spot
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const ground = heightAt(pos.x, pos.z);
    const target = new THREE.Vector3(pos.x, ground, pos.z);
    const up = new THREE.Vector3(pos.x - fx * 160 * M, ground + 110 * M, pos.z - fz * 160 * M);
    rig.controls.target.copy(target);
    rig.flyTo(up, target, reducedMotion ? 0.01 : 1.4);
    onExit?.();
  }

  function place(dt) {
    const ground = heightAt(pos.x, pos.z) + EYE;
    // steps and kerbs ease in; a first frame snaps
    eyeY = dt > 0 ? eyeY + (ground - eyeY) * Math.min(1, dt * 12) : ground;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const c = Math.cos(pitch);
    camera.position.set(pos.x, eyeY, pos.z);
    _look.set(pos.x + fx * c, eyeY + Math.sin(pitch), pos.z + fz * c);
    camera.up.set(0, 1, 0);
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
    if (Math.abs(vel.x) + Math.abs(vel.z) > 1e-5) {
      let dx = vel.x * dt, dz = vel.z * dt;
      const next = collider.move(pos.x, pos.z, dx, dz, BODY);
      if (bounds) {
        next.x = THREE.MathUtils.clamp(next.x, bounds.x0, bounds.x1);
        next.z = THREE.MathUtils.clamp(next.z, Math.min(bounds.zN, bounds.zS), Math.max(bounds.zN, bounds.zS));
      }
      walked += Math.hypot(next.x - pos.x, next.z - pos.z) * METRES_PER_UNIT;
      if (next.hit) { vel.x *= 0.5; vel.z *= 0.5; }
      pos.x = next.x;
      pos.z = next.z;
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
        eyeM: +((camera.position.y - heightAt(pos.x, pos.z)) * METRES_PER_UNIT).toFixed(2),
        walkedM: +walked.toFixed(1), inside: collider.inside(pos.x, pos.z), buildings: collider.count,
      };
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

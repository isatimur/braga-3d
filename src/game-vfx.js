// Azulejo game effects (src/game.js): the pickup burst, world-space and
// pooled. One additive Points cloud, recycled from a ring buffer, so a
// combo of quick pickups never allocates and the GPU has one draw call.
import * as THREE from 'three';

const MAX = 800;

// A soft round dot, so additive points read as sparks, not squares.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGameVfx({ scene }) {
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const max = new Float32Array(MAX);
  const base = new Float32Array(MAX * 3);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.PointsMaterial({
    size: 0.9,
    sizeAttenuation: true,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'game-vfx';
  points.frustumCulled = false;
  points.renderOrder = 30;
  scene.add(points);

  const _c = new THREE.Color();
  function burst(x, y, z, { count = 55, color = 0xffd27a, spread = 16, up = 12 } = {}) {
    _c.set(color);
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const sp = 0.4 + Math.random() * 1.2;
      pos[i * 3] = x + Math.cos(a) * r * 0.15;
      pos[i * 3 + 1] = y + (Math.random() - 0.3) * r * 0.15;
      pos[i * 3 + 2] = z + Math.sin(a) * r * 0.15;
      vel[i * 3] = Math.cos(a) * sp * 7;
      vel[i * 3 + 1] = up * (0.4 + Math.random()) * 0.6;
      vel[i * 3 + 2] = Math.sin(a) * sp * 7;
      base[i * 3] = _c.r;
      base[i * 3 + 1] = _c.g;
      base[i * 3 + 2] = _c.b;
      life[i] = 1;
      max[i] = 0.8 + Math.random() * 0.9;
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  let any = false;
  function update(dt) {
    if (!any && cursor === 0) return;
    let alive = false;
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      alive = true;
      life[i] -= dt / max[i];
      const k = Math.max(0, life[i]);
      vel[i * 3 + 1] -= 22 * dt; // light gravity
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = k * k;
      col[i * 3] = base[i * 3] * f;
      col[i * 3 + 1] = base[i * 3 + 1] * f;
      col[i * 3 + 2] = base[i * 3 + 2] * f;
      if (life[i] <= 0) {
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
      }
    }
    any = alive;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { burst, update, points };
}

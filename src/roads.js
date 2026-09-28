// Street network, draped on the terrain, in two layers per road kind:
//   - a flat ribbon mesh at the real width (primary 8 m, secondary 5 m,
//     minor 3 m ...), a darker tone of the road colour: the street surface
//     you see in a close-up;
//   - a LineSegments2 at a constant pixel width on top: the glowing line
//     that keeps the network readable from far away, where a ribbon a few
//     metres wide is thinner than a pixel.
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { S } from './geo.js';

// Order is draw order (later draws on top). metres: real width; px: the
// line's CSS pixel width (the floor); surface: ribbon tone of the colour.
export const STYLE = {
  water: { color: 0x6fb2dd, metres: 8, px: 1.5, opacity: 0.7, surface: 0.55 },
  minor: { color: 0xc9a47a, metres: 3, px: 0.75, opacity: 0.3, surface: 0.55 },
  rail: { color: 0xa3a3a3, metres: 2.5, px: 1.2, opacity: 0.65, dashed: true, surface: 0.4 },
  secondary: { color: 0xe0a45e, metres: 5, px: 1.2, opacity: 0.62, surface: 0.55 },
  primary: { color: 0xf3bb68, metres: 8, px: 1.7, opacity: 0.88, glow: true, surface: 0.55 },
};

// street surfaces (sRGB): asphalt on the main roads, granite setts and
// worn tarmac on the smaller streets, ballast under the rails
export const SURFACE = { primary: 0x5b5753, secondary: 0x66615a, minor: 0x777066, rail: 0x5f574e, water: 0x2a4652 };

export const LIFT = 0.35; // line: world units (1.4 m) above the terrain surface
export const RIBBON_LIFT = 0.12; // ribbon: 0.5 m
export const MAX_SEG = 6; // subdivide longer segments so they follow the terrain

// One flat quad per segment, lengthened by half the width at both ends so
// consecutive quads overlap at the joints (opaque, so overlaps do not show).
function ribbon(segs, widthUnits, heightAt) {
  const n = segs.length / 6;
  const pos = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  const h = widthUnits / 2;
  let v = 0;
  let o = 0;
  for (let i = 0; i < n; i++) {
    const ax = segs[i * 6];
    const az = segs[i * 6 + 2];
    const bx = segs[i * 6 + 3];
    const bz = segs[i * 6 + 5];
    let dx = bx - ax;
    let dz = bz - az;
    const L = Math.hypot(dx, dz) || 1;
    dx /= L;
    dz /= L;
    const nx = -dz * h;
    const nz = dx * h;
    const ex = dx * h;
    const ez = dz * h;
    const corners = [
      [ax - ex + nx, az - ez + nz],
      [ax - ex - nx, az - ez - nz],
      [bx + ex - nx, bz + ez - nz],
      [bx + ex + nx, bz + ez + nz],
    ];
    const base = v / 3;
    for (const [x, z] of corners) {
      pos[v++] = x;
      pos[v++] = heightAt(x, z) + RIBBON_LIFT;
      pos[v++] = z;
    }
    // counter-clockwise from above whatever the direction: pick by winding
    const up = (corners[1][1] - corners[0][1]) * (corners[2][0] - corners[0][0]) - (corners[1][0] - corners[0][0]) * (corners[2][1] - corners[0][1]);
    if (up >= 0) idx.set([base, base + 1, base + 2, base, base + 2, base + 3], o);
    else idx.set([base, base + 2, base + 1, base, base + 3, base + 2], o);
    o += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

export function buildRoads(roads, project, heightAt, { waterRibbon = true } = {}) {
  const group = new THREE.Group();
  group.name = 'roads';
  const materials = [];
  const lines = {};
  const glows = [];
  let lastNight = -1;
  let lastClose = 1;
  let lastFar = 0;
  let bloomOn = false;
  function applyBloom() {
    const core = lines.primary?.material;
    const kc = bloomOn ? 1.45 - 0.35 * lastFar : 1;
    const kg = bloomOn ? 3 - 1.8 * lastFar : 1;
    if (core) {
      core.userData.base ??= core.color.clone();
      core.color.copy(core.userData.base).multiplyScalar(kc);
    }
    for (const g of glows) {
      g.userData.base ??= g.color.clone();
      g.color.copy(g.userData.base).multiplyScalar(kg);
    }
  }
  function applyOpacity() {
    const w = Math.max(0, lastNight);
    const near = 0.3 + 0.7 * lastClose;
    for (const [kind, line] of Object.entries(lines)) {
      const st = STYLE[kind];
      line.material.opacity = st.opacity * near * (kind === 'primary' ? 1 - 0.25 * w : 1 - 0.55 * w);
    }
  }
  const buckets = {};
  for (const k of Object.keys(STYLE)) buckets[k] = [];

  for (const f of roads.features || []) {
    const out = buckets[f.kind];
    if (!out || !Array.isArray(f.pts) || f.pts.length < 2) continue;
    let prev = null;
    for (const p of f.pts) {
      const cur = project(p[0], p[1]); // pts are [lat, lon]
      if (prev) {
        const dx = cur.x - prev.x;
        const dz = cur.z - prev.z;
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_SEG));
        for (let i = 0; i < n; i++) {
          const ax = prev.x + (dx * i) / n;
          const az = prev.z + (dz * i) / n;
          const bx = prev.x + (dx * (i + 1)) / n;
          const bz = prev.z + (dz * (i + 1)) / n;
          out.push(ax, heightAt(ax, az) + LIFT, az, bx, heightAt(bx, bz) + LIFT, bz);
        }
      }
      prev = cur;
    }
  }

  let order = 1;
  const counts = {};
  let ribbonTris = 0;
  const surfaceColor = new THREE.Color();
  for (const [kind, st] of Object.entries(STYLE)) {
    const arr = buckets[kind];
    counts[kind] = arr.length / 6;
    if (!arr.length) continue;

    // rivers: the nature layer draws the water surface when it has data
    if (kind === 'water' && !waterRibbon) {
      addLine(kind, st, arr);
      continue;
    }
    // the street surface at its real width: lit asphalt and granite setts,
    // so it takes the sun, the shadows of the houses and the night
    const rg = ribbon(arr, st.metres * S, heightAt);
    ribbonTris += rg.index.count / 3;
    surfaceColor.set(SURFACE[kind] ?? st.color);
    const rm = new THREE.MeshStandardMaterial({
      color: surfaceColor,
      roughness: 0.92,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2 - order,
    });
    materials.push(rm);
    const rmesh = new THREE.Mesh(rg, rm);
    rmesh.name = `street-${kind}`;
    rmesh.renderOrder = 0;
    rmesh.receiveShadow = true;
    group.add(rmesh);
    addLine(kind, st, arr);
  }

  function addLine(kind, st, arr) {
    const geo = new LineSegmentsGeometry();
    geo.setPositions(arr);
    const mat = new LineMaterial({
      color: st.color,
      linewidth: st.px,
      transparent: true,
      opacity: st.opacity,
      depthWrite: false,
      dashed: !!st.dashed,
      dashSize: 1.5,
      gapSize: 1.2,
    });
    mat.toneMapped = false;
    mat.fog = true;
    materials.push(mat);
    const line = new LineSegments2(geo, mat);
    if (st.dashed) line.computeLineDistances();
    line.renderOrder = order++;
    line.frustumCulled = false;
    line.name = `road-${kind}`;
    group.add(line);
    lines[kind] = line;

    if (st.glow) {
      const glowMat = new LineMaterial({
        color: st.color,
        linewidth: st.px * 3,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      glowMat.toneMapped = false;
      glowMat.fog = true;
      materials.push(glowMat);
      const glow = new LineSegments2(geo, glowMat);
      glow.renderOrder = order++;
      glow.frustumCulled = false;
      glow.name = `road-${kind}-glow`;
      group.add(glow);
      glows.push(glowMat);
    }
  }
  counts.ribbonTriangles = ribbonTris;

  const lamps = streetLamps(roads, project, heightAt);
  if (lamps) group.add(lamps);
  counts.lamps = lamps ? lamps.geometry.attributes.position.count : 0;

  return {
    group,
    counts,
    // the constant-width lines by kind, and the primary glow materials: the
    // streamed tiles (src/tiles.js) draw their main streets with the same
    // materials, so night, bloom and view-distance changes reach them too
    lines,
    glows,
    // w, h: CSS pixels; dpr: gl_PointSize counts device pixels
    setResolution(w, h, dpr = 1) {
      for (const m of materials) if (m.isLineMaterial) m.resolution.set(w, h);
      if (lamps) lamps.material.uniforms.uHeight.value = h * dpr;
    },
    // 0 day .. 1 night: lamps on; the unlit street surfaces and the minor
    // lines darken with the land, the main streets keep a soft glow
    setNight(w) {
      if (Math.abs(w - lastNight) < 0.005) return;
      lastNight = w;
      applyOpacity();
      for (const g of glows) g.opacity = 0.09 + 0.05 * w;
      if (lamps) {
        lamps.material.uniforms.uNight.value = w;
        lamps.visible = w > 0.02;
      }
    },
    // with post-processing, the main streets' core and glow go above the
    // bloom threshold (linear HDR); without it they keep their plain colours
    setBloom(on) {
      bloomOn = !!on;
      applyBloom();
    },
    // camera distance to the orbit target: in a close-up the constant-width
    // lines step back and the lit street surfaces carry the streets
    setViewDistance(d) {
      const k = THREE.MathUtils.smoothstep(d, 60, 420);
      // from far away the whole network is on screen at once: less glow
      const far = THREE.MathUtils.smoothstep(d, 1800, 5000);
      if (Math.abs(far - lastFar) > 0.02) {
        lastFar = far;
        applyBloom();
      }
      if (Math.abs(k - lastClose) < 0.01) return;
      lastClose = k;
      applyOpacity();
    },
    // the thin blue river line is for the far view; up close the water
    // surface shows the river at its width
    setWaterLine(visible) {
      if (lines.water) lines.water.visible = visible;
    },
  };
}

// Street lamps along the main and secondary streets: one Points draw, warm
// sodium glow, only at night. Every LAMP_M metres, alternating sides.
const LAMP_M = 34;
function streetLamps(roads, project, heightAt) {
  const pos = [];
  for (const f of roads.features || []) {
    if ((f.kind !== 'primary' && f.kind !== 'secondary') || !Array.isArray(f.pts)) continue;
    const half = (STYLE[f.kind].metres / 2 + 1.5) * S;
    const step = LAMP_M * S;
    let carry = step * 0.5;
    let side = 1;
    let prev = null;
    for (const q of f.pts) {
      const c = project(q[0], q[1]);
      if (prev) {
        const dx = c.x - prev.x;
        const dz = c.z - prev.z;
        const L = Math.hypot(dx, dz);
        if (L > 1e-4) {
          const ux = dx / L;
          const uz = dz / L;
          let s = carry;
          while (s < L) {
            const x = prev.x + ux * s - uz * half * side;
            const z = prev.z + uz * s + ux * half * side;
            pos.push(x, heightAt(x, z) + 7 * S, z);
            side = -side;
            s += step;
          }
          carry = s - L;
        }
      }
      prev = c;
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uNight: { value: 0 }, uHeight: { value: 900 } },
    vertexShader: /* glsl */ `
      uniform float uHeight;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        // a small glow in perspective (about 10 m), 1.5 .. 12 px
        gl_PointSize = clamp(2.4 * projectionMatrix[1][1] * uHeight * 0.5 / d, 1.5, 12.0);
        vFade = 1.0 - smoothstep(2500.0, 6000.0, d);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vFade;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = dot(p, p);
        if (r > 1.0) discard;
        float core = exp(-r * 12.0);
        float halo = exp(-r * 3.0) * 0.22;
        vec3 sodium = vec3(1.0, 0.58, 0.24);
        gl_FragColor = vec4(sodium * (core * 2.4 + halo) * uNight * vFade, 1.0);
      }`,
  });
  mat.toneMapped = false;
  const pts = new THREE.Points(geo, mat);
  pts.name = 'street-lamps';
  // point sizes follow the real drawing buffer, whatever set the pixel
  // ratio (the 2x quality mode, a postcard capture)
  const _db = new THREE.Vector2();
  pts.onBeforeRender = (renderer) => {
    const t = renderer.getRenderTarget();
    mat.uniforms.uHeight.value = t ? t.height : renderer.getDrawingBufferSize(_db).y;
  };
  pts.frustumCulled = false;
  pts.visible = false;
  pts.renderOrder = 30;
  return pts;
}

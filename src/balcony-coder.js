// Easter egg: the site's builder sits at a desk behind a 5th-floor window of
// one tower, coding on two laptops and a monitor. Click the window on the
// map, or come near it in walk mode, and a chat panel styled like a Claude
// Code terminal opens. When /api/coder is set up (api/coder.js), each message
// also goes to the owner on Telegram and his answers come back live; when he
// has not answered within LIVE_WAIT_MS, or the API is off, the scripted
// replies answer (balcony-coder-replies.js, no AI). (The file names keep the
// first version's name: he sat on a balcony then.)
//
// The place comes from the city config (cities/<id>.json "balcony_coder"):
// tower: a point inside the footprint; corner: a footprint corner, and the
// window goes on the facade opposite it (the line from the corner through
// the footprint centre leaves the tower there); floor: the storey.
//
// The room: the facade's windows are painted by the building shader on one
// flat wall, so there is no hole to look through. The room is drawn first
// (renderOrder -2, behind the wall), then an invisible quad a few cm in front
// of the wall writes depth over the opening (renderOrder -1), so the wall,
// drawn after, loses the depth test there and the room stays. A closed box
// behind the opening means every ray through it ends on a room surface.
// The room has its own light: its materials drop the scene's sun, sky and
// environment light and take three lamps (the screens, a warm light behind a
// curtain, the daylight from the window), so it reads as an interior.
//
// Cost: nothing is built or loaded until the camera comes within LOAD_M; the
// room and furniture are ~3k triangles in a few draws, the figure is one
// crowd model posed once (no mixer). Beyond SHOW_M the group is hidden and
// update() is one distance test.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fitToHeight } from './character-model.js';
import { createReplier } from './balcony-coder-replies.js';
import { t, language } from './i18n.js';
import { S } from './geo.js';
import './balcony-coder.css';

const MODEL = 'assets/characters/3d/crowd/passante-5.glb';
const SHOW_M = 300; // drawn within this distance of the camera
const LOAD_M = 400; // built and loaded when the camera first comes this near
const ANIM_M = 120; // he types within this distance
const TALK_M = 25; // walk mode: the prompt shows within this distance, on the window side
const STREET_UP = 0.12; // as in buildings.js: the ground floor's lift, world units
// the modern facade's window grid (facades.js, style 4): ground floor 3.6 m,
// then 3.0 m floors, glass from 0.96 to 2.7 m of each, mullions every 1.6 m
const G0 = 3.6;
const FH = 3.0;
const CELL = 1.6;
// the window (metres, window frame: x along the wall, y up from the room
// floor, z out of the wall): two cells wide, and taller than the ribbon so
// a seated man shows from the street
const OX = CELL; // half width
const Y0 = 0.5;
const Y1 = 2.7;
const FR = 0.07; // frame width
// the room behind it
const RW = 2.4; // half width
const RD = 3.6; // depth
const RH = 2.8; // ceiling
// where he sits (room frame) and where he faces: the left wall, turned 35
// degrees toward the window, so from outside his face and the monitor show
const SEAT = new THREE.Vector3(-0.25, 0, -1.45);
const FACE = Math.atan2(-0.82, 0.57);

function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// ---- the window's place: the facade opposite the configured corner
// Returns { i, a, e, n, s0, len } for footprint edge i: a its start, e its
// direction, n the outward normal, s0 the window's left end in metres from a
// (on the facade's mullion grid), or null.
export function pickFacade(poly, hint, S_ = S) {
  const n = poly.length;
  let area2 = 0;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], c = poly[(i + 1) % n];
    area2 += a.x * c.z - c.x * a.z;
    cx += a.x;
    cz += a.z;
  }
  cx /= n;
  cz /= n;
  const sgn = area2 >= 0 ? 1 : -1; // positive area: (dz, -dx) is the outward normal
  // the corner nearest the hint, and the direction from it through the centre
  let ci = 0;
  for (let i = 1; i < n; i++) if (Math.hypot(poly[i].x - hint.x, poly[i].z - hint.z) < Math.hypot(poly[ci].x - hint.x, poly[ci].z - hint.z)) ci = i;
  const dl = Math.hypot(cx - poly[ci].x, cz - poly[ci].z) || 1;
  const d = { x: (cx - poly[ci].x) / dl, z: (cz - poly[ci].z) / dl };
  // edges long enough for the window; score: faces along d, lies far along d
  const need = (2 * OX + 2 * CELL) * S_;
  let best = null;
  let run = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const runI = run;
    run += len / S_;
    if (len < need) continue;
    const e = { x: dx / len, z: dz / len };
    const nn = { x: (sgn * dz) / len, z: (sgn * -dx) / len };
    const mx = (a.x + b.x) / 2 - cx, mz = (a.z + b.z) / 2 - cz;
    const score = nn.x * d.x + nn.z * d.z + (0.3 * (mx * d.x + mz * d.z)) / dl;
    if (!best || score > best.score) {
      // the window's left end on the mullion grid, centred as near as it goes
      // (aWall.x runs on around the footprint from vertex 0: buildings.js)
      const lenM = len / S_;
      const k = Math.round((runI + lenM / 2 - OX) / CELL);
      const s0 = Math.min(Math.max(k * CELL - runI, CELL), lenM - CELL - 2 * OX);
      best = { score, i, a, e, n: nn, s0, len: lenM };
    }
  }
  return best;
}

// ---- canvas textures, drawn once
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// the monitor: an editor on a dark screen, yellow, green and red lines
const codeTex = () =>
  canvasTex(256, 150, (g, w, h) => {
    g.fillStyle = '#121419';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2027';
    g.fillRect(0, 0, 46, h); // the session list
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i === 5 ? '#3a3f4b' : '#2a2e37';
      g.fillRect(4, 8 + i * 15, 36, 7);
    }
    const cols = ['#e5c07b', '#e5c07b', '#98c379', '#e5c07b', '#e06c75', '#e06c75', '#e5c07b', '#98c379', '#98c379', '#e6e1d6', '#e5c07b', '#e5c07b', '#d97757', '#e5c07b'];
    for (let i = 0; i < cols.length; i++) {
      const y = 6 + i * 10;
      if (cols[i] === '#e06c75') {
        g.fillStyle = 'rgba(224,108,117,0.18)';
        g.fillRect(48, y - 2, w - 50, 9);
      } else if (cols[i] === '#98c379') {
        g.fillStyle = 'rgba(152,195,121,0.16)';
        g.fillRect(48, y - 2, w - 50, 9);
      }
      g.fillStyle = '#5c6370';
      g.fillRect(50, y, 8, 4);
      g.fillStyle = cols[i];
      const ind = ((i * 5) % 4) * 6;
      let x = 64 + ind;
      for (let k = 0; k < 4; k++) {
        const wd = 10 + ((i * 31 + k * 17) % 34);
        if (x + wd > w - 6) break;
        g.fillRect(x, y, wd, 4);
        x += wd + 4;
      }
    }
  });
// the left laptop: a lake, rocks and snowy hills
const lakeTex = () =>
  canvasTex(128, 84, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.45);
    sky.addColorStop(0, '#4f86c6');
    sky.addColorStop(1, '#b9d3ea');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#8aa1b8';
    g.beginPath();
    g.moveTo(0, h * 0.45);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.36 + 0.06 * Math.sin(x * 0.17) + 0.03 * Math.sin(x * 0.53)));
    g.lineTo(w, h * 0.45);
    g.fill();
    const sea = g.createLinearGradient(0, h * 0.45, 0, h);
    sea.addColorStop(0, '#3f9fb0');
    sea.addColorStop(1, '#7fd3c4');
    g.fillStyle = sea;
    g.fillRect(0, h * 0.45, w, h * 0.55);
    g.fillStyle = '#9d9a91';
    for (const [x, y, r] of [[30, 62, 9], [52, 58, 6], [80, 66, 11], [104, 56, 5], [16, 72, 7]]) {
      g.beginPath();
      g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
// the middle laptop: this map, with its blue panel
const mapTex = () =>
  canvasTex(128, 84, (g, w, h) => {
    g.fillStyle = '#d9dde2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9b48f';
    for (let i = 0; i < 14; i++) g.fillRect(40 + ((i * 37) % 80), 10 + ((i * 23) % 60), 10, 8);
    g.fillStyle = '#e07a4f';
    for (let i = 0; i < 6; i++) g.fillRect(50 + ((i * 29) % 70), 40 + ((i * 13) % 34), 12, 7);
    g.fillStyle = '#e6d9a8';
    g.fillRect(56, 8, 22, 50); // the tower
    g.fillStyle = '#21407a';
    g.fillRect(4, 8, 30, h - 14);
    g.fillStyle = '#7f9bd0';
    for (let i = 0; i < 9; i++) g.fillRect(7, 14 + i * 7, 18 + ((i * 7) % 6), 3);
  });
// a soft round glow
const glowTex = () =>
  canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });

// the light the window throws on the wall around it: the glow with the
// window's own rectangle cut out (it must not haze the room)
const haloTex = (wf, hf) =>
  canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(w * (0.5 - wf / 2), w * (0.5 - hf / 2), w * wf, w * hf);
  });

// ---- the interior light (see the header)
const LAMP_COL = [new THREE.Color(0.55, 0.66, 0.9), new THREE.Color(1.0, 0.6, 0.28), new THREE.Color(0.62, 0.66, 0.72)];
function interiorUniforms() {
  return {
    uLampPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uLampCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    uLampFall: { value: [1, 1, 1] },
    uAmb: { value: new THREE.Color(0.02, 0.02, 0.026) },
  };
}
function interiorMat(U, opts) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...opts });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLampPos[3];\nuniform vec3 uLampCol[3];\nuniform float uLampFall[3];\nuniform vec3 uAmb;')
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
  {
    vec3 bp = -vViewPosition;
    vec3 irr = uAmb;
    for (int i = 0; i < 3; i++) {
      vec3 l = uLampPos[i] - bp;
      float d = length(l);
      irr += uLampCol[i] * (0.25 + 0.75 * max(dot(normal, l / max(d, 1e-4)), 0.0)) / (1.0 + d * d * uLampFall[i]);
    }
    reflectedLight.directDiffuse = vec3(0.0);
    reflectedLight.directSpecular = vec3(0.0);
    reflectedLight.indirectSpecular = vec3(0.0);
    reflectedLight.indirectDiffuse = diffuseColor.rgb * irr;
  }`,
      );
  };
  m.customProgramCacheKey = () => 'brg-interior';
  return m;
}

// geometry helpers: every piece gets a colour attribute, so one material and
// one draw holds a whole set
function paint(geo, hex, jitter = 0, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  let r = seed;
  for (let i = 0; i < n; i++) {
    r = (r * 16807) % 2147483647;
    const k = 1 + jitter * ((r / 2147483647) * 2 - 1);
    a[i * 3] = c.r * k;
    a[i * 3 + 1] = c.g * k;
    a[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// a box from its min and max corners
const box = (x0, y0, z0, x1, y1, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

export function createBalconyCoder({ scene, camera, project, heightAt, footprints, config, city = null, getWalk = () => null, getNight = () => 0, isHidden = () => false }) {
  if (!config?.tower || !config?.corner || !Array.isArray(footprints)) return null;
  const tower = project(config.tower[0], config.tower[1]);
  const poly = footprints.find((p) => inPoly(tower.x, tower.z, p));
  if (!poly) {
    console.info('[braga] window coder: no footprint at the tower point');
    return null;
  }
  const face = pickFacade(poly, project(config.corner[0], config.corner[1]));
  if (!face) {
    console.info('[braga] window coder: no facade wide enough');
    return null;
  }
  // the room floor, the same ground rule as extrudeBuilding (buildings.js)
  const gs = poly.map((p) => heightAt(p.x, p.z));
  const low = Math.min(...gs);
  const gmin = Math.min(gs.reduce((s, g) => s + g, 0) / poly.length, low + 0.4) + STREET_UP;
  const floorY = gmin + (G0 + ((config.floor ?? 5) - 1) * FH) * S;

  // root: metres; local x along the wall (right, seen from outside), y up,
  // z out of the wall; origin on the wall under the window's middle
  const sc = (face.s0 + OX) * S;
  const root = new THREE.Group();
  root.name = 'window-coder';
  root.position.set(face.a.x + face.e.x * sc, floorY, face.a.z + face.e.z * sc);
  root.rotation.y = Math.atan2(face.n.x, face.n.z);
  root.scale.setScalar(S);
  root.visible = false;
  root.updateMatrixWorld(true);
  // the window's middle, world units (for distances, tests and screenshots)
  const win = root.localToWorld(new THREE.Vector3(0, (Y0 + Y1) / 2, 0));
  const seat = { x: win.x, z: win.z, y: win.y, nx: face.n.x, nz: face.n.z };

  let state = 'idle'; // idle | loading | ready | failed
  let bones = null;
  let proxy = null;
  let clock = 0;
  const U = interiorUniforms();
  const lampsLocal = [new THREE.Vector3(-0.9, 1.05, -1.1), new THREE.Vector3(2.0, 1.9, -2.3), new THREE.Vector3(0, 2.1, 0.8)];
  const lampFallM = [1.6, 0.35, 0.18]; // per metre²
  for (let i = 0; i < 3; i++) U.uLampFall.value[i] = lampFallM[i] / (S * S);
  let curtainMat = null, glassMat = null, haloMat = null;
  const screenMats = [];

  // ---- the room, the window and its frame (built on the first approach)
  function buildRoom() {
    const parts = [];
    const wall = 0x2c2e35;
    const plane = (w, h) => new THREE.PlaneGeometry(w, h, 1, 1);
    parts.push(paint(plane(2 * RW, RH).translate(0, RH / 2, -RD), wall, 0.08, 3)); // back
    parts.push(paint(plane(RD, RH).rotateY(Math.PI / 2).translate(-RW, RH / 2, -RD / 2), 0x30323a, 0.08, 5)); // left
    parts.push(paint(plane(RD, RH).rotateY(-Math.PI / 2).translate(RW, RH / 2, -RD / 2), 0x30323a, 0.08, 7)); // right
    parts.push(paint(plane(2 * RW, RD).rotateX(-Math.PI / 2).translate(0, 0, -RD / 2), 0x3a2c22)); // floor: dark wood
    parts.push(paint(plane(2 * RW, RD).rotateX(Math.PI / 2).translate(0, RH, -RD / 2), 0x8c8983)); // ceiling: white paint, what the street sees most
    // a skirting board, a door in the back wall
    parts.push(paint(box(-RW, 0, -RD, RW, 0.08, -RD + 0.02), 0x1d1e22));
    parts.push(paint(box(-1.2, 0, -RD, -0.35, 2.05, -RD + 0.04), 0x24252b));
    // the fern: a pot, and fronds that arch out
    parts.push(paint(new THREE.CylinderGeometry(0.17, 0.13, 0.34, 10).translate(-1.95, 0.5, -3.2), 0x1c1c1f));
    parts.push(paint(box(-2.15, 0, -3.4, -1.75, 0.33, -3.0), 0x2a2420)); // a stand
    for (let k = 0; k < 13; k++) {
      const a = (k / 13) * Math.PI * 2 + 0.3 * Math.sin(k * 7.1);
      const L = 0.5 + 0.18 * Math.sin(k * 3.7);
      const pos = [];
      const SEG = 6;
      for (let j = 0; j <= SEG; j++) {
        const u = j / SEG;
        const r = L * u;
        const y = 0.66 + 0.42 * Math.sin(u * Math.PI * 0.62) * L - 0.15 * u * u;
        const wdt = 0.07 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (j % 2 ? 1.25 : 0.75);
        const px = -1.95 + Math.cos(a) * r, pz = -3.2 + Math.sin(a) * r;
        pos.push([px - Math.sin(a) * wdt, y, pz + Math.cos(a) * wdt], [px + Math.sin(a) * wdt, y, pz - Math.cos(a) * wdt]);
      }
      const arr = [];
      for (let j = 0; j < SEG; j++) {
        const [p0, p1] = [pos[j * 2], pos[j * 2 + 1]];
        const [p2, p3] = [pos[j * 2 + 2], pos[j * 2 + 3]];
        arr.push(...p0, ...p2, ...p1, ...p1, ...p2, ...p3);
        arr.push(...p0, ...p1, ...p2, ...p1, ...p3, ...p2); // both sides
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.computeVertexNormals();
      parts.push(paint(g, k % 3 ? 0x2f5d2c : 0x3c6e33, 0.15, k + 11));
    }
    const room = new THREE.Mesh(mergeGeometries(parts), interiorMat(U, { vertexColors: true }));
    room.name = 'window-coder-room';
    root.add(room);

    // the curtain on the right wall, lit from behind (its own glow)
    const cg = new THREE.PlaneGeometry(1.6, 2.4, 24, 4);
    const cp = cg.attributes.position;
    const ccol = new Float32Array(cp.count * 3);
    const warm = new THREE.Color(1.0, 0.72, 0.38), dim = new THREE.Color(0.42, 0.3, 0.2);
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i);
      cp.setZ(i, 0.05 * Math.sin(x * 15) + 0.025 * Math.sin(x * 37));
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(x * 15 + 1.2)); // folds catch the light
      const top = THREE.MathUtils.smoothstep(y, 0.3, 1.2); // brightest at the rail
      const c = dim.clone().lerp(warm, 0.35 + 0.65 * top).multiplyScalar(k);
      ccol.set([c.r, c.g, c.b], i * 3);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
    cg.rotateY(-Math.PI / 2).translate(RW - 0.08, 1.45, -2.35);
    curtainMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    root.add(new THREE.Mesh(cg, curtainMat));
    // the light leaking over the curtain rail
    const leak = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5).rotateY(-Math.PI / 2).translate(RW - 0.02, 2.62, -2.35), new THREE.MeshBasicMaterial({ color: 0x99692f, map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false }));
    root.add(leak);

    // the window: frame, sill, a central mullion (lit by the scene, outside)
    const fr = [
      box(-OX - FR, Y0 - FR, -0.24, -OX + 0.02, Y1 + FR, 0.07),
      box(OX - 0.02, Y0 - FR, -0.24, OX + FR, Y1 + FR, 0.07),
      box(-OX - FR, Y1 - 0.02, -0.24, OX + FR, Y1 + FR, 0.07),
      box(-OX - FR, Y0 - FR, -0.24, OX + FR, Y0 + 0.02, 0.07),
      box(-0.03, Y0, -0.16, 0.03, Y1, -0.08),
      box(-OX, 2.16, -0.16, OX, 2.21, -0.08), // a transom
    ];
    const frame = new THREE.Mesh(mergeGeometries(fr), new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5, metalness: 0.4 }));
    const sill = new THREE.Mesh(box(-OX - 0.14, Y0 - FR - 0.06, -0.06, OX + 0.14, Y0 - FR, 0.17), new THREE.MeshStandardMaterial({ color: 0xbdb8ae, roughness: 0.85 }));
    root.add(frame, sill);
    // the depth punch over the opening (see the header)
    const punch = new THREE.Mesh(new THREE.PlaneGeometry(2 * (OX + FR), Y1 - Y0 + 2 * FR).translate(0, (Y0 + Y1) / 2, 0.04), new THREE.MeshBasicMaterial({ colorWrite: false }));
    // (4 cm in front of the wall is enough for the depth buffer out to SHOW_M;
    // a polygon offset would pull it 30 cm forward at a slant and hide the glass)
    punch.name = 'window-coder-punch';
    root.add(punch);
    // the glass: a faint sheen of the sky; at night a warm glow on the wall
    glassMat = new THREE.MeshBasicMaterial({ color: 0xa9bfd4, transparent: true, opacity: 0.1, depthWrite: false });
    // (in front of the punch: behind it the depth test would hide it)
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * OX, Y1 - Y0).translate(0, (Y0 + Y1) / 2, 0.06), glassMat));
    haloMat = new THREE.MeshBasicMaterial({ color: 0xffb46a, map: haloTex(1 / 1.5, 1 / 1.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * OX * 1.5, (Y1 - Y0) * 1.7).translate(0, (Y0 + Y1) / 2, 0.09), haloMat));
    // the pick target: invisible, in front of the window and larger than it,
    // so a tap on a phone lands (the map's orbit is ~120 m away)
    proxy = new THREE.Mesh(box(-OX - 1, Y0 - 1, -0.5, OX + 1, Y1 + 1, 2.5), new THREE.MeshBasicMaterial({ visible: false }));
    root.add(proxy);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      if (o !== punch) o.renderOrder = -2;
    });
    punch.renderOrder = -1;
    // an additive glow in the opaque pass: after the room, before the punch
    // (in the transparent pass the punch's depth would hide it)
    leak.renderOrder = -1.5;
  }

  // ---- the figure: a crowd model, recoloured and posed at the desk
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
  // turn `bone` so the direction to `child` points along `dir` (holder space)
  function aim(bone, child, dir) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    bone.getWorldPosition(_a);
    child.getWorldPosition(_b);
    _q.setFromUnitVectors(_b.sub(_a).normalize(), dir.clone().normalize());
    bone.getWorldQuaternion(_wq);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
    bone.updateMatrixWorld(true);
  }
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());

  // the owner's look: navy athletic top, dark trousers, skin; by the bone
  // that moves each vertex most (the crowd model's texture is an atlas)
  const SKIN = new THREE.Color('#c79a84');
  const TOP = new THREE.Color('#141d36');
  const LEGS = new THREE.Color('#25272c');
  const SHOES = new THREE.Color('#151517');
  function regionColour(name) {
    if (/^(Head|head_end|headfront)$/.test(name) || /Hand$/.test(name)) return SKIN; // the neck: a high collar
    if (/(Foot|ToeBase)$/.test(name)) return SHOES;
    if (/(UpLeg|Leg)$/.test(name) || name === 'Hips') return LEGS;
    return TOP;
  }
  // recolour by bone weights; returns the boxes (holder space, bind pose)
  // of the head and the chest
  function recolour(mesh) {
    const geo = mesh.geometry;
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    const names = mesh.skeleton.bones.map((b) => b.name);
    const head = new THREE.Box3(), chest = new THREE.Box3();
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.setRGB(0, 0, 0);
      let top = 0, topName = '';
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (!w) continue;
        const nm = names[si.getComponent(i, k)] || '';
        c.r += regionColour(nm).r * w;
        c.g += regionColour(nm).g * w;
        c.b += regionColour(nm).b * w;
        if (w > top) [top, topName] = [w, nm];
      }
      col.set([c.r, c.g, c.b], i * 3);
      if (topName === 'Head' || topName === 'headfront' || topName === 'Spine') {
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
        (topName === 'Spine' ? chest : head).expandByPoint(v);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.deleteAttribute('uv');
    mesh.material = interiorMat(U, { vertexColors: true, roughness: 0.75 });
    return { head, chest };
  }

  // hair, beard, headphones and a face, around the head box (holder space)
  function headParts(hb) {
    const c = hb.getCenter(new THREE.Vector3());
    const z = hb.getSize(new THREE.Vector3());
    const parts = [];
    const hair = 0x2a2420, grey = 0x6b6660;
    // the hair: a cap tilted back, and curls on it, some grey
    const cap = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(z.x * 0.56, z.y * 0.5, z.z * 0.58).rotateX(-0.42).translate(c.x, c.y + z.y * 0.1, c.z - z.z * 0.04);
    parts.push(paint(cap, hair, 0.25, 3));
    for (let k = 0; k < 26; k++) {
      const th = 0.2 + 1.1 * ((k * 0.618) % 1); // from the crown down
      const ph = k * 2.4;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), zz = Math.sin(th) * Math.sin(ph);
      if (zz > 0.3 && y < 0.6) continue; // not on the forehead
      const g = new THREE.IcosahedronGeometry(0.02 + 0.006 * ((k * 7) % 3), 0).translate(c.x + x * z.x * 0.56, c.y + z.y * 0.12 + y * z.y * 0.47, c.z - z.z * 0.06 + zz * z.z * 0.56);
      parts.push(paint(g, k % 3 === 1 ? grey : hair, 0.2, k + 5));
    }
    // the beard: the lower front of the head, full to the ears, flecked grey
    // (tipped forward: up to the ears at the sides, to the mouth in front)
    const beard = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI, Math.PI * 0.45, Math.PI * 0.44).scale(z.x * 0.53, z.y * 0.46, z.z * 0.57).rotateX(0.4).translate(c.x, c.y - z.y * 0.02, c.z + z.z * 0.03);
    parts.push(paint(beard, 0x2c2723));
    parts.push(paint(new THREE.SphereGeometry(1, 8, 4).scale(z.x * 0.2, z.y * 0.05, z.z * 0.08).translate(c.x, c.y - z.y * 0.08, c.z + z.z * 0.5), hair)); // moustache
    // eyes and brows
    for (const sx of [-1, 1]) {
      parts.push(paint(new THREE.SphereGeometry(0.007, 6, 4).translate(c.x + sx * z.x * 0.18, c.y + z.y * 0.1, c.z + z.z * 0.5), 0x2a1a12));
      parts.push(paint(box(-0.026, -0.006, -0.008, 0.026, 0.006, 0.008).rotateZ(sx * -0.12).translate(c.x + sx * z.x * 0.19, c.y + z.y * 0.17, c.z + z.z * 0.5), hair));
    }
    // black over-ear headphones: a band over the crown, two cups
    const bw = z.x * 0.6 + 0.03;
    const band = new THREE.TorusGeometry(1, 0.02 / bw, 6, 18, Math.PI).scale(bw, z.y * 0.7, 1.4 * bw).translate(c.x, c.y - z.y * 0.04, c.z - z.z * 0.02);
    parts.push(paint(band, 0x060607));
    for (const sx of [-1, 1]) {
      parts.push(paint(new THREE.CylinderGeometry(0.05, 0.052, 0.045, 14).rotateZ(Math.PI / 2).translate(c.x + sx * bw, c.y - z.y * 0.06, c.z - z.z * 0.02), 0x060607));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), interiorMat(U, { vertexColors: true, roughness: 0.6 }));
    m.name = 'window-coder-head';
    return m;
  }
  // the top's thin white piping: from the collar over the chest to the arms
  function piping(cb) {
    const c = cb.getCenter(new THREE.Vector3());
    const z = cb.getSize(new THREE.Vector3());
    const parts = [];
    for (const sx of [-1, 1]) {
      const a = V(c.x + sx * z.x * 0.1, cb.max.y - z.y * 0.22, cb.max.z + 0.004);
      const b = V(c.x + sx * z.x * 0.4, cb.max.y - z.y * 0.02, c.z + z.z * 0.3);
      const len = a.distanceTo(b);
      const g = new THREE.BoxGeometry(0.008, len, 0.006);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2 + 0.012);
      parts.push(paint(g, 0xe8e8e6));
    }
    return new THREE.Mesh(mergeGeometries(parts), interiorMat(U, { vertexColors: true }));
  }

  // a laptop facing +z (toward him), the screen texture on its lid
  function laptop(tex, mBody) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.016, 0.24), mBody);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.008, -0.12);
    hinge.rotation.x = -0.3; // the lid leans away from him
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.23, 0.01).translate(0, 0.115, 0), mBody);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    screenMats.push(mat);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.2), mat);
    glow.position.set(0, 0.118, 0.0055);
    hinge.add(lid, glow);
    g.add(base, hinge);
    return g;
  }

  async function load() {
    state = 'loading';
    buildRoom();
    try {
      const gltf = await new GLTFLoader().loadAsync(MODEL);
      const model = fitToHeight(gltf.scene, 1.78);
      const char = new THREE.Group(); // faces +z, metres; posed with no parent
      char.add(model);
      char.updateMatrixWorld(true);
      const b = (name) => model.getObjectByName(name);
      let boxes = null;
      model.traverse((o) => {
        if (o.isSkinnedMesh && !boxes) boxes = recolour(o);
      });
      // hair, beard and headphones ride on the head bone, the piping on the chest
      const headMesh = headParts(boxes.head);
      char.add(headMesh);
      b('Head').attach(headMesh);
      if (!boxes.chest.isEmpty() && b('Spine')) {
        const p = piping(boxes.chest);
        char.add(p);
        b('Spine').attach(p);
      }
      // sit: thighs forward, shins down, feet flat; lean a little in
      // (the chain runs Hips > Spine02 > Spine01 > Spine > neck > Head)
      aim(b('Spine02'), b('Spine01'), V(0, 1, 0.1));
      for (const [side, x] of [['Left', 1], ['Right', -1]]) {
        aim(b(`${side}UpLeg`), b(`${side}Leg`), V(0.1 * x, -0.08, 1));
        aim(b(`${side}Leg`), b(`${side}Foot`), V(0.02 * x, -1, 0.12));
        aim(b(`${side}Foot`), b(`${side}ToeBase`), V(0, -0.35, 1));
      }
      const footY = Math.min(wp(b('LeftFoot')).y, wp(b('RightFoot')).y);
      char.position.y = 0.08 - footY;
      char.updateMatrixWorld(true);
      const hips = wp(b('Hips'));
      const holder = new THREE.Group();
      holder.add(char);

      // the desk, its legs, the chair (one draw)
      const DESK = 0.73;
      const dz0 = hips.z + 0.26, dz1 = hips.z + 0.98;
      const furn = [];
      furn.push(paint(box(-1.0, DESK - 0.035, dz0, 0.8, DESK, dz1), 0x2e2621));
      furn.push(paint(box(-0.98, 0, dz0 + 0.03, -0.94, DESK - 0.035, dz1 - 0.03), 0x1e1e21));
      furn.push(paint(box(0.74, 0, dz0 + 0.03, 0.78, DESK - 0.035, dz1 - 0.03), 0x1e1e21));
      const seatY = hips.y - 0.1;
      furn.push(paint(box(-0.24, seatY - 0.06, hips.z - 0.28, 0.24, seatY, hips.z + 0.2), 0x202124));
      furn.push(paint(box(-0.22, seatY + 0.08, hips.z - 0.34, 0.22, seatY + 0.62, hips.z - 0.28).rotateX(-0.12), 0x202124));
      furn.push(paint(new THREE.CylinderGeometry(0.025, 0.025, seatY - 0.12, 6).translate(0, (seatY - 0.06) / 2, hips.z - 0.04), 0x55575c));
      for (let k = 0; k < 5; k++) furn.push(paint(box(-0.02, 0.03, 0, 0.02, 0.07, 0.3).rotateY((k / 5) * Math.PI * 2).translate(0, 0, hips.z - 0.04), 0x2a2b2e));
      // the white mug, right of the monitor
      furn.push(paint(new THREE.CylinderGeometry(0.045, 0.042, 0.1, 10).translate(-0.9, DESK + 0.05, dz0 + 0.18), 0xf2efe8));
      furn.push(paint(new THREE.TorusGeometry(0.028, 0.008, 4, 8).translate(-0.95, DESK + 0.055, dz0 + 0.18), 0xf2efe8));
      // cables, a phone
      furn.push(paint(box(0.25, DESK, dz0 + 0.12, 0.33, DESK + 0.008, dz0 + 0.27), 0x1a1a1c));
      holder.add(new THREE.Mesh(mergeGeometries(furn), interiorMat(U, { vertexColors: true, roughness: 0.7 })));
      // two laptops side by side, the monitor on his right
      const mBody = interiorMat(U, { color: 0x8e9299, roughness: 0.5 });
      const head = wp(b('Head'));
      const toHim = (o, extra = 0) => (o.rotation.y = Math.atan2(head.x - o.position.x, head.z - o.position.z) + extra);
      const l2 = laptop(mapTex(), mBody);
      l2.position.set(0, DESK + 0.008, hips.z + 0.5);
      const l1 = laptop(lakeTex(), mBody);
      l1.position.set(0.46, DESK + 0.008, hips.z + 0.55);
      toHim(l1);
      toHim(l2);
      holder.add(l1, l2);
      const mon = new THREE.Group();
      mon.position.set(-0.58, DESK, hips.z + 0.78);
      const mDark = interiorMat(U, { color: 0x1b1c1f, roughness: 0.6 });
      mon.add(new THREE.Mesh(mergeGeometries([box(-0.12, 0, -0.1, 0.12, 0.015, 0.08), box(-0.025, 0, -0.06, 0.025, 0.3, -0.03), box(-0.33, 0.12, -0.04, 0.33, 0.52, 0)]), mDark));
      const codeMat = new THREE.MeshBasicMaterial({ map: codeTex(), toneMapped: false });
      screenMats.push(codeMat);
      mon.add(new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.375).translate(0, 0.32, 0.002), codeMat));
      toHim(mon, -0.45); // and a little toward the window, as he has it
      holder.add(mon);
      // hands on the middle laptop's keys: upper arms down and forward, forearms to the keys
      const keys = V(0, DESK + 0.03, l2.position.z + 0.04);
      for (const [side, x] of [['Left', 1], ['Right', -1]]) {
        aim(b(`${side}Arm`), b(`${side}ForeArm`), V(0.14 * x, -0.8, 0.6));
        const el = wp(b(`${side}ForeArm`));
        aim(b(`${side}ForeArm`), b(`${side}Hand`), keys.clone().add(V(0.08 * x, 0, 0)).sub(el));
        aim(b(`${side}Hand`), b(`${side}Hand`).children[0], V(0, -0.25, 1));
      }
      aim(b('Head'), b('head_end'), V(0, 1, -0.3)); // looks at the screens
      // the screens' lamp: between the screens and his face
      holder.position.copy(SEAT);
      holder.rotation.y = FACE;
      root.add(holder);
      holder.updateMatrixWorld(true);
      lampsLocal[0].copy(root.worldToLocal(holder.localToWorld(V(-0.15, DESK + 0.32, hips.z + 0.42))));
      holder.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = false;
        o.renderOrder = -2;
        o.frustumCulled = false;
      });
      // the head turns about the vertical and nods about his side axis; in the
      // head bone's own frame (the parent does not move)
      const keep = (o) => (o ? [o, o.quaternion.clone()] : null);
      const hb = b('Head');
      const pInv = hb.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const rq = root.getWorldQuaternion(new THREE.Quaternion()).multiply(holder.quaternion);
      bones = {
        arms: [keep(b('LeftForeArm')), keep(b('RightForeArm')), keep(b('LeftHand')), keep(b('RightHand'))].filter(Boolean),
        head: keep(hb),
        up: V(0, 1, 0).applyQuaternion(rq).applyQuaternion(pInv).normalize(),
        side: V(1, 0, 0).applyQuaternion(rq).applyQuaternion(pInv).normalize(),
      };
      state = 'ready';
    } catch (e) {
      console.warn('[braga] window coder:', e);
      state = 'failed';
    }
  }

  scene.add(root);

  // ---- typing, a slow nod, now and then a glance at the window
  const _t = new THREE.Quaternion(), _u = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  function animate() {
    if (!bones) return;
    bones.arms.forEach(([bone, q0], i) => {
      const k = i < 2 ? 0.035 : 0.12;
      const s = Math.sin(clock * (i % 2 ? 19 : 23) + i * 1.7) * Math.max(0, Math.sin(clock * 0.9 + i)) * k;
      bone.quaternion.copy(q0).multiply(_t.setFromAxisAngle(i < 2 ? Z : X, s));
    });
    if (bones.head) {
      const [h, q0] = bones.head;
      // the glance: every 11 s, 2 s toward the window (his left)
      const ph = clock % 11;
      const glance = ph > 8 ? Math.sin(((ph - 8) / 3) * Math.PI) ** 2 : 0;
      const yaw = 0.05 * Math.sin(clock * 0.7) + 0.85 * glance;
      const nod = 0.04 * Math.sin(clock * 1.3) - 0.12 * glance;
      h.quaternion.copy(q0).premultiply(_u.setFromAxisAngle(bones.side, nod)).premultiply(_t.setFromAxisAngle(bones.up, yaw));
    }
  }

  // ---- the light: lamps to view space, the night makes it all warmer
  const _l = new THREE.Vector3();
  const SHEEN = new THREE.Color(0xa9bfd4), WARM = new THREE.Color(0xffc27a);
  function light(dist) {
    const night = THREE.MathUtils.clamp(getNight() || 0, 0, 1);
    const day = 1 - night;
    // by day the room must still read as lit against a sunny facade
    // and at night against the facade's lit windows
    const k = [2.6 + 1.4 * night, 3.0 + 2.6 * night, 1.4 * day];
    root.updateMatrixWorld();
    for (let i = 0; i < 3; i++) {
      _l.copy(lampsLocal[i]);
      root.localToWorld(_l).applyMatrix4(camera.matrixWorldInverse);
      U.uLampPos.value[i].copy(_l);
      U.uLampCol.value[i].copy(LAMP_COL[i]).multiplyScalar(k[i]);
    }
    U.uAmb.value.setRGB(0.12 + 0.02 * day, 0.09 + 0.025 * day, 0.07 + 0.03 * day);
    curtainMat?.color.setScalar(1.0 + 0.6 * night);
    for (const m of screenMats) m.color?.setScalar(0.85 + 0.15 * night);
    // the glass: a sky sheen up close; from afar (the map) the room is a few
    // pixels, so the pane takes the room's mean warm light, as the facade's
    // own lit windows do
    if (glassMat) {
      const far = THREE.MathUtils.smoothstep(dist, 35, 110);
      glassMat.color.lerpColors(SHEEN, WARM, far);
      glassMat.opacity = (0.06 * day + 0.02) * (1 - far) + far * (0.3 + 0.45 * night);
    }
    if (haloMat) haloMat.opacity = 0.03 + 0.17 * night;
  }

  // ---- walk mode prompt
  let promptEl = null;
  function prompt(show) {
    if (!show && !promptEl) return;
    if (!promptEl) {
      promptEl = document.createElement('button');
      promptEl.type = 'button';
      promptEl.className = 'bc-prompt';
      promptEl.textContent = `T · ${t('Поговорить с кодером')}`;
      promptEl.addEventListener('click', () => open());
      document.body.appendChild(promptEl);
    }
    promptEl.hidden = !show;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || !promptEl || promptEl.hidden || isOpen()) return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    open();
  });
  // metres out of the window's wall (negative: behind it, inside the tower)
  const _o = new THREE.Vector3();
  const outOfWall = (p) => root.worldToLocal(_o.set(p.x, win.y, p.z)).z;

  // ---- chat panel (built the first time it opens)
  let panel = null;
  let replier = null;
  let thinking = false;
  let lastFocus = null;
  const isOpen = () => !!panel && !panel.hidden;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function line(cls, mark, text) {
    const el = document.createElement('div');
    el.className = `bc-line ${cls}`;
    const m = document.createElement('span');
    m.className = 'bc-mark';
    m.setAttribute('aria-hidden', 'true');
    m.textContent = mark;
    const s = document.createElement('span');
    s.className = 'bc-text';
    s.textContent = text;
    el.append(m, s);
    return el;
  }
  function addLine(el) {
    const log = panel.querySelector('.bc-log');
    log.insertBefore(el, log.querySelector('.bc-cursor'));
    log.scrollTop = log.scrollHeight;
  }
  function say(r, after) {
    thinking = true;
    const think = line('bc-think', '✻', t('думает…'));
    think.setAttribute('aria-hidden', 'true');
    addLine(think);
    panel.querySelector('.bc-cursor').hidden = true;
    const spin = ['·', '✢', '✳', '✶', '✻', '✽'];
    let i = 0;
    const timer = reduced ? 0 : setInterval(() => (think.firstChild.textContent = spin[++i % spin.length]), 110);
    setTimeout(() => {
      clearInterval(timer);
      think.remove();
      // ⏺ is drawn by CSS (.bc-rec): few fonts have U+23FA, and the
      // fallback shows a smaller ● or a box
      const el = line('bc-him', '', r.text);
      el.firstChild.classList.add('bc-rec');
      el.lang = r.lang === 'pt' ? 'pt-PT' : r.lang;
      addLine(el);
      panel.querySelector('.bc-cursor').hidden = false;
      thinking = false;
      after?.();
    }, 300 + Math.random() * 600);
  }

  // ---- the live bridge (api/coder.js). One question on the first open: is
  // it set up? If not (or the site has no /api), nothing more is sent and the
  // chat is scripted as before. If so, each message is POSTed, the panel
  // polls for his replies while it is open (POLL_FOR_MS after the last
  // message), and the scripted reply comes after LIVE_WAIT_MS without one.
  const API = '/api/coder';
  const NOTE_OFF = 'Пасхалка: ответы написаны заранее, без сервера и без ИИ.';
  const NOTE_LIVE = 'Сообщения уходят ему в Telegram, не пишите личных данных. Если он не ответит, ответят заготовки.';
  const LIVE_WAIT_MS = 12e3;
  const POLL_MS = 4e3;
  const POLL_FOR_MS = 180e3;
  let live = null; // null: not asked yet, false: off, true: on
  let sid = '';
  let pollAfter = 0; // unix s: replies newer than the first message of this visit
  let pollUntil = 0;
  let pollTimer = 0;
  let polling = false;
  let lastLiveAt = 0;
  const seenLive = new Set();

  function sessionId() {
    const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
    try {
      let s = localStorage.getItem('bc-sid');
      if (!/^[a-z0-9]{8,16}$/.test(s || '')) localStorage.setItem('bc-sid', (s = fresh()));
      return s;
    } catch {
      return fresh(); // no storage: one id for this page
    }
  }
  async function api(query = '', init = {}) {
    const r = await fetch(API + query, { ...init, signal: AbortSignal.timeout(8000) });
    return r.json();
  }
  function probe() {
    live = false;
    api()
      .then((j) => {
        live = j?.on === true;
        if (live && panel) panel.querySelector('.bc-note').textContent = t(NOTE_LIVE);
      })
      .catch(() => {});
  }
  function showLive(text) {
    const el = line('bc-him bc-live', '', text);
    el.firstChild.classList.add('bc-rec');
    const badge = document.createElement('span');
    badge.className = 'bc-badge';
    badge.textContent = t('вживую');
    el.insertBefore(badge, el.lastChild);
    addLine(el);
  }
  async function poll() {
    if (!isOpen() || Date.now() > pollUntil) return stopPolling();
    if (polling) return;
    polling = true;
    const j = await api(`?sid=${sid}&after=${pollAfter}`).catch(() => null);
    polling = false;
    for (const r of j?.replies || []) {
      const key = `${r.date}|${r.text}`;
      if (seenLive.has(key) || typeof r.text !== 'string') continue;
      seenLive.add(key);
      lastLiveAt = Date.now();
      pollUntil = Math.max(pollUntil, lastLiveAt + 60e3); // he is there: listen a while longer
      if (panel) showLive(r.text);
    }
  }
  function startPolling() {
    if (pollTimer || !isOpen() || Date.now() > pollUntil) return;
    pollTimer = setInterval(poll, POLL_MS);
  }
  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = 0;
  }
  function sendLive(text) {
    thinking = true; // one message at a time while it posts
    api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sid, text, lang: language, city }) })
      .catch(() => null)
      .then((j) => {
        thinking = false;
        if (!j?.ok) return say(replier.reply(text)); // off, refused, or down: as before
        addLine(line('bc-sys', '⎿', t('отправлено ему в Telegram — он может ответить вживую')));
        const sentAt = Date.now();
        if (!pollAfter) pollAfter = Math.max(0, Math.floor(Number(j.date) || sentAt / 1000) - 2);
        pollUntil = sentAt + POLL_FOR_MS;
        startPolling();
        setTimeout(() => {
          if (lastLiveAt < sentAt) say(replier.reply(text));
        }, LIVE_WAIT_MS);
      });
  }

  function build() {
    panel = document.createElement('section');
    panel.className = 'bc-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'bc-title');
    panel.innerHTML = `
      <header class="bc-head">
        <span class="bc-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h2 id="bc-title" class="bc-title"></h2>
        <button type="button" class="bc-close">×</button>
      </header>
      <p class="bc-note"></p>
      <div class="bc-log" role="log" aria-live="polite"><span class="bc-cursor" aria-hidden="true"></span></div>
      <form class="bc-form">
        <span class="bc-prompt-mark" aria-hidden="true">&gt;</span>
        <input class="bc-input" type="text" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" />
        <button type="submit" class="bc-send"></button>
      </form>`;
    panel.querySelector('.bc-title').textContent = `✻ ${t('Кодер у окна')}`;
    panel.querySelector('.bc-note').textContent = t(live ? NOTE_LIVE : NOTE_OFF);
    panel.querySelector('.bc-log').setAttribute('aria-label', t('Переписка'));
    const close = panel.querySelector('.bc-close');
    close.setAttribute('aria-label', t('Закрыть (Esc)'));
    close.title = t('Закрыть (Esc)');
    close.addEventListener('click', () => hide());
    const input = panel.querySelector('.bc-input');
    input.placeholder = t('Напишите ему…');
    input.setAttribute('aria-label', t('Сообщение кодеру'));
    panel.querySelector('.bc-send').textContent = t('Отправить');
    panel.querySelector('.bc-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || thinking) return;
      input.value = '';
      addLine(line('bc-you', '>', text));
      if (live) sendLive(text);
      else say(replier.reply(text));
    });
    // Esc closes; Tab stays inside the panel
    panel.addEventListener('keydown', (e) => {
      e.stopPropagation(); // walk mode and the map keys stay out while it is open
      if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      } else if (e.key === 'Tab') {
        const items = [...panel.querySelectorAll('button, input')].filter((el) => !el.disabled);
        const i = items.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
        e.preventDefault();
        items[next].focus();
      }
    });
    document.body.appendChild(panel);
    replier = createReplier({ siteLang: language });
    sid = sessionId();
    probe();
  }

  function open() {
    if (!panel) build();
    if (isOpen()) return;
    lastFocus = document.activeElement;
    panel.hidden = false;
    document.body.classList.add('bc-open');
    prompt(false);
    if (!panel.querySelector('.bc-him')) say(replier.open());
    panel.querySelector('.bc-input').focus({ preventScroll: true });
    startPolling(); // back within the window: listen again
  }
  function hide() {
    if (!isOpen()) return;
    stopPolling();
    panel.hidden = true;
    document.body.classList.remove('bc-open');
    if (lastFocus?.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  return {
    root,
    seat, // the window's middle, world units, and the wall's outward normal
    get ready() {
      return state === 'ready';
    },
    get state() {
      return { load: state, visible: root.visible, open: isOpen(), prompt: !!promptEl && !promptEl.hidden };
    },
    update(dt) {
      const dx = camera.position.x - seat.x, dz = camera.position.z - seat.z;
      const d = Math.hypot(dx, dz) / S; // metres
      if (d > LOAD_M || isHidden()) {
        if (root.visible) root.visible = false;
        prompt(false);
        return;
      }
      if (state === 'idle') load();
      root.visible = d < SHOW_M && state !== 'idle';
      const walk = getWalk();
      if (walk?.active) {
        const w = walk.position;
        prompt(Math.hypot(w.x - seat.x, w.z - seat.z) / S < TALK_M && outOfWall(w) > 0.5 && !isOpen());
      } else prompt(false);
      if (!root.visible) return;
      light(d);
      if (d < ANIM_M && state === 'ready') {
        clock += dt;
        animate();
      }
    },
    // map mode: a click ray (main.js); true when it hit the window and the
    // panel opened. Only from the window's side: a ray from behind the wall
    // would pass through the tower.
    pick(raycaster) {
      if (!root.visible || !proxy) return false;
      if (outOfWall(raycaster.ray.origin) < 1) return false;
      if (!raycaster.intersectObject(proxy, false).length) return false;
      open();
      return true;
    },
    // tests: the screen point of the window, NDC
    screen() {
      return new THREE.Vector3(win.x, win.y, win.z).project(camera);
    },
    open,
    close: hide,
  };
}

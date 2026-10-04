// Azulejo — the discovery game mode (src/main.js startMode('game')).
//
// A drone's-eye hunt over the real city. The map starts in fog of war; the
// player flies the free-fly camera (camera.js / fly.js) and searches for
// six glowing azulejo shards, one hidden above each landmark. Getting close
// charges a scan; a completed scan delivers the shard with a burst, a
// chime and a combo. Collect all six and the lost mural fills in.
//
// This file owns the state machine, the beacons and the reveal; the HUD
// (game-hud.js), sound (game-audio.js), particles (game-vfx.js), save
// (game-progress.js) and the fog shader (scene.js createShroud) are
// separate. It reads the camera every frame, never writes it, so the
// player keeps full control of the flight.
import * as THREE from 'three';
import { t, language } from './i18n.js';
import { assetUrl } from './data.js';
import { METRES_PER_UNIT } from './geo.js';
import { MIN_DISTANCE } from './camera.js';
import { createShroud } from './scene.js';
import { createGameHud } from './game-hud.js';
import { createGameAudio } from './game-audio.js';
import { createGameVfx } from './game-vfx.js';
import { createGameProgress } from './game-progress.js';

const S = METRES_PER_UNIT; // 1 world unit = 4 m
const UP = new THREE.Vector3(0, 1, 0);
const LEVEL_STEP = 300; // score per level
const ECHO_CD = 12; // seconds between echo pulses
const RING_PASS = 13; // fly within this many units of a ring to clear it
const FRAG_COUNT = 110; // scattered exploration pickups
const FRAG_R = 16; // pickup radius, world units
const BASE_FOV = 38;
const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'Space', 'ShiftLeft', 'ShiftRight']);

// deterministic RNG for fragment placement (same city, same scatter)
function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A flat tile placeholder while a generated PNG loads (or if it is
// missing): a blue field, a gold frame and the shard's initial letter.
function fallbackTile(letter) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#123a6b';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#d8b25a';
  g.lineWidth = 12;
  g.strokeRect(14, 14, 228, 228);
  g.fillStyle = '#e8cf8a';
  g.font = 'bold 150px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 128, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGame(ctx) {
  const { scene, camera, rig, heightAt, items, terrain, sky, roads, project, atmosphere, ui, reducedMotion, debug, setHash } = ctx;
  const cityId = ctx.city || 'braga';
  const byId = new Map(items.map((it) => [it.data.id, it]));

  const hud = createGameHud({ onExit: () => stop(), onGo: () => goToTarget(), onAction: (act) => action(act) });
  const audio = createGameAudio();
  const vfx = createGameVfx({ scene });
  const progress = createGameProgress(cityId);
  const shroud = createShroud(terrain.bounds, { size: 256 });

  const group = new THREE.Group();
  group.name = 'game-beacons';
  scene.add(group);

  // A tall, thin golden column over the current target: a waypoint visible
  // through the fog from across the city, so you always know where to fly.
  const waypoint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
  );
  waypoint.name = 'game-waypoint';
  waypoint.renderOrder = 17;
  waypoint.visible = false;
  group.add(waypoint);

  let config = null;
  let loading = null;
  let shards = []; // { def, item, pos, sprite, glow, beam, ring, found }
  let active = false;
  let score = 0;
  let level = 1;
  let combo = 1;
  let comboT = 0;
  let lastCollect = -Infinity;
  let scanning = null; // { id, t }
  let target = -1; // index of the shard the clue points at
  let savedTime = null;
  let orbit = false; // circling the current target (OrbitControls autoRotate)
  let overview = false; // parked at the city overview
  let prevPose = null; // where to return from the overview
  let echoCd = 0; // echo pulse cooldown, seconds
  let rasanteAcc = 0; // low-fly bonus accumulator
  let discoveryT = 0;
  let prevShroudY = 1; // fog darkness saved while the overview is open
  let rings = []; // sky-ring chain toward the target
  let ringChain = 0; // rings cleared in the current chain
  let ringsFor = -1; // target index the chain was built for
  let fragGroup = null; // exploration pickups (Points)
  let fragPos = null; // Float32Array of their positions
  let fragTaken = null; // Uint8Array flags
  let fragCount = 0;
  let labelT = 0; // throttles the label reveal

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const distM = (a, b) => a.distanceTo(b) * S;

  async function loadConfig() {
    if (config) return config;
    if (loading) return loading;
    loading = fetch(assetUrl('data/game.json'), { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        config = json;
        build(json);
        return config;
      })
      .catch((err) => {
        console.warn('[braga] game data failed, using a built-in set', err);
        config = builtinConfig();
        build(config);
        return config;
      });
    return loading;
  }

  // Fallback if data/game.json will not load: the same six shards, no text.
  function builtinConfig() {
    return {
      start_landmark: 'se-braga',
      start_distance_m: 220,
      start_height_m: 70,
      reveal_radius_m: 340,
      scan_radius_m: 95,
      scan_hold_s: 1.3,
      combo_window_s: 9,
      shards: ['se-braga', 'arco-porta-nova', 'torre-menagem', 'estadio-braga', 'bom-jesus', 'sameiro'].map((id) => ({
        id,
        landmark_id: id,
        tile: `assets/game/shard-${id}.jpg`,
        name_ru: id,
        clue_ru: 'Найдите осколок.',
        lore_ru: '',
        points: 100,
      })),
    };
  }

  const pick = (o, key) => o?.[`${key}_${language}`] || o?.[`${key}_ru`] || '';

  function build(cfg) {
    const palette = [0xffd27a, 0x9fd0ff, 0xf0c46a, 0x8ec5ff, 0xffe19a, 0xbcd8ff];
    shards = cfg.shards
      .map((def, i) => {
        const item = byId.get(def.landmark_id);
        if (!item) {
          console.warn(`[braga] game shard "${def.id}": no landmark ${def.landmark_id}`);
          return null;
        }
        const x = item.center.x;
        const z = item.center.z;
        const ground = Math.max(heightAt(x, z), item.base ?? heightAt(x, z));
        const y = (item.top ?? ground + 20) + 6;
        const pos = new THREE.Vector3(x, y, z);

        const tex = fallbackTile((pick(def, 'name') || def.id).slice(0, 1).toUpperCase());
        const holder = { def, item, pos, index: i, color: palette[i % palette.length], tex, sprite: null, glow: null, beam: null, ring: null, found: progress.has(def.id) };

        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(6, 6, 1);
        sprite.position.copy(pos);
        sprite.renderOrder = 20;
        holder.sprite = sprite;

        const glowMat = new THREE.SpriteMaterial({ map: radialGlow(), color: holder.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0.34 });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(13, 13, 1);
        glow.position.copy(pos);
        glow.renderOrder = 19;
        holder.glow = glow;

        const height = Math.max(pos.y - ground, 6);
        const beamMat = new THREE.MeshBasicMaterial({ color: holder.color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, height, 8, 1, true), beamMat);
        beam.position.set(x, ground + height / 2, z);
        beam.renderOrder = 18;
        holder.beam = beam;

        const ringMat = new THREE.MeshBasicMaterial({ color: holder.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(8, 10, 40), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, ground + 0.6, z);
        ring.renderOrder = 17;
        holder.ring = ring;

        group.add(sprite, glow, beam, ring);
        sprite.userData.shard = holder;
        return holder;
      })
      .filter(Boolean);
    // the HUD panel follows the final shard list
    hud.setShards(shards.map((s) => ({ id: s.def.id, tile: assetUrl(s.def.tile) })));
    for (const s of shards) if (s.found) hud.found(s.index);
    loadTextures();
    updateTarget();
    buildFragments();
  }

  function loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const s of shards) {
      const url = assetUrl(s.def.tile);
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          s.tex.dispose();
          s.sprite.material.map = tex;
          s.sprite.material.needsUpdate = true;
          s.tex = tex;
        },
        undefined,
        () => {},
      );
    }
  }

  function radialGlow() {
    if (radialGlow.tex) return radialGlow.tex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    radialGlow.tex = tex;
    return tex;
  }
  radialGlow.tex = null;

  function startPos() {
    const it = byId.get(config?.start_landmark) || shards[0]?.item || items[0];
    if (!it) return null;
    const d = (config?.start_distance_m ?? 220) / S;
    const h = (config?.start_height_m ?? 70) / S;
    const px = it.center.x + Math.sin(it.viewBearing ?? 0) * d;
    const pz = it.center.z + Math.cos(it.viewBearing ?? 0) * d;
    return { pos: new THREE.Vector3(px, Math.max(heightAt(px, pz) + h, it.top + h), pz), look: it.center.clone() };
  }

  function updateTarget() {
    target = shards.findIndex((s) => !s.found);
    const s = target >= 0 ? shards[target] : null;
    if (!s) {
      waypoint.visible = false;
      return;
    }
    const ground = heightAt(s.pos.x, s.pos.z);
    const top = Math.max(s.pos.y, ground) + 72;
    const height = Math.max(top - ground, 20);
    waypoint.scale.y = height;
    waypoint.position.set(s.pos.x, ground + height / 2, s.pos.z);
    waypoint.visible = true;
  }

  // Fly the drone to a shard (the touch-screen "go" button, and tests).
  // The camera lands inside the scan radius, so the scan then completes on
  // its own. Keyboard players fly by hand instead.
  function goToTarget(id) {
    const s = (id != null && shards.find((x) => x.def.id === id)) || (target >= 0 ? shards[target] : null);
    if (!s) return false;
    const to = s.pos.clone().add(new THREE.Vector3(0, 2, 12));
    rig.flyTo(to, s.pos.clone(), 0.6);
    return true;
  }

  function foundCount() {
    return shards.filter((s) => s.found).length;
  }

  // ------------------------------------------------------------ sky rings
  // A chain of glowing rings arcs from where the player is to the current
  // target, lifted over the roofs (tour.js skyline). Flying through a ring
  // clears it for points and keeps the chain alive; clearing the whole chain
  // pays a bonus. Optional by design: the trail is a guide and a skill line,
  // never a wall.
  function clearRings() {
    for (const r of rings) {
      group.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    rings = [];
    ringChain = 0;
    hud.setRings(0, 0);
  }

  function buildRings(sArg) {
    clearRings();
    const s = sArg || (target >= 0 ? shards[target] : null);
    if (!s || !active) return;
    const from = camera.position.clone();
    const to = s.pos.clone();
    const dist = from.distanceTo(to);
    if (dist < 60) return;
    const count = reducedMotion ? 5 : Math.max(5, Math.min(11, Math.round(dist / 42)));
    const pts = [];
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      const roof = Math.max(heightAt(x, z), sky?.at(x, z, 8) ?? 0);
      const lift = reducedMotion ? 0 : Math.sin(Math.PI * t) * 22;
      const y = Math.max(roof + 10, from.y + (to.y - from.y) * t) + lift;
      pts.push(new THREE.Vector3(x, y, z));
    }
    pts.forEach((p, i) => {
      const nxt = pts[i + 1] || to;
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(9, 0.55, 8, 44),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      );
      mesh.position.copy(p);
      mesh.lookAt(nxt);
      mesh.renderOrder = 16;
      group.add(mesh);
      rings.push({ mesh, pos: p, passed: false });
    });
    hud.setRings(0, rings.length);
  }

  function passRing(r) {
    r.passed = true;
    r.mesh.scale.setScalar(1);
    r.mesh.material.opacity = 0.14;
    r.mesh.material.color.setHex(0x6fbf6a);
    ringChain++;
    const delta = Math.round(28 * (1 + 0.18 * ringChain));
    addScore(delta);
    hud.setScore(score, delta);
    audio.ring(ringChain);
    vfx.burst(r.pos.x, r.pos.y, r.pos.z, { color: 0x9fd0ff, count: 32, spread: 10, up: 4 });
    const done = rings.filter((x) => x.passed).length;
    hud.setRings(done, rings.length);
    if (done === rings.length) {
      addScore(150);
      hud.setScore(score, 150, t('ЦЕПОЧКА'));
      audio.chain();
      hud.banner(t('Цепочка!'));
      vibrate(25);
    }
  }

  // ------------------------------------------------------------ fragments
  // Small glowing motes scattered across the city, so wandering through the
  // fog is itself rewarded (not just the six shards). They are drawn as one
  // additive Points cloud (one draw call) and only read well up close, so
  // they invite low, exploratory flying rather than showing the whole map.
  function buildFragments() {
    if (fragGroup) {
      group.remove(fragGroup);
      fragGroup.geometry.dispose();
      fragGroup.material.dispose();
      fragGroup = null;
    }
    if (!shards.length) return;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const s of shards) {
      x0 = Math.min(x0, s.pos.x);
      x1 = Math.max(x1, s.pos.x);
      z0 = Math.min(z0, s.pos.z);
      z1 = Math.max(z1, s.pos.z);
    }
    const pad = 340;
    x0 -= pad;
    x1 += pad;
    z0 -= pad;
    z1 += pad;
    const pos = new Float32Array(FRAG_COUNT * 3);
    const col = new Float32Array(FRAG_COUNT * 3);
    fragTaken = new Uint8Array(FRAG_COUNT);
    const rng = mulberry32(0x5eed);
    // candidates: real street vertices inside the play area, so the sparks
    // line the roads the player actually flies (falls back to a scatter)
    const cand = [];
    const feats = roads?.features;
    if (Array.isArray(feats) && typeof project === 'function') {
      const step = Math.max(1, Math.floor(feats.length / (FRAG_COUNT * 6)));
      for (let k = 0; k < feats.length && cand.length < FRAG_COUNT * 8; k += step) {
        const pts = feats[k].pts;
        if (!pts || !pts.length) continue;
        const q = pts[Math.floor(rng() * pts.length)];
        const p = project(q[0], q[1]);
        if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
        cand.push(p);
      }
    }
    for (let i = 0; i < FRAG_COUNT; i++) {
      let x;
      let z;
      if (cand.length) {
        const p = cand[Math.min(cand.length - 1, Math.floor((i / FRAG_COUNT) * cand.length))];
        x = p.x;
        z = p.z;
      } else {
        x = x0 + (x1 - x0) * rng();
        z = z0 + (z1 - z0) * rng();
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = heightAt(x, z) + 1.7 + rng() * 3.5;
      pos[i * 3 + 2] = z;
      col[i * 3] = 1;
      col[i * 3 + 1] = 0.82;
      col[i * 3 + 2] = 0.42;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), x1 - x0);
    const mat = new THREE.PointsMaterial({
      size: 2.4,
      sizeAttenuation: true,
      map: radialGlow(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    fragGroup = new THREE.Points(geo, mat);
    fragGroup.name = 'game-fragments';
    fragGroup.frustumCulled = false;
    fragGroup.renderOrder = 15;
    group.add(fragGroup);
    fragPos = pos;
    fragCount = 0;
    hud.setFragments(0);
  }

  function checkFragments() {
    if (!fragPos) return;
    const cam = camera.position;
    for (let i = 0; i < FRAG_COUNT; i++) {
      if (fragTaken[i]) continue;
      const dx = fragPos[i * 3] - cam.x;
      const dy = fragPos[i * 3 + 1] - cam.y;
      const dz = fragPos[i * 3 + 2] - cam.z;
      if (dx * dx + dy * dy + dz * dz > FRAG_R * FRAG_R) continue;
      fragTaken[i] = 1;
      fragCount++;
      const c = fragGroup.geometry.attributes.color;
      c.array[i * 3] = c.array[i * 3 + 1] = c.array[i * 3 + 2] = 0; // additive: 0 = gone
      c.needsUpdate = true;
      addScore(12);
      hud.setScore(score, 12);
      hud.setFragments(fragCount);
      audio.ring(2 + (fragCount % 5));
      vfx.burst(fragPos[i * 3], fragPos[i * 3 + 1], fragPos[i * 3 + 2], { color: 0xffd27a, count: 16, spread: 5, up: 3 });
      shroud.stamp(fragPos[i * 3], fragPos[i * 3 + 2], 95);
      if (fragCount % 6 === 0) echoCd = Math.max(0, echoCd - 4); // a little echo back
    }
  }

  // Hide landmark labels under the fog; they fade in as their area is
  // uncovered, so the city is genuinely discovered. The current target
  // always stays visible.
  function updateLabels() {
    for (const it of items) {
      if (!it.labelEl) continue;
      const isTarget = target >= 0 && shards[target]?.item === it;
      const revealed = shroud.revealAt(it.center.x, it.center.z) > 0.5;
      it.labelEl.classList.toggle('is-unexplored', !revealed && !isTarget);
    }
  }

  const levelFor = (s) => 1 + Math.floor(s / LEVEL_STEP);
  function addScore(delta) {
    if (!delta) return;
    score += delta;
    progress.setScore(score, combo);
    const next = levelFor(score);
    if (next > level) {
      level = next;
      audio.levelUp();
      hud.banner(`${t('Уровень')} ${level}`);
      vibrate([15, 30, 15]);
    }
    hud.setLevel(level, (score % LEVEL_STEP) / LEVEL_STEP);
  }

  function vibrate(pattern) {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // haptics may be blocked; ignore
    }
  }

  // Fast collection earns a medal and a bonus; the combo window makes this
  // a running chase rather than a leisurely sightseeing game.
  function medalFor(elapsed) {
    if (elapsed < 9) return { rank: 'gold', label: t('ЗОЛОТО'), bonus: 120 };
    if (elapsed < 18) return { rank: 'silver', label: t('СЕРЕБРО'), bonus: 60 };
    return { rank: 'bronze', label: t('БРОНЗА'), bonus: 0 };
  }

  // Park the camera circling the current target; autoRotate spins it. Any
  // flight key or another ability cancels it (camera.js owns the controls).
  function stopOrbit() {
    if (!orbit) return;
    orbit = false;
    rig.controls.autoRotate = false;
    hud.setAbility('orbit', false);
  }
  function startOrbit() {
    const s = target >= 0 ? shards[target] : null;
    if (!s) return;
    const a = performance.now() / 1400;
    const at = s.pos.clone().add(new THREE.Vector3(Math.sin(a) * 20, 7, Math.cos(a) * 20));
    rig.flyTo(at, s.pos.clone(), 0.6);
    orbit = true;
    rig.controls.autoRotate = true;
    rig.controls.autoRotateSpeed = 1.1;
    hud.setAbility('orbit', true);
    hud.banner(t('Облёт цели'));
  }

  // Birds-eye over the whole city, and back. Uses the map's home view and
  // lifts the fog while it is open, so this doubles as the strategic map.
  function toggleOverview() {
    stopOrbit();
    if (overview && prevPose) {
      rig.flyTo(prevPose.pos, prevPose.target, 1.2);
      overview = false;
      shroud.params.y = prevShroudY;
      hud.setAbility('overview', false);
      return;
    }
    prevPose = { pos: camera.position.clone(), target: rig.controls.target.clone() };
    prevShroudY = shroud.params.y;
    shroud.params.y = 0.22; // see the whole city from above
    const hp = ctx.home?.position;
    const ht = ctx.home?.target;
    if (hp && ht) {
      rig.flyTo(hp.clone(), ht.clone(), 1.6);
    } else {
      const p = camera.position.clone();
      p.y = heightAt(p.x, p.z) + 520;
      rig.flyTo(p, camera.position.clone().setY(heightAt(camera.position.x, camera.position.z)), 1.4);
    }
    overview = true;
    hud.setAbility('overview', true);
    hud.banner(t('Весь город'));
  }

  // Echo pulse: reveal a wide circle around the player and the target, so a
  // lost shard comes back into sight. Cooldown keeps it a decision.
  function echo() {
    if (echoCd > 0) return;
    echoCd = ECHO_CD;
    audio.echo();
    vibrate(30);
    const r = 820 / S;
    shroud.stamp(camera.position.x, camera.position.z, r);
    if (target >= 0) shroud.stamp(shards[target].pos.x, shards[target].pos.z, r);
    shroud.flush();
    vfx.burst(camera.position.x, camera.position.y, camera.position.z, { color: 0x6fb0ff, count: 140, spread: 46, up: 4 });
    hud.banner(t('Эхо!'));
  }

  function action(act) {
    if (act === 'orbit') toggleOrbit();
    else if (act === 'overview') toggleOverview();
    else if (act === 'echo') echo();
    else if (act === 'help') toggleHelp();
    else if (act === 'mute') {
      audio.setMuted(!audio.muted);
      hud.setMuted(audio.muted);
    }
  }
  function toggleOrbit() {
    if (orbit) stopOrbit();
    else startOrbit();
  }
  function toggleHelp() {
    if (hud.helpOpen) hud.hideHelp();
    else hud.showHelp();
  }

  async function start() {
    if (active) return;
    audio.resume();
    active = true;
    ctx.onEnter?.();
    await loadConfig();
    if (!active) return; // stopped while loading
    // a finished mural starts again from the beginning
    if (foundCount() === shards.length) reset();
    savedTime = atmosphere.time;
    ctx.setTime?.('sunset');
    // the map lets the drone swoop in low: the orbit floor drops from 120 m
    // to 40 m so a shard can actually be reached (restored on stop)
    rig.controls.minDistance = 10;
    // plain left-drag turns the view while the game runs
    rig.setGameMode?.(true);
    // clear the fog except the start; stamps reveal as the player flies
    shroud.reset();
    shroud.set(true);
    group.visible = true;
    for (const s of shards) {
      const show = !s.found;
      s.sprite.visible = show;
      s.glow.visible = show;
      s.beam.visible = show;
      s.ring.visible = show;
    }
    score = 0;
    level = 1;
    combo = 1;
    comboT = 0;
    lastCollect = -Infinity;
    scanning = null;
    orbit = false;
    overview = false;
    echoCd = 0;
    rasanteAcc = 0;
    clearRings();
    ringsFor = -1;
    rig.controls.autoRotate = false;
    hud.setScore(0);
    hud.setLevel(1, 0);
    hud.setDiscovery(0);
    hud.setFlight(0, 0, false);
    hud.setEcho(null);
    hud.setAbility('orbit', false);
    hud.setAbility('overview', false);
    hud.setMuted(audio.muted);
    for (const s of shards) if (!s.found) hud.root.querySelector(`.game-tile[data-id="${s.def.id}"]`)?.classList.remove('is-found');
    hud.show();
    const sp = startPos();
    if (sp) {
      rig.flyTo(sp.pos, sp.look, reducedMotion ? 0.4 : 1.6);
      const r = (config?.reveal_radius_m ?? 340) / S;
      shroud.stamp(sp.pos.x, sp.pos.z, r);
      shroud.stamp(sp.pos.x, sp.pos.z, r * 0.5, 1);
      shroud.flush();
      revX = sp.pos.x;
      revZ = sp.pos.z;
    }
    updateTarget();
    buildFragments();
    hud.setBest(progress.state.best);
    audio.startAmbient();
    updateLabels();
    // first visit: show the controls once
    try {
      if (!localStorage.getItem('braga-game-help')) {
        localStorage.setItem('braga-game-help', '1');
        setTimeout(() => {
          if (active) hud.showHelp();
        }, 1100);
      }
    } catch {
      // storage blocked; skip the auto-help
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    stopOrbit();
    overview = false;
    shroud.params.y = 1;
    clearRings();
    ringsFor = -1;
    hud.hide();
    hud.setScan(null);
    scanning = null;
    shroud.set(false);
    group.visible = false;
    rig.controls.minDistance = MIN_DISTANCE;
    rig.setGameMode?.(false);
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
    audio.stopAmbient();
    for (const it of items) it.labelEl?.classList.remove('is-unexplored');
    if (savedTime) ctx.setTime?.(savedTime);
    ctx.onExit?.();
  }

  function collect(s) {
    if (s.found) return;
    s.found = true;
    progress.markFound(s.def.id);
    const now = performance.now() / 1000;
    const elapsed = now - lastCollect;
    combo = elapsed < (config?.combo_window_s ?? 9) ? combo + 1 : 1;
    lastCollect = now;
    comboT = config?.combo_window_s ?? 9;
    const medal = medalFor(elapsed);
    const mult = 1 + 0.35 * (combo - 1);
    const delta = Math.round((s.def.points ?? 100) * mult) + medal.bonus;
    addScore(delta);
    hud.found(s.index);
    hud.setScore(score, delta, medal.label);
    hud.setCombo(combo, 1);
    vfx.burst(s.pos.x, s.pos.y, s.pos.z, { color: s.color, count: 90 });
    audio.pickup(combo);
    audio.medal(medal.rank);
    vibrate([18, 40, 18]);
    s.sprite.visible = false;
    s.glow.visible = false;
    s.beam.visible = false;
    s.ring.visible = false;
    shroud.stamp(s.pos.x, s.pos.z, 120);
    updateTarget();
    if (target < 0) complete();
    else hud.banner(`${t('Осколок найден')} · x${combo}`);
  }

  function complete() {
    audio.complete();
    hud.banner(t('Панно собрано!'));
    hud.setClue({ clue: t('Панно собрано!'), name: '', distanceM: 0, bearing: null });
    hud.finale(assetUrl(config?.mural || 'assets/game/mural.jpg'), score);
    shroud.stamp(0, 0, 1e5); // reveal the whole map
    shroud.flush();
    debug?.game && (debug.game.complete = true);
  }

  let revX = Infinity;
  let revZ = Infinity;
  function revealCamera(force = false) {
    // the scripted flight into the start would paint a long reveal trail;
    // only the player's own flying uncovers the map
    if (!force && rig.flying) return;
    const r = (config?.reveal_radius_m ?? 340) / S;
    const x = camera.position.x;
    const z = camera.position.z;
    if (!force && Math.hypot(x - revX, z - revZ) < r * 0.18) return;
    revX = x;
    revZ = z;
    shroud.stamp(x, z, r);
    shroud.stamp(x, z, r * 0.5, 1);
  }

  function update(dt) {
    if (!active || !shards.length) return;
    revealCamera();
    shroud.flush();

    // animate the beacons: spin, pulse
    const tsec = performance.now() / 1000;
    const camDistTo = (s) => camera.position.distanceTo(s.pos);
    for (const s of shards) {
      if (!s.sprite.visible) continue;
      s.sprite.material.rotation = tsec * 0.6 + s.index;
      const pulse = 0.8 + 0.2 * Math.sin(tsec * 2.2 + s.index);
      s.glow.scale.setScalar(13 * pulse);
      s.glow.material.opacity = 0.3 * pulse;
      s.ring.scale.setScalar(1 + 0.06 * Math.sin(tsec * 2 + s.index));
    }
    if (waypoint.visible) waypoint.material.opacity = reducedMotion ? 0.3 : 0.26 + 0.14 * Math.sin(tsec * 2.4);

    // sky-ring chain: rebuild when the target changes, then run it
    if (!rig.flying && target >= 0 && ringsFor !== target) {
      buildRings();
      ringsFor = target;
    } else if (target < 0 && rings.length) {
      clearRings();
      ringsFor = -1;
    }
    if (rings.length) {
      let active = null;
      for (const r of rings) {
        if (!r.passed) {
          active = r;
          break;
        }
      }
      if (active) {
        if (!reducedMotion) active.mesh.scale.setScalar(0.82 + 0.18 * Math.sin(tsec * 3 + 1));
        active.mesh.material.opacity = 0.72;
        active.mesh.material.color.setHex(0xffd27a);
        if (camera.position.distanceTo(active.pos) < RING_PASS) passRing(active);
      }
    }

    // scan: the nearest uncollected shard inside the scan radius
    const scanR = (config?.scan_radius_m ?? 95) / S;
    let nearest = null;
    let nd = Infinity;
    for (const s of shards) {
      if (s.found) continue;
      const d = camDistTo(s);
      if (d < scanR && d < nd) {
        nd = d;
        nearest = s;
      }
    }
    if (nearest) {
      if (!scanning || scanning.id !== nearest.def.id) scanning = { id: nearest.def.id, t: 0, soundAt: 0 };
      scanning.t += dt;
      const ratio = clamp01(scanning.t / (config?.scan_hold_s ?? 1.3));
      hud.setScan(ratio);
      if (scanning.t - scanning.soundAt > 0.14) {
        scanning.soundAt = scanning.t;
        audio.scan(ratio);
      }
      if (ratio >= 1) {
        hud.setScan(null);
        const s = nearest;
        scanning = null;
        collect(s);
      }
    } else if (scanning) {
      scanning = null;
      hud.setScan(null);
    }

    // combo countdown
    if (combo > 1 && comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) {
        combo = 1;
        comboT = 0;
        hud.setCombo(1, 0);
      } else {
        hud.setCombo(combo, comboT / (config?.combo_window_s ?? 9));
      }
    }

    // clue and compass arrow for the current target
    const ts = target >= 0 ? shards[target] : null;
    if (ts && hud.visible) {
      const d = camDistTo(ts);
      const fwd = new THREE.Vector3().subVectors(rig.controls.target, camera.position).setY(0);
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
      fwd.normalize();
      const dir = new THREE.Vector3().subVectors(ts.pos, camera.position).setY(0).normalize();
      const bearing = Math.atan2(fwd.x * dir.z - fwd.z * dir.x, fwd.x * dir.x + fwd.z * dir.z);
      hud.setClue({ clue: pick(ts.def, 'clue'), name: pick(ts.def, 'name'), distanceM: distM(camera.position, ts.pos), bearing, step: `${t('Осколок')} ${foundCount() + 1}/${shards.length}` });
    }

    // flight readout, and a trickle of points for skimming low and fast
    const fs = rig.flyState;
    const altM = Math.max(0, (camera.position.y - heightAt(camera.position.x, camera.position.z)) * S);
    const kmh = fs.speed * S * 3.6;
    const rasante = !overview && altM < 40 && fs.speed > 20;
    hud.setFlight(kmh, altM, rasante);
    if (rasante) {
      rasanteAcc += dt;
      if (rasanteAcc > 0.4) {
        rasanteAcc = 0;
        score += 2;
        const next = levelFor(score);
        if (next > level) {
          level = next;
          audio.levelUp();
          hud.banner(`${t('Уровень')} ${level}`);
        }
        hud.setScore(score);
        hud.setLevel(level, (score % LEVEL_STEP) / LEVEL_STEP);
      }
    } else {
      rasanteAcc = 0;
    }
    checkFragments();
    // FOV widens with speed, for a sense of rush
    const fovT = BASE_FOV + Math.min(12, fs.speed * 0.05);
    if (Math.abs(camera.fov - fovT) > 0.02) {
      camera.fov += (fovT - camera.fov) * 0.08;
      camera.updateProjectionMatrix();
    }
    // landmarks fade in as their fog is uncovered
    labelT += dt;
    if (labelT > 0.4) {
      labelT = 0;
      updateLabels();
    }

    // echo cooldown
    if (echoCd > 0) {
      echoCd = Math.max(0, echoCd - dt);
      hud.setEcho(echoCd > 0 ? echoCd / ECHO_CD : null);
    }

    // how much of the city is uncovered, a few times a second
    discoveryT += dt;
    if (discoveryT > 1.0) {
      discoveryT = 0;
      hud.setDiscovery(shroud.revealFraction() * 100);
    }

    vfx.update(dt);
    hud.tickScore();
  }

  function onKey(e) {
    if (!active) return false;
    if (e.key === 'Escape') {
      if (hud.helpOpen) {
        hud.hideHelp();
        return true;
      }
      stop();
      return true;
    }
    if (e.code === 'KeyH') {
      toggleHelp();
      return true;
    }
    if (e.code === 'KeyM') {
      action('mute');
      return true;
    }
    if (e.code === 'KeyC') {
      toggleOrbit();
      return true;
    }
    if (e.code === 'KeyV') {
      toggleOverview();
      return true;
    }
    if (e.code === 'KeyX') {
      echo();
      return true;
    }
    // taking the controls by hand ends the scripted orbit / overview
    if (MOVE_CODES.has(e.code)) {
      stopOrbit();
      if (overview) {
        overview = false;
        shroud.params.y = prevShroudY;
        hud.setAbility('overview', false);
      }
    }
    return false;
  }

  function reset() {
    progress.reset();
    for (const s of shards) {
      s.found = false;
      const show = active;
      s.sprite.visible = show;
      s.glow.visible = show;
      s.beam.visible = show;
      s.ring.visible = show;
    }
    if (active) shroud.reset();
    score = 0;
    level = 1;
    combo = 1;
    echoCd = 0;
    overview = false;
    shroud.params.y = 1;
    clearRings();
    ringsFor = -1;
    stopOrbit();
    buildFragments();
    hud.setScore(0);
    hud.setLevel(1, 0);
    hud.setEcho(null);
    updateTarget();
    updateLabels();
  }

  const api = {
    get active() {
      return active;
    },
    start,
    stop,
    update,
    onKey,
    reset,
    goToTarget,
    action,
    toggleOrbit,
    toggleOverview,
    echo,
    // tests/demos: draw a ring chain toward a chosen shard without changing
    // the real target (used by docs/game/game-verify.mjs)
    showRings(id) {
      const s = shards.find((x) => x.def.id === id) || (target >= 0 ? shards[target] : null);
      if (!s) return 0;
      buildRings(s);
      ringsFor = target; // keep the demo chain until the target changes
      return rings.length;
    },
    shardPos(id) {
      return shards.find((x) => x.def.id === id)?.pos.toArray() ?? null;
    },
    // tests: fly the camera onto the i-th spark so it is collected
    visitFragment(i = 0) {
      if (!fragPos || i < 0 || i >= FRAG_COUNT) return false;
      const p = new THREE.Vector3(fragPos[i * 3], fragPos[i * 3 + 1], fragPos[i * 3 + 2]);
      rig.flyTo(p.clone().add(new THREE.Vector3(0, 2, 8)), p, 0.3);
      return true;
    },
    get fragmentCount() {
      return fragCount;
    },
    get helpOpen() {
      return hud.helpOpen;
    },
    // tests: the current clue target and a scripted flight to it
    get targetPos() {
      const s = target >= 0 ? shards[target] : null;
      return s ? s.pos.toArray() : null;
    },
    flyTo(id) {
      return goToTarget(id);
    },
    get state() {
      return {
        active,
        score,
        level,
        combo,
        found: foundCount(),
        total: shards.length,
        target: target >= 0 ? shards[target]?.def.id : null,
        scanning: scanning?.id ?? null,
        orbit,
        overview,
        echoCd: +echoCd.toFixed(2),
        discovered: Math.round(shroud.revealFraction() * 100),
        rings: rings.length,
        ringsDone: rings.filter((r) => r.passed).length,
        fragments: fragCount,
      };
    },
    shroud,
  };
  debug && (debug.game = api);
  return api;
}

// Easter egg: the site's builder sits on a 5th-floor corner balcony of one
// tower with a laptop, coding. Click him on the map, or come near in walk
// mode, and a chat panel styled like a Claude Code terminal opens; his
// replies are scripted (balcony-coder-replies.js), no server and no AI.
//
// The place comes from the city config (cities/<id>.json "balcony_coder"):
// tower: a point inside the footprint, corner: the footprint corner the
// balcony wraps, floor: the storey. A city without it has no coder.
//
// Cost: nothing is drawn or loaded until the camera comes within LOAD_M; the
// balcony, chair and laptop are ~500 triangles, the figure is one crowd
// model posed once (no mixer). Beyond SHOW_M the group is hidden and update()
// is one distance test.
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
const LOAD_M = 400; // the model loads when the camera first comes this near
const ANIM_M = 120; // the hands type within this distance
const TALK_M = 25; // walk mode: the prompt shows within this distance
const STOREY_M = 3.2;
const STREET_UP = 0.12; // as in buildings.js: the ground floor's lift, world units
const OUT = 1.7; // metres the balcony reaches out of each face
const ALONG = 2.6; // metres it runs along each face from the corner

function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// the laptop screen: a few lines of a terminal, drawn once
function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#16181d';
  g.fillRect(0, 0, 128, 80);
  const cols = ['#d97757', '#9fd18b', '#e6e1d6', '#7fb3e6', '#e6e1d6', '#9fd18b', '#d97757'];
  for (let i = 0; i < 7; i++) {
    g.fillStyle = cols[i];
    g.fillRect(8 + (i % 3) * 6, 8 + i * 9.5, 30 + ((i * 37) % 70), 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBalconyCoder({ scene, camera, project, heightAt, footprints, config, getWalk = () => null, isHidden = () => false }) {
  if (!config?.tower || !config?.corner || !Array.isArray(footprints)) return null;
  const tower = project(config.tower[0], config.tower[1]);
  const poly = footprints.find((p) => inPoly(tower.x, tower.z, p));
  if (!poly) {
    console.info('[braga] balcony coder: no footprint at the tower point');
    return null;
  }
  // the corner: the footprint vertex nearest the configured point
  const hint = project(config.corner[0], config.corner[1]);
  const n = poly.length;
  let ci = 0;
  for (let i = 1; i < n; i++) if (Math.hypot(poly[i].x - hint.x, poly[i].z - hint.z) < Math.hypot(poly[ci].x - hint.x, poly[ci].z - hint.z)) ci = i;
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], c = poly[(i + 1) % n];
    area2 += a.x * c.z - c.x * a.z;
  }
  const P = poly[ci];
  let A = poly[(ci + n - 1) % n], B = poly[(ci + 1) % n];
  if (area2 < 0) [A, B] = [B, A]; // positive area: (dz, -dx) is the outward normal
  const outN = (p, q) => {
    const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
    return { x: dz / l, z: -dx / l };
  };
  const u = outN(A, P); // outward of the face before the corner
  const v = outN(P, B); // outward of the face after it
  // the ground floor level, the same rule as extrudeBuilding (buildings.js)
  const gs = poly.map((p) => heightAt(p.x, p.z));
  const low = Math.min(...gs);
  const gmin = Math.min(gs.reduce((s, g) => s + g, 0) / n, low + 0.4) + STREET_UP;
  const floorY = gmin + (config.floor ?? 5) * (config.storeyM ?? STOREY_M) * S;

  // root: metres, local +x along u, local z along ±v
  const root = new THREE.Group();
  root.name = 'balcony-coder';
  root.position.set(P.x, floorY, P.z);
  root.rotation.y = Math.atan2(-u.z, u.x);
  root.scale.setScalar(S);
  root.visible = false;
  const sgn = Math.sin(root.rotation.y) * v.x + Math.cos(root.rotation.y) * v.z >= 0 ? 1 : -1;
  // the figure's seat on the balcony, in world units (for distances)
  const seatA = 0.85, seatB = 0.85;
  const seat = {
    x: P.x + (u.x * seatA + v.x * seatB) * S,
    z: P.z + (u.z * seatA + v.z * seatB) * S,
  };

  let state = 'idle'; // idle | loading | ready | failed
  let bones = null; // { arms: [[bone, baseQuat]], head: [bone, baseQuat] }
  let proxy = null;
  let clock = 0;

  // ---- balcony: an L-shaped slab around the corner and a railing
  function buildBalcony() {
    // a box in (a along u, y, b along v) metres
    const box = (a0, a1, y0, y1, b0, b1) => {
      const g = new THREE.BoxGeometry(a1 - a0, y1 - y0, b1 - b0);
      const bz = (b0 + b1) / 2;
      g.translate((a0 + a1) / 2, (y0 + y1) / 2, sgn * bz);
      return g;
    };
    const slab = [box(0, OUT, -0.22, 0, -ALONG, OUT), box(-ALONG, 0, -0.22, 0, 0, OUT)];
    const rail = [];
    const R = 0.05, H = 1.0;
    // top and middle rails on the two long outer edges and the two short ends
    for (const y of [H - R, 0.48]) {
      rail.push(box(OUT - R, OUT, y, y + R, -ALONG, OUT));
      rail.push(box(-ALONG, OUT, y, y + R, OUT - R, OUT));
      rail.push(box(0, OUT, y, y + R, -ALONG, -ALONG + R));
      rail.push(box(-ALONG, -ALONG + R, y, y + R, 0, OUT));
    }
    const posts = 7;
    for (let i = 0; i <= posts; i++) {
      const s = -ALONG + ((ALONG + OUT) * i) / posts;
      rail.push(box(OUT - 0.04, OUT, 0, H, s - 0.02, s + 0.02));
      rail.push(box(s - 0.02, s + 0.02, 0, H, OUT - 0.04, OUT));
    }
    for (const s of [0.6, 1.2]) {
      rail.push(box(s - 0.02, s + 0.02, 0, H, -ALONG, -ALONG + 0.04));
      rail.push(box(-ALONG, -ALONG + 0.04, 0, H, s - 0.02, s + 0.02));
    }
    const mSlab = new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.9 });
    const mRail = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.6, metalness: 0.3 });
    const s = new THREE.Mesh(mergeGeometries(slab), mSlab);
    const r = new THREE.Mesh(mergeGeometries(rail), mRail);
    s.castShadow = r.castShadow = true;
    s.receiveShadow = true;
    root.add(s, r);
  }

  // ---- the figure: a crowd model posed seated, a chair, a laptop, a mug
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

  async function load() {
    state = 'loading';
    try {
      const gltf = await new GLTFLoader().loadAsync(MODEL);
      const model = fitToHeight(gltf.scene, 1.78);
      const char = new THREE.Group(); // faces +z, metres; posed with no parent
      char.add(model);
      char.updateMatrixWorld(true);
      const b = (name) => model.getObjectByName(name);
      // sit: thighs forward, shins down, feet flat; lean a little in
      aim(b('Spine'), b('Spine01'), V(0, 1, 0.16));
      for (const [side, x] of [['Left', 1], ['Right', -1]]) {
        aim(b(`${side}UpLeg`), b(`${side}Leg`), V(0.08 * x, -0.1, 1));
        aim(b(`${side}Leg`), b(`${side}Foot`), V(0.02 * x, -1, 0.1));
        aim(b(`${side}Foot`), b(`${side}ToeBase`), V(0, -0.35, 1));
      }
      // feet on the floor
      const footY = Math.min(wp(b('LeftFoot')).y, wp(b('RightFoot')).y);
      char.position.y = 0.08 - footY;
      char.updateMatrixWorld(true);
      const hips = wp(b('Hips'));
      const knee = wp(b('LeftLeg')).add(wp(b('RightLeg'))).multiplyScalar(0.5);
      const holder = new THREE.Group();
      holder.add(char);
      // laptop on the thighs, near the knees
      const lap = new THREE.Group();
      lap.position.set(0, knee.y + 0.06, hips.z + (knee.z - hips.z) * 0.62);
      const mBody = new THREE.MeshStandardMaterial({ color: 0x9a9ea6, roughness: 0.4, metalness: 0.6 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.23), mBody);
      const hinge = new THREE.Group();
      hinge.position.set(0, 0.01, 0.115);
      hinge.rotation.x = 0.28; // the lid leans away from him
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.23, 0.012), mBody);
      lid.position.set(0, 0.115, 0);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.2), new THREE.MeshBasicMaterial({ map: screenTexture(), color: 0x8c8c8c, toneMapped: false }));
      glow.position.set(0, 0.115, -0.0065);
      glow.rotation.y = Math.PI;
      hinge.add(lid, glow);
      lap.add(base, hinge);
      base.castShadow = lid.castShadow = true;
      holder.add(lap);
      // hands on the keyboard: upper arms down and a little forward, forearms to the keys
      const keys = V(0, lap.position.y + 0.03, lap.position.z - 0.03);
      for (const [side, x] of [['Left', 1], ['Right', -1]]) {
        aim(b(`${side}Arm`), b(`${side}ForeArm`), V(0.12 * x, -1, 0.42));
        const el = wp(b(`${side}ForeArm`));
        aim(b(`${side}ForeArm`), b(`${side}Hand`), keys.clone().add(V(0.07 * x, 0, 0)).sub(el));
      }
      aim(b('Head'), b('head_end'), V(0, 1, 0.12)); // looks down at the screen
      // chair under the hips
      const mChair = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.8 });
      const seatY = hips.y - 0.1;
      const chair = [new THREE.BoxGeometry(0.44, 0.04, 0.42).translate(0, seatY, hips.z - 0.04)];
      for (const [x, z] of [[-0.19, -0.2], [0.19, -0.2], [-0.19, 0.13], [0.19, 0.13]]) chair.push(new THREE.BoxGeometry(0.035, seatY, 0.035).translate(x, seatY / 2, hips.z + z));
      chair.push(new THREE.BoxGeometry(0.44, 0.42, 0.03).translate(0, seatY + 0.25, hips.z - 0.26));
      const chairMesh = new THREE.Mesh(mergeGeometries(chair), mChair);
      chairMesh.castShadow = true;
      holder.add(chairMesh);
      // a coffee mug by the rail
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5 }));
      mug.position.set(0.42, 0.05, 0.25);
      holder.add(mug);
      // the pick target: invisible, larger than him so a tap on a phone lands
      // (the map's orbit stays 120 m away: there he is ~15 px tall)
      proxy = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 3.2), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.set(0, 1.2, 0.2);
      holder.add(proxy);
      // in the balcony frame: at the seat, facing out of the corner
      holder.position.set(seatA, 0, sgn * seatB);
      holder.rotation.y = Math.atan2(1, sgn);
      root.add(holder);
      const keep = (o) => (o ? [o, o.quaternion.clone()] : null);
      bones = {
        arms: [keep(b('LeftForeArm')), keep(b('RightForeArm')), keep(b('LeftHand')), keep(b('RightHand'))].filter(Boolean),
        head: keep(b('Head')),
      };
      state = 'ready';
    } catch (e) {
      console.warn('[braga] balcony coder:', e);
      state = 'failed';
    }
  }

  buildBalcony();
  scene.add(root);

  // ---- typing: small turns of the forearms and hands, a slow nod
  const _t = new THREE.Quaternion();
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
      h.quaternion.copy(q0).multiply(_t.setFromAxisAngle(X, Math.sin(clock * 1.3) * 0.05));
    }
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
      const el = line('bc-him', '⏺', r.text);
      el.lang = r.lang === 'pt' ? 'pt-PT' : r.lang;
      addLine(el);
      panel.querySelector('.bc-cursor').hidden = false;
      thinking = false;
      after?.();
    }, 300 + Math.random() * 600);
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
    panel.querySelector('.bc-title').textContent = `✻ ${t('Кодер на балконе')}`;
    panel.querySelector('.bc-note').textContent = t('Пасхалка: ответы написаны заранее, без сервера и без ИИ.');
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
      say(replier.reply(text));
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
  }
  function hide() {
    if (!isOpen()) return;
    panel.hidden = true;
    document.body.classList.remove('bc-open');
    if (lastFocus?.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  return {
    root,
    seat, // world units, for tests and screenshots
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
      root.visible = d < SHOW_M;
      const walk = getWalk();
      if (walk?.active) {
        const w = walk.position;
        prompt(Math.hypot(w.x - seat.x, w.z - seat.z) / S < TALK_M && !isOpen());
      } else prompt(false);
      if (root.visible && d < ANIM_M && state === 'ready') {
        clock += dt;
        animate();
      }
    },
    // map mode: a click ray (main.js); true when it hit him and the panel opened
    pick(raycaster) {
      if (!root.visible || !proxy) return false;
      if (!raycaster.intersectObject(proxy, false).length) return false;
      open();
      return true;
    },
    // tests: the screen point of the figure, NDC
    screen() {
      const p = new THREE.Vector3();
      if (proxy) proxy.getWorldPosition(p);
      return p.project(camera);
    },
    open,
    close: hide,
  };
}

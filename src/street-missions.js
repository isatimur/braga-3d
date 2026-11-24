// Street missions (walk mode on the /play page): people of Braga stand in the
// Porta Nova walk district, each under a column of light with their portrait.
// Walk up to one and press E (or tap "Talk"): they say a line, and four of
// them give a timed errand: a delivery, a race, a fetch-and-carry, and one
// too far to run, made for the e-scooters parked beside some of them (F to
// ride and to get off; walk.js does the riding). A mission shows
// its next stop as a coloured column, the objective, the distance and the
// clock at the top of the screen; at the last stop it is passed (points,
// saved on this device) or, when the clock runs out, failed.
//
// The characters are fictional (generated portraits, assets/characters/);
// none of them depicts a real person. main.js creates this when walk mode
// starts and calls update(dt) every frame while walking; the walker is read
// through walk.position and never moved.
import * as THREE from 'three';
import { language } from './i18n.js';
import { METRES_PER_UNIT } from './geo.js';
import { RIBBON_LIFT } from './roads.js';
import { createFigure } from './walk-figure.js';
import { loadCharacter } from './character-model.js';

// clothes of each figure, after the portrait
const LOOK = {
  pasteleira: { shirt: 0x5d6f9e, trousers: 0x4a4f63, hair: 0x9a948c },
  pescador: { shirt: 0x8a3a3a, trousers: 0xc9a23a, hair: 0x1f2a4a },
  estudante: { shirt: 0x15161a, trousers: 0x15161a, hair: 0x5a3a24 },
  taxista: { shirt: 0xd9d2bf, trousers: 0x3a3a3a, hair: 0x4a4038 },
  musico: { shirt: 0x4a6a9a, trousers: 0x2b2f3a, hair: 0x2a1c14 },
  fadista: { shirt: 0x141414, trousers: 0x141414, hair: 0x1e140f },
  futebolista: { shirt: 0xc42a2a, trousers: 0x1c1c22, hair: 0x1a120c },
  'avo-minhota': { shirt: 0xb2262a, trousers: 0x18161a, hair: 0xc9c4bc },
};
import './street-missions.css';

const M = 1 / METRES_PER_UNIT; // world units per metre
const TALK_M = 4.5; // talk range
const REACH_M = 5; // a stop is reached within this
const SAVE = 'braga-street-missions-v1';
const L = (o) => o[language] ?? o.en;

// [lat, lon] spots on the street (data/roads.json, Rua Dom Diogo de Sousa and Rua do Souto)
export const PEOPLE = [
  { id: 'pasteleira', at: [41.55052, -8.42661], name: 'Dona Rosa', role: { pt: 'pastelaria do Souto', en: 'pastry shop owner', ru: 'хозяйка пастелария' },
    line: { pt: 'Os pastéis saem do forno às dez. Quem chega tarde, fica a ver!', en: 'The pastéis come out of the oven at ten. Late ones just watch!', ru: 'Паштейш выходят из печи в десять. Кто опоздал — только смотрит!' } },
  { id: 'pescador', at: [41.55021, -8.42962], name: 'Sr. Joaquim', role: { pt: 'pescador da Póvoa', en: 'fisherman from Póvoa', ru: 'рыбак из Повуа' },
    line: { pt: 'Venho a Braga pela Sé e pelos pastéis. O mar espera.', en: 'I come to Braga for the cathedral and the pastéis. The sea can wait.', ru: 'Я приезжаю в Брагу ради собора и пирожных. Море подождёт.' } },
  { id: 'estudante', at: [41.55036, -8.42815], name: 'Inês', role: { pt: 'estudante da Universidade do Minho', en: 'University of Minho student', ru: 'студентка Университета Минью' },
    line: { pt: 'Esta capa já viu três Enterros da Gata!', en: 'This cape has seen three Enterro da Gata festivals!', ru: 'Эта мантия видела три праздника Энтерру да Гата!' } },
  { id: 'taxista', at: [41.55065, -8.4254], name: 'Sr. Armando', role: { pt: 'taxista', en: 'taxi driver', ru: 'таксист' },
    line: { pt: 'Trinta anos ao volante. Conheço cada pedra desta cidade.', en: 'Thirty years at the wheel. I know every stone of this city.', ru: 'Тридцать лет за рулём. Знаю каждый камень в этом городе.' } },
  { id: 'musico', at: [41.55041, -8.42767], name: 'Tiago', role: { pt: 'músico de rua', en: 'street musician', ru: 'уличный музыкант' },
    line: { pt: 'A guitarra portuguesa tem doze cordas e uma saudade em cada uma.', en: 'The Portuguese guitar has twelve strings and a saudade in each one.', ru: 'У португальской гитары двенадцать струн и в каждой — саудаде.' } },
  { id: 'fadista', at: [41.55002, -8.42722], name: 'Amélia', role: { pt: 'fadista', en: 'fado singer', ru: 'исполнительница фаду' },
    line: { pt: 'Hoje à noite canto perto da Sé. Apareça!', en: 'Tonight I sing near the cathedral. Come by!', ru: 'Сегодня вечером пою у собора. Приходите!' } },
  { id: 'futebolista', at: [41.55079, -8.42411], name: 'Rúben', role: { pt: 'avançado do clube do bairro', en: 'striker of the local club', ru: 'нападающий местного клуба' },
    line: { pt: 'Domingo há jogo. Treino a correr nestas ruas.', en: 'Match on Sunday. I train by running these streets.', ru: 'В воскресенье матч. Тренируюсь, бегая по этим улицам.' } },
  { id: 'avo-minhota', at: [41.55027, -8.42905], name: 'Avó Conceição', role: { pt: 'avó minhota', en: 'grandmother from Minho', ru: 'бабушка из Минью' },
    line: { pt: 'Este ouro é filigrana de Póvoa de Lanhoso. Foi da minha mãe.', en: 'This gold is filigree from Póvoa de Lanhoso. It was my mother\'s.', ru: 'Это золото — филигрань из Повуа-ди-Ланьозу. Оно было маминым.' } },
];

// A mission: who gives it, the stops in order (person ids or [lat, lon]), the time, the points.
export const MISSIONS = [
  { id: 'pasteis', giver: 'pasteleira', stops: ['pescador'], seconds: 80, points: 300,
    title: { pt: 'Pastéis quentes', en: 'Hot pastéis', ru: 'Горячие паштейш' },
    ask: { pt: 'O Sr. Joaquim encomendou uma caixa de pastéis e está no Arco da Porta Nova. Leva-lhos antes que arrefeçam!', en: 'Sr. Joaquim ordered a box of pastéis and he is at the Arco da Porta Nova. Take them before they go cold!', ru: 'Сеньор Жоаким заказал коробку паштейш и ждёт у Арки Порта-Нова. Отнеси, пока не остыли!' },
    goal: { pt: 'Leva os pastéis ao Sr. Joaquim', en: 'Take the pastéis to Sr. Joaquim', ru: 'Отнеси паштейш сеньору Жоакиму' },
    done: { pt: 'Ainda quentinhos! Obrigado.', en: 'Still warm! Thank you.', ru: 'Ещё тёплые! Спасибо.' } },
  { id: 'corrida', giver: 'estudante', stops: ['futebolista', 'estudante'], seconds: 75, points: 400,
    title: { pt: 'Corrida académica', en: 'The academic race', ru: 'Студенческий забег' },
    ask: { pt: 'Aposto que não tocas no Rúben, ao fundo da Rua do Souto, e voltas aqui antes de eu acabar o café!', en: 'Bet you can\'t tag Rúben at the far end of Rua do Souto and get back before I finish my coffee!', ru: 'Спорим, не успеешь добежать до Рубена в конце Руа-ду-Соуту и вернуться, пока я пью кофе!' },
    goal: { pt: 'Toca no Rúben e volta à Inês', en: 'Tag Rúben and run back to Inês', ru: 'Добеги до Рубена и вернись к Инеш' },
    done: { pt: 'Não acredito! Pago eu o próximo café.', en: 'No way! The next coffee is on me.', ru: 'Не может быть! Следующий кофе за мной.' } },
  { id: 'guitarra', giver: 'taxista', stops: ['musico', 'fadista'], seconds: 95, points: 500,
    title: { pt: 'A guitarra esquecida', en: 'The forgotten guitar', ru: 'Забытая гитара' },
    ask: { pt: 'A Amélia deixou a guitarra no meu táxi e canta já a seguir na Sé. O Tiago tem-na guardada. Vai buscá-la e leva-lha!', en: 'Amélia left her guitar in my taxi and she sings at the cathedral soon. Tiago is keeping it. Fetch it and take it to her!', ru: 'Амелия забыла гитару в моём такси, а скоро ей петь у собора. Гитара у Тиагу. Забери и отнеси ей!' },
    goal: { pt: 'Busca a guitarra ao Tiago e leva-a à Amélia', en: 'Get the guitar from Tiago and take it to Amélia', ru: 'Забери гитару у Тиагу и отнеси Амелии' },
    done: { pt: 'Chegou mesmo a tempo. Esta canção é para ti.', en: 'Just in time. This song is for you.', ru: 'Как раз вовремя. Эта песня — для тебя.' } },
  { id: 'chave', giver: 'avo-minhota', stops: ['futebolista', 'avo-minhota'], seconds: 120, points: 600,
    title: { pt: 'A chave da avó', en: 'Grandma\'s key', ru: 'Бабушкин ключ' },
    ask: { pt: 'O meu neto Rúben levou a chave de casa e está lá no fundo da Rua do Souto. A pé não chegas a tempo — apanha uma trotinete!', en: 'My grandson Rúben took the house key and he is at the far end of Rua do Souto. On foot you will never make it — grab a scooter!', ru: 'Мой внук Рубен унёс ключ от дома, он в самом конце Руа-ду-Соуту. Пешком не успеешь — бери самокат!' },
    goal: { pt: 'Busca a chave ao Rúben e volta à avó', en: 'Get the key from Rúben and bring it back to grandma', ru: 'Забери ключ у Рубена и вернись к бабушке' },
    done: { pt: 'Ai, que rapaz tão rápido! Toma, um beijinho.', en: 'Oh, what a quick lad! Here, a little kiss.', ru: 'Ох, какой быстрый! Держи, поцелуйчик.' } },
];

// parked e-scooters: [lat, lon] next to these people
const SCOOTERS = ['pasteleira', 'estudante', 'taxista', 'avo-minhota'];
const MOUNT_M = 2.5;

// an e-scooter in metres (scaled to world units by the caller); forward is -z
function scooterMesh() {
  const g = new THREE.Group();
  g.name = 'mission-scooter';
  const m = (c, r = 0.5, me = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: me });
  const body = m(0x13a89e, 0.4, 0.3), dark = m(0x1c1f24, 0.8, 0.1), steel = m(0x9aa3ad, 0.35, 0.8);
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.rotation.set(rx, 0, rz);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  add(new THREE.BoxGeometry(0.2, 0.06, 0.95), body, 0, 0.13, 0); // deck
  for (const z of [-0.5, 0.48]) add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 18), dark, 0, 0.11, z, 0, Math.PI / 2); // wheels
  add(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 10), steel, 0, 0.62, -0.53, -0.12); // stem
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 10), steel, 0, 1.11, -0.59, 0, Math.PI / 2); // bar
  for (const x of [-0.23, 0.23]) add(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 10), dark, x, 1.11, -0.59, 0, Math.PI / 2); // grips
  add(new THREE.BoxGeometry(0.08, 0.05, 0.03), m(0xfff3c4, 0.3, 0), 0, 0.98, -0.6); // lamp
  return g;
}

const UI = {
  talk: { pt: 'Falar', en: 'Talk', ru: 'Говорить' },
  accept: { pt: 'Aceitar', en: 'Accept', ru: 'Взять задание' },
  later: { pt: 'Agora não', en: 'Not now', ru: 'Не сейчас' },
  close: { pt: 'Fechar', en: 'Close', ru: 'Закрыть' },
  passed: { pt: 'Missão cumprida', en: 'Mission passed', ru: 'Миссия выполнена' },
  failed: { pt: 'Missão falhada', en: 'Mission failed', ru: 'Миссия провалена' },
  late: { pt: 'O tempo acabou.', en: 'Time ran out.', ru: 'Время вышло.' },
  next: { pt: 'Próximo', en: 'Next', ru: 'Дальше' },
  points: { pt: 'pontos', en: 'points', ru: 'очков' },
  again: { pt: 'Já cumprida. Outra vez?', en: 'Already passed. Again?', ru: 'Уже выполнена. Ещё раз?' },
  ride: { pt: 'Andar de trotinete', en: 'Ride the scooter', ru: 'Сесть на самокат' },
  off: { pt: 'sair', en: 'get off', ru: 'сойти' },
};

const portraitUrl = (id) => `assets/characters/${id}.webp`;
const modelUrl = (id) => `assets/characters/3d/${id}.glb`;
// how tall each person stands, metres
const HEIGHT_M = { 'avo-minhota': 1.55, estudante: 1.65, fadista: 1.65, futebolista: 1.78, musico: 1.78, pasteleira: 1.6, pescador: 1.7, taxista: 1.72 };

// a column of light: an open cylinder that fades upward, additive
function beam(color, radiusM, heightM) {
  const g = new THREE.CylinderGeometry(radiusM * M, radiusM * M, heightM * M, 28, 1, true);
  g.translate(0, (heightM * M) / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uAlpha: { value: 0.55 } },
    vertexShader: 'varying float vH; void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; uniform float uAlpha; varying float vH; void main() { float a = pow(1.0 - vH, 1.6) * (0.75 + 0.25 * sin(uTime * 3.0 + vH * 8.0)); gl_FragColor = vec4(uColor * a * uAlpha, 1.0); }',
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  return mesh;
}

export function createStreetMissions({ scene, walk, project, heightAt, heading = Math.PI / 2, onEvent = () => {} }) {
  const group = new THREE.Group();
  group.name = 'street-missions';
  scene.add(group);

  // where each person stands: the spot, nudged to the nearest free ground
  const people = PEOPLE.map((p) => {
    const c = project(p.at[0], p.at[1]);
    let x = c.x, z = c.z;
    search: for (let d = 0; d < 30 * M; d += 0.5 * M) {
      for (let a = 0; a < 12; a++) {
        const tx = c.x + Math.cos((a * Math.PI) / 6) * d, tz = c.z + Math.sin((a * Math.PI) / 6) * d;
        if (walk.free(tx, tz)) { x = tx; z = tz; break search; }
      }
    }
    const y = heightAt(x, z) + RIBBON_LIFT;
    const col = beam(0xffc24a, 0.55, 7);
    col.position.set(x, y, z);
    group.add(col);
    const fig = createFigure(LOOK[p.id]);
    fig.root.name = `mission-${p.id}`;
    fig.root.scale.setScalar(M);
    fig.root.position.set(x, y, z);
    group.add(fig.root);
    return { ...p, x, z, y, col, fig, face: Math.random() * Math.PI * 2 };
  });
  // the textured model replaces the simple figure once it has loaded
  let disposed = false;
  for (const p of people) {
    loadCharacter(modelUrl(p.id), HEIGHT_M[p.id] ?? 1.7)
      .then((model) => {
        if (disposed) return model.dispose();
        model.root.name = `mission-${p.id}`;
        model.root.position.copy(p.fig.root.position);
        model.root.rotation.y = p.face;
        group.remove(p.fig.root);
        p.fig.dispose();
        group.add(model.root);
        p.fig = model;
      })
      .catch(() => { /* keep the simple figure */ });
  }
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  // a scooter parked a couple of metres from its person, on free ground
  const scooters = SCOOTERS.map((id) => {
    const p = byId[id];
    let x = p.x, z = p.z;
    for (let a = 0; a < 16; a++) {
      const tx = p.x + Math.cos(a * 0.39) * 2.2 * M, tz = p.z + Math.sin(a * 0.39) * 2.2 * M;
      if (walk.free(tx, tz)) { x = tx; z = tz; break; }
    }
    const mesh = scooterMesh();
    mesh.scale.setScalar(M);
    mesh.position.set(x, heightAt(x, z) + RIBBON_LIFT, z);
    mesh.rotation.y = -heading; // parked along the street (rotation.y is minus the heading)
    group.add(mesh);
    return mesh;
  });
  const stopBeam = beam(0x4ad8ff, 1.6, 22);
  stopBeam.visible = false;
  group.add(stopBeam);

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch { saved = {}; }
  const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(saved)); } catch { /* private mode */ } };

  // ---- DOM: prompt, dialogue, mission bar, banner
  const root = document.createElement('div');
  root.className = 'sm-root';
  root.innerHTML = `
    <button type="button" class="sm-prompt" hidden></button>
    <div class="sm-dialog" role="dialog" aria-live="polite" hidden>
      <img class="sm-face" alt="" width="110" height="146" />
      <div class="sm-body"><div class="sm-name"></div><div class="sm-role"></div><p class="sm-text"></p><div class="sm-actions"></div></div>
    </div>
    <div class="sm-bar" hidden><div class="sm-title"></div><div class="sm-goal"></div><div class="sm-meta"><span class="sm-dist"></span><span class="sm-clock"></span></div></div>
    <div class="sm-banner" hidden><div class="sm-banner-big"></div><div class="sm-banner-small"></div></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const promptEl = $('.sm-prompt'), dialog = $('.sm-dialog'), bar = $('.sm-bar'), banner = $('.sm-banner');

  let near = null; // the person in talk range
  let talking = null;
  let run = null; // { m, stop, left }
  let bannerT = 0;
  let clock = 0;

  function say(p, text, actions) {
    talking = p;
    dialog.hidden = false;
    $('.sm-face').src = portraitUrl(p.id);
    $('.sm-name').textContent = p.name;
    $('.sm-role').textContent = L(p.role);
    $('.sm-text').textContent = text;
    const box = $('.sm-actions');
    box.textContent = '';
    for (const [label, fn, primary] of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = primary ? 'sm-btn sm-primary' : 'sm-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      box.appendChild(b);
    }
    box.querySelector('button')?.focus({ preventScroll: true });
  }
  function hush() {
    talking = null;
    dialog.hidden = true;
  }
  function talk(p) {
    if (run) {
      // during a mission only the line; the stop check does the rest
      say(p, L(p.line), [[L(UI.close), hush, true]]);
      return;
    }
    const m = MISSIONS.find((q) => q.giver === p.id);
    if (!m) {
      say(p, L(p.line), [[L(UI.close), hush, true]]);
      return;
    }
    const text = saved[m.id] ? `${L(UI.again)}\n\n${L(m.ask)}` : L(m.ask);
    say(p, text, [[L(UI.accept), () => { hush(); start(m); }, true], [L(UI.later), hush]]);
  }
  function stopAt(m, k) {
    const s = m.stops[k];
    if (typeof s === 'string') return byId[s];
    const c = project(s[0], s[1]);
    return { x: c.x, z: c.z, y: heightAt(c.x, c.z) + RIBBON_LIFT };
  }
  function start(m) {
    run = { m, stop: 0, left: m.seconds };
    bar.hidden = false;
    $('.sm-title').textContent = L(m.title);
    $('.sm-goal').textContent = L(m.goal);
    showBanner(L(m.title), L(m.goal), 2.2);
    onEvent('mission_start', { id: m.id });
  }
  function end(ok) {
    const m = run.m;
    stopBeam.visible = false;
    bar.hidden = true;
    if (ok) {
      const gain = m.points + Math.round(run.left) * 5;
      saved[m.id] = Math.max(saved[m.id] || 0, gain);
      save();
      showBanner(L(UI.passed), `+${gain} ${L(UI.points)}`, 3.5, 'ok');
      const last = stopAt(m, m.stops.length - 1);
      if (last.id) say(last, L(m.done), [[L(UI.close), hush, true]]);
    } else {
      showBanner(L(UI.failed), L(UI.late), 3, 'fail');
    }
    onEvent(ok ? 'mission_pass' : 'mission_fail', { id: m.id });
    run = null;
  }
  function showBanner(big, small, s, kind = '') {
    banner.hidden = false;
    banner.className = `sm-banner ${kind}`;
    $('.sm-banner-big').textContent = big;
    $('.sm-banner-small').textContent = small;
    bannerT = s;
  }

  // the scooter within reach (on foot), or the one being ridden
  let nearScooter = null;
  function toggleRide() {
    if (walk.riding) {
      walk.dismount();
      return;
    }
    if (nearScooter) {
      hush();
      walk.mount(nearScooter);
    }
  }
  promptEl.addEventListener('click', () => {
    if (walk.riding || (nearScooter && !near)) toggleRide();
    else if (near) talk(near);
  });
  const onKey = (e) => {
    if (!walk.active || e.repeat || e.target?.closest?.('input, textarea')) return;
    if (e.code === 'KeyE' && near && !talking && !walk.riding) {
      e.preventDefault();
      talk(near);
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      toggleRide();
    } else if (e.code === 'Escape' && talking) {
      hush();
    }
  };
  window.addEventListener('keydown', onKey);

  function update(dt) {
    clock += dt;
    if (!walk.active) {
      root.hidden = true;
      group.visible = false;
      return;
    }
    root.hidden = false;
    group.visible = true;
    const w = walk.position;
    for (const p of people) {
      p.col.material.uniforms.uTime.value = clock;
      // a person turns to the walker within 15 m (the figure looks along -z at yaw 0)
      const dx = w.x - p.x, dz = w.z - p.z;
      const dist = Math.hypot(dx, dz);
      // the beam marks the person from afar and fades as the walker comes near (it would tint the person)
      p.col.material.uniforms.uAlpha.value = 0.55 * THREE.MathUtils.smoothstep(dist, 6 * M, 16 * M);
      if (dist < 15 * M) {
        const want = Math.atan2(-dx, -dz);
        let d = want - p.face;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        p.face += d * Math.min(1, dt * 4);
      }
      p.fig.root.rotation.y = p.face;
      p.fig.step(0, dt);
    }
    stopBeam.material.uniforms.uTime.value = clock;

    // the nearest person in talk range
    let best = null, bd = TALK_M * M;
    for (const p of people) {
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      if (d < bd) { bd = d; best = p; }
    }
    const riding = walk.riding;
    near = riding ? null : best;
    nearScooter = null;
    if (!riding) {
      let sd = MOUNT_M * M;
      for (const s of scooters) {
        const d = Math.hypot(s.position.x - w.x, s.position.z - w.z);
        if (d < sd) { sd = d; nearScooter = s; }
      }
    }
    if (talking && !riding && (!near || near.id !== talking.id)) hush();
    if (riding) {
      promptEl.hidden = false;
      promptEl.textContent = `${Math.max(0, Math.round(riding.speedKmh))} km/h · F · ${L(UI.off)}`;
    } else if (near && !talking) {
      promptEl.hidden = false;
      promptEl.textContent = `E · ${L(UI.talk)}: ${near.name}`;
    } else if (nearScooter && !talking) {
      promptEl.hidden = false;
      promptEl.textContent = `F · ${L(UI.ride)}`;
    } else promptEl.hidden = true;

    if (run) {
      run.left -= dt;
      const s = stopAt(run.m, run.stop);
      stopBeam.visible = true;
      stopBeam.position.set(s.x, s.y, s.z);
      const dx = s.x - w.x, dz = s.z - w.z;
      const dist = Math.hypot(dx, dz) / M;
      // the stop's bearing against the walker's facing, as an arrow
      const fx = Math.sin(w.yaw), fz = -Math.cos(w.yaw);
      const ang = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
      const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
      const arrow = arrows[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
      $('.sm-dist').textContent = `${arrow} ${Math.round(dist)} m`;
      const sec = Math.max(0, Math.ceil(run.left));
      $('.sm-clock').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      $('.sm-clock').classList.toggle('sm-hurry', run.left < 15);
      if (dist < REACH_M) {
        run.stop++;
        if (run.stop >= run.m.stops.length) end(true);
        else showBanner(L(UI.next), stopAt(run.m, run.stop).name || '', 1.4);
      } else if (run.left <= 0) {
        end(false);
      }
    }
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) banner.hidden = true;
    }
  }

  return {
    update,
    // tests and debugging
    get state() {
      return { near: near?.id ?? null, talking: talking?.id ?? null, riding: walk.riding, scooters: scooters.map((s) => ({ x: +s.position.x.toFixed(2), z: +s.position.z.toFixed(2) })), run: run ? { id: run.m.id, stop: run.stop, left: +run.left.toFixed(1) } : null, saved: { ...saved }, people: people.map((p) => ({ id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2) })) };
    },
    talk: (id) => byId[id] && talk(byId[id]),
    accept: () => dialog.querySelector('.sm-primary')?.click(),
    setLeft: (s) => { if (run) run.left = s; },
    dispose() {
      window.removeEventListener('keydown', onKey);
      root.remove();
      disposed = true;
      for (const p of people) p.fig.dispose();
      scene.remove(group);
    },
  };
}

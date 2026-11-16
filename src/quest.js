// History route («Discover historic Braga», #quest): five landmarks in
// time order, one at a time. The camera flies to each one (tour.js
// flightCurve, over roofs and terrain); the card tells its history in a few
// sentences, shows the photo with its credit and asks one question with
// three options. A right answer earns a stamp. The end shows the score, the
// five stamps and how to see each place in the real city.
//
// Content: data/quest.json, loaded with the module. Its history, answer
// and visit lines are verbatim excerpts of the place cards (checked by
// scripts/quest.test.mjs); its `ui` table holds this mode's interface
// strings in ru/en/pt, so the first load carries none of them.
//
// While a stop is shown the visitor may orbit the map freely; «Show the
// place» flies back to the framing. Reduced motion: every flight is a cut.
// Esc (main.js key dispatcher -> onKey) leaves the mode. The scene shows
// clear daylight while the route runs; the visitor's light comes back on
// exit (see «light» below).
import * as THREE from 'three';
import { language } from './i18n.js';
import { flightCurve, easeInOut } from './tour.js';
import { S } from './geo.js';
import { assetUrl } from './data.js';
import { dataPath } from './city.js';
import { creditNode } from './gallery.js';
import { createQuestProgress, questSummary } from './quest-progress.js';
import './quest.css';

const SHOT_CLEAR = 10 * S; // 10 m over the roofs around the camera
const OVERVIEW = { az: 0, elev: 0.78, k: 1.05 }; // intro and end: every stop in view
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const pick = (o) => (o && typeof o === 'object' ? o[language] ?? o.ru : o) ?? '';

// <data_dir>/quest.json, fetched when the route first opens
async function loadQuest() {
  const res = await fetch(assetUrl(dataPath('quest.json')), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('not JSON');
  return res.json();
}

// ctx: { camera, rig, items, sky, home: {position, target}, reducedMotion,
//        city, onFocus(ids), onEnter(), onExit(), onPlace(index), onError(err) }
export function createQuest(ctx) {
  const { camera, rig, reducedMotion } = ctx;
  const byId = new Map(ctx.items.map((it) => [it.data.id, it]));
  const progress = createQuestProgress(ctx.city);
  // the map chrome quest.css hides; inert while the route runs, so Tab and
  // screen readers do not land in it
  const CHROME = '.side, .detail, .topbar, .brand, .instruments, .hint, .clusters, .callout, .callout-leader, .atmo, .guide-fab, .guide, #labels';
  let inerted = [];
  const mq = window.matchMedia('(max-width: 900px)');
  const mobile = () => mq.matches;

  let data = null;
  let stops = []; // { ...json stop, item }
  let active = false;
  let screen = 'intro'; // intro | stop | end
  let current = -1; // stop index on the stop screen
  let shot = null; // the framing of the current screen
  let flying = false;

  // ------------------------------------------------ strings
  function s(key, vars = {}) {
    const raw = pick(data?.ui?.[key]) || key;
    return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  // ------------------------------------------------ DOM
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text, onClick) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };

  const root = el('section', 'quest');
  root.id = 'quest';
  root.hidden = true;
  root.tabIndex = -1;
  const card = el('div', 'quest-card');
  const head = el('div', 'quest-head');
  const kicker = el('p', 'quest-kicker');
  const stampList = el('ol', 'quest-stamps');
  const closeBtn = button('quest-close', '×', () => stop());
  head.append(kicker, stampList, closeBtn);
  const body = el('div', 'quest-body');
  // the screen's buttons stay in view below the scrolling text
  const foot = el('div', 'quest-actions');
  card.append(head, body, foot);
  root.append(card);
  (document.getElementById('story')?.parentElement || document.body).append(root);

  function renderStamps() {
    stampList.replaceChildren();
    stops.forEach((st, i) => {
      const name = st.item.data.name;
      const a = progress.answer(st.id);
      const right = a != null && a === st.answer;
      const seen = progress.visited(st.id) || a != null;
      const li = el('li', `quest-stamp${right ? ' is-right' : seen ? ' is-seen' : ''}`);
      li.append(el('span', 'quest-stamp-num', String(i + 1)));
      const label = s(right ? 'stamp_right' : seen ? 'stamp_seen' : 'stamp_none', { name });
      li.setAttribute('aria-label', label);
      li.title = label;
      if (screen === 'stop' && i === current) li.setAttribute('aria-current', 'step');
      stampList.append(li);
    });
  }

  function sourcesLine(l) {
    if (!l.sources?.length) return null;
    const p = el('p', 'quest-sources');
    p.append(el('span', '', `${s('sources')}: `));
    l.sources.forEach((q, k) => {
      if (k) p.append(document.createTextNode(' · '));
      // a Russian-only title (one Sé source) reads as its site name elsewhere
      const name = language !== 'ru' && /[А-Яа-яЁё]/.test(q.title) ? new URL(q.url).hostname.replace(/^www\./, '') : q.title;
      const a = el('a', '', name);
      Object.assign(a, { href: q.url, target: '_blank', rel: 'noopener noreferrer' });
      p.append(a);
    });
    return p;
  }

  function show(nodes, buttons, focus) {
    root.dataset.screen = screen;
    body.replaceChildren(...nodes.filter(Boolean));
    foot.replaceChildren(...buttons.filter(Boolean));
    body.scrollTop = 0;
    renderStamps();
    (focus || body.querySelector('.quest-title'))?.focus({ preventScroll: true });
  }

  // ------------------------------------------------ screens
  function renderIntro() {
    screen = 'intro';
    current = -1;
    const sum = questSummary(stops, progress);
    const title = el('h2', 'quest-title quest-title-main', s('title'));
    title.tabIndex = -1;
    const plan = el('ol', 'quest-plan');
    for (const st of stops) {
      const li = el('li');
      li.append(el('span', 'quest-plan-name', st.item.data.name), el('span', 'quest-plan-year', st.item.data.year || ''));
      plan.append(li);
    }
    let primary;
    if (sum.answered === 0) primary = button('quest-btn is-primary', s('start'), () => goStop(0));
    else if (sum.next < sum.total) primary = button('quest-btn is-primary', s('resume', { n: sum.next + 1, m: sum.total }), () => goStop(sum.next));
    else primary = button('quest-btn is-primary', s('finish'), () => renderEnd());
    const again = sum.answered ? button('quest-btn', s('restart'), () => restart()) : null;
    show([title, el('p', 'quest-lead', s('subtitle')), plan, el('p', 'quest-note', s('note'))], [again, primary]);
    frameOverview();
  }

  function renderStop(i) {
    screen = 'stop';
    current = i;
    const st = stops[i];
    const l = st.item.data;
    progress.visit(st.id);
    const step = el('p', 'quest-step', s('stop', { n: i + 1, m: stops.length }));
    if (l.year) step.append(el('span', 'quest-year', l.year));
    const title = el('h2', 'quest-title', l.name);
    title.tabIndex = -1;

    let photo = null;
    if (l.image) {
      photo = el('figure', 'quest-photo');
      const img = el('img');
      Object.assign(img, { alt: l.name, loading: 'lazy', decoding: 'async', src: assetUrl(l.image) });
      img.addEventListener('error', () => photo.remove());
      photo.append(img);
      const credit = creditNode(l.image_credit, s('photo'));
      if (credit) {
        const cap = el('figcaption', 'quest-credit');
        cap.append(credit);
        photo.append(cap);
      }
    }
    const text = el('p', 'quest-text', pick(st.text).join(' '));

    // question
    const qBox = el('div', 'quest-q');
    qBox.setAttribute('role', 'group');
    const qId = `quest-q-${st.id}`;
    qBox.setAttribute('aria-labelledby', qId);
    const q = el('p', 'quest-question', pick(st.question));
    q.id = qId;
    const opts = el('div', 'quest-options');
    const feedback = el('div', 'quest-feedback');
    feedback.setAttribute('aria-live', 'polite');
    const nextBtn = i < stops.length - 1
      ? button('quest-btn is-primary', s('next'), () => goStop(i + 1))
      : button('quest-btn is-primary', s('finish'), () => renderEnd());
    const optButtons = st.options.map((o, k) => {
      const b = button('quest-option', '', () => answer(k));
      b.append(el('span', 'quest-option-key', 'ABC'[k]), el('span', 'quest-option-text', pick(o)));
      opts.append(b);
      return b;
    });
    qBox.append(el('p', 'quest-qlabel', s('question')), q, opts, feedback);

    function settle(chosen, announce) {
      const right = chosen === st.answer;
      optButtons.forEach((b, k) => {
        b.disabled = true;
        b.classList.toggle('is-right', k === st.answer);
        b.classList.toggle('is-wrong', k === chosen && !right);
        if (k === chosen) b.setAttribute('aria-pressed', 'true');
      });
      const verdict = el('p', `quest-verdict ${right ? 'is-right' : 'is-wrong'}`);
      if (right) verdict.textContent = s('correct');
      else verdict.append(document.createTextNode(`${s('wrong')} `), el('strong', '', pick(st.options[st.answer])));
      const basis = el('blockquote', 'quest-basis');
      basis.append(el('span', 'quest-basis-label', s('basis')), document.createTextNode(` ${s('basis_quote', { text: pick(st.basis) })}`));
      feedback.replaceChildren(verdict, basis); // also on a revisit: the saved answer
      nextBtn.hidden = false;
      renderStamps();
      if (announce) {
        nextBtn.focus({ preventScroll: true });
        feedback.scrollIntoView({ block: 'end', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
    function answer(k) {
      if (!progress.pick(st.id, k)) return;
      settle(k, true);
    }

    nextBtn.hidden = true;
    const showBtn = button('quest-btn is-quiet', s('show'), () => fly(shot));
    show([step, title, photo, text, qBox, sourcesLine(l)], [showBtn, nextBtn]);
    const saved = progress.answer(st.id);
    if (saved != null) settle(saved, false);
    ctx.onFocus?.([st.id]);
    shot = screenShot();
    fly(shot);
  }

  function renderEnd() {
    screen = 'end';
    current = -1;
    const sum = questSummary(stops, progress);
    const title = el('h2', 'quest-title quest-title-main', s('score', { n: sum.right, m: sum.total }));
    title.tabIndex = -1;
    const list = el('ol', 'quest-visits');
    stops.forEach((st, i) => {
      const l = st.item.data;
      const li = el('li', 'quest-visit');
      // the stop's stamp, large: filled for a right answer
      const a = progress.answer(st.id);
      const right = a != null && a === st.answer;
      const seen = progress.visited(st.id) || a != null;
      const stamp = el('span', `quest-stamp quest-visit-stamp${right ? ' is-right' : seen ? ' is-seen' : ''}`, String(i + 1));
      stamp.setAttribute('aria-hidden', 'true');
      const h = el('h3', 'quest-visit-name', l.name);
      li.append(stamp, h, el('p', 'quest-visit-text', pick(st.visit).join(' ')));
      const open = button('quest-link', s('open_card'), () => {
        const index = st.item.index;
        stop();
        ctx.onPlace?.(index);
      });
      open.setAttribute('aria-label', `${s('open_card')}: ${l.name}`);
      li.append(open);
      list.append(li);
    });
    show(
      [el('p', 'quest-step', s('result')), title, el('p', 'quest-lead', s('end_lead')), el('h3', 'quest-sub', s('visit')), list],
      [button('quest-btn', s('restart'), () => restart()), button('quest-btn is-primary', s('explore'), () => stop())],
    );
    frameOverview();
  }

  function goStop(i) {
    renderStop(THREE.MathUtils.clamp(i, 0, stops.length - 1));
  }

  function restart() {
    progress.reset();
    goStop(0);
  }

  // ------------------------------------------------ camera
  // The part of the screen the card leaves free, as fractions of the view.
  function freeView() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const r = card.getBoundingClientRect();
    if (mobile()) {
      const bottom = r.height ? r.top / H : 0.45;
      return { l: 0, r: 1, t: 0.08, b: THREE.MathUtils.clamp(bottom - 0.02, 0.3, 0.9) };
    }
    return { l: Math.min(0.6, (r.right || 440) / W + 0.01), r: 1, t: 0.06, b: 1 };
  }

  // A view of `list` (landmark items), framed in the free part of the
  // screen. v: { az: radians added to `bearing`, elev: radians above the
  // horizon, k: distance multiplier }. The view is raised until no roof
  // hides the first item (as story.js does for its chapters).
  function frame(list, v, bearing) {
    const box = new THREE.Box3();
    for (const it of list) box.union(it.box);
    const size = box.getSize(new THREE.Vector3());
    const look = box.getCenter(new THREE.Vector3());
    const base = Math.min(...list.map((it) => it.base));
    look.y = base + Math.min(size.y, 60) * 0.3;
    const r = Math.max(8, 0.5 * Math.hypot(size.x, size.z, Math.min(size.y, 80)));
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = window.innerWidth / window.innerHeight;
    const view = freeView();
    const fw = view.r - view.l;
    const fh = view.b - view.t;
    const dist = THREE.MathUtils.clamp(Math.max(r / (tanV * fh), r / (tanV * aspect * fw)) * (v.k ?? 1), 30, 2600);
    const az = bearing + (v.az ?? 0);
    const subject = list[0];
    const q = new THREE.Vector3();
    const inside = (p) => p.x > subject.box.min.x - 0.5 && p.x < subject.box.max.x + 0.5 && p.z > subject.box.min.z - 0.5 && p.z < subject.box.max.z + 0.5;
    const blocked = (pos) => {
      for (let k = 1; k < 32; k++) {
        q.lerpVectors(subject.center, pos, k / 32);
        if (!inside(q) && ctx.sky.at(q.x, q.z, 0) > q.y + 0.5) return true;
      }
      return false;
    };
    let pose = null;
    for (let up = 0; up <= 0.8; up += 0.08) {
      const e = Math.min(1.4, (v.elev ?? 0.45) + up + (mobile() ? 0.18 : 0));
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e));
      const tgt = look.clone();
      const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
      const fwd = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
      tgt.addScaledVector(right, -((view.l + view.r) / 2 - 0.5) * 2 * dist * tanV * aspect);
      tgt.addScaledVector(fwd, (((view.t + view.b) / 2 - 0.5) * 2 * dist * tanV) / Math.max(0.3, Math.sin(e)));
      const pos = tgt.clone().addScaledVector(dir, dist);
      pos.y = Math.max(pos.y, ctx.sky.at(pos.x, pos.z, 6) + SHOT_CLEAR);
      pose = { pos, look: tgt };
      if (!blocked(pos)) break;
    }
    return pose;
  }

  // the bearing of the map's opening view, so the city reads as it did
  const homeBearing = () => Math.atan2(ctx.home.position.x - ctx.home.target.x, ctx.home.position.z - ctx.home.target.z);
  function screenShot() {
    if (screen === 'stop') return frame([stops[current].item], stops[current].view || {}, stops[current].item.viewBearing ?? 0);
    // the old town's stops; the finale (Bom Jesus, 5 km out) is a reveal
    const ids = new Set(data.overview || stops.map((st) => st.id));
    const list = stops.filter((st) => ids.has(st.id)).map((st) => st.item);
    return frame(list.length ? list : stops.map((st) => st.item), OVERVIEW, homeBearing());
  }
  function frameOverview() {
    ctx.onFocus?.(stops.map((st) => st.id));
    shot = screenShot();
    fly(shot);
  }

  // One flight to `to` along a curve over the city, driven through the
  // rig (camera.js drive). At the end the rig hands the orbit controls
  // back, so the visitor can look around the stop.
  function fly(to) {
    if (!to || !active) return;
    const from = camera.position.clone();
    const look0 = rig.controls.target.clone();
    const far = from.distanceTo(to.pos) > 40;
    const curve = !reducedMotion && far ? flightCurve(from, to.pos, ctx.sky) : null;
    const dur = reducedMotion ? 0 : curve ? THREE.MathUtils.clamp(1.6 + curve.getLength() / 900, 2.4, 5.5) : 1.2;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    let t = 0;
    flying = true;
    rig.drive({
      floor: 3,
      snap: true, // the pose is eased here; the rig copies it
      done: false,
      advance(dt) {
        t += dt;
        if (t >= dur) {
          this.done = true;
          flying = false;
        }
      },
      pose() {
        const u = dur ? clamp01(t / dur) : 1;
        if (curve) curve.getPointAt(easeInOut(u), pos);
        else pos.lerpVectors(from, to.pos, easeInOut(u));
        look.lerpVectors(look0, to.look, curve ? easeInOut(clamp01((u - 0.05) / 0.8)) : easeInOut(u));
        return { pos, look, cut: true };
      },
    });
  }

  // ------------------------------------------------ light
  // While the route runs the scene shows clear daylight, so an evening demo
  // is not dark. The visitor's own light (a preset or the live sun, and the
  // weather) is kept here, never saved or put in the URL, and comes back on
  // exit. A light the visitor sets meanwhile (a time= edit of the hash: the
  // atmosphere panel is inert during the route) wins and stays.
  const atmosphere = ctx.atmosphere;
  let held = null; // { time, live, weather, timeSet, weatherSet }
  let ours = false;
  const quietly = (fn) => {
    ours = true;
    try {
      fn();
    } finally {
      ours = false;
    }
  };
  // 'live' is never a hand change here: it comes from live.js starting late
  atmosphere?.onChange((name) => {
    if (held && !ours && name !== 'live') held.timeSet = true;
  });
  const watched = new WeakSet();
  function holdLight() {
    if (!atmosphere) return;
    const life = ctx.getLife?.();
    if (!held) held = { time: atmosphere.time, live: false, weather: null, timeSet: false, weatherSet: false };
    // life.js may arrive after the route opened: its live mode then sets
    // the real sun first, and that is the visitor's light
    else if (!held.timeSet && atmosphere.time === 'live') held.time = 'live';
    if (life) {
      held.live = life.live.live;
      if (!held.weatherSet) held.weather = life.weather.name;
      life.live.hold(true);
      if (!watched.has(life.weather)) {
        watched.add(life.weather);
        life.weather.onChange(() => {
          if (held && !ours) held.weatherSet = true;
        });
      }
    }
    quietly(() => {
      if (!held.timeSet) ctx.setTime('day');
      if (life && !held.weatherSet) life.weather.set('clear');
    });
  }
  function releaseLight() {
    const h = held;
    held = null;
    if (!h) return;
    const life = ctx.getLife?.();
    quietly(() => {
      if (life && !h.weatherSet && h.weather) life.weather.set(h.weather);
      if (!h.timeSet && h.time !== 'live') ctx.setTime(h.time);
      life?.live.hold(false, !h.timeSet);
    });
  }
  // the visitor's light while the route shows daylight (main.js currentHash)
  function heldLight() {
    if (!held) return null;
    const life = ctx.getLife?.();
    const time = held.timeSet ? atmosphere.time : held.time;
    const weather = held.weatherSet ? life?.weather.name : held.weather;
    const hash = held.live && !held.timeSet ? 'live=1' : weather && weather !== 'clear' ? `weather=${weather}` : '';
    return { time, hash };
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (!active) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!active) return;
      shot = screenShot();
      fly(shot);
    }, 200);
  });

  // ------------------------------------------------ lifecycle
  // wanted(): false when the visitor moved on while quest.json loaded
  async function start(wanted = () => true) {
    if (active) return;
    if (!data) {
      try {
        data = await loadQuest();
      } catch (err) {
        console.error('[braga] quest.json failed to load', err);
        if (wanted()) ctx.onError?.(err);
        return;
      }
      stops = (data?.stops || []).map((st) => ({ ...st, item: byId.get(st.id) })).filter((st) => st.item);
      if (stops.length < 2) {
        console.error('[braga] quest.json: too few stops on this map');
        data = null;
        ctx.onError?.(new Error('no stops'));
        return;
      }
      root.setAttribute('aria-label', s('title'));
      kicker.textContent = s('kicker');
      stampList.setAttribute('aria-label', s('stamps'));
      closeBtn.setAttribute('aria-label', s('close'));
      closeBtn.title = s('close');
    }
    if (active || !wanted()) return;
    active = true;
    holdLight();
    ctx.onEnter?.();
    root.hidden = false;
    document.body.classList.add('is-quest');
    inerted = [...document.querySelectorAll(CHROME)].filter((n) => !n.inert && !root.contains(n));
    for (const n of inerted) n.inert = true;
    requestAnimationFrame(() => root.classList.add('is-open'));
    renderIntro();
  }

  function stop() {
    if (!active) return;
    active = false;
    flying = false;
    rig.stopDrive();
    root.classList.remove('is-open');
    document.body.classList.remove('is-quest');
    for (const n of inerted) n.inert = false;
    inerted = [];
    root.hidden = true;
    ctx.onFocus?.([]);
    releaseLight();
    ctx.onExit?.();
  }

  function onKey(e) {
    if (!active) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
      return true;
    }
    return false;
  }

  return {
    start,
    stop,
    onKey,
    get active() {
      return active;
    },
    get heldLight() {
      return heldLight();
    },
    // main.js: life.js was built while the route runs
    lifeReady() {
      if (active) holdLight();
    },
    // tests and screenshots
    get state() {
      const sum = stops.length ? questSummary(stops, progress) : null;
      return { active, screen, stop: current, id: stops[current]?.id ?? null, flying: flying && rig.touring, ...sum };
    },
    goStop,
    showEnd: () => renderEnd(),
    answer(k) {
      body.querySelectorAll('.quest-option')[k]?.click();
    },
  };
}

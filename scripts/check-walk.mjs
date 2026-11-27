#!/usr/bin/env node
// Walk mode check (src/walk.js) in a real browser, desktop and phone.
//
//   node scripts/check-walk.mjs [--base http://localhost:5471/] [--out dir]
//        [--budget on|off|only] [--budget-file perf/budgets.json] [--record]
//
// Walk budget (docs/specs/walk-budget.md, scripts/frame-budget.mjs): after
// the checks below (--budget on, the default) or alone (--budget only), stand
// at the /play start with a fixed clock, a pinned class and a frozen
// governor, let the scene settle, sample 240 frames and FAIL when the p95
// draw calls or triangles are above the walk limits in perf/budgets.json, or
// the p50 below their floors. --budget off runs the old checks only.
// --record runs the probe five times per profile and prints the proposed
// limits; a person pastes them into perf/budgets.json (no code writes it).
//
// For each profile: start on a street by the cathedral with #walk, check the
// eye height, walk and run in eight directions and never stand inside a
// building, look around by drag, leave with Esc (desktop) or the button
// (phone) and check that the orbit camera is back. The walk profile
// (braga-032, src/walk-lod.js) is on in the walk (far plane 5 km, 1.5 km
// tiers), and after the walk the far plane, fog, sky and tile tiers match the
// map again. walklod=0: /play keeps the map's far plane. Needs a served build
// (npm run build, npx vite preview) and playwright-core with a Chromium;
// without them it exits 77 (skip). Env: PLAYWRIGHT_CORE.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { QUALITY_CLASS, waitWalk, readPose, freezeGovernor, readGovernor, settle, sampleFrames, judge, computeLimits, angleDiff } from './frame-budget.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = (k) => process.argv.includes('--' + k);
// a value flag: the next token, unless it is the next flag
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  const v = i > 0 ? process.argv[i + 1] : undefined;
  return v === undefined || v.startsWith('--') ? d : v;
};
const BASE = arg('base', 'http://localhost:5471/');
const OUT = arg('out', '');
const BUDGET = arg('budget', 'on'); // on | off | only
const RECORD = flag('record');
const BUDGET_FILE = arg('budget-file', 'perf/budgets.json');
if (!['on', 'off', 'only'].includes(BUDGET)) { console.log(`--budget must be on, off or only (got ${BUDGET})`); process.exit(2); }
if (RECORD && BUDGET === 'off') { console.log('--record needs a budget mode other than off'); process.exit(2); }
const CORE = process.env.PLAYWRIGHT_CORE;
if (!CORE || !existsSync(CORE)) {
  console.log('skip: set PLAYWRIGHT_CORE to playwright-core/index.mjs');
  process.exit(77);
}
const { chromium, devices } = await import(pathToFileURL(CORE).href);
if (OUT) mkdirSync(OUT, { recursive: true });

// Rua Dom Paio Mendes, the street that runs up to the cathedral front
const START = { lat: 41.55005, lon: -8.42905 };
const fails = [];
const ok = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) fails.push(msg);
};
const state = (page) => page.evaluate(() => ({
  ...window.__braga.walk?.state,
  active: !!window.__braga.walk?.active,
  cls: document.body.classList.contains('is-walk'),
  fov: window.__braga.camera.fov,
  near: window.__braga.camera.near,
  orbit: window.__braga.rig.controls.enabled,
  hash: location.hash,
}));
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const watch = (page, errors) => {
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  // a shader that does not compile throws nothing: three.js logs it and the
  // mesh (once, every house in the city) is simply not drawn
  page.on('console', (m) => {
    if (m.type() === 'error' && /shader|WebGLProgram|GLSL/i.test(m.text())) errors.push(m.text().slice(0, 200));
  });
};

async function run(profile) {
  const phone = profile === 'phone';
  const browser = await launch();
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  await page.goto(`${BASE}?intro=0&lang=en#time=day&weather=clear&live=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__braga?.ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  const fov0 = await page.evaluate(() => window.__braga.camera.fov);
  // the walk profile (src/walk-lod.js): what the map had before. The radius
  // follows the governor, so it is left out of the before/after compare.
  const lod = () => page.evaluate(() => JSON.stringify(window.__braga.lodSnapshot(), (k, v) => (k === 'radiusM' ? undefined : v)));
  const lodMap = await lod();

  // look at the start street, then ask for the mode the way a link does
  await page.evaluate(({ lat, lon }) => {
    const P = window.__braga;
    const q = P.project(lat, lon);
    const y = P.heightAt(q.x, q.z);
    const V = P.camera.position.constructor;
    P.rig.flyTo(new V(q.x, y + 60, q.z + 80), new V(q.x, y, q.z), 0.05);
  }, START);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { location.hash = 'walk'; });
  await page.waitForFunction(() => window.__braga.walk?.active === true, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  let s = await state(page);
  ok(s.cls && s.active, `${profile}: walk mode is on (#walk)`);
  ok(Math.abs(s.eyeM - 1.7) < 0.15, `${profile}: eye height ${s.eyeM} m`);
  ok(s.inside === false && s.blocked === false, `${profile}: the start point is in the street, clear of houses and café seats`);
  ok(s.liftM > 0.2 && s.liftM < 1.5, `${profile}: the walker stands on the paving, ${s.liftM} m above the terrain`);
  ok(s.lanes > 1000 && s.seats > 10, `${profile}: the street layer gave ${s.lanes} lane points and ${s.seats} staying spots`);
  ok(s.solids > 50, `${profile}: ${s.solids} lamps, benches, tables and trees block the walker`);
  ok(s.orbit === false, `${profile}: the orbit controls are off`);
  ok(s.near < 0.2, `${profile}: near plane ${(s.near * 4).toFixed(2)} m`);
  ok(s.buildings > 1000, `${profile}: ${s.buildings} outlines in the collider`);
  ok(/walk/.test(s.hash), `${profile}: the link says ${s.hash}`);
  ok(await page.locator('.walk-exit').isVisible(), `${profile}: the Go up button shows`);
  ok((await page.locator('.walk-stick').isVisible()) === phone, `${profile}: the stick ${phone ? 'shows' : 'is hidden'}`);
  ok(s.view === 'third' && s.figure, `${profile}: third person, the figure shows`);
  ok(s.camM > 1.5 && s.camM < 5 && !s.camInside, `${profile}: the camera is ${s.camM} m behind, in the street`);
  if (OUT) await page.screenshot({ path: `${OUT}/walk-${profile}-start.png` });
  const w = await page.evaluate(() => window.__braga.lodSnapshot());
  ok(w.far === 1250 && w.farFade.y > w.farFade.x && w.sky < w.far && w.walkLod, `${profile}: the walk profile is on (far ${w.far}, fade ${w.farFade.x}-${w.farFade.y}, sky ${w.sky})`);
  ok((!w.tiles || w.tiles.radiusM <= 1500) && (!w.ms || w.ms.radiusM <= 1500) && w.core?.vfarM === 1500, `${profile}: walk tiers (ring ${w.tiles?.radiusM} m, ms ${w.ms?.radiusM} m, core roofs from ${w.core?.vfarM} m)`);

  // eight headings: walk, and on the desktop run, never inside a building
  let insideSeen = 0;
  let before = s.walkedM;
  for (let i = 0; i < 8; i++) {
    await page.evaluate((yaw) => window.__braga.walk.turn(yaw), (i * Math.PI) / 4);
    if (phone) {
      const box = await page.locator('.walk-stick').boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const id = 40 + i;
      const touch = (type, x, y) => page.evaluate(([type, x, y, id]) => {
        const el = document.querySelector('.walk-stick');
        el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
      }, [type, x, y, id]);
      await touch('pointerdown', cx, cy);
      await touch('pointermove', cx, cy - 40);
      for (let k = 0; k < 4; k++) {
        await page.waitForTimeout(500);
        insideSeen += (await state(page)).inside ? 1 : 0;
      }
      await touch('pointerup', cx, cy - 40);
    } else {
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
      for (let k = 0; k < 4; k++) {
        await page.waitForTimeout(500);
        insideSeen += (await state(page)).inside ? 1 : 0;
      }
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
    }
  }
  s = await state(page);
  ok(insideSeen === 0, `${profile}: never inside a building (${insideSeen} of 32 samples)`);
  ok(s.walkedM - before > (phone ? 4 : 10), `${profile}: walked ${(s.walkedM - before).toFixed(1)} m`);
  ok(Math.abs(s.eyeM - 1.7) < 0.3, `${profile}: eye height after the walk ${s.eyeM} m`);

  // bodies: put the walker on a drawn pedestrian, then on a drawn vehicle;
  // each time the walker must end outside the body. A vehicle pushes at once
  // (two frames); a pedestrian gives way, so the walker squeezes out over
  // about half a second (30 frames), measured from that body where it is then
  for (const [kind, name, clearM, frames] of [['pedestrian', 'people', 0.4, 30], ['vehicle', 'traffic', 1.2, 2]]) {
    const r = await page.evaluate(async ([name, frames]) => {
      const P = window.__braga;
      const w = P.walk;
      for (let tries = 0; tries < 40; tries++) {
        const c = w.bodies(name);
        for (const [x, z] of c.slice(0, 60)) {
          const bumps0 = w.state.bumps;
          if (!w.teleport(x, z)) continue;
          await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
          if (w.state.bumps === bumps0) continue; // that body left the view this frame
          if (frames <= 2) {
            // from where that body stood two frames ago (it moves a few cm)
            const s = w.state;
            return { m: Math.hypot(s.x - x, s.z - z) * 4, drawn: c.length };
          }
          // follow that body frame by frame (it moves a few cm a frame)
          let bx = x, bz = z, lost = false;
          for (let f = 2; f < frames && !lost; f++) {
            await new Promise((res) => requestAnimationFrame(res));
            let best = Infinity;
            for (const [px, pz] of w.bodies(name)) {
              const d = Math.hypot(px - bx, pz - bz);
              if (d < best) { best = d; var nx = px, nz = pz; }
            }
            if (best > 0.3 / 4) lost = true;
            else { bx = nx; bz = nz; }
          }
          if (lost) continue;
          const s = w.state;
          return { m: Math.hypot(s.x - bx, s.z - bz) * 4, drawn: c.length };
        }
        await new Promise((res) => setTimeout(res, 500));
      }
      return { none: 'no body the walker could reach' };
    }, [name, frames]);
    if (r.none && kind === 'vehicle') console.log(`note ${profile}: ${r.none} (${kind})`);
    else ok(!r.none && r.m >= clearM, `${profile}: a ${kind} pushes the walker out${r.none ? ` (${r.none})` : ` (${r.m.toFixed(2)} m from its centre, ${r.drawn} drawn)`}`);
  }
  // water: the middle of a lake or a pond is no place to stand (a bridge or
  // a quay drawn over it is)
  const wet = await page.evaluate(() => {
    const P = window.__braga;
    const rings = P.waterRings || [];
    let tested = 0, blocked = 0;
    for (const r of rings) {
      let cx = 0, cz = 0;
      for (const p of r) { cx += p.x; cz += p.z; }
      cx /= r.length;
      cz /= r.length;
      let inside = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        if (r[i].z > cz !== r[j].z > cz && cx < ((r[j].x - r[i].x) * (cz - r[i].z)) / (r[j].z - r[i].z) + r[i].x) inside = !inside;
      }
      if (!inside) continue; // a bent outline: its centre is on the bank
      tested++;
      if (!P.walk.teleport(cx, cz)) blocked++;
    }
    return { rings: rings.length, tested, blocked };
  });
  if (!wet.tested) console.log(`  note ${profile}: no water area to test (${wet.rings} outlines)`);
  else ok(wet.blocked >= wet.tested * 0.8, `${profile}: water blocks the walker (${wet.blocked} of ${wet.tested} water areas)`);
  // open places are not walls (cities/braga.json walk_open_landmarks): inside
  // Praça da República (the fountain square) and on Avenida Central
  const open = await page.evaluate(() => {
    const P = window.__braga, free = (lat, lon) => { const c = P.project(lat, lon); return P.walk.free(c.x, c.z); };
    return { praca: free(41.55126, -8.42298), avenida: free(41.5514, -8.42), pool: free(41.551395, -8.42309) };
  });
  ok(open.praca && open.avenida, `${profile}: the walker may enter Praça da República (${open.praca}) and Avenida Central (${open.avenida})`);
  // ... but not the Praça fountain's pool (issue #2, its OSM water part)
  ok(!open.pool, `${profile}: the Praça fountain's pool blocks the walker (free ${open.pool})`);
  await page.evaluate(({ lat, lon }) => {
    const P = window.__braga;
    const q = P.project(lat, lon);
    for (let d = 0; d < 12; d += 0.5) for (let a = 0; a < 8; a++) if (P.walk.teleport(q.x + Math.cos(a * 0.785) * d, q.z + Math.sin(a * 0.785) * d)) return;
  }, START);
  await page.waitForTimeout(400);

  // look: a drag on the map turns the view
  await page.evaluate(() => window.__braga.walk.turn(0));
  const yaw0 = (await state(page)).yaw;
  const size = page.viewportSize();
  await page.evaluate(([w, h]) => {
    const c = document.querySelector('canvas');
    const ev = (type, x) => new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', clientX: x, clientY: h / 2, bubbles: true, buttons: 1 });
    c.dispatchEvent(ev('pointerdown', w * 0.6));
    window.dispatchEvent(ev('pointermove', w * 0.6 + 120));
    window.dispatchEvent(ev('pointerup', w * 0.6 + 120));
  }, [size.width, size.height]);
  await page.waitForTimeout(300);
  s = await state(page);
  ok(Math.abs(s.yaw - yaw0) > 0.3, `${profile}: a drag turns the view (${yaw0} to ${s.yaw})`);
  if (OUT) {
    await page.evaluate(() => window.__braga.walk.turn(1.9));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/walk-${profile}-street.png` });
  }

  // first person: the button on a phone, V on the desktop
  if (phone) await page.locator('.walk-view').click();
  else await page.keyboard.press('KeyV');
  await page.waitForTimeout(600);
  s = await state(page);
  ok(s.view === 'first' && !s.figure && s.camM < 0.05, `${profile}: first person, the camera is at the eyes`);
  if (OUT) await page.screenshot({ path: `${OUT}/walk-${profile}-first.png` });
  if (phone) await page.locator('.walk-view').click();
  else await page.keyboard.press('KeyV');
  await page.waitForTimeout(1200);
  s = await state(page);
  ok(s.view === 'third' && !s.camInside && (s.figure ? s.camM > 1.5 : s.camM < 0.05), `${profile}: back to third person (${s.figure ? `camera ${s.camM} m behind` : 'a wall behind, so the view is from the eyes'})`);

  // a place within reach offers its card: stand by the cathedral
  const stood = await page.evaluate(async () => {
    const P = window.__braga;
    const q = P.project(41.54998, -8.42715);
    for (let d = 5; d <= 30; d += 1) {
      for (let a = 0; a < 16; a++) {
        const x = q.x + Math.cos((a / 16) * 6.283) * d, z = q.z + Math.sin((a / 16) * 6.283) * d;
        if (!P.walk.teleport(x, z)) continue;
        await new Promise((r) => setTimeout(r, 700));
        if (P.walk.state.near != null) return { d: d * 4, near: P.walk.state.near };
      }
    }
    return null;
  });
  ok(!!stood, `${profile}: by the cathedral a place is within reach${stood ? ` (${stood.d} m from its centre)` : ''}`);
  const chip = page.locator('.walk-place');
  ok(await chip.isVisible(), `${profile}: the place button shows: ${(await chip.textContent()) || ''}`);
  if (OUT) await page.screenshot({ path: `${OUT}/walk-${profile}-place.png` });
  await chip.click();
  await page.waitForTimeout(3500);
  s = await state(page);
  ok(!s.active && /place=/.test(s.hash), `${profile}: the button ends the walk and opens the place (${s.hash})`);
  if (OUT) await page.screenshot({ path: `${OUT}/walk-${profile}-card.png` });
  await page.evaluate(() => { location.hash = 'walk'; });
  await page.waitForFunction(() => window.__braga.walk?.active === true, null, { timeout: 20000 });
  await page.waitForTimeout(1000);

  // leave
  if (phone) await page.locator('.walk-exit').click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(3000);
  s = await state(page);
  const up = await page.evaluate(() => {
    const P = window.__braga;
    return (P.camera.position.y - P.heightAt(P.camera.position.x, P.camera.position.z)) * 4;
  });
  ok(!s.active && !s.cls, `${profile}: walk mode is off after ${phone ? 'Go up' : 'Esc'}`);
  ok(s.orbit === true, `${profile}: the orbit controls are back`);
  ok(Math.abs(s.fov - fov0) < 0.01, `${profile}: the lens is back (${s.fov})`);
  ok(up > 60, `${profile}: the camera is ${up.toFixed(0)} m up again`);
  ok(!/walk/.test(s.hash), `${profile}: the link no longer says walk (${s.hash || 'empty'})`);
  ok(s.figure === false, `${profile}: the figure is gone`);
  ok(s.near >= 0.5, `${profile}: the orbit near plane is back`);
  const lodBack = await lod();
  ok(lodBack === lodMap, `${profile}: after the walk far, fog, sky and tile tiers match the map${lodBack === lodMap ? '' : `: ${lodMap} -> ${lodBack}`}`);
  if (OUT) await page.screenshot({ path: `${OUT}/walk-${profile}-after.png` });
  ok(errors.length === 0, `${profile}: no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await browser.close();
}

// ------------------------------------------------------------ ?walklod=0
// the kill switch: walk mode keeps the map's far plane and tile tiers
async function killSwitch() {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  watch(page, errors);
  await page.goto(`${BASE}play?lang=en&walklod=0#time=day&weather=clear&live=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__braga?.ready === true, null, { timeout: 240000 });
  await page.waitForFunction(() => window.__braga.walk?.active === true, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__braga.lodSnapshot());
  ok(s.far === 16000 && !s.walkLod && s.farFade.y === 0 && !s.core?.walk, `walklod=0: walk keeps the map's far plane and tiers (far ${s.far}, ring ${s.tiles?.radiusM} m)`);
  // /play's mission people stand on the drawn paving, never under a roof
  // (Amélia once waited inside the Sé porch, waist-deep in its floor)
  await page.waitForFunction(() => { let n = 0; window.__braga.scene.traverse((o) => { if (/^mission-(?!scooter)/.test(o.name)) n++; }); return n > 0; }, null, { timeout: 30000 }).catch(() => {});
  const people = await page.evaluate(() => {
    const P = window.__braga, out = [];
    P.scene.traverse((o) => {
      if (!/^mission-(?!scooter)/.test(o.name)) return;
      const st = P.walk.standAt(o.position.x, o.position.z);
      out.push({ id: o.name, roofed: st.roofed, sunkM: +((st.y - o.position.y) * 4).toFixed(2) });
    });
    return out;
  });
  const bad = people.filter((q) => q.roofed || Math.abs(q.sunkM) > 0.1);
  ok(people.length > 0 && !bad.length, `/play: ${people.length} mission people stand on the paving, none under a roof${bad.length ? ` (${JSON.stringify(bad)})` : ''}`);
  ok(errors.length === 0, `walklod=0: no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await browser.close();
}

// ------------------------------------------------------------ walk budget
// One probe run (docs/specs/walk-budget.md §3) in a fresh browser: ?quality=
// is saved to localStorage, and the old checks must not see it. Never
// throws: an exception is the fault "probe error".
async function probeRun(profile, walk, tag) {
  const probe = walk.probe;
  const quality = walk[profile].quality;
  const run = {
    profile, want: QUALITY_CLASS[quality], fault: null, errors: [],
    cls: null, level: null, renderer: null, tiles: null,
    pose: null, metresPerUnit: null, drift: null, calls: null, tris: null, frames: 0,
  };
  const fault = (text) => {
    run.fault = `budget ${tag}: ${text}`;
    return run;
  };
  let browser;
  try {
    browser = await launch();
    const ctx = await browser.newContext(profile === 'phone' ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, run.errors);
    // 1. load and wait
    const url = `${BASE}${probe.path}?intro=0&lang=en&quality=${quality}${probe.hash}`;
    const w = await waitWalk(page, url, probe);
    if (w.fault) return fault(w.fault);
    // 2. start check
    const pose = await readPose(page);
    run.pose = { x: pose.x, z: pose.z, yaw: pose.yaw };
    run.metresPerUnit = pose.metresPerUnit;
    const start = probe.start;
    if (start) {
      const d = Math.hypot(pose.x - start.x, pose.z - start.z) * pose.metresPerUnit;
      const a = Math.abs(angleDiff(pose.yaw, start.yaw));
      if (d > 2 || a > 0.02) {
        const why = w.lanesAtWalk === 0 ? '; walk.state.lanes was 0 when the walk began, so the start could not snap to a walk lane' : '';
        return fault(`start moved ${d.toFixed(1)} m, ${a.toFixed(3)} rad (limit 2 m, 0.02 rad)${why}`);
      }
    }
    const yaw = start ? start.yaw : pose.yaw;
    // 3. freeze the governor at level 0
    const frozen = await freezeGovernor(page);
    if (frozen.fault) return fault(frozen.fault);
    run.cls = frozen.cls;
    run.level = frozen.level;
    run.renderer = frozen.renderer;
    let sample = null, drift = 0, drift1 = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      // 4. turn; 5. settle
      await page.evaluate((y) => (window.__braga || window.__porto || window.__city).walk.turn(y, 0), yaw);
      const st = await settle(page, probe);
      run.tiles = st.tiles;
      if (!st.settled) return fault(`scene did not settle in ${Math.round(st.ms / 1000)} s (${st.cause})`);
      // 6. the pose before sampling, and the camera looks along the target yaw
      const p0 = await readPose(page);
      const off = Math.abs(angleDiff(p0.camYaw, yaw));
      if (off > 0.02) return fault(`view not fixed (camera yaw off by ${off.toFixed(3)} rad)`);
      // 7. sample
      sample = await sampleFrames(page, { frames: probe.frames });
      run.frames = sample.frames;
      if (sample.frames < probe.frames) return fault(`too few frames (${sample.frames} of ${probe.frames} in 60 s)`);
      // 8. drift: a passer-by may have shoved the walker; one retry
      const p1 = await readPose(page);
      drift = Math.hypot(p1.x - p0.x, p1.z - p0.z) * p0.metresPerUnit;
      if (drift <= 0.5) break;
      if (drift1 != null) return fault(`walker pushed twice (drift ${drift1.toFixed(1)} m, then ${drift.toFixed(1)} m)`);
      drift1 = drift;
      const back = await page.evaluate(([x, z]) => (window.__braga || window.__porto || window.__city).walk.teleport(x, z), [p0.x, p0.z]);
      if (back === false) return fault(`walker pushed twice (drift ${drift1.toFixed(1)} m, teleport back refused)`);
    }
    // 9. the governor did not move during settle, samples and retry
    const gov = await readGovernor(page);
    if (gov.level !== 0 || gov.lastT !== frozen.lastT) return fault(`governor moved (level ${gov.level}, last change ${gov.why})`);
    run.drift = drift;
    run.calls = sample.calls;
    run.tris = sample.tris;
    return run;
  } catch (e) {
    return fault(`probe error: ${String(e?.message || e).split('\n')[0]}`);
  } finally {
    await browser?.close().catch(() => {});
  }
}

const print = (entries) => {
  for (const e of entries) {
    if (e.level === 'FAIL') ok(false, e.msg);
    else if (e.level === 'ok') ok(true, e.msg);
    else console.log(`info ${e.msg}`);
  }
};

// The only budget entry point: read the walk section, run the probe per
// profile, judge each run; with --record, print the proposed limits.
async function walkBudget() {
  let walk = null;
  try {
    walk = JSON.parse(readFileSync(BUDGET_FILE === 'perf/budgets.json' ? join(ROOT, BUDGET_FILE) : resolve(BUDGET_FILE), 'utf8')).walk;
  } catch {}
  if (!walk?.probe || !walk.desktop || !walk.phone) {
    ok(false, `budget: no walk budget in ${BUDGET_FILE}`);
    return;
  }
  const runs = [];
  for (const profile of ['desktop', 'phone']) {
    const n = RECORD ? walk.probe.runs : 1;
    for (let i = 1; i <= n; i++) {
      const tag = RECORD ? `${profile} run ${i}/${n}` : profile;
      const run = await probeRun(profile, walk, tag);
      runs.push(run);
      print(judge(run, walk, { record: RECORD, tag }));
    }
  }
  if (!RECORD) return;
  const r = computeLimits(runs, walk);
  const pct = (s) => (s == null ? '?' : (s * 100).toFixed(1));
  for (const p of ['desktop', 'phone']) {
    const s = r.spread[p];
    console.log(`record ${p}: ${r.ok[p]} of ${walk.probe.runs} runs ok; spread p95 calls ${pct(s?.calls)} %, p95 triangles ${pct(s?.tris)} %`);
  }
  for (const e of r.errors) ok(false, e);
  if (r.errors.length) {
    console.log('record: no limits proposed (see FAIL lines)');
    return;
  }
  let sha = '?';
  try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {}
  const okRun = (p) => runs.find((x) => x.profile === p && !x.fault && !x.errors.length && x.cls === x.want);
  const renderer = (okRun('desktop') || okRun('phone'))?.renderer || 'unknown renderer';
  const start = { x: +r.start.x.toFixed(3), z: +r.start.z.toFixed(3), yaw: +r.start.yaw.toFixed(4) };
  console.log('--- walk limits: paste into perf/budgets.json and copy this block into the commit message ---');
  console.log(`sha ${sha}, load ${loadavg()[0].toFixed(1)}, ${new Date().toISOString()}, ${renderer}`);
  console.log(`walk.probe.start = ${JSON.stringify(start)}`);
  console.log(`walk.desktop = ${JSON.stringify(r.limits.desktop)}`);
  console.log(`walk.phone = ${JSON.stringify(r.limits.phone)}`);
  console.log('--- end ---');
}

if (BUDGET !== 'only' && !RECORD) {
  await killSwitch();
  for (const profile of ['desktop', 'phone']) await run(profile);
}
if (BUDGET !== 'off') await walkBudget();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);

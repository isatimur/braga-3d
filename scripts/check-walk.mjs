#!/usr/bin/env node
// Walk mode check (src/walk.js) in a real browser, desktop and phone.
//
//   node scripts/check-walk.mjs [--base http://localhost:5471/] [--out dir]
//
// For each profile: start on a street by the cathedral with #walk, check the
// eye height, walk and run in eight directions and never stand inside a
// building, look around by drag, leave with Esc (desktop) or the button
// (phone) and check that the orbit camera is back. Needs a served build
// (npm run build, npx vite preview) and playwright-core with a Chromium;
// without them it exits 77 (skip). Env: PLAYWRIGHT_CORE.
import { existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg('base', 'http://localhost:5471/');
const OUT = arg('out', '');
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

async function run(profile) {
  const phone = profile === 'phone';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  // a shader that does not compile throws nothing: three.js logs it and the
  // mesh (once, every house in the city) is simply not drawn
  page.on('console', (m) => {
    if (m.type() === 'error' && /shader|WebGLProgram|GLSL/i.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  await page.goto(`${BASE}?intro=0&lang=en#time=day&weather=clear&live=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__braga?.ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  const fov0 = await page.evaluate(() => window.__braga.camera.fov);

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
  // each time the walker must end outside the body
  for (const [kind, name, clearM] of [['pedestrian', 'people', 0.6], ['vehicle', 'traffic', 1.2]]) {
    const r = await page.evaluate(async ([name]) => {
      const P = window.__braga;
      const w = P.walk;
      for (let tries = 0; tries < 40; tries++) {
        const c = w.bodies(name);
        for (const [x, z] of c.slice(0, 60)) {
          const bumps0 = w.state.bumps;
          if (!w.teleport(x, z)) continue;
          await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
          const s = w.state;
          if (s.bumps === bumps0) continue; // that body left the view this frame
          // from where that body stood two frames ago (it moves a few cm)
          return { m: Math.hypot(s.x - x, s.z - z) * 4, drawn: c.length };
        }
        await new Promise((res) => setTimeout(res, 500));
      }
      return { none: 'no body the walker could reach' };
    }, [name]);
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
  if (OUT) await page.screenshot({ path: `${OUT}/walk-${profile}-after.png` });
  ok(errors.length === 0, `${profile}: no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await browser.close();
}

for (const profile of ['desktop', 'phone']) await run(profile);
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);

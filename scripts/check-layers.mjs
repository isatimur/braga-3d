#!/usr/bin/env node
// Browser check of the Layers panel and the status pill (plain Playwright).
// Ported from lisboa-3d (its final state, with the belem-3d waits). Needs a
// running server on the production build: `npx vite preview --host
// 127.0.0.1 --port 4874` (as the route checks), or porto-3d's
// perf-serve.mjs on dist/ (brotli, Vercel cache headers, no /api):
//
//   node scripts/check-layers.mjs --url http://127.0.0.1:4874/ [--out output/layers-check] [--size 1440x900]
//
// 1. ?layers=light: no request of any optional layer (network log of the
//    page and its workers).
// 2. For each layer: switch it on in the panel; its files must now be
//    requested (the positive control: a log that sees nothing proves
//    nothing), and it must report loaded, without a reload. Braga: the MS
//    buildings switched on while the ring is still off fade in (the fade
//    clock runs without tiles.js).
// 2b. The ring off takes its main streets (joined to the core's lines) and
//    its trees along; on again brings both back.
// 3. Reload without ?layers: the choice came back from localStorage.
// 4. Ring tiles that fail (aborted by the test) end in a failed status with
//    a Retry button; Retry with the network back loads them.
// 5. Screenshots: the panel, the pill mid-load (tile replies held back),
//    the pill failed with Retry.
// 6. Braga: a history route (#quest) hides the pill and keeps the panel
//    shut; the route opens in the Light preset.
// Exit 1 on any failed assertion or console error.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const BASE = opt('url', 'http://127.0.0.1:4874/');
const OUT = opt('out', 'output/layers-check');
const [W, H] = opt('size', '1440x900').split('x').map(Number);
const PHONE = W < 600;
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const c = [process.env.PLAYWRIGHT_CORE, 'playwright-core'].filter(Boolean);
  try {
    c.push(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), '@playwright/cli/node_modules/playwright-core/index.mjs'));
  } catch {
    // no global npm
  }
  for (const p of c) {
    try {
      const m = await import(p.startsWith('/') ? pathToFileURL(p).href : p);
      if (m.chromium || m.default?.chromium) return m.chromium || m.default.chromium;
    } catch {
      // next
    }
  }
  throw new Error('playwright-core not found (set PLAYWRIGHT_CORE)');
}
function chromePath() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dir = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().pop();
  const sub = dir && readdirSync(join(cache, dir)).find((d) => d.startsWith('chrome-headless-shell'));
  const exe = sub && join(cache, dir, sub, 'chrome-headless-shell');
  return exe && existsSync(exe) ? exe : undefined;
}

// pois.json is core in Braga (Discovery, search): not a street request
const PATTERNS = {
  ring: /\/data\/tiles\/|\/tile-worker[-.]/,
  ms: /\/data\/(buildings-ms\.json|tiles-ms\/)/,
  street: /\/data\/streetscape\.json/,
  live: /\/(liveair|livebus)[-.]|\/data\/gtfs\//,
};

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

const chromium = await loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: PHONE ? 2 : 1, isMobile: PHONE, hasTouch: PHONE, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && !/\/api\//.test(m.location()?.url || '') && errors.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const urls = [];
page.on('request', (r) => urls.push(r.url()));
const hits = (id, from = 0) => urls.slice(from).filter((u) => PATTERNS[id].test(u));
const ready = () => page.waitForFunction(() => window.__braga?.ready === true, null, { timeout: 180000 });
const rowState = (id) => page.evaluate((i) => document.querySelector(`.layer-row[data-layer="${i}"]`)?.dataset.state, id);
const waitRow = (id, states, ms = 90000) => page.waitForFunction(([i, s]) => s.includes(document.querySelector(`.layer-row[data-layer="${i}"]`)?.dataset.state), [id, states], { timeout: ms, polling: 200 });
const frames = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const openPanel = async () => {
  if (await page.evaluate(() => window.__braga.layersUI.isOpen)) return;
  await page.evaluate(() => window.__braga.layersUI.open());
  await page.waitForSelector('#layers.is-open');
  // the panel fades in (style.css .atmo, 0.18 s): a screenshot taken at
  // once shows the page through a half-open panel
  await page.waitForFunction(() => getComputedStyle(document.getElementById('layers')).opacity === '1', null, { timeout: 5000 });
};

// ---- 1. light: nothing optional on the wire
const sep = BASE.includes('?') ? '&' : '?';
await page.goto(`${BASE}${sep}intro=0&lang=en&layers=light`, { waitUntil: 'domcontentloaded' });
await ready();
await page.waitForTimeout(6000); // the ring would start 20 frames after ready
const sel = await page.evaluate(() => window.__braga.layers.selection);
ok(Object.values(sel).every((v) => !v), `light preset: every layer off (${JSON.stringify(sel)})`);
for (const id of Object.keys(PATTERNS)) ok(hits(id).length === 0, `light: no ${id} request (${hits(id).length})`);
ok(urls.some((u) => /\/data\/pois\.json/.test(u)), 'light: pois.json is still fetched (core: Discovery and the search)');

// ---- 2. switch each layer on in the panel: it loads, no reload
await openPanel();
await page.screenshot({ path: `${OUT}/panel-light-${W}x${H}.png` });
const nav0 = await page.evaluate(() => performance.getEntriesByType('navigation').length + ':' + performance.timeOrigin);
// The streamed layers (ring, MS) have no wave until their index is read and
// their first tiles are asked for (`begun`). Their row must not say loaded
// before that, and it is read once the source has begun, its wave has ended
// and the row has settled, all in one poll: a city with many tiles may
// start its next wave a moment later.
const STREAMED = { ring: 'tiles', ms: 'ms' };
const settledRow = (id, ms = 90000) =>
  page
    .waitForFunction(
      ([i, key]) => {
        const st = document.querySelector(`.layer-row[data-layer="${i}"]`)?.dataset.state;
        if (st !== 'ready' && st !== 'failed') return false;
        if (!key) return st;
        const src = window.__braga[key];
        return src && src.begun === true && !src.wave.snapshot().active ? st : false;
      },
      [id, STREAMED[id] || null],
      { timeout: ms, polling: 100 },
    )
    .then((h) => h.jsonValue(), async () => `not settled in ${ms / 1000} s (row ${await rowState(id)})`);
// the row's states, every frame from the switch-on until the source has begun
const earlyStates = (id) =>
  page.evaluate(
    ([i, key]) =>
      new Promise((res) => {
        const seen = new Set();
        const t0 = performance.now();
        const f = () => {
          const src = window.__braga[key];
          seen.add(document.querySelector(`.layer-row[data-layer="${i}"]`)?.dataset.state);
          if (src?.begun === true || src?.wave.snapshot().active || performance.now() - t0 > 60000) res([...seen]);
          else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      }),
    [id, STREAMED[id]],
  );
for (const id of ['street', 'live', 'ms', 'ring']) {
  const from = urls.length;
  await openPanel();
  const early = STREAMED[id] ? earlyStates(id) : null;
  await page.click(`.layer-switch[data-layer="${id}"]`);
  if (early) {
    const seen = await early;
    ok(!seen.includes('ready'), `${id} on: the row does not say loaded before its first tiles are asked for (${seen.join(' -> ')})`);
  }
  const st = await settledRow(id);
  ok(hits(id, from).length > 0, `${id} on: its files are requested now (${hits(id, from).length}, e.g. ${(hits(id, from)[0] || '').replace(/^https?:\/\/[^/]+/, '')})`);
  ok(st === 'ready', `${id} on: panel says loaded (state ${st})`);
  if (id === 'ms') {
    // Braga: the ring is still off (no tiles.js), so main.js runs the fade
    // clock the MS buildings read; without it they never fade in
    const a = await page.evaluate(() => ({ clock: window.__braga.buildingClock(), tiles: !!window.__braga.tiles, core: window.__braga.msStats.coreTiles }));
    await frames(30);
    const b = await page.evaluate(() => window.__braga.buildingClock());
    ok(!a.tiles && a.core > 0 && b > a.clock, `ms on with the ring off: ${a.core} core blocks, the fade clock runs (${a.clock.toFixed(2)} -> ${b.toFixed(2)} s)`);
  }
}
const nav1 = await page.evaluate(() => performance.getEntriesByType('navigation').length + ':' + performance.timeOrigin);
ok(nav0 === nav1, 'no page reload while switching layers');
await page.screenshot({ path: `${OUT}/panel-full-${W}x${H}.png` });

// ---- 2b. the ring off: its main streets and its trees go with it.
// tiles.js joins the ring's main streets (and rivers) to the core's own
// road-primary (and road-water) line, objects outside the ring's group; off
// must give them their core-only geometry back, on must join the ring
// again. The ring's trees live in nature.js (stream trees).
{
  const lineState = () =>
    page.evaluate(() => {
      const P = window.__braga;
      const segs = (n) => P.scene.getObjectByName(n)?.geometry.attributes.instanceStart?.count ?? null;
      const cell = (P.roadCells?.() || []).find((c) => c.name === 'road-primary');
      return { primary: segs('road-primary'), water: segs('road-water'), core: P.roadSegments.primary ?? null, coreWater: P.roadSegments.water ?? null, cell: cell ? { whole: cell.whole, drawn: cell.drawn, total: cell.total } : null, trees: P.nature?.stream ?? 0 };
    });
  const joined = () =>
    page
      .waitForFunction(() => (window.__braga.scene.getObjectByName('road-primary')?.geometry.attributes.instanceStart?.count ?? 0) > window.__braga.roadSegments.primary, null, { timeout: 30000, polling: 200 })
      .then(() => true, () => false);
  const treesBack = () =>
    page
      .waitForFunction(() => (window.__braga.nature?.stream ?? 0) > 0, null, { timeout: 30000, polling: 200 })
      .then(() => true, () => false);
  await joined();
  // the road cells are sorted in idle slots after ready (main.js): read them once done
  await page.waitForFunction(() => window.__braga.timing?.roadCells != null, null, { timeout: 30000, polling: 200 }).catch(() => {});
  await treesBack();
  const on1 = await lineState();
  // the positive control: with the ring on, road-primary has the ring's part
  ok(on1.core > 0 && on1.primary > on1.core, `ring on: the ring's main streets join road-primary (${on1.core} core + ${on1.primary - on1.core} ring segments)`);
  await openPanel();
  await page.click('.layer-switch[data-layer="ring"]');
  await frames(3);
  const off = await lineState();
  ok(off.primary === off.core, `ring off: road-primary draws the core only (${off.primary} segments, core ${off.core})`);
  // (no road-water object in a city built with noWaterLines)
  if (off.water != null) ok(off.water === off.coreWater, `ring off: road-water draws the core only (${off.water} segments, core ${off.coreWater})`);
  // a core line with grid cells (cell-runs.js) draws by cell again, not whole
  if (off.cell) ok(off.cell.whole === false, `ring off: road-primary is culled by cell again (whole ${off.cell.whole}, ${off.cell.drawn} of ${off.cell.total})`);
  else console.log(`n/a   ring off: road-primary has no grid cells in this city (${off.core} segments)`);
  if (on1.trees > 0) ok(off.trees === 0, `ring off: the ring's trees go (${on1.trees} -> ${off.trees})`);
  else console.log('n/a   ring on: no ring trees in this view');
  await page.click('.layer-switch[data-layer="ring"]');
  await waitRow('ring', ['ready', 'failed']).catch(() => {});
  const back2 = await joined();
  const trees2 = on1.trees > 0 ? await treesBack() : true;
  const on2 = await lineState();
  ok(back2 && on2.primary > on2.core, `ring on again: the ring's main streets join road-primary again (${on2.primary} segments, core ${on2.core})`);
  if (on1.trees > 0) ok(trees2 && on2.trees > 0, `ring on again: the ring's trees come back (${on2.trees})`);
}

// a layer switched off again: hidden, and no more of its requests
{
  await page.click('.layer-switch[data-layer="street"]');
  const vis = await page.evaluate(() => window.__braga.life.street.object.visible);
  ok(vis === false, 'street off again: hidden at once');
}

// ---- 3. the choice persists (localStorage), without ?layers
const savedSel = await page.evaluate(() => window.__braga.layers.selection);
await page.goto(`${BASE}${sep}intro=0&lang=en`, { waitUntil: 'domcontentloaded' });
await ready();
// a small streamed radius (the governor's own knob), so a camera move
// below reaches tiles that are not loaded yet
await page.waitForFunction(() => !!window.__braga.tiles, null, { timeout: 30000 });
await page.evaluate(() => window.__braga.tiles.setBudgetScale(0.25));
const back = await page.evaluate(() => ({ sel: window.__braga.layers.selection, src: window.__braga.layers.source }));
ok(back.src === 'saved' && JSON.stringify(back.sel) === JSON.stringify(savedSel), `choice restored from localStorage (${back.src}: ${JSON.stringify(back.sel)})`);

// ---- 4 and 5. a camera move: the pill counts the area; failures and retry
{
  // hold tile replies back so the pill can be seen mid-load, and fail some.
  // Each reply a little later than the one before: replies held for the
  // same time land together, and small tiles (Braga's ring tiles are 1 to
  // 9 KB) are built within one tick of the pill (250 ms), which then goes
  // from "0 of n" straight to "loaded" (true, but nothing to count)
  let mode = 'slow';
  let held = 0;
  await ctx.route(/\/data\/tiles\/\d+_\d+\.json/, async (route) => {
    if (mode === 'fail') return route.abort('failed');
    await new Promise((r) => setTimeout(r, 900 + 400 * (held++ % 8)));
    return route.continue();
  });
  const fly = (lat, lon) =>
    page.evaluate(
      async ([la, lo]) => {
        const P = window.__braga;
        const V = P.camera.position.constructor;
        const q = P.project(la, lo);
        const k = P.projection.metresPerUnit;
        const gy = P.heightAt(q.x, q.z);
        const f0 = P.flights;
        P.rig.flyTo(new V(q.x + 300 / k, gy + 900 / k, q.z + 600 / k), new V(q.x, gy, q.z), 0.4);
        const t0 = performance.now();
        while (P.flights === f0 && performance.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
      },
      [lat, lon],
    );
  await page.evaluate(() => window.__braga.layersUI.close());
  await page.evaluate(() => window.__braga.tiles?.idle(60000));
  await fly(41.6, -8.5); // north-west of the core (Braga's ring): tiles not yet seen
  // the pill, read in the page at each of its ticks: counting this area
  const saw = await page
    .waitForFunction(() => { const s = window.__braga.layersUI.status; return s.state === 'loading' && s.id === 'area' && s.done > 0 ? s : false; }, null, { timeout: 15000, polling: 100 })
    .then((h) => h.jsonValue(), () => null);
  ok(!!saw, `camera move: the pill counts this area (${saw?.text})`);
  if (saw) await page.screenshot({ path: `${OUT}/status-midload-${W}x${H}.png` });
  const live = await page.evaluate(() => {
    const el = document.getElementById('load-status-live');
    return { polite: el?.getAttribute('aria-live'), role: el?.getAttribute('role'), text: el?.textContent, inPill: !!el?.closest('#load-status') };
  });
  ok(live.polite === 'polite' && live.role === 'status' && !live.inPill, `a polite live region outside the pill (says "${live.text}")`);
  // prefers-reduced-motion: the loading dot stops pulsing
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const anim = await page.evaluate(() => {
    const pill = document.getElementById('load-status');
    const prev = pill.dataset.state;
    pill.dataset.state = 'loading'; // the pulsing state, for the style check only
    const a = getComputedStyle(pill.querySelector('.ls-dot')).animationName;
    pill.dataset.state = prev;
    return a;
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  ok(anim === 'none', `reduced motion: no pulse on the loading dot (animation ${anim})`);
  await page.waitForFunction(() => window.__braga.layersUI.status.state !== 'loading', null, { timeout: 120000, polling: 200 });
  const after = await page.evaluate(() => window.__braga.layersUI.status);
  ok(after.state === 'done' || after.state === 'idle', `the wave ends: ${after.state} "${after.text}"`);

  // failures: every ring tile request aborts; three tries, then failed + Retry
  mode = 'fail';
  const err0 = await page.evaluate(() => window.__braga.tiles.stats.errors);
  await fly(41.495, -8.52); // south-west of the core
  let failedState = null;
  try {
    await page.waitForFunction(() => window.__braga.layersUI.status.state === 'failed', null, { timeout: 90000, polling: 250 });
    failedState = await page.evaluate(() => window.__braga.layersUI.status);
  } catch {
    // reported below
  }
  const err1 = await page.evaluate(() => window.__braga.tiles.stats.errors);
  ok(err1 > err0, `the aborts reached the tile loader (errors ${err0} -> ${err1})`);
  ok(failedState?.state === 'failed', `failed tiles: the pill says so (${failedState?.text})`);
  const retryShown = await page.evaluate(() => !document.querySelector('#load-status .ls-retry').hidden);
  ok(retryShown, 'a Retry button shows');
  if (failedState) await page.screenshot({ path: `${OUT}/status-failed-${W}x${H}.png` });
  // the touch target: a finger needs 44 px (the pill), 36 px buttons in it
  if (PHONE) {
    const box = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const tx = document.querySelector('#load-status .ls-text');
      return { pill: Math.round(r('#load-status').height), retry: Math.round(r('#load-status .ls-retry').height), clipped: tx.scrollHeight > tx.clientHeight + 1 || tx.scrollWidth > tx.clientWidth + 1, right: Math.round(r('#load-status').right), vw: innerWidth };
    });
    ok(box.pill >= 44 && box.retry >= 36, `phone: the pill is ${box.pill} px tall, Retry ${box.retry} px`);
    ok(!box.clipped && box.right <= box.vw, `phone: the failed line shows whole, count included (clipped ${box.clipped}, right edge ${box.right} of ${box.vw})`);
  }
  // the network comes back. The pill says "failed" as soon as one tile has
  // given up, while others of this move may still be between two tries (the
  // count grows); a request that failed just before can come back after the
  // press. So: Retry is pressed once the pill says failed with its button
  // shown and no tile request is in flight (the visitor's moment to press it)
  mode = 'slow';
  await page
    .waitForFunction(() => { const P = window.__braga; return P.layersUI.status.state === 'failed' && !document.querySelector('#load-status .ls-retry').hidden && ![...P.tiles.tiles.values()].some((T) => T.loading); }, null, { timeout: 90000, polling: 100 })
    .catch(() => {});
  // keyboard: Retry is reachable with Tab and works with Enter
  await page.focus('#load-status .ls-retry');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__braga.layersUI.status.state !== 'failed', null, { timeout: 30000, polling: 200 });
  await page.waitForFunction(() => window.__braga.layersUI.status.state !== 'loading', null, { timeout: 120000, polling: 200 });
  const stuck = await page.evaluate(() => window.__braga.tiles.stats.stuck);
  ok(stuck === 0, `Retry with the network back: no tile left failed (${stuck})`);
  await ctx.unroute(/\/data\/tiles\/\d+_\d+\.json/);
}

// no layout shift: the pill is fixed
const pos = await page.evaluate(() => getComputedStyle(document.getElementById('load-status')).position);
ok(pos === 'fixed', 'the pill is position: fixed (no layout shift)');

// ---- 6. Braga: a history route in the Light preset; the pill stays out of it
{
  await page.goto(`${BASE}${sep}intro=0&lang=en&layers=light#quest=old-town-on-foot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__braga?.ready && window.__braga.quest?.active, null, { timeout: 180000 });
  const q = await page.evaluate(() => {
    const P = window.__braga;
    P.layersUI.open(); // refused while a route runs
    const pill = document.getElementById('load-status');
    return { preset: P.layers.preset, pill: getComputedStyle(pill).display, panel: P.layersUI.isOpen, card: !!document.querySelector('.quest-card'), tiles: !!P.tiles, ms: !!P.ms };
  });
  ok(q.preset === 'light' && !q.tiles && !q.ms, `route in Light: no ring, no MS buildings (${q.preset})`);
  ok(q.card, 'route in Light: the route card opens');
  ok(q.pill === 'none' && !q.panel, `route: the pill is hidden (${q.pill}) and the panel does not open (${q.panel})`);
}

ok(errors.length === 0, `no console errors (${errors.length})${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await browser.close();
console.log(failures ? `\ncheck-layers: ${failures} FAILED` : '\ncheck-layers: OK');
process.exit(failures ? 1 : 0);

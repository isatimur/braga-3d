#!/usr/bin/env node
// "Fix the map" panel check (src/report.js) in a real browser, with
// /api/report stubbed by page.route (no request leaves the browser).
// Spec: docs/specs/public-reports.md, phase 4.
//
//   node scripts/check-report.mjs [--base http://localhost:5471/] [--out dir]
//
// Runs:
//   1. desktop, map mode, pt: open from the menu, send, see the thanks; the
//      request carries the view centre (+-0.0001) and the category; the
//      dialog closes after 3 s and focus goes back to the button.
//   2. desktop, walk mode, en: open from the walk HUD, press Escape: the
//      dialog closes and the walk goes on.
//   3. phone size, walk mode, ru: the stub answers 503; the OSM note and the
//      GitHub links show, with the same lat/lon as the request.
//   4. without ?report=1: no menu button, no walk HUD button, no dialog.
// Needs a served build (npm run build, npx vite preview) and playwright-core
// with a Chromium; without them it exits 77 (skip). Env: PLAYWRIGHT_CORE.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  const v = i > 0 ? process.argv[i + 1] : undefined;
  return v === undefined || v.startsWith('--') ? d : v;
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

// Rua Dom Paio Mendes, by the cathedral (the check-walk start)
const START = { lat: 41.55005, lon: -8.42905 };
const TOL = 1e-4;
const fails = [];
const ok = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) fails.push(msg);
};
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shot = async (page, name) => {
  if (!OUT) return;
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`info screenshot ${file}`);
};

async function openPage({ phone = false, lang, report = true, stub = 200 }) {
  const browser = await launch();
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const requests = [];
  await page.route('**/api/report', async (route) => {
    requests.push(JSON.parse(route.request().postData() || 'null'));
    const body = stub === 200 ? { ok: true } : { error: 'not_configured' };
    await route.fulfill({ status: stub, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const q = `?intro=0&lang=${lang}${report ? '&report=1' : ''}`;
  await page.goto(`${BASE}${q}#time=day&weather=clear&live=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__braga?.ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  // the view centre on the start street
  await page.evaluate(({ lat, lon }) => {
    const P = window.__braga;
    const p = P.project(lat, lon);
    const y = P.heightAt(p.x, p.z);
    const V = P.camera.position.constructor;
    P.rig.flyTo(new V(p.x, y + 60, p.z + 80), new V(p.x, y, p.z), 0.05);
  }, START);
  await page.waitForTimeout(1500);
  return { browser, page, errors, requests };
}

async function startWalk(page) {
  await page.evaluate(() => { location.hash = 'walk'; });
  await page.waitForFunction(() => window.__braga.walk?.active === true, null, { timeout: 40000 });
  await page.waitForTimeout(1200);
}

const near = (a, b) => Math.abs(a - b) <= TOL;
// lat/lon from a URL that ends in "#map=19/<lat>/<lon>"
const mapLL = (href) => {
  const m = /#map=19\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(href || '');
  return m ? { lat: +m[1], lon: +m[2] } : null;
};
const dialogOpen = (page) => page.evaluate(() => !!document.querySelector('dialog.report')?.open);

// 1 ------------------------------------------------------------ map, pt
{
  const { browser, page, errors, requests } = await openPage({ lang: 'pt' });
  const target = await page.evaluate(() => { const t = window.__braga.rig.controls.target; return { x: t.x, z: t.z }; });
  const want = await page.evaluate(({ lat, lon }) => window.__braga.project(lat, lon), START);
  ok(Math.hypot(target.x - want.x, target.z - want.z) < 0.5, `map pt: the view centre is on the start street (${(Math.hypot(target.x - want.x, target.z - want.z) * 4).toFixed(2)} m off)`);
  const btn = page.locator('#report-open');
  if (!(await btn.isVisible())) await page.locator('#tools-toggle').click();
  ok(await btn.isVisible(), 'map pt: the «Corrigir o mapa» button is in the menu');
  ok((await btn.textContent()) === 'Corrigir o mapa', `map pt: button text "${await btn.textContent()}"`);
  await btn.click();
  ok(await dialogOpen(page), 'map pt: the dialog opens');
  ok((await page.locator('.report-place').textContent()) === 'Local: o centro do ecrã', 'map pt: place line "Local: o centro do ecrã"');
  ok(await page.locator('.report-cross').isVisible(), 'map pt: the crosshair shows');
  const hp = await page.locator('.report-hp').evaluate((el) => ({ box: el.getBoundingClientRect().right, tab: el.tabIndex, ac: el.autocomplete, hidden: el.getAttribute('aria-hidden') }));
  ok(hp.box <= 0 && hp.tab === -1 && hp.ac === 'off' && hp.hidden === 'true', `map pt: the honeypot is off screen, tabindex -1, autocomplete off, aria-hidden (${JSON.stringify(hp)})`);
  await page.locator('input[name="category"][value="road"]').check();
  ok(await page.locator('.report-osm').isVisible(), 'map pt: a road fault offers the OSM note');
  await page.locator('textarea[name="text"]').fill('O caminho junto à Sé está fechado há uma semana.');
  await page.locator('input[name="email"]').fill('visitante@example.pt');
  await shot(page, 'report-map-pt-open');
  // a too short text stays in the panel with its message, nothing is sent
  await page.locator('textarea[name="text"]').fill('curto');
  await page.locator('.report-send').click();
  ok(await page.locator('#report-text-err').isVisible() && requests.length === 0, 'map pt: a 5-letter text gets "Pelo menos 10 caracteres", no request');
  await page.locator('textarea[name="text"]').fill('O caminho junto à Sé está fechado há uma semana.');
  await page.waitForTimeout(2100); // the 2 s rule
  await page.locator('.report-send').click();
  await page.waitForFunction(() => /Obrigado/.test(document.querySelector('.report-status')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  ok((await page.locator('.report-status').textContent()) === 'Obrigado! Recebemos a sua mensagem.', 'map pt: the thanks shows');
  await shot(page, 'report-map-pt-thanks');
  const r = requests[0] || {};
  ok(requests.length === 1, `map pt: one request (${requests.length})`);
  ok(near(r.lat, START.lat) && near(r.lon, START.lon), `map pt: request place ${r.lat}, ${r.lon} within 0.0001 of the view centre ${START.lat}, ${START.lon}`);
  ok(r.category === 'road' && r.mode === 'map' && r.lang === 'pt' && r.city === 'braga', `map pt: category ${r.category}, mode ${r.mode}, lang ${r.lang}, city ${r.city}`);
  ok(r.x_note === '' && r.elapsed >= 2000 && r.email === 'visitante@example.pt', `map pt: x_note empty, elapsed ${r.elapsed} ms, e-mail sent`);
  await page.waitForTimeout(3400);
  ok(!(await dialogOpen(page)), 'map pt: the dialog closes after 3 s');
  const focused = await page.evaluate(() => { const a = document.activeElement; return a?.id || `${a?.tagName}.${a?.className}`; });
  // the button sits in the tools sheet, which the click closed: then the
  // sheet's toggle, the visible way back to the button
  const sheetClosed = await page.evaluate(() => !document.querySelector('#tools-sheet.is-open') && !!document.getElementById('report-open')?.closest('#tools-sheet'));
  ok(focused === 'report-open' || (sheetClosed && focused === 'tools-toggle'), `map pt: focus is back on the button, or on the menu toggle when the button is in the closed sheet (${focused})`);
  ok(errors.length === 0, `map pt: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await browser.close();
}

// 2 ----------------------------------------------------------- walk, en
{
  const { browser, page, errors } = await openPage({ lang: 'en' });
  await startWalk(page);
  const hud = page.locator('.walk-report');
  ok(await hud.isVisible(), 'walk en: the HUD has a «Fix the map» button');
  await hud.click();
  ok(await dialogOpen(page), 'walk en: the dialog opens from the HUD');
  ok((await page.locator('.report-place').textContent()) === 'Place: where the walker stands', 'walk en: place line "Place: where the walker stands"');
  await page.locator('input[name="category"][value="walk"]').check();
  ok(!(await page.locator('.report-osm').isVisible()), 'walk en: a walk fault offers no OSM note');
  await page.locator('input[name="category"][value="missing-building"]').check();
  await page.locator('textarea[name="text"]').fill('My house on this street is not on the map.');
  // the place is the walker's: the OSM link projects back onto walk.position
  const href = await page.locator('.report-osm a').getAttribute('href');
  const ll = mapLL(href);
  const d = ll && (await page.evaluate(({ lat, lon }) => { const P = window.__braga; const p = P.project(lat, lon); const w = P.walk.position; return Math.hypot(p.x - w.x, p.z - w.z) * 4; }, ll));
  ok(d != null && d < 1.5, `walk en: the OSM note is at the walker (${d?.toFixed(2)} m)`);
  await shot(page, 'report-walk-en-open');
  // keys in the dialog do not walk: W types into the text, the walker stays
  const before = await page.evaluate(() => window.__braga.walk.position);
  await page.locator('textarea[name="text"]').press('KeyW');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__braga.walk.position);
  ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.05, 'walk en: W in the dialog does not move the walker');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(!(await dialogOpen(page)), 'walk en: Escape closes the dialog');
  ok(await page.evaluate(() => window.__braga.walk.active === true), 'walk en: walk.active stays true');
  ok(errors.length === 0, `walk en: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await browser.close();
}

// 3 --------------------------------------------------- phone, walk, ru, 503
{
  const { browser, page, errors, requests } = await openPage({ phone: true, lang: 'ru', stub: 503 });
  await startWalk(page);
  await page.locator('.walk-report').click();
  ok(await dialogOpen(page), 'phone ru: the dialog opens from the HUD');
  await page.locator('input[name="category"][value="looks-wrong"]').check();
  await page.locator('textarea[name="text"]').fill('Крыша у этого дома не того цвета.');
  await page.waitForTimeout(2100);
  await page.locator('.report-send').click();
  await page.locator('.report-fallback').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  ok(await page.locator('.report-fallback').isVisible(), 'phone ru: 503 shows the fallback');
  ok((await page.locator('.report-fallback-lead').textContent()) === 'Не удалось отправить. Можно так:', 'phone ru: "Не удалось отправить. Можно так:"');
  ok((await page.locator('textarea[name="text"]').inputValue()) === 'Крыша у этого дома не того цвета.', 'phone ru: the text is kept');
  const r = requests[0] || {};
  ok(r.mode === 'walk' && r.lang === 'ru', `phone ru: request mode ${r.mode}, lang ${r.lang}`);
  const osm = mapLL(await page.locator('.report-fallback-osm').getAttribute('href'));
  ok(osm && near(osm.lat, r.lat) && near(osm.lon, r.lon), `phone ru: OSM note link at ${osm?.lat}, ${osm?.lon} = request ${r.lat}, ${r.lon}`);
  const gh = new URL(await page.locator('.report-gh').getAttribute('href'));
  ok(gh.origin + gh.pathname === 'https://github.com/isatimur/braga-3d/issues/new', `phone ru: GitHub link ${gh.origin}${gh.pathname}`);
  ok(gh.searchParams.get('title') === `[looks-wrong] ${r.lat}, ${r.lon}`, `phone ru: GitHub title "${gh.searchParams.get('title')}"`);
  ok(!/e-mail|version/.test(gh.searchParams.get('body')), 'phone ru: the GitHub body has no e-mail and no version line');
  ok(await page.locator('.report-fallback small').isVisible(), 'phone ru: "Это сообщение будет видно всем." shows');
  await page.locator('.report-fallback').scrollIntoViewIfNeeded();
  await shot(page, 'report-phone-ru-fallback');
  ok(errors.length === 0, `phone ru: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await browser.close();
}

// 4 ---------------------------------------------------------- gate off
{
  const { browser, page, errors } = await openPage({ lang: 'en', report: false });
  ok((await page.locator('#report-open').count()) === 0, 'no ?report=1: no menu button');
  ok((await page.locator('dialog.report').count()) === 0, 'no ?report=1: no dialog');
  ok(await page.evaluate(() => window.__braga.report === null), 'no ?report=1: installReport returned null');
  await startWalk(page);
  ok((await page.locator('.walk-report').count()) === 0, 'no ?report=1: no walk HUD button');
  ok(errors.length === 0, `no ?report=1: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);

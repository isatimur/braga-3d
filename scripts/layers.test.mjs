// The layer definitions (src/layer-defs.js) and the status line
// (src/load-status.js). Ported from lisboa-3d; Braga has no photo-texture
// layer, so its Standard preset holds every layer and the panel offers two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAYERS, PRESETS, PRESET_ORDER, CLASS_PRESET, defaultsFor, resolveSelection, presetOf, selectionBytes, formatMB, urlSelection } from '../src/layer-defs.js';
import { createWave, summarize } from '../src/load-status.js';

const ids = LAYERS.map((l) => l.id);

test('every layer has a Russian source name and a file or chunk list', () => {
  for (const l of LAYERS) {
    assert.ok(l.name && /[а-я]/i.test(l.name), `${l.id} name`);
    assert.ok(l.files.length + (l.chunks?.length || 0) > 0, `${l.id} files`);
  }
});

test('Braga: the ring, the MS buildings, the street level and the live layer; no textures', () => {
  assert.deepEqual([...ids].sort(), ['live', 'ms', 'ring', 'street']);
});

test('pois.json stays core: Discovery and the search read it on every visit', () => {
  for (const l of LAYERS) assert.ok(!l.files.some((f) => /pois\.json/.test(f)), `${l.id} lists pois.json`);
  // main.js installs the POI list before any layer is known
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /\n {2}installPois\(debug\);/);
});

test('the buses ride on the TUB timetable: the live layer owns data/gtfs', () => {
  const live = LAYERS.find((l) => l.id === 'live');
  assert.ok(live.files.includes('data/gtfs/**'));
  assert.deepEqual([...live.chunks].sort(), ['liveair', 'livebus']);
});

test('every Russian source string of the panel and the pill has a pt and an en text', async () => {
  const { messages } = await import('../src/locales/ui.js');
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const src = read('layers-ui.js') + read('load-status.js');
  const keys = new Set([
    ...LAYERS.flatMap((l) => [l.name, l.hint]),
    ...[...src.matchAll(/t\('([^']*[а-яё][^']*)'\)/gi)].map((m) => m[1]),
    // the name tables of layers-ui.js (passed through t() by variable)
    ...[...read('layers-ui.js').matchAll(/(?:PRESET_NAMES|STATE_NAMES) = \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).filter((s) => /[а-яё]/i.test(s))),
  ]);
  assert.ok(keys.size > 30, `only ${keys.size} strings found`);
  for (const k of keys) {
    const v = messages[k];
    assert.ok(Array.isArray(v) && v.length === 2 && v.every((s) => typeof s === 'string' && s.length), `no pt/en for «${k}»`);
  }
});

test('Full is every layer, Light is none; with no fullOnly layer Standard equals Full and the panel offers two presets', () => {
  assert.deepEqual([...PRESETS.full].sort(), [...ids].sort());
  assert.deepEqual(PRESETS.light, []);
  assert.deepEqual([...PRESETS.standard].sort(), [...ids].sort());
  assert.deepEqual(PRESET_ORDER, ['light', 'compact', 'full']);
});

test('class defaults: phones of the low and potato class start compact (extra buildings and street level, no ring, no live data), the rest get every layer', () => {
  for (const c of ['XL', 'L', 'M', 'S', 'P']) assert.ok(CLASS_PRESET[c], c);
  assert.equal(presetOf(defaultsFor('S')), 'compact');
  assert.equal(presetOf(defaultsFor('P')), 'compact');
  assert.deepEqual(defaultsFor('S'), { ring: false, ms: true, street: true, live: false });
  assert.equal(presetOf(defaultsFor('XL')), 'full');
  assert.equal(presetOf(defaultsFor('L')), 'full');
  // M keeps the lisboa-3d rule (Standard), which is every layer here
  assert.equal(CLASS_PRESET.M, 'standard');
  assert.equal(presetOf(defaultsFor('M')), 'full');
  // an unknown class gets the standard preset
  assert.equal(presetOf(defaultsFor('?')), 'full');
});

test('a saved choice wins, and merges with the class defaults for new layers', () => {
  const saved = JSON.stringify({ v: 1, layers: { ring: true, live: false } });
  const r = resolveSelection(saved, 'S');
  assert.equal(r.source, 'saved');
  assert.equal(r.layers.ring, true);
  assert.equal(r.layers.live, false);
  // not in the saved record: the class default (S: street level on)
  assert.equal(r.layers.street, true);
  for (const id of ids) assert.equal(typeof r.layers[id], 'boolean');
});

test('a broken or foreign saved value falls back to the class defaults', () => {
  for (const bad of [null, '', '{', '[]', '{"v":1}', '{"v":1,"layers":5}', '{"v":1,"layers":{"ring":"yes"}}']) {
    const r = resolveSelection(bad, 'XL');
    assert.equal(presetOf(r.layers), 'full', String(bad));
  }
  assert.equal(resolveSelection(null, 'S').source, 'default');
  // unknown layer ids in storage are dropped
  assert.equal('nope' in resolveSelection('{"v":1,"layers":{"nope":true}}', 'S').layers, false);
});

test('the URL can pin a preset or a list of layers (tests, measurements)', () => {
  assert.equal(urlSelection(''), null);
  assert.equal(presetOf(urlSelection('?layers=light')), 'light');
  assert.equal(presetOf(urlSelection('?layers=full')), 'full');
  assert.equal(presetOf(urlSelection('?layers=standard')), 'full');
  const l = urlSelection('?layers=ring,street');
  assert.equal(l.ring, true);
  assert.equal(l.street, true);
  assert.equal(l.live, false);
  assert.equal(presetOf(urlSelection('?layers=none')), 'light');
  assert.equal(urlSelection('?layers=bogus'), null);
});

test('presetOf names a selection, or custom', () => {
  const all = Object.fromEntries(ids.map((id) => [id, true]));
  assert.equal(presetOf(all), 'full');
  assert.equal(presetOf({ ...all, live: false }), 'custom');
  assert.equal(presetOf({ ...Object.fromEntries(ids.map((id) => [id, false])), ring: true }), 'custom');
});

test('selection bytes come from the manifest; a missing entry is unknown, never 0', () => {
  const manifest = { layers: { ring: { bytes: 1000 }, live: { bytes: 5000 } } };
  const sel = Object.fromEntries(ids.map((id) => [id, false]));
  assert.deepEqual(selectionBytes({ ...sel, ring: true, live: true }, manifest), { bytes: 6000, unknown: false });
  assert.deepEqual(selectionBytes({ ...sel, street: true }, manifest), { bytes: 0, unknown: true });
  assert.deepEqual(selectionBytes(sel, null), { bytes: 0, unknown: false });
  assert.equal(selectionBytes({ ...sel, ring: true }, null).unknown, true);
});

test('formatMB: one decimal, the language decimal mark, small sizes in KB', () => {
  assert.equal(formatMB(8_400_000, 'en'), '8.4 MB');
  assert.equal(formatMB(8_400_000, 'pt'), '8,4 MB');
  assert.equal(formatMB(8_400_000, 'ru'), '8,4 МБ');
  assert.equal(formatMB(41_000, 'en'), '41 KB');
  assert.equal(formatMB(41_000, 'ru'), '41 КБ');
  assert.equal(formatMB(0, 'en'), '0 KB');
  assert.equal(formatMB(null, 'en'), '?');
});

test('data/layers.json, when present, lists exactly these layers', () => {
  let doc = null;
  try {
    doc = JSON.parse(readFileSync(new URL('../data/layers.json', import.meta.url), 'utf8'));
  } catch {
    return; // not generated yet (npm run build && npm run layers)
  }
  assert.deepEqual(Object.keys(doc.layers).sort(), [...ids].sort());
  for (const id of ids) assert.ok(Number.isFinite(doc.layers[id].bytes) && doc.layers[id].bytes > 0, id);
});

// ------------------------------------------------------------ the area wave
test('a wave counts the tiles sent since the last quiet moment', () => {
  const w = createWave();
  assert.equal(w.snapshot().active, false);
  w.send();
  w.send();
  w.send();
  assert.deepEqual(pick(w.snapshot()), { active: true, done: 0, total: 3, failed: 0 });
  w.finish('ok');
  w.finish('error');
  assert.deepEqual(pick(w.snapshot()), { active: true, done: 2, total: 3, failed: 1 });
  w.finish('ok', 1000);
  const s = w.snapshot();
  assert.equal(s.active, false);
  assert.equal(s.endedAt, 1000);
  assert.equal(s.done, 3);
  // the next send starts a new wave from zero
  w.send();
  assert.deepEqual(pick(w.snapshot()), { active: true, done: 0, total: 1, failed: 0 });
});

test('a superseded request leaves the wave without counting as done', () => {
  const w = createWave();
  w.send();
  w.send();
  w.finish('cancel');
  assert.deepEqual(pick(w.snapshot()), { active: true, done: 0, total: 1, failed: 0 });
  w.finish('ok', 5);
  assert.equal(w.snapshot().active, false);
});

test('more sends while a wave runs grow the same wave', () => {
  const w = createWave();
  w.send();
  w.finish('ok');
  assert.equal(w.snapshot().active, false);
  w.send();
  w.send();
  w.finish('ok');
  w.send();
  assert.deepEqual(pick(w.snapshot()), { active: true, done: 1, total: 3, failed: 0 });
});

const pick = ({ active, done, total, failed }) => ({ active, done, total, failed });

// ------------------------------------------------------------ the status line
const tr = (s) => s; // identity: the Russian source strings

test('nothing loading: the status is idle and says nothing', () => {
  const s = summarize([], { now: 0, t: tr });
  assert.equal(s.state, 'idle');
  assert.equal(s.text, '');
});

test('an area wave reads "this area, n of m"', () => {
  const s = summarize([{ id: 'area', kind: 'area', active: true, done: 3, total: 8, failed: 0 }], { now: 0, t: tr });
  assert.equal(s.state, 'loading');
  assert.match(s.text, /3/);
  assert.match(s.text, /8/);
  assert.match(s.text, /район/);
});

test('a layer being switched on names itself and counts its items when it knows them', () => {
  const a = summarize([{ id: 'live', kind: 'layer', label: 'Самолёты и автобусы', active: true, done: 4, total: 15 }], { now: 0, t: tr });
  assert.equal(a.state, 'loading');
  assert.match(a.text, /Самолёты/);
  assert.match(a.text, /4/);
  assert.match(a.text, /15/);
  // no total known: no numbers invented
  const b = summarize([{ id: 'street', kind: 'layer', label: 'Улицы', active: true, done: 0, total: 0 }], { now: 0, t: tr });
  assert.doesNotMatch(b.text, /\d/);
});

test('two things at once: the first one and how many more', () => {
  const s = summarize(
    [
      { id: 'street', kind: 'layer', label: 'Уровень улицы', active: true, done: 0, total: 0 },
      { id: 'area', kind: 'area', active: true, done: 0, total: 4 },
    ],
    { now: 0, t: tr },
  );
  assert.match(s.text, /\+1/);
});

test('finished: says done for a short while, then goes idle', () => {
  const e = [{ id: 'area', kind: 'area', active: false, done: 8, total: 8, failed: 0, endedAt: 1000 }];
  assert.equal(summarize(e, { now: 1500, t: tr }).state, 'done');
  assert.equal(summarize(e, { now: 1000 + 60000, t: tr }).state, 'idle');
});

test('a failed tile after the wave: failed state with a retry, until retried', () => {
  const e = [{ id: 'area', kind: 'area', active: false, done: 8, total: 8, failed: 1, stuck: 2, endedAt: 1000 }];
  const s = summarize(e, { now: 99999, t: tr });
  assert.equal(s.state, 'failed');
  assert.equal(s.retry, 'area');
  assert.match(s.text, /2/);
  // a layer that failed to load
  const l = summarize([{ id: 'street', kind: 'layer', label: 'Улицы', active: false, error: true, endedAt: 5 }], { now: 99999, t: tr });
  assert.equal(l.state, 'failed');
  assert.equal(l.retry, 'street');
});

test('loading wins over failed and done', () => {
  const s = summarize(
    [
      { id: 'area', kind: 'area', active: false, stuck: 1, endedAt: 1 },
      { id: 'ms', kind: 'area', active: true, done: 1, total: 2 },
    ],
    { now: 2, t: tr },
  );
  assert.equal(s.state, 'loading');
});

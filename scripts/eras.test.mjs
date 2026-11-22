// eras.js, quest points and analytics.js: pure logic, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ERAS, yearSpan, erasOf } from '../src/eras.js';
import { questPoints, STOP_POINTS, ROUTE_BONUS } from '../src/quest-progress.js';
import { analyticsOn, eventData } from '../src/analytics.js';

const landmarks = JSON.parse(readFileSync(new URL('../data/landmarks.json', import.meta.url), 'utf8'));

test('yearSpan reads years in digits and centuries in Roman numerals', () => {
  assert.deepEqual(yearSpan('1625'), [1625, 1625]);
  assert.deepEqual(yearSpan('1722–1811'), [1722, 1811]);
  assert.deepEqual(yearSpan('1918, 2007'), [1918, 2007]);
  assert.deepEqual(yearSpan('XI век'), [1001, 1100]);
  assert.deepEqual(yearSpan('XIV–XVIII века'), [1301, 1800]);
  assert.deepEqual(yearSpan('I–II века н. э.'), [1, 200]);
  assert.deepEqual(yearSpan('VII–X века'), [601, 1000]);
  assert.equal(yearSpan(''), null);
  assert.equal(yearSpan('дата неизвестна'), null);
});

test('eras are contiguous date ranges that cover every year', () => {
  for (let i = 1; i < ERAS.length; i++) assert.equal(ERAS[i].from, ERAS[i - 1].to + 1, ERAS[i].id);
  assert.equal(ERAS[0].from, -Infinity);
  assert.equal(ERAS.at(-1).to, Infinity);
});

// The whole assignment for Braga, written out so a reader can check each
// line against the place's stated dates. A new place must be added here.
const EXPECTED = {
  'termas-romanas': ['roman'],
  'fonte-idolo': ['roman'],
  'sao-frutuoso': ['medieval'],
  'se-braga': ['medieval'],
  'torre-menagem': ['medieval'],
  'santa-barbara': ['medieval', 'early-modern'],
  coimbras: ['early-modern'],
  populo: ['early-modern'],
  'santa-cruz': ['early-modern'],
  biscainhos: ['early-modern'],
  tibaes: ['early-modern'],
  'palacio-raio': ['early-modern'],
  'arco-porta-nova': ['early-modern'],
  'praca-republica': ['early-modern'],
  congregados: ['early-modern'],
  'sao-marcos': ['early-modern'],
  'bom-jesus': ['early-modern', 'modern'],
  sameiro: ['modern'],
  'avenida-central': ['modern'],
  'parque-ponte': ['modern'],
  'theatro-circo': ['modern'],
  'diogo-sousa': ['modern'],
  'ucp-braga': ['modern'],
  'estadio-1-maio': ['modern'],
  'dmaria-ii': ['modern'],
  'nogueira-silva': ['modern'],
  'forum-braga': ['modern'],
  'uminho-gualtar': ['modern'],
  'leonardo-da-vinci': ['modern'],
  'estadio-braga': ['modern'],
};

test('every Braga place gets the eras its stated dates touch', () => {
  const got = Object.fromEntries(landmarks.map((l) => [l.id, erasOf(l.year)]));
  assert.deepEqual(got, EXPECTED);
  for (const l of landmarks) assert.ok(erasOf(l.year).length, `${l.id}: no era from «${l.year}»`);
});

test('the era names have a pt and an en text', async () => {
  const { messages } = await import('../src/locales/ui.js');
  for (const k of [...ERAS.map((e) => e.name), 'Фильтр по эпохам']) {
    assert.ok(Array.isArray(messages[k]) && messages[k].length === 2 && messages[k].every(Boolean), `no pt/en for «${k}»`);
  }
});

test('route points: 100 a solved stop, 200 once for the whole route, nothing for tries', () => {
  assert.equal(STOP_POINTS, 100);
  assert.equal(ROUTE_BONUS, 200);
  assert.deepEqual(questPoints({ done: 0, total: 5 }), { points: 0, max: 700 });
  assert.deepEqual(questPoints({ done: 2, total: 5 }), { points: 200, max: 700 });
  assert.deepEqual(questPoints({ done: 5, total: 5 }), { points: 700, max: 700 });
  assert.deepEqual(questPoints({ done: 0, total: 0 }), { points: 0, max: 0 });
});

test('analytics: on only for the named provider and never on a local host', () => {
  assert.equal(analyticsOn('vercel', 'braga-3d.com'), true);
  assert.equal(analyticsOn(null, 'braga-3d.com'), false);
  assert.equal(analyticsOn('other', 'braga-3d.com'), false);
  for (const h of ['localhost', '127.0.0.1', '[::1]', 'braga.localhost', 'braga.test']) assert.equal(analyticsOn('vercel', h), false, h);
});

test('analytics: an event carries its non-null keys and not its name', () => {
  assert.deepEqual(eventData({ name: 'landmark_selected', city: 'braga', route: null, stop: 'se-braga', attempt: null, type: null, lang: 'en' }), { city: 'braga', stop: 'se-braga', lang: 'en' });
});

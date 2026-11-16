// History route (#quest): accuracy and wiring checks for data/quest.json.
// Every history line, every answer basis and every visit line must be a
// verbatim excerpt of the landmark's own text in the same language, so the
// route never says more than the sourced place cards do.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { messages } from '../src/locales/ui.js';
import { createQuestProgress, questSummary, stopResult, migrateProgress, LEGACY_ROUTE } from '../src/quest-progress.js';

const root = new URL('../', import.meta.url);
// a fork without the route's data skips these checks (as verify skips a
// check whose input is missing)
const HAS = existsSync(new URL('data/quest.json', root)) && existsSync(new URL('src/locales/en.js', root));
const test = HAS ? nodeTest : (name) => nodeTest(name, { skip: 'no data/quest.json here' }, () => {});
const quest = HAS ? JSON.parse(readFileSync(new URL('data/quest.json', root), 'utf8')) : null;
const LM = HAS ? JSON.parse(readFileSync(new URL('data/landmarks.json', root), 'utf8')) : [];
const EN = HAS ? (await import('../src/locales/en.js')).landmarks : {};
const PT = HAS ? (await import('../src/locales/pt.js')).landmarks : {};
const byId = new Map(LM.map((l) => [l.id, l]));
const LANGS = ['ru', 'en', 'pt'];
const CYRILLIC = /[А-Яа-яЁё]/;

// the texts a stop may quote, per language and field
function sourceText(id, lang) {
  const l = byId.get(id);
  if (lang === 'ru') return { history: l.history_ru, facts: (l.facts_ru || []).join('\n'), tip: l.tip_ru, long: l.long_ru };
  const tr = (lang === 'en' ? EN : PT)[id] || {};
  return { history: tr.history, facts: (tr.facts || []).join('\n'), tip: tr.tip, long: tr.long };
}
const inAny = (line, src, fields) => fields.some((f) => typeof src[f] === 'string' && src[f].includes(line));

test('five stops, each a known landmark with its sources', () => {
  assert.equal(quest.stops.length, 5);
  assert.equal(new Set(quest.stops.map((s) => s.id)).size, 5);
  for (const s of quest.stops) {
    const l = byId.get(s.id);
    assert.ok(l, `${s.id}: not in data/landmarks.json`);
    assert.ok(l.sources?.length >= 2, `${s.id}: needs at least two sources`);
    assert.deepEqual([...s.sources].sort(), l.sources.map((q) => q.url).sort(), `${s.id}: sources differ from the landmark`);
  }
});

test('history lines are verbatim excerpts of the place card, in every language', () => {
  for (const s of quest.stops) {
    for (const lang of LANGS) {
      const lines = s.text[lang];
      assert.ok(Array.isArray(lines) && lines.length >= 2 && lines.length <= 4, `${s.id}/${lang}: 2-4 lines`);
      const src = sourceText(s.id, lang);
      for (const line of lines) assert.ok(inAny(line, src, ['history', 'facts', 'long']), `${s.id}/${lang}: not in the place card: «${line}»`);
    }
  }
});

test('each right answer rests on a verbatim fact in every language', () => {
  for (const s of quest.stops) {
    assert.equal(s.options.length, 3, `${s.id}: three options`);
    assert.ok(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < 3, `${s.id}: answer index`);
    for (const lang of LANGS) {
      assert.ok(s.question[lang]?.trim(), `${s.id}/${lang}: question`);
      for (const o of s.options) assert.ok(o[lang]?.trim(), `${s.id}/${lang}: option text`);
      assert.ok(inAny(s.basis[lang], sourceText(s.id, lang), ['history', 'facts']), `${s.id}/${lang}: basis not in the place card: «${s.basis[lang]}»`);
    }
  }
});

test('the year shown on each stop agrees across languages', () => {
  const years = (s) => (String(s ?? '').match(/\d{4}/g) || []).join(',');
  for (const s of quest.stops) {
    const ru = years(byId.get(s.id).year);
    for (const tr of [EN, PT]) if (tr[s.id]?.year != null) assert.equal(years(tr[s.id].year), ru, `${s.id}: year «${tr[s.id].year}» vs «${byId.get(s.id).year}»`);
  }
});

test('the menu label, its title and the load error are translated', () => {
  for (const k of ['Исторический маршрут', 'Откройте историческую Брагу: пять мест, пять вопросов', 'Не удалось загрузить маршрут']) {
    assert.ok(messages[k]?.[0] && messages[k]?.[1], `src/locales/ui.js: ${k}`);
  }
});

test('the right answer is not always in the same place', () => {
  assert.ok(new Set(quest.stops.map((s) => s.answer)).size >= 2);
});

test('visit lines quote the place card tip and carry no opening hours', () => {
  for (const s of quest.stops) {
    for (const lang of LANGS) {
      const src = sourceText(s.id, lang);
      assert.ok(s.visit[lang]?.length >= 1, `${s.id}/${lang}: visit line`);
      for (const line of s.visit[lang]) {
        assert.ok(inAny(line, src, ['tip']), `${s.id}/${lang}: not in the tip: «${line}»`);
        assert.doesNotMatch(line, /\d{1,2}[:.h]\d{2}|€|EUR/, `${s.id}/${lang}: hours or prices go stale`);
      }
    }
  }
});

test('English and Portuguese texts have no Russian left in them', () => {
  const strings = (lang) => [
    ...Object.values(quest.ui).map((v) => v[lang]),
    ...quest.stops.flatMap((s) => [...s.text[lang], s.question[lang], s.basis[lang], ...s.visit[lang], ...s.options.map((o) => o[lang])]),
    ...quest.stops.map((s) => (lang === 'en' ? EN : PT)[s.id]?.name || byId.get(s.id).name_pt),
  ];
  for (const lang of ['en', 'pt']) for (const str of strings(lang)) assert.doesNotMatch(str, CYRILLIC, `${lang}: «${str}»`);
});

test('every interface string the module uses exists in all three languages', () => {
  for (const [k, v] of Object.entries(quest.ui)) for (const lang of LANGS) assert.ok(v[lang]?.trim(), `ui.${k}.${lang}`);
  const code = readFileSync(new URL('src/quest.js', root), 'utf8');
  const used = new Set([...code.matchAll(/\bs\('([a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(used.size > 10, 'the module reads its strings through s()');
  // keys built or chosen at run time
  for (const k of ['correct_gold', 'correct_plain', 'stamp_gold', 'stamp_plain', 'stamp_seen', 'stamp_none']) used.add(k);
  for (const k of used) assert.ok(quest.ui[k], `src/quest.js uses ui.${k}, missing in data/quest.json`);
  // no reconstruction is called historical; no feature is promised
  for (const v of Object.values(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], /reconstru|реконструк/i);
});

// a localStorage stand-in; returns its Map
function fakeStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  return store;
}
const wrongOf = (s, n = 1) => (s.answer + n) % 3;

test('retry: a wrong pick is kept and disabled, the right one closes the stop', () => {
  fakeStorage();
  const stops = quest.stops;
  const rp = createQuestProgress('braga').route(LEGACY_ROUTE);
  const [a, b] = stops;
  assert.deepEqual(questSummary(stops, rp), { gold: 0, done: 0, visited: 0, started: 0, total: 5, next: 0 });
  rp.visit(a.id);
  assert.equal(rp.visited(a.id), true);
  // stop 1: right first time
  assert.equal(rp.pick(a.id, a.answer, a.answer), 'right');
  assert.equal(rp.pick(a.id, wrongOf(a), a.answer), null, 'a done stop takes no more picks');
  assert.deepEqual(stopResult(rp.tries(a.id), a.answer), { done: true, attempts: 1, gold: true });
  // stop 2: wrong, the same wrong again (ignored), another wrong, then right
  assert.equal(rp.pick(b.id, wrongOf(b), b.answer), 'wrong');
  assert.deepEqual(stopResult(rp.tries(b.id), b.answer), { done: false, attempts: 1, gold: false });
  assert.equal(rp.pick(b.id, wrongOf(b), b.answer), null, 'a tried option is disabled');
  assert.equal(rp.pick(b.id, 7.5, b.answer), null, 'not an option');
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 1, visited: 2, started: 2, total: 5, next: 1 });
  assert.equal(rp.pick(b.id, wrongOf(b, 2), b.answer), 'wrong');
  assert.equal(rp.pick(b.id, b.answer, b.answer), 'right');
  assert.deepEqual(stopResult(rp.tries(b.id), b.answer), { done: true, attempts: 3, gold: false });
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 2, visited: 2, started: 2, total: 5, next: 2 });
  // a reload mid-stop does not give a fresh first try
  const c = stops[2];
  rp.pick(c.id, wrongOf(c), c.answer);
  const again = createQuestProgress('braga').route(LEGACY_ROUTE);
  assert.deepEqual(again.tries(c.id), [wrongOf(c)]);
  assert.equal(again.pick(c.id, c.answer, c.answer), 'right');
  assert.equal(stopResult(again.tries(c.id), c.answer).gold, false);
  again.reset();
  assert.deepEqual(questSummary(stops, createQuestProgress('braga').route(LEGACY_ROUTE)), { gold: 0, done: 0, visited: 0, started: 0, total: 5, next: 0 });
  delete globalThis.localStorage;
});

test('progress: the first-round save migrates without loss, once, into the first route only', () => {
  const stops = quest.stops;
  const answers = Object.fromEntries(stops.map((s) => [s.id, s.answer]));
  const [a, b, c] = stops;
  const old = { visited: { [a.id]: 1, [b.id]: 1, [c.id]: 1 }, answers: { [a.id]: a.answer, [b.id]: wrongOf(b) } };
  const store = fakeStorage({ 'braga-quest-braga': JSON.stringify(old) });
  const p = createQuestProgress('braga', answers);
  const rp = p.route(LEGACY_ROUTE);
  // right stays gold; the old wrong (final, it showed the answer) becomes a plain stamp
  assert.deepEqual(stopResult(rp.tries(a.id), a.answer), { done: true, attempts: 1, gold: true });
  assert.deepEqual(stopResult(rp.tries(b.id), b.answer), { done: true, attempts: 2, gold: false });
  assert.equal(rp.visited(c.id), true);
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 2, visited: 3, started: 2, total: 5, next: 2 });
  assert.equal(p.last, LEGACY_ROUTE);
  // another route that shares a stop does not inherit the answer
  assert.deepEqual(p.route('another').tries(a.id), []);
  // the new key is written on the first change; the old one is left alone
  rp.visit(stops[3].id);
  assert.equal(store.get('braga-quest-braga'), JSON.stringify(old));
  assert.equal(JSON.parse(store.get('braga-quests-braga')).v, 2);
  // once the new save exists the old one is not read again
  store.set('braga-quest-braga', JSON.stringify({ visited: {}, answers: { [c.id]: c.answer } }));
  assert.deepEqual(createQuestProgress('braga', answers).route(LEGACY_ROUTE).tries(c.id), []);
  delete globalThis.localStorage;
});

test('progress: broken or foreign saves and blocked storage never throw', () => {
  for (const raw of ['{not json', 'null', '[]', '42', '"x"', JSON.stringify({ v: 2, routes: { r: { visited: 5, tries: { s: 'x', t: [1, 1, 'y', -1, 2] } } } })]) {
    fakeStorage({ 'braga-quests-braga': raw, 'braga-quest-braga': '{broken' });
    const rp = createQuestProgress('braga', {}).route('r');
    assert.deepEqual(rp.tries('s'), []);
    if (raw.includes('"t"')) assert.deepEqual(rp.tries('t'), [1, 2], 'only valid, unique picks survive');
    assert.equal(rp.pick('s', 0, 1), 'wrong');
  }
  assert.deepEqual(migrateProgress(null, { answers: { x: 'a' } }), { v: 2, last: null, routes: {} });
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blocked = createQuestProgress('braga').route('r');
  blocked.visit('x');
  assert.equal(blocked.pick('x', 1, 1), 'right');
  assert.deepEqual(blocked.tries('x'), [1]);
  delete globalThis.localStorage;
});

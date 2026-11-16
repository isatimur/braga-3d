// History routes (#quest): accuracy and wiring checks for data/quest.json.
// Every history line, every answer basis and every visit line of every route
// must be a verbatim excerpt of the landmark's own text in the same language,
// so a route never says more than the sourced place cards do.
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
const ROUTES = quest?.routes || [];
const STOPS = ROUTES.flatMap((r) => r.stops.map((s) => ({ ...s, route: r.id })));
const LM = HAS ? JSON.parse(readFileSync(new URL('data/landmarks.json', root), 'utf8')) : [];
const EN = HAS ? (await import('../src/locales/en.js')).landmarks : {};
const PT = HAS ? (await import('../src/locales/pt.js')).landmarks : {};
const byId = new Map(LM.map((l) => [l.id, l]));
const LANGS = ['ru', 'en', 'pt'];
const CYRILLIC = /[А-Яа-яЁё]/;
const tag = (s) => `${s.route}/${s.id}`;

// the texts a stop may quote, per language and field
function sourceText(id, lang) {
  const l = byId.get(id);
  if (lang === 'ru') return { history: l.history_ru, facts: (l.facts_ru || []).join('\n'), tip: l.tip_ru, long: l.long_ru };
  const tr = (lang === 'en' ? EN : PT)[id] || {};
  return { history: tr.history, facts: (tr.facts || []).join('\n'), tip: tr.tip, long: tr.long };
}
const inAny = (line, src, fields) => fields.some((f) => typeof src[f] === 'string' && src[f].includes(line));

test('routes: stable unique ids, the first round kept as the first route', () => {
  assert.ok(ROUTES.length >= 2, 'at least two routes');
  const ids = ROUTES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'route ids are unique');
  for (const id of ids) {
    // the id is a URL path (public/route/<id>/) and a hash value: kebab case,
    // and never a language folder of the text pages
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `route id «${id}»`);
    assert.ok(!['en', 'ru', 'pt'].includes(id), `route id «${id}» clashes with a language folder`);
  }
  assert.equal(ROUTES[0].id, LEGACY_ROUTE, 'the first-round route keeps its id (saved progress migrates into it)');
  for (const r of ROUTES) {
    for (const k of ['title', 'intro', 'end_lead']) for (const lang of LANGS) assert.ok(r[k]?.[lang]?.trim(), `${r.id}: ${k}.${lang}`);
    assert.ok(r.stops.length >= 3 && r.stops.length <= 7, `${r.id}: 3 to 7 stops`);
    assert.equal(new Set(r.stops.map((s) => s.id)).size, r.stops.length, `${r.id}: a stop appears once`);
    for (const id of r.overview || []) assert.ok(r.stops.some((s) => s.id === id), `${r.id}: overview ${id} is not a stop`);
  }
});

test('each stop is a known landmark with its sources', () => {
  for (const s of STOPS) {
    const l = byId.get(s.id);
    assert.ok(l, `${tag(s)}: not in data/landmarks.json`);
    assert.ok(l.sources?.length >= 2, `${tag(s)}: needs at least two sources`);
    assert.ok(l.image && l.image_credit, `${tag(s)}: needs a credited photo`);
    assert.deepEqual([...s.sources].sort(), l.sources.map((q) => q.url).sort(), `${tag(s)}: sources differ from the landmark`);
  }
});

test('history lines are verbatim excerpts of the place card, in every language', () => {
  for (const s of STOPS) {
    for (const lang of LANGS) {
      const lines = s.text[lang];
      assert.ok(Array.isArray(lines) && lines.length >= 2 && lines.length <= 4, `${tag(s)}/${lang}: 2-4 lines`);
      const src = sourceText(s.id, lang);
      for (const line of lines) assert.ok(inAny(line, src, ['history', 'facts', 'long']), `${tag(s)}/${lang}: not in the place card: «${line}»`);
    }
  }
});

test('each right answer rests on a verbatim fact in every language', () => {
  for (const s of STOPS) {
    assert.equal(s.options.length, 3, `${tag(s)}: three options`);
    assert.ok(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < 3, `${tag(s)}: answer index`);
    for (const lang of LANGS) {
      assert.ok(s.question[lang]?.trim(), `${tag(s)}/${lang}: question`);
      for (const o of s.options) assert.ok(o[lang]?.trim(), `${tag(s)}/${lang}: option text`);
      assert.equal(new Set(s.options.map((o) => o[lang])).size, 3, `${tag(s)}/${lang}: three different options`);
      assert.ok(inAny(s.basis[lang], sourceText(s.id, lang), ['history', 'facts']), `${tag(s)}/${lang}: basis not in the place card: «${s.basis[lang]}»`);
    }
  }
});

test('a stop shared by two routes asks a different question in each', () => {
  const seen = new Map();
  for (const s of STOPS) {
    const prev = seen.get(s.id);
    if (prev) {
      for (const lang of LANGS) {
        assert.notEqual(s.question[lang], prev.question[lang], `${s.id}/${lang}: same question in ${prev.route} and ${s.route}`);
        assert.notEqual(s.basis[lang], prev.basis[lang], `${s.id}/${lang}: same answer basis in ${prev.route} and ${s.route}`);
      }
    } else seen.set(s.id, s);
  }
  assert.ok([...new Set(STOPS.map((s) => s.id))].length < STOPS.length, 'the routes share at least one stop (else this test checks nothing)');
});

test('the year shown on each stop agrees across languages', () => {
  const years = (s) => (String(s ?? '').match(/\d{4}/g) || []).join(',');
  for (const id of new Set(STOPS.map((s) => s.id))) {
    const ru = years(byId.get(id).year);
    for (const tr of [EN, PT]) if (tr[id]?.year != null) assert.equal(years(tr[id].year), ru, `${id}: year «${tr[id].year}» vs «${byId.get(id).year}»`);
  }
});

test('the menu label, its title and the load error are translated', () => {
  for (const k of ['Исторический маршрут', 'Откройте историческую Брагу: пять мест, пять вопросов', 'Не удалось загрузить маршрут']) {
    assert.ok(messages[k]?.[0] && messages[k]?.[1], `src/locales/ui.js: ${k}`);
  }
});

test('the right answer is not always in the same place', () => {
  for (const r of ROUTES) assert.ok(new Set(r.stops.map((s) => s.answer)).size >= 2, r.id);
});

test('visit lines quote the place card tip and carry no hours, prices or closures', () => {
  // these go stale: opening hours, prices, «closed on Mondays», «temporarily closed»
  const STALE = /\d{1,2}[:.h]\d{2}|€|EUR|clos|encerra|fechad|закрыт|выходн|monday|tuesday|wednesday|thursday|friday|saturday|sunday|segunda|terça|quarta|quinta|sexta|sábado|domingo|понедельник|вторник|сред[ау]|четверг|пятниц|суббот|воскресень/i;
  for (const s of STOPS) {
    for (const lang of LANGS) {
      const src = sourceText(s.id, lang);
      assert.ok(s.visit[lang]?.length >= 1, `${tag(s)}/${lang}: visit line`);
      for (const line of s.visit[lang]) {
        assert.ok(inAny(line, src, ['tip']), `${tag(s)}/${lang}: not in the tip: «${line}»`);
        assert.doesNotMatch(line, STALE, `${tag(s)}/${lang}: hours, prices or closures go stale: «${line}»`);
      }
    }
  }
});

test('route texts state no walking time or distance of their own', () => {
  // only the quoted visit lines may (they come from the place cards)
  const DIST = /\d+\s*(min|мин|km|км|m\b|м\b)|minute|minuto|минут|metre|meter|metro|метр|walk (of|for)/i;
  for (const r of ROUTES) for (const k of ['title', 'intro', 'end_lead']) for (const lang of LANGS) assert.doesNotMatch(r[k][lang], DIST, `${r.id}: ${k}.${lang}`);
  for (const [k, v] of Object.entries(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], DIST, `ui.${k}.${lang}`);
});

test('English and Portuguese texts have no Russian left in them', () => {
  const strings = (lang) => [
    ...Object.values(quest.ui).map((v) => v[lang]),
    ...ROUTES.flatMap((r) => [r.title[lang], r.intro[lang], r.end_lead[lang]]),
    ...STOPS.flatMap((s) => [...s.text[lang], s.question[lang], s.basis[lang], ...s.visit[lang], ...s.options.map((o) => o[lang])]),
    ...STOPS.map((s) => (lang === 'en' ? EN : PT)[s.id]?.name || byId.get(s.id).name_pt),
  ];
  for (const lang of ['en', 'pt']) for (const str of strings(lang)) assert.doesNotMatch(str, CYRILLIC, `${lang}: «${str}»`);
});

test('every interface string the module uses exists in all three languages', () => {
  for (const [k, v] of Object.entries(quest.ui)) for (const lang of LANGS) assert.ok(v[lang]?.trim(), `ui.${k}.${lang}`);
  const code = readFileSync(new URL('src/quest.js', root), 'utf8') + readFileSync(new URL('scripts/route-pages.mjs', root), 'utf8');
  const used = new Set([...code.matchAll(/\bs\('([a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(used.size > 10, 'the module reads its strings through s()');
  // keys built or chosen at run time
  for (const k of ['correct_gold', 'correct_plain', 'stamp_gold', 'stamp_plain', 'stamp_seen', 'stamp_none']) used.add(k);
  for (const k of used) assert.ok(quest.ui[k], `src/quest.js uses ui.${k}, missing in data/quest.json`);
  // no reconstruction is called historical; no feature is promised
  for (const v of Object.values(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], /reconstru|реконструк/i);
});

test('text pages: committed, current with the data, readable without JavaScript', async () => {
  const { loadInputs, renderRoutePages, routePagePaths } = await import('./route-pages.mjs');
  const inputs = await loadInputs();
  const pages = renderRoutePages(inputs);
  assert.equal(pages.length, (ROUTES.length + 1) * 3, 'a list and one page per route, in three languages');
  for (const { path, html } of pages) {
    const file = new URL(path, root);
    assert.ok(existsSync(file), `${path} is missing: run node scripts/make-og.mjs --pages`);
    assert.equal(readFileSync(file, 'utf8'), html, `${path} is stale: run node scripts/make-og.mjs --pages`);
    assert.doesNotMatch(html, /<script/i, `${path}: no script, no redirect`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${path}: one h1`);
    assert.match(html, /<html lang="(pt-PT|en|ru)">/, `${path}: page language`);
    assert.match(html, /<nav aria-label="[^"]+"><ul>/, `${path}: language links`);
    assert.doesNotMatch(html, /\b20\d\d-\d\d-\d\d\b/, `${path}: no build date (the page changes only with the data)`);
    // en and pt pages carry no Russian outside the «Русский» language link
    if (!/\/ru\/index\.html$/.test(path)) assert.doesNotMatch(html.replace(/<a [^>]*lang="ru"[^>]*>Русский<\/a>/g, ''), CYRILLIC, `${path}: Russian text`);
  }
  for (const r of ROUTES) {
    for (const [lang, sub] of [['pt', ''], ['en', 'en/'], ['ru', 'ru/']]) {
      const html = pages.find((p) => p.path === `public/route/${r.id}/${sub}index.html`).html;
      assert.ok(html.includes(`href="/?lang=${lang}#quest=${r.id}"`), `${r.id}/${lang}: link to the route on the 3D map`);
      for (const s of r.stops) {
        assert.ok(html.includes(`<h2 id="stop-${s.id}">`), `${r.id}/${lang}: heading for ${s.id}`);
        for (const line of s.text[lang]) assert.ok(html.includes(line.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;')), `${r.id}/${lang}: history line of ${s.id}`);
        for (const url of s.sources) assert.ok(html.includes(`href="${url}"`), `${r.id}/${lang}: source ${url}`);
      }
    }
  }
  // the sitemap lists every page
  const sitemap = readFileSync(new URL('public/sitemap.xml', root), 'utf8');
  for (const p of routePagePaths(quest)) assert.ok(sitemap.includes(`${inputs.site}${p}</loc>`), `sitemap: ${p}`);
});

test('the route intro links to the text version of the open route', () => {
  const code = readFileSync(new URL('src/quest.js', root), 'utf8');
  assert.match(code, /`route\/\$\{id \? `\$\{id\}\/` : ''\}/, 'src/quest.js builds a route/<id>/ link');
});

// a localStorage stand-in; returns its Map
function fakeStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  return store;
}
const wrongOf = (s, n = 1) => (s.answer + n) % 3;
const FIRST = ROUTES[0]?.stops || [];

test('retry: a wrong pick is kept and disabled, the right one closes the stop', () => {
  fakeStorage();
  const stops = FIRST;
  const n = stops.length;
  const rp = createQuestProgress('braga').route(LEGACY_ROUTE);
  const [a, b] = stops;
  assert.deepEqual(questSummary(stops, rp), { gold: 0, done: 0, visited: 0, started: 0, total: n, next: 0 });
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
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 1, visited: 2, started: 2, total: n, next: 1 });
  assert.equal(rp.pick(b.id, wrongOf(b, 2), b.answer), 'wrong');
  assert.equal(rp.pick(b.id, b.answer, b.answer), 'right');
  assert.deepEqual(stopResult(rp.tries(b.id), b.answer), { done: true, attempts: 3, gold: false });
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 2, visited: 2, started: 2, total: n, next: 2 });
  // a reload mid-stop does not give a fresh first try
  const c = stops[2];
  rp.pick(c.id, wrongOf(c), c.answer);
  const again = createQuestProgress('braga').route(LEGACY_ROUTE);
  assert.deepEqual(again.tries(c.id), [wrongOf(c)]);
  assert.equal(again.pick(c.id, c.answer, c.answer), 'right');
  assert.equal(stopResult(again.tries(c.id), c.answer).gold, false);
  again.reset();
  assert.deepEqual(questSummary(stops, createQuestProgress('braga').route(LEGACY_ROUTE)), { gold: 0, done: 0, visited: 0, started: 0, total: n, next: 0 });
  delete globalThis.localStorage;
});

test('progress: saved per route id; the last route is remembered', () => {
  fakeStorage();
  const [r1, r2] = ROUTES;
  const shared = r1.stops.find((s) => r2.stops.some((t) => t.id === s.id));
  const p = createQuestProgress('braga');
  p.route(r1.id).pick(shared.id, shared.answer, shared.answer);
  assert.deepEqual(p.route(r2.id).tries(shared.id), [], 'a stop shared by two routes keeps two records');
  p.setLast(r2.id);
  assert.equal(createQuestProgress('braga').last, r2.id);
  delete globalThis.localStorage;
});

test('progress: the first-round save migrates without loss, once, into the first route only', () => {
  const stops = FIRST;
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
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 2, visited: 3, started: 2, total: stops.length, next: 2 });
  assert.equal(p.last, LEGACY_ROUTE);
  // another route that shares a stop does not inherit the answer
  for (const r of ROUTES.slice(1)) for (const s of r.stops) assert.deepEqual(p.route(r.id).tries(s.id), [], `${r.id}/${s.id}`);
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

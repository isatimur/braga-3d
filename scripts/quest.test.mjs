// History route (#quest): accuracy and wiring checks for data/quest.json.
// Every history line, every answer basis and every visit line must be a
// verbatim excerpt of the landmark's own text in the same language, so the
// route never says more than the sourced place cards do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landmarks as EN } from '../src/locales/en.js';
import { landmarks as PT } from '../src/locales/pt.js';
import { messages } from '../src/locales/ui.js';
import { createQuestProgress, questSummary } from '../src/quest-progress.js';

const root = new URL('../', import.meta.url);
const quest = JSON.parse(readFileSync(new URL('data/quest.json', root), 'utf8'));
const LM = JSON.parse(readFileSync(new URL('data/landmarks.json', root), 'utf8'));
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
  for (const k of used) assert.ok(quest.ui[k], `src/quest.js uses ui.${k}, missing in data/quest.json`);
  // no reconstruction is called historical; no feature is promised
  for (const v of Object.values(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], /reconstru|реконструк/i);
});

test('progress: visits, first answer is final, summary, reset', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const stops = quest.stops;
  const p = createQuestProgress('braga');
  assert.deepEqual(questSummary(stops, p), { right: 0, answered: 0, total: 5, next: 0 });
  p.visit(stops[0].id);
  assert.equal(p.visited(stops[0].id), true);
  assert.equal(p.pick(stops[0].id, stops[0].answer), true);
  assert.equal(p.pick(stops[0].id, (stops[0].answer + 1) % 3), false, 'a second pick is ignored');
  assert.equal(p.pick(stops[1].id, (stops[1].answer + 1) % 3), true);
  assert.deepEqual(questSummary(stops, p), { right: 1, answered: 2, total: 5, next: 2 });
  // a fresh reader sees the saved state
  const again = createQuestProgress('braga');
  assert.equal(again.answer(stops[0].id), stops[0].answer);
  assert.ok(store.has('braga-quest-braga'));
  again.reset();
  assert.deepEqual(questSummary(stops, createQuestProgress('braga')), { right: 0, answered: 0, total: 5, next: 0 });
  // blocked storage: memory only, no throw
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blocked = createQuestProgress('braga');
  blocked.visit('x');
  assert.equal(blocked.pick('x', 1), true);
  assert.equal(blocked.answer('x'), 1);
  delete globalThis.localStorage;
});

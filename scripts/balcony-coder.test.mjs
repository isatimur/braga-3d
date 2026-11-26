// balcony-coder-replies.js: the easter-egg coder's scripted replies. Pure logic, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, INTENTS, REPLIES, detectLanguage, intentOf, createReplier } from '../src/balcony-coder-replies.js';
import { readFileSync } from 'node:fs';

// i18n.js uses import.meta.glob (Vite only): read its language list as text
const i18nSrc = readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const supportedLanguages = JSON.parse(i18nSrc.match(/supportedLanguages = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

test('every site language and every intent has replies', () => {
  for (const l of supportedLanguages) assert.ok(LANGS.includes(l), `language ${l}`);
  let total = 0;
  for (const intent of [...INTENTS, 'open']) {
    for (const l of LANGS) {
      const list = REPLIES[intent]?.[l];
      assert.ok(Array.isArray(list) && list.length >= 2, `${intent}/${l}`);
      for (const s of list) assert.ok(s.trim().length > 0 && s.length < 140, `${intent}/${l}: ${s}`);
      total += list.length;
    }
  }
  assert.ok(total / LANGS.length >= 40, `about 40-60 replies per language, got ${total / LANGS.length}`);
});

test('no personal data in the replies', () => {
  const all = JSON.stringify(REPLIES);
  assert.doesNotMatch(all, /@|https?:|\+\d{3}|\b\d{9}\b/);
});

test('intents match keywords in English, Portuguese and Russian', () => {
  const cases = {
    'hi!': 'greeting', 'olá': 'greeting', 'привет': 'greeting', 'boa tarde': 'greeting',
    'who are you?': 'who', 'quem és tu?': 'who', 'кто ты?': 'who', 'hi, who are you': 'who',
    'what are you doing': 'doing', 'o que estás a fazer?': 'doing', 'что делаешь?': 'doing',
    'tell me about Braga': 'braga', 'e o Porto?': 'porto', 'а Порту?': 'porto',
    'the map lags': 'bugs', 'está muito lento': 'bugs', 'всё тормозит': 'bugs', 'нашёл баги': 'bugs',
    'can I ride a bike': 'bike', 'the bike lags': 'bike', 'самокат': 'bike', 'how do I walk': 'walk', 'como andar a pé': 'walk',
    'how many buildings': 'map', 'the roofs flicker': 'layers', 'текстуры': 'layers',
    'any missions?': 'missions', 'is this AI?': 'chat', 'ты бот?': 'chat',
    'coffee?': 'coffee', 'café?': 'coffee', 'ты спишь?': 'time', 'thanks': 'thanks', 'obrigado': 'thanks',
    'спасибо, пока': 'thanks', 'bye': 'bye', 'tchau': 'bye', 'пока': 'bye',
    'asdkjh qwe': 'fallback', '???': 'fallback', '': 'fallback',
  };
  for (const [text, want] of Object.entries(cases)) assert.equal(intentOf(text), want, text);
});

test('language: Cyrillic is Russian, Portuguese words are Portuguese, else the site language', () => {
  assert.equal(detectLanguage('привет', 'en'), 'ru');
  assert.equal(detectLanguage('o que estás a fazer?', 'en'), 'pt');
  assert.equal(detectLanguage('olá, tudo bem?', 'ru'), 'pt');
  assert.equal(detectLanguage('what are you doing?', 'pt'), 'en');
  assert.equal(detectLanguage('ok', 'pt'), 'pt');
  assert.equal(detectLanguage('???', 'ru'), 'ru');
  assert.equal(detectLanguage('asdf', 'en'), 'en');
});

test('the replier answers in the visitor language and never repeats a line twice in a row', () => {
  const r = createReplier({ siteLang: 'pt' });
  assert.equal(r.open().lang, 'pt');
  const a = r.reply('who are you');
  assert.equal(a.lang, 'en');
  assert.equal(a.intent, 'who');
  assert.ok(REPLIES.who.en.includes(a.text));
  assert.equal(r.reply('кто ты').lang, 'ru');
  assert.equal(r.reply('ok').lang, 'ru'); // stays in the language last shown
  let prev = '';
  for (let i = 0; i < 200; i++) {
    const { text } = r.reply(i % 2 ? 'bug' : 'баг');
    assert.notEqual(text, prev, `repeat at ${i}`);
    prev = text;
  }
  // even with a random source that always says the same number
  const stuck = createReplier({ siteLang: 'en', random: () => 0 });
  const seen = [stuck.reply('hi').text, stuck.reply('hi').text, stuck.reply('hi').text];
  assert.notEqual(seen[0], seen[1]);
  assert.notEqual(seen[1], seen[2]);
});

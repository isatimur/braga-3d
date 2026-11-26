// api/coder.js (the window coder's Telegram bridge): input checks, the rate
// limit, the reply filter, and the handler with a mocked fetch (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { validSid, cleanText, createRateLimiter, formatMessage, filterReplies, clientIp } from '../api/_coder-core.js';

test('sid: 8-16 lowercase letters and digits', () => {
  for (const s of ['abcd1234', 'a1b2c3d4e5f6g7h8']) assert.ok(validSid(s), s);
  for (const s of ['abc123', 'a1b2c3d4e5f6g7h8i', 'ABCD1234', 'abcd-1234', '', null, 12345678]) assert.ok(!validSid(s), String(s));
});

test('text: trimmed, control characters gone, 1-300 characters', () => {
  assert.deepEqual(cleanText('  hello  '), { ok: true, text: 'hello' });
  const RLO = String.fromCharCode(0x202e), ZWSP = String.fromCharCode(0x200b);
  assert.deepEqual(cleanText(`a\nb\tc\u0000d${RLO}e`), { ok: true, text: 'a b c de' });
  assert.equal(cleanText('   ').reason, 'empty');
  assert.equal(cleanText(`${ZWSP}\u0007`).reason, 'empty');
  assert.equal(cleanText(42).reason, 'empty');
  assert.ok(cleanText('я'.repeat(300)).ok);
  assert.equal(cleanText('я'.repeat(301)).reason, 'long');
  assert.ok(cleanText('Olá! Gosto do mapa, é ótimo. Obrigado.').ok);
  assert.ok(cleanText('Привет! Как дела? e.g. the map').ok);
});

test('links and @mentions are refused', () => {
  for (const s of ['see https://x.y', 'http://a', 'go www.spam', 'join t.me/abc', 'buy at cheap-pills.com now', 'site.ru', 'ftp://host', 'ping @someone', 'me@mail.org']) {
    assert.equal(cleanText(s).reason, 'link', s);
  }
  for (const s of ['I like Braga.', 'version 1.2.3', 'it is 5 p.m.', 'Bom Jesus do Monte']) assert.ok(cleanText(s).ok, s);
});

test('rate limit: 5 a minute per key, then free again', () => {
  let now = 0;
  const allow = createRateLimiter({ limit: 5, windowMs: 60e3, now: () => now });
  for (let i = 0; i < 5; i++) assert.ok(allow('ip1'));
  assert.ok(!allow('ip1'));
  assert.ok(allow('ip2'), 'another key has its own window');
  now = 59e3;
  assert.ok(!allow('ip1'));
  now = 60e3;
  assert.ok(allow('ip1'));
});

test('rate limit: the key map is bounded', () => {
  const allow = createRateLimiter({ limit: 1, windowMs: 60e3, maxKeys: 3 });
  for (const k of ['a', 'b', 'c', 'd']) assert.ok(allow(k));
  assert.ok(allow('a'), 'the oldest key was dropped');
  assert.ok(!allow('d'));
});

test('message text: city, #sid, language, then the text', () => {
  assert.equal(formatMessage({ sid: 'abcd1234', text: 'hi <b>x</b>', lang: 'pt', city: 'braga' }), '🏙 Braga · #abcd1234 · pt\nhi <b>x</b>');
  assert.equal(formatMessage({ sid: 'abcd1234', text: 'x', lang: 'zz', city: '<script>' }), '🏙 ? · #abcd1234 · ?\nx');
});

test('client ip: the first x-forwarded-for address', () => {
  assert.equal(clientIp({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }), '1.2.3.4');
  assert.equal(clientIp({ 'x-real-ip': '5.6.7.8' }), '5.6.7.8');
  assert.equal(clientIp({}), 'unknown');
});

const OWNER = 111;
const BOT = { id: 999, is_bot: true, first_name: 'bot' };
const me = { id: OWNER, first_name: 'Owner' };
const botMsg = (sid) => ({ message_id: 1, from: BOT, chat: { id: OWNER, type: 'private' }, date: 100, text: `🏙 Braga · #${sid} · en\nhello` });
const reply = (id, sid, date, text, extra = {}) => ({ update_id: id, message: { message_id: id, from: me, chat: { id: OWNER, type: 'private' }, date, text, reply_to_message: botMsg(sid), ...extra } });

const UPDATES = [
  reply(1, 'abcd1234', 200, 'hi there'),
  reply(2, 'abcd1234', 150, 'too old'),
  reply(3, 'zzzz9999', 210, 'other visitor'),
  reply(4, 'abcd12345', 220, 'longer sid shares the prefix'),
  { update_id: 5, message: { message_id: 5, from: me, chat: { id: OWNER }, date: 230, text: 'not a reply' } },
  { update_id: 6, message: { message_id: 6, from: { id: 222 }, chat: { id: 222 }, date: 240, text: 'stranger', reply_to_message: botMsg('abcd1234') } },
  { update_id: 7, message: { message_id: 7, from: { id: 222 }, chat: { id: OWNER }, date: 245, text: 'stranger in his chat', reply_to_message: botMsg('abcd1234') } },
  reply(8, 'abcd1234', 250, '', {}),
  { update_id: 9, message: { message_id: 9, from: me, chat: { id: OWNER }, date: 260, photo: [{}], reply_to_message: botMsg('abcd1234') } },
  reply(10, 'abcd1234', 190, 'second, earlier'),
  { update_id: 11, edited_message: { text: 'edit' } },
];

test('replies: the owner, a reply to #sid, newer than after, oldest first', () => {
  assert.deepEqual(filterReplies(UPDATES, { chatId: String(OWNER), sid: 'abcd1234', after: 160 }), [
    { text: 'second, earlier', date: 190 },
    { text: 'hi there', date: 200 },
  ]);
  assert.deepEqual(filterReplies(UPDATES, { chatId: OWNER, sid: 'abcd1234', after: 195 }), [{ text: 'hi there', date: 200 }]);
  assert.deepEqual(filterReplies(UPDATES, { chatId: OWNER, sid: 'zzzz9999', after: 0 }), [{ text: 'other visitor', date: 210 }]);
  assert.deepEqual(filterReplies(UPDATES, { chatId: 222, sid: 'abcd1234', after: 0 }), [{ text: 'stranger', date: 240 }]);
  assert.deepEqual(filterReplies(null, { chatId: OWNER, sid: 'abcd1234' }), []);
  assert.deepEqual(filterReplies(UPDATES, { chatId: OWNER, sid: 'bad' }), []);
});

// ---- the handler, fetch mocked
function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
  res.end = (b) => (res.body = b ?? '');
  res.json = () => JSON.parse(res.body);
  return res;
}
function req(method, url, body, ip = '9.9.9.9') {
  const r = body === undefined ? Readable.from([]) : Readable.from([JSON.stringify(body)]);
  return Object.assign(r, { method, url, headers: { 'x-forwarded-for': ip } });
}
async function call(handler, ...args) {
  const res = fakeRes();
  await handler(req(...args), res);
  return res;
}

const calls = [];
let getUpdatesResult = UPDATES;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  calls.push({ url: String(url), body });
  const method = String(url).split('/').pop();
  const result = method === 'sendMessage' ? { message_id: 77, date: 1234, chat: { id: OWNER }, text: body.text } : getUpdatesResult;
  return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
};
const { default: handler, _reset } = await import('../api/coder.js');

test('no env: the feature is off and Telegram is not called', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  calls.length = 0;
  assert.deepEqual((await call(handler, 'GET', '/api/coder')).json(), { on: false });
  assert.deepEqual((await call(handler, 'POST', '/api/coder', { sid: 'abcd1234', text: 'hi' })).json(), { ok: false, reason: 'off' });
  assert.deepEqual((await call(handler, 'GET', '/api/coder?sid=abcd1234&after=0')).json(), { ok: false, reason: 'off', replies: [] });
  assert.equal(calls.length, 0);
});

test('POST sends plain text to the owner and never returns the token', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'TEST:not-a-real-token';
  process.env.TELEGRAM_CHAT_ID = String(OWNER);
  calls.length = 0;
  assert.deepEqual((await call(handler, 'GET', '/api/coder')).json(), { on: true });
  const res = await call(handler, 'POST', '/api/coder', { sid: 'abcd1234', text: '  hi <i>you</i>\n', lang: 'en', city: 'braga' }, '1.1.1.1');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, date: 1234 });
  assert.doesNotMatch(res.body, /not-a-real-token/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/botTEST:not-a-real-token/sendMessage');
  assert.deepEqual(calls[0].body, { chat_id: String(OWNER), text: '🏙 Braga · #abcd1234 · en\nhi <i>you</i>', link_preview_options: { is_disabled: true } });
  assert.equal(calls[0].body.parse_mode, undefined);
});

test('POST refuses bad input before Telegram, and rate-limits per IP', async () => {
  calls.length = 0;
  const bad = [
    [{ sid: 'short', text: 'hi' }, 'bad'],
    [{ sid: 'abcd1234', text: '   ' }, 'empty'],
    [{ sid: 'abcd1234', text: 'x'.repeat(301) }, 'long'],
    [{ sid: 'abcd1234', text: 'see https://spam.example' }, 'link'],
    [{ sid: 'abcd1234', text: 'ask @someone' }, 'link'],
  ];
  for (const [body, reason] of bad) {
    const res = await call(handler, 'POST', '/api/coder', body, '2.2.2.2');
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().reason, reason);
  }
  assert.equal(calls.length, 0);
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await call(handler, 'POST', '/api/coder', { sid: `rate000${i}`, text: 'hi' }, '3.3.3.3')).statusCode);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]);
});

test('GET returns this sid\'s replies; getUpdates has no offset and is cached', async () => {
  _reset();
  calls.length = 0;
  const a = (await call(handler, 'GET', '/api/coder?sid=abcd1234&after=160', undefined, '4.4.4.4')).json();
  assert.deepEqual(a, { ok: true, replies: [{ text: 'second, earlier', date: 190 }, { text: 'hi there', date: 200 }] });
  const b = (await call(handler, 'GET', '/api/coder?sid=zzzz9999&after=0', undefined, '4.4.4.4')).json();
  assert.deepEqual(b.replies, [{ text: 'other visitor', date: 210 }]);
  assert.equal(calls.length, 1, 'the second poll used the cache');
  assert.match(calls[0].url, /\/getUpdates$/);
  assert.equal(calls[0].body.offset, undefined);
  assert.deepEqual(calls[0].body.allowed_updates, ['message']);
  assert.equal((await call(handler, 'GET', '/api/coder?sid=BAD&after=0')).statusCode, 400);
  assert.equal((await call(handler, 'GET', '/api/coder?sid=abcd1234&after=-1')).statusCode, 400);
});

test('a Telegram failure is ok: false, and the next poll tries again', async () => {
  _reset();
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error_code: 409, description: 'Conflict: webhook is active' }), { status: 409 });
  const res = await call(handler, 'GET', '/api/coder?sid=abcd1234&after=0', undefined, '5.5.5.5');
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { ok: false, reason: 'telegram', replies: [] });
  const post = await call(handler, 'POST', '/api/coder', { sid: 'abcd1234', text: 'hi' }, '5.5.5.6');
  assert.deepEqual(post.json(), { ok: false, reason: 'telegram' });
  globalThis.fetch = saved;
  calls.length = 0;
  assert.equal((await call(handler, 'GET', '/api/coder?sid=abcd1234&after=0', undefined, '5.5.5.5')).json().ok, true);
  assert.equal(calls.length, 1);
});

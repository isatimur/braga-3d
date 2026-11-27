// api/report.js, the handler: every status in the spec table and the check
// order, with a fake fetch (no network) and fake env values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

process.env.CITIES = 'braga';
delete process.env.REPORTS_ON;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
delete process.env.VERCEL_GIT_COMMIT_SHA;

const { message, validate } = await import('../api/_report-core.js');
const { default: handler } = await import('../api/report.js');

const TOKEN = 'TEST:not-a-real-token';
const CHAT = '111';
const on = () => {
  process.env.REPORTS_ON = '1';
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_CHAT_ID = CHAT;
};

const calls = [];
let upstream = 'ok'; // ok | fail | reject
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: JSON.parse(init.body) });
  if (upstream === 'reject') throw new Error('network down');
  if (upstream === 'fail') return new Response(JSON.stringify({ ok: false, description: 'Forbidden: bot was blocked by the user' }), { status: 403 });
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1, date: 1 } }), { status: 200 });
};

const logs = [];
const info = console.info;
console.info = (...a) => logs.push(a.join(' '));

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
  res.end = (b) => (res.body = b ?? '');
  res.json = () => JSON.parse(res.body);
  return res;
}
// raw: a string sent as is; otherwise JSON
async function call({ method = 'POST', body, raw, ip = '9.9.9.9', headers = {} } = {}) {
  const text = raw ?? (body === undefined ? '' : JSON.stringify(body));
  const r = Object.assign(Readable.from([Buffer.from(text)]), { method, url: '/api/report', headers: { 'x-forwarded-for': ip, host: 'braga-3d.com', ...headers } });
  const res = fakeRes();
  await handler(r, res);
  return res;
}
const good = (over = {}) => ({ city: 'braga', category: 'road', text: 'The path by the river is closed.', email: '', lat: 41.55126, lon: -8.42298, mode: 'map', lang: 'pt', x_note: '', elapsed: 14200, ...over });

test('405: not POST', async () => {
  on();
  const res = await call({ method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.json(), { error: 'post_only' });
  assert.equal(res.headers.allow, 'POST');
});

test('503: REPORTS_ON unset, or the Telegram env missing; Telegram is not called', async () => {
  calls.length = 0;
  on();
  delete process.env.REPORTS_ON;
  for (const v of [undefined, '0', 'true']) {
    if (v === undefined) delete process.env.REPORTS_ON;
    else process.env.REPORTS_ON = v;
    const res = await call({ body: good() });
    assert.equal(res.statusCode, 503, `REPORTS_ON=${v}`);
    assert.deepEqual(res.json(), { error: 'not_configured' });
  }
  on();
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal((await call({ body: good() })).statusCode, 503);
  on();
  process.env.TELEGRAM_CHAT_ID = ' ';
  assert.equal((await call({ body: good() })).statusCode, 503);
  // the gate comes before the origin and the body
  delete process.env.REPORTS_ON;
  assert.equal((await call({ raw: 'x'.repeat(20000), headers: { origin: 'https://evil.example' } })).statusCode, 503);
  assert.equal(calls.length, 0);
});

test('403: another origin, before the body is read', async () => {
  on();
  const res = await call({ raw: 'x'.repeat(20000), headers: { origin: 'https://evil.example' } });
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.json(), { error: 'forbidden' });
  assert.equal((await call({ body: good({ x_note: 'bot' }), headers: { 'sec-fetch-site': 'cross-site' } })).statusCode, 403);
});

test('413: body over the cap', async () => {
  on();
  const res = await call({ raw: JSON.stringify(good({ text: 'x'.repeat(9000) })) });
  assert.equal(res.statusCode, 413);
  assert.deepEqual(res.json(), { error: 'too_large' });
  // 1000 emoji (4 bytes each) plus the other fields fit (EGM round 5, zoom-out-5-2)
  calls.length = 0;
  assert.equal((await call({ body: good({ text: '😀'.repeat(1000) }), ip: '7.7.7.1' })).statusCode, 200);
});

test('400 field body: not a JSON object', async () => {
  on();
  for (const raw of ['null', '[1]', '5', '"s"', 'not json', '']) {
    const res = await call({ raw });
    assert.equal(res.statusCode, 400, raw);
    assert.deepEqual(res.json(), { error: 'bad_request', field: 'body' }, raw);
  }
});

test('202: honeypot or timing, nothing sent, nothing counted', async () => {
  on();
  calls.length = 0;
  for (const b of [good({ x_note: 'http://spam' }), good({ elapsed: 500 }), good({ elapsed: undefined }), good({ x_note: 'x', city: 'nowhere', text: '' })]) {
    const res = await call({ body: b, ip: '6.6.6.6' });
    assert.equal(res.statusCode, 202);
    assert.deepEqual(res.json(), { ok: true });
  }
  assert.equal(calls.length, 0);
  assert.equal((await call({ body: good(), ip: '6.6.6.6' })).statusCode, 200, 'the bots used no slot');
});

test('400 with field: city (missing is not braga), then validate; not counted', async () => {
  on();
  calls.length = 0;
  const cases = [
    [good({ city: undefined }), 'city'], [good({ city: 'porto' }), 'city'], [good({ city: 'BAD!' }), 'city'], [good({ city: ['braga'] }), 'city'],
    [good({ category: 'x' }), 'category'], [good({ text: 'short' }), 'text'], [good({ email: '#abc12345@x.pt' }), 'email'], [good({ email: 'a\nb@x.pt' }), 'email'],
    [good({ lat: 40 }), 'lat'], [good({ lon: 0 }), 'lon'], [good({ mode: 'fly' }), 'mode'], [good({ lang: 'de' }), 'lang'],
  ];
  for (const [b, field] of cases) {
    const res = await call({ body: b, ip: '5.5.5.5' });
    assert.equal(res.statusCode, 400, field);
    assert.deepEqual(res.json(), { error: 'bad_request', field });
  }
  assert.equal(calls.length, 0);
  for (let i = 0; i < 3; i++) assert.equal((await call({ body: good(), ip: '5.5.5.5' })).statusCode, 200, 'bad requests used no slot');
});

test('200: plain text to the owner chat; no token, text or e-mail in the reply or the log', async () => {
  on();
  process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef0123456789';
  calls.length = 0;
  logs.length = 0;
  const b = good({ text: 'My house at Rua X 12 is missing #abcd1234 `x` @user', email: 'me@mail.pt' });
  const res = await call({ body: b, ip: '4.4.4.4' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
  assert.deepEqual(calls[0].body, {
    chat_id: CHAT,
    text: message(validate(b, { s: 41.47, w: -8.55, n: 41.63, e: -8.3 }).value, 'abcdef0123456789'),
    link_preview_options: { is_disabled: true },
  });
  assert.equal(calls[0].body.parse_mode, undefined);
  assert.match(calls[0].body.text, /\nversion abcdef0\n/);
  assert.doesNotMatch(res.body, /not-a-real-token/);
  assert.deepEqual(logs, ['[report] 200 road']);
  delete process.env.VERCEL_GIT_COMMIT_SHA;
});

test('429: 3 per 10 minutes per IP', async () => {
  on();
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await call({ body: good(), ip: '3.3.3.3' })).statusCode);
  assert.deepEqual(codes, [200, 200, 200, 429]);
  const res = await call({ body: good(), ip: '3.3.3.3' });
  assert.deepEqual(res.json(), { error: 'rate_limited' });
});

test('502: Telegram rejects, fails or the network drops; no token in the reply or the log', async () => {
  on();
  logs.length = 0;
  for (const [mode, ip] of [['reject', '2.2.2.1'], ['fail', '2.2.2.2']]) {
    upstream = mode;
    const res = await call({ body: good(), ip });
    assert.equal(res.statusCode, 502, mode);
    assert.deepEqual(res.json(), { error: 'upstream' });
    assert.doesNotMatch(res.body, /not-a-real-token/);
  }
  upstream = 'ok';
  assert.deepEqual(logs, ['[report] 502 road', '[report] 502 road']);
});

test('429: 30 per hour per instance in total', async () => {
  on();
  let sent = 0;
  let code = 200;
  for (let i = 0; i < 40 && code !== 429; i++) {
    code = (await call({ body: good(), ip: `10.0.0.${i}` })).statusCode;
    if (code !== 429) sent++;
  }
  assert.equal(code, 429);
  // reports sent before this test: 1 (413 test) + 1 (202) + 3 (400) + 1 (200) + 3 (429) + 2 (502) = 11
  assert.equal(sent + 11, 30);
  console.info = info;
});

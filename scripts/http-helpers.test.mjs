// api/_http.js: the same-origin rule and the capped body read, shared by
// api/guide.js and api/report.js (guide had no tests for them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { crossOrigin, readBody, MAX_BODY } from '../api/_http.js';

const req = (headers) => ({ headers });

test('crossOrigin: same host or no Origin passes; another site is refused', () => {
  assert.equal(crossOrigin(req({ host: 'braga-3d.com' })), false, 'no Origin (curl, server)');
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', origin: 'https://braga-3d.com' })), false);
  assert.equal(crossOrigin(req({ host: 'localhost:5471', origin: 'http://localhost:5471' })), false);
  assert.equal(crossOrigin(req({ host: 'internal', 'x-forwarded-host': 'braga-3d.com', origin: 'https://braga-3d.com' })), false);
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', origin: 'https://evil.example' })), true);
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', origin: 'not a url' })), true);
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', 'sec-fetch-site': 'cross-site' })), true);
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', 'sec-fetch-site': 'same-site' })), true);
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', 'sec-fetch-site': 'same-origin', origin: 'https://braga-3d.com' })), false);
  assert.equal(crossOrigin(req({ host: 'braga-3d.com', 'sec-fetch-site': 'none' })), false);
});

const stream = (text) => Object.assign(Readable.from([Buffer.from(text)]), { headers: {} });

test('readBody: a stream, a string, a Buffer and a parsed object', async () => {
  assert.deepEqual(await readBody(stream('{"a":1}')), { json: { a: 1 }, size: 7 });
  assert.deepEqual(await readBody({ body: '{"a":2}' }), { json: { a: 2 }, size: 7 });
  assert.deepEqual(await readBody({ body: Buffer.from('[3]') }), { json: [3], size: 3 });
  assert.deepEqual(await readBody({ body: { a: 4 } }), { json: { a: 4 }, size: 7 });
  assert.deepEqual(await readBody(stream('not json')), { json: undefined, size: 8 });
  assert.deepEqual(await readBody(stream('')), { json: undefined, size: 0 });
});

test('readBody: the cap is 4096 bytes by default (guide), or the given max', async () => {
  assert.equal(MAX_BODY, 4096);
  const at = `"${'a'.repeat(4094)}"`;
  assert.equal((await readBody(stream(at))).json.length, 4094);
  const over = await readBody(stream(`"${'a'.repeat(4095)}"`));
  assert.equal(over.json, undefined);
  assert.ok(over.size > 4096);
  // bytes, not characters: 2100 Cyrillic letters are 4200 bytes
  assert.ok((await readBody({ body: `"${'я'.repeat(2100)}"` })).size > 4096);
  assert.equal((await readBody(stream(`"${'я'.repeat(2100)}"`), 8192)).json.length, 2100);
  assert.ok((await readBody(stream('x'.repeat(9000)), 8192)).size > 8192);
});

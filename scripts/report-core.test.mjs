// "Fix the map" reports, the pure rules (api/_report-core.js) and the
// projection's inverse (src/geo.js unproject). docs/specs/public-reports.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, OSM_CATEGORIES, LIMITS, ISSUES, cleanReportText, isBot, validate, message, osmNoteUrl, githubIssueUrl } from '../api/_report-core.js';
import { createProjection } from '../src/geo.js';

const BOX = { s: 41.47, w: -8.55, n: 41.63, e: -8.3 }; // cities/braga.json wide_bbox
const good = (over = {}) => ({ city: 'braga', category: 'road', text: 'The path by the river is closed.', email: '', lat: 41.55126, lon: -8.42298, mode: 'map', lang: 'pt', x_note: '', elapsed: 14200, ...over });
const FW_HASH = String.fromCharCode(0xff03);

test('categories: six, three of them offer an OSM note', () => {
  assert.deepEqual(CATEGORIES, ['missing-building', 'road', 'name', 'walk', 'looks-wrong', 'idea']);
  assert.deepEqual(OSM_CATEGORIES, ['missing-building', 'road', 'name']);
  assert.deepEqual(LIMITS.text, [10, 1000]);
});

test('cleanReportText: NFC, \\n, no control characters, two blank lines at most, trimmed', () => {
  const RLO = String.fromCharCode(0x202e);
  assert.equal(cleanReportText('  é a\r\nb\rc  '), 'é a\nb\nc');
  assert.equal(cleanReportText(`a\u0000b\u0007c\td${RLO}e\u009f`), 'ab' + 'c\td' + 'e');
  assert.equal(cleanReportText('a\n\n\n\n\n\nb'), 'a\n\n\nb');
  assert.equal(cleanReportText('a\n \n\t\n\n\nb'), 'a\n\n\nb');
  assert.equal(cleanReportText('a\n\n\nb'), 'a\n\n\nb', 'two blank lines stay');
  assert.equal(cleanReportText('the shop at https://x.pt, mail me@x.pt @owner'), 'the shop at https://x.pt, mail me@x.pt @owner');
  assert.equal(cleanReportText(42), '');
  assert.equal(cleanReportText(null), '');
});

test('isBot: a filled x_note or under 2 s or no number', () => {
  assert.equal(isBot(good()), false);
  assert.equal(isBot(good({ elapsed: 2000 })), false);
  assert.equal(isBot(good({ x_note: 'http://spam' })), true);
  assert.equal(isBot(good({ x_note: 0 })), true);
  assert.equal(isBot(good({ elapsed: 1999 })), true);
  assert.equal(isBot(good({ elapsed: '9000' })), true);
  assert.equal(isBot(good({ elapsed: NaN })), true);
  assert.equal(isBot({ ...good(), elapsed: undefined }), true);
});

test('validate: a good report, rounded to 5 decimals, unknown fields ignored', () => {
  const r = validate(good({ lat: 41.551264, lon: -8.422976, extra: 'x', text: '  Wrong road.  \r\n' }), BOX);
  assert.deepEqual(r, { ok: true, value: { city: 'braga', category: 'road', text: 'Wrong road.', email: '', lat: 41.55126, lon: -8.42298, mode: 'map', lang: 'pt' } });
  assert.equal(validate(good({ email: undefined }), BOX).value.email, '');
  assert.equal(validate(good({ email: ' me@mail.pt ' }), BOX).value.email, 'me@mail.pt');
});

test('validate: each field fails on its own', () => {
  const cases = [
    [null, 'body'], [[1], 'body'], ['x', 'body'],
    [good({ city: undefined }), 'city'], [good({ city: 7 }), 'city'],
    [good({ category: 'spam' }), 'category'], [good({ category: undefined }), 'category'],
    [good({ text: 'too short' }), 'text'], [good({ text: '    ' }), 'text'], [good({ text: 42 }), 'text'],
    [good({ text: 'я'.repeat(1001) }), 'text'],
    [good({ email: 'not an email' }), 'email'], [good({ email: '#abc12345@x.pt' }), 'email'], [good({ email: 'a\nb@x.pt' }), 'email'],
    [good({ email: `${'a'.repeat(116)}@x.pt` }), 'email'], [good({ email: 5 }), 'email'],
    [good({ lat: '41.5' }), 'lat'], [good({ lat: NaN }), 'lat'], [good({ lat: Infinity }), 'lat'],
    [good({ lon: null }), 'lon'],
    [good({ lat: 41.46999 }), 'lat'], [good({ lat: 41.63001 }), 'lat'],
    [good({ lon: -8.55001 }), 'lon'], [good({ lon: -8.29999 }), 'lon'],
    [good({ mode: 'fly' }), 'mode'], [good({ lang: 'de' }), 'lang'],
  ];
  for (const [body, field] of cases) assert.deepEqual(validate(body, BOX), { ok: false, field }, JSON.stringify(body)?.slice(0, 80));
  assert.deepEqual(validate(good(), null), { ok: false, field: 'city' }, 'a city with no box is not served');
});

test('validate: text bounds by code points, bbox edges inclusive', () => {
  assert.ok(validate(good({ text: 'a'.repeat(10) }), BOX).ok);
  assert.ok(validate(good({ text: 'я'.repeat(1000) }), BOX).ok);
  assert.ok(validate(good({ text: '😀'.repeat(1000) }), BOX).ok, '1000 emoji are 1000 code points');
  assert.equal(validate(good({ text: '😀'.repeat(9) }), BOX).ok, false);
  for (const [lat, lon] of [[BOX.s, BOX.w], [BOX.n, BOX.e]]) assert.ok(validate(good({ lat, lon }), BOX).ok, `${lat},${lon}`);
  assert.ok(validate(good({ email: `${'a'.repeat(115)}@x.pt` }), BOX).ok, '120 characters');
});

test('message: plain text lines, the # swap, backticks, @user and URLs stay plain', () => {
  const v = validate(good({ text: 'Fix `this` @user #12 #abcd1234 see https://x.pt', email: 'me@mail.pt' }), BOX).value;
  assert.equal(message(v, '0123456789abcdef'), [
    '[report] braga · road · pt · map',
    '41.55126, -8.42298',
    'https://www.openstreetmap.org/#map=19/41.55126/-8.42298',
    'e-mail: me@mail.pt',
    'version 0123456',
    '—',
    `Fix \`this\` @user ${FW_HASH}12 ${FW_HASH}abcd1234 see https://x.pt`,
  ].join('\n'));
  const noMail = message({ ...v, email: '' }, undefined);
  assert.match(noMail, /\ne-mail: no e-mail\n/);
  assert.match(noMail, /\nversion dev\n/);
  // the coder bridge's tag never appears in the visitor's part
  assert.doesNotMatch(noMail.split('—')[1], /#/);
  assert.ok([...message({ ...v, text: 'я'.repeat(1000) }, 'x')].length <= 4000);
});

test('osmNoteUrl and githubIssueUrl', () => {
  assert.equal(osmNoteUrl(41.55126, -8.42298), 'https://www.openstreetmap.org/note/new#map=19/41.55126/-8.42298');
  const v = validate(good({ email: 'me@mail.pt', text: 'Wrong road #3 here.' }), BOX).value;
  const url = new URL(githubIssueUrl(v));
  assert.equal(`${url.origin}${url.pathname}`, ISSUES);
  assert.equal(url.searchParams.get('title'), '[road] 41.55126, -8.42298');
  const body = url.searchParams.get('body');
  assert.equal(body, `[report] braga · road · pt · map\n41.55126, -8.42298\nhttps://www.openstreetmap.org/#map=19/41.55126/-8.42298\n—\nWrong road ${FW_HASH}3 here.`);
  assert.doesNotMatch(githubIssueUrl(v), /mail\.pt|version/, 'no e-mail, no version');
  // 1000 Cyrillic characters fit under GitHub's practical 8 kB URL limit
  const long = githubIssueUrl({ ...v, text: 'я'.repeat(1200) });
  assert.ok(long.length < 8000, `${long.length} chars`);
  assert.equal(new URL(long).searchParams.get('body').split('—\n')[1].length, 1000, 'cut to 1000');
});

test('unproject is the inverse of project', () => {
  const p = createProjection({ lat: 41.5503, lon: -8.4201 }, null, [], null);
  for (const [lat, lon] of [[41.55126, -8.42298], [41.47, -8.55], [41.63, -8.3]]) {
    const { x, z } = p.project(lat, lon);
    const back = p.unproject(x, z);
    assert.ok(Math.abs(back.lat - lat) < 1e-9 && Math.abs(back.lon - lon) < 1e-9, `${lat},${lon} -> ${back.lat},${back.lon}`);
  }
});

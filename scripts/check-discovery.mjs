import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNews, loadNews, default as handler } from '../api/news.js';
import { dailyPlace, readSaved, osmLink, walkingLink } from '../src/discovery-state.js';

const now = Date.parse('2026-10-04T22:00:00Z');
const item = (title, { url = 'https://ominho.pt/story/', date = 'Sun, 04 Oct 2026 19:00:00 GMT', category = 'Minho' } = {}) =>
  `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate><category>${category}</category></item>`;
const rss = (...items) => `<rss><channel>${items.join('')}</channel></rss>`;
const headline = item('Bom Jesus: &#8220;património&#8221; &amp; cidade');
assert.deepEqual(parseNews(rss(headline), now), [{ title: 'Bom Jesus: “património” & cidade', url: 'https://ominho.pt/story/', publishedAt: '2026-10-04T19:00:00.000Z', placeId: 'bom-jesus' }]);
assert.equal(parseNews(rss(headline, headline), now).length, 1, 'deduplicate URLs');
assert.equal(parseNews(rss(item('Guimarães celebra os castelos')), now).length, 0, 'do not present regional news as Braga news');
assert.equal(parseNews(rss(item('Um novo serviço', { category: 'Braga' })), now)[0].placeId, null, 'no invented map position');
for (const url of ['javascript:alert(1)', 'https://ominho.pt.evil.test/x', 'https://user@ominho.pt/x', 'http://ominho.pt/x']) {
  assert.equal(parseNews(rss(item('Braga', { url })), now).length, 0, 'reject unsafe source URLs');
}
for (const date of ['not a date', 'Sun, 04 Oct 2025 19:00:00 GMT', 'Sun, 05 Oct 2026 19:00:00 GMT']) {
  assert.equal(parseNews(rss(item('Braga', { date })), now).length, 0, 'reject stale or future news');
}
assert.throws(() => parseNews('<html>upstream failure</html>', now));
assert.throws(() => parseNews('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>', now));
const data = await loadNews(async () => new Response(rss(headline)), now);
assert.equal(data.items.length, 1);
assert.equal(data.checkedAt, new Date(now).toISOString());
await assert.rejects(loadNews(async () => new Response('x'.repeat(1_500_001)), now));
await assert.rejects(loadNews(async () => new Response('unavailable', { status: 503 }), now));
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('offline'); };
const headers = {};
const res = { setHeader(k, v) { headers[k] = v; }, status(v) { this.code = v; return this; }, json(v) { this.body = v; return this; } };
try {
  await handler({ method: 'GET', query: {} }, res);
  assert.equal(res.code, 503); assert.equal(res.body.error, 'news_unavailable'); assert.equal(res.body.checkedAt, null); assert.equal(headers['Cache-Control'], 'no-store');
  await handler({ method: 'POST' }, res); assert.equal(res.code, 405);
  await handler({ method: 'GET', query: { city: 'porto' } }, res); assert.equal(res.code, 400);
} finally { globalThis.fetch = originalFetch; }

const places = JSON.parse(readFileSync(new URL('../data/landmarks.json', import.meta.url)));
const validIds = new Set(places.map(p => p.id));
const brokenStorage = { getItem() { throw new Error('blocked'); } };
assert.equal(readSaved(brokenStorage, 'saved', validIds).size, 0);
assert.deepEqual([...readSaved({ getItem: () => '["se-braga","missing","se-braga"]' }, 'saved', validIds)], ['se-braga']);
assert.equal(readSaved({ getItem: () => '{}' }, 'saved', validIds).size, 0);
assert.equal(dailyPlace(places, new Date('2026-07-01T23:30:00Z')).id, dailyPlace(places, new Date('2026-07-02T12:00:00Z')).id, 'Lisbon calendar, not UTC date');
assert.equal(dailyPlace([], new Date()), null);
assert.equal(osmLink({ id: 'w123' }), 'https://www.openstreetmap.org/way/123');
assert.equal(osmLink({ id: 'javascript:x' }), 'https://www.openstreetmap.org/');
assert.ok(walkingLink(places[0]).includes('travelmode=walking'));

const pois = JSON.parse(readFileSync(new URL('../data/pois.json', import.meta.url)));
assert.match(pois.source, /OpenStreetMap/);
assert.ok(Number.isFinite(Date.parse(pois.fetched)));
assert.ok(pois.pois.length > 0);
for (const p of pois.pois) {
  assert.match(p.id, /^[nwr]\d+$/);
  assert.ok(Number.isFinite(p.lat) && p.lat >= pois.bbox.s && p.lat <= pois.bbox.n);
  assert.ok(Number.isFinite(p.lon) && p.lon >= pois.bbox.w && p.lon <= pois.bbox.e);
}
console.log(`Discovery checks passed: RSS provenance, dates, errors, bookmarks, Lisbon day, ${pois.pois.length} real POIs.`);

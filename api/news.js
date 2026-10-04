// Headlines only, from the publisher's public RSS feed. No article bodies,
// images, generated summaries or inferred incident coordinates are returned.
export const SOURCE = { name: 'O MINHO', url: 'https://ominho.pt/', feed: 'https://ominho.pt/feed/' };
const MAX_BYTES = 1_500_000;
const AGE = 14 * 86400000;
const PLACES = [
  ['bom-jesus', /\bbom jesus\b/], ['sameiro', /\bsameiro\b/],
  ['theatro-circo', /\btheatro circo\b/], ['se-braga', /\bse de braga\b/],
  ['tibaes', /\btibaes\b/], ['palacio-raio', /\bpalacio do raio\b/],
  ['biscainhos', /\bbiscainhos\b/], ['forum-braga', /\bforum braga\b/],
];
const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function plain(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, key) => {
      const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      if (key[0] !== '#') return named[key.toLowerCase()] || m;
      const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }).replace(/\s+/g, ' ').trim();
}
const field = (item, tag) => plain(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item)?.[1] || '');

export function parseNews(xml, now = Date.now()) {
  if (!/<rss\b/i.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Invalid RSS');
  const seen = new Set();
  const items = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const raw = match[1];
    const title = field(raw, 'title');
    const link = field(raw, 'link');
    const published = Date.parse(field(raw, 'pubDate'));
    const categories = [...raw.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map(m => fold(plain(m[1])));
    const titleKey = fold(title);
    const placeId = PLACES.find(([, re]) => re.test(titleKey))?.[0] || null;
    if (!title || title.length > 280 || !Number.isFinite(published) || published > now + 300000 || now - published > AGE) continue;
    // Explicit Braga categorisation/title or a named Braga landmark only.
    if (!categories.includes('braga') && !/\bbraga\b/.test(titleKey) && !placeId) continue;
    let url;
    try { url = new URL(link); } catch { continue; }
    if (url.protocol !== 'https:' || url.hostname !== 'ominho.pt' || url.username || url.password || url.port) continue;
    url.hash = '';
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    items.push({ title, url: url.href, publishedAt: new Date(published).toISOString(), placeId });
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6);
}

export async function loadNews(fetcher = fetch, now = Date.now()) {
  const response = await fetcher(SOURCE.feed, {
    signal: AbortSignal.timeout(7000), redirect: 'error',
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'Braga3D/1.0 (+https://braga-3d.com)' },
  });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Feed unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Feed too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { source: SOURCE, checkedAt: new Date(now).toISOString(), items: parseNews(new TextDecoder().decode(bytes), now) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (req.query?.city && req.query.city !== 'braga') return res.status(400).json({ error: 'unsupported_city' });
  try {
    const result = await loadNews();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
    return res.status(200).json(result);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ source: SOURCE, checkedAt: null, items: [], error: 'news_unavailable' });
  }
}

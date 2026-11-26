// The pure part of api/coder.js (the window coder's Telegram bridge): input
// checks, the rate limit, the message text and the reply filter. No network,
// no env: node --test imports it as is (scripts/coder-api.test.mjs).

export const SID_RE = /^[a-z0-9]{8,16}$/;
export const MAX_TEXT = 300;
export const LANGS = ['ru', 'pt', 'en'];

// control characters (C0, DEL, C1) and the invisible format ones (bidi
// overrides, zero-width): a newline or tab becomes a space, the rest goes
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const FORMAT = /\p{Cf}/gu;

// A link in any common spelling: a scheme, www., t.me, or a word.tld with a
// common top-level domain. Spam in a chat that reaches a phone is mostly links.
const LINK = /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\bt\.me\b|\b[a-z0-9-]{2,}\.(?:com|net|org|info|biz|io|me|co|ly|gg|ru|pt|br|uk|us|eu|xyz|top|site|online|club|shop|store|app|dev|link|click|live|pro|cc|tk|to|su|ua|by|kz|in)\b)/i;
// @name (a Telegram mention) or an e-mail address
const MENTION = /@[a-z0-9_]{2,}/i;

export function validSid(sid) {
  return typeof sid === 'string' && SID_RE.test(sid);
}

// -> { ok: true, text } | { ok: false, reason: 'empty' | 'long' | 'link' }
export function cleanText(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const text = raw.replace(CONTROL, ' ').replace(FORMAT, '').replace(/ {2,}/g, ' ').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if ([...text].length > MAX_TEXT) return { ok: false, reason: 'long' };
  if (LINK.test(text) || MENTION.test(text)) return { ok: false, reason: 'link' };
  return { ok: true, text };
}

// A sliding-window limit per key, in this instance's memory: at most `limit`
// hits per `windowMs`. Vercel may run several instances, each with its own
// window, so it is a brake, not a guarantee. The map is bounded.
export function createRateLimiter({ limit, windowMs, maxKeys = 5000, now = Date.now }) {
  const hits = new Map(); // key -> timestamps, oldest first
  return function allow(key) {
    const t = now();
    const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (list.length >= limit) {
      hits.set(key, list);
      return false;
    }
    list.push(t);
    hits.delete(key); // re-insert: the map keeps keys in last-use order
    hits.set(key, list);
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
    return true;
  };
}

// "braga" -> "Braga"; anything not a city id -> "?"
function cityName(city) {
  return typeof city === 'string' && /^[a-z][a-z-]{1,39}$/.test(city) ? city[0].toUpperCase() + city.slice(1) : '?';
}

// The text the owner gets. Plain text (no parse_mode), so nothing in it is
// read as HTML or Markdown. The #sid tag is how his reply finds its way back.
export function formatMessage({ sid, text, lang, city }) {
  const l = LANGS.includes(lang) ? lang : '?';
  return `🏙 ${cityName(city)} · #${sid} · ${l}\n${text}`;
}

// The owner's replies for one visitor from a getUpdates result: a message in
// the owner's chat (chat.id, and from.id when present, equal chatId) that
// replies to a message whose text carries #<sid>, newer than `after` (unix s).
// -> [{ text, date }], oldest first
export function filterReplies(updates, { chatId, sid, after = 0 }) {
  if (!Array.isArray(updates) || !validSid(sid)) return [];
  const id = String(chatId);
  const tag = new RegExp(`#${sid}(?![a-z0-9])`);
  const out = [];
  for (const u of updates) {
    const m = u?.message;
    if (!m || typeof m.text !== 'string' || !m.text.trim()) continue;
    if (String(m.chat?.id) !== id) continue;
    if (m.from && String(m.from.id) !== id) continue;
    const to = m.reply_to_message;
    if (!to || typeof to.text !== 'string' || !tag.test(to.text)) continue;
    if (!(Number(m.date) > after)) continue;
    out.push({ text: m.text.slice(0, 1000), date: Number(m.date) });
  }
  return out.sort((a, b) => a.date - b.date);
}

// The first address in x-forwarded-for (Vercel sets it), else x-real-ip.
export function clientIp(headers = {}) {
  const xf = headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : xf || '').split(',')[0].trim();
  return first || String(headers['x-real-ip'] || 'unknown');
}

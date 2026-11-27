// /api/coder: the window coder's chat (src/balcony-coder.js) bridged to the
// owner's Telegram. No database: Telegram keeps the messages.
//
//   GET  /api/coder                      -> { on }  is the bridge set up (no Telegram call)
//   POST /api/coder { sid, text, lang, city }
//        -> { ok: true, date } | { ok: false, reason }
//        reason: 'off' (no env: the site works as before, scripted only),
//        'bad' (sid), 'empty' | 'long' | 'link' (text), 'rate', 'telegram'
//        The bot sends the owner "🏙 Braga · #<sid> · <lang>\n<text>".
//   GET  /api/coder?sid=<sid>&after=<unix s>
//        -> { ok: true, replies: [{ text, date }] } | { ok: false, reason, replies: [] }
//        The owner's replies (Telegram "Reply" to the bot's message) for that
//        sid, newer than `after`.
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (scripts/telegram-whoami.mjs finds
// the chat id). The token is never logged or returned.
//
// How replies are read: getUpdates WITHOUT an offset, so no update is ever
// confirmed; Telegram keeps each one for 24 h and every poll sees them all.
// Limits that follow:
//   - Telegram keeps at most 100 pending updates and drops them after 24 h:
//     a reply older than 24 h is gone, and past 100 messages to the bot in a
//     day the newest ones are not returned until older ones expire.
//   - getUpdates fails while a webhook is set on the bot (409): the bot must
//     have none, and no other program may consume its updates.
//   - One getUpdates result is shared for CACHE_MS in this instance.
// Rate limits live in this instance's memory (several instances each count
// on their own): a brake on spam, not a guarantee.
import { validSid, cleanText, createRateLimiter, formatMessage, filterReplies, clientIp } from './_coder-core.js';
import { telegram } from './_telegram.js';

const CACHE_MS = 3000;
const MAX_BODY = 4096;

const perIp = createRateLimiter({ limit: 5, windowMs: 60e3 });
const perSid = createRateLimiter({ limit: 5, windowMs: 60e3 });
const total = createRateLimiter({ limit: 40, windowMs: 60e3 }); // all visitors: the owner's phone
const pollIp = createRateLimiter({ limit: 40, windowMs: 60e3 }); // a client polls every 4 s

function env() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

let updates = { at: 0, promise: null };
function getUpdates(token) {
  const now = Date.now();
  if (updates.promise && now - updates.at < CACHE_MS) return updates.promise;
  const promise = telegram(token, 'getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message'] });
  updates = { at: now, promise };
  promise.catch(() => {
    if (updates.promise === promise) updates = { at: 0, promise: null };
  });
  return promise;
}

// tests: a fresh module state
export function _reset() {
  updates = { at: 0, promise: null };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel parsed it
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error('body too large');
  }
  return JSON.parse(raw || '{}');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status, body, cache = 'no-store') => {
    res.statusCode = status;
    res.setHeader('Cache-Control', cache);
    res.end(JSON.stringify(body));
  };
  const cfg = env();

  if (req.method === 'POST') {
    if (!cfg) return send(200, { ok: false, reason: 'off' });
    let body;
    try {
      body = await readBody(req);
    } catch {
      return send(400, { ok: false, reason: 'bad' });
    }
    const { sid, text, lang, city } = body || {};
    if (!validSid(sid)) return send(400, { ok: false, reason: 'bad' });
    const clean = cleanText(text);
    if (!clean.ok) return send(400, { ok: false, reason: clean.reason });
    if (!perIp(clientIp(req.headers)) || !perSid(sid) || !total('all')) return send(429, { ok: false, reason: 'rate' });
    try {
      const msg = await telegram(cfg.token, 'sendMessage', {
        chat_id: cfg.chatId,
        text: formatMessage({ sid, text: clean.text, lang, city }),
        link_preview_options: { is_disabled: true },
      });
      return send(200, { ok: true, date: Number(msg?.date) || Math.floor(Date.now() / 1000) });
    } catch (e) {
      console.warn('[coder]', e.message);
      return send(502, { ok: false, reason: 'telegram' });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return send(405, { ok: false, reason: 'method' });
  }
  const q = new URL(req.url || '/', 'http://x').searchParams;
  if (!q.has('sid')) return send(200, { on: !!cfg }, 'public, max-age=60');
  const sid = q.get('sid');
  const after = Number(q.get('after') ?? 0);
  if (!validSid(sid) || !Number.isFinite(after) || after < 0) return send(400, { ok: false, reason: 'bad', replies: [] });
  if (!cfg) return send(200, { ok: false, reason: 'off', replies: [] });
  if (!pollIp(clientIp(req.headers))) return send(429, { ok: false, reason: 'rate', replies: [] });
  try {
    const result = await getUpdates(cfg.token);
    return send(200, { ok: true, replies: filterReplies(result, { chatId: cfg.chatId, sid, after }) });
  } catch (e) {
    console.warn('[coder]', e.message);
    return send(502, { ok: false, reason: 'telegram', replies: [] });
  }
}

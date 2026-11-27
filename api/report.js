// POST /api/report: a "Fix the map" report (src/report.js), sent to the
// owner's private Telegram chat. Spec: docs/specs/public-reports.md.
//
// Request (JSON, at most LIMITS.body bytes):
//   { city, category, text, email, lat, lon, mode, lang, x_note, elapsed }
// Replies (JSON, never cached):
//   200 { ok: true }                    delivered
//   202 { ok: true }                    the honeypot or the 2 s rule caught a bot: nothing sent
//   400 { error: 'bad_request', field } field: body | city | category | text | email | lat | lon | mode | lang
//   403 { error: 'forbidden' }          another origin
//   405 { error: 'post_only' }
//   413 { error: 'too_large' }
//   429 { error: 'rate_limited' }       3 per 10 min per IP, 30 per hour per instance
//   502 { error: 'upstream' }           Telegram failed or took over 5 s
//   503 { error: 'not_configured' }     REPORTS_ON is not 1, or no Telegram env
//
// Off by default: until the owner sets REPORTS_ON=1 the endpoint takes no
// data. Env: REPORTS_ON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (the coder's
// bot and chat), VERCEL_GIT_COMMIT_SHA (set by Vercel). The token, the text,
// the e-mail, the place and the IP are never logged or returned. The IP is
// a rate-limit key in this instance's memory only.
//
// A 502 still uses the visitor's rate-limit slot (the count comes before the
// send). That is intended: the visitor gets the fallback links on a 502 and
// on a 429 alike, and a Telegram outage cannot turn into a retry storm.
import { cityConfig } from './_city.js';
import { createRateLimiter, clientIp } from './_coder-core.js';
import { crossOrigin, readBody } from './_http.js';
import { telegram } from './_telegram.js';
import { LIMITS, isBot, validate, message } from './_report-core.js';

const perIp = createRateLimiter({ limit: 3, windowMs: 10 * 60e3 });
const total = createRateLimiter({ limit: 30, windowMs: 60 * 60e3 });

function env() {
  if (process.env.REPORTS_ON !== '1') return null;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  let category = '-';
  const send = (status, body, headers = {}) => {
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    console.info(`[report] ${status} ${category}`); // status and category only
    res.end(JSON.stringify(body));
  };
  const bad = (field) => send(400, { error: 'bad_request', field });

  if (req.method !== 'POST') return send(405, { error: 'post_only' }, { Allow: 'POST' });
  const cfg = env();
  if (!cfg) return send(503, { error: 'not_configured' });
  if (crossOrigin(req)) return send(403, { error: 'forbidden' });
  let read;
  try {
    read = await readBody(req, LIMITS.body);
  } catch {
    return bad('body');
  }
  if (read.size > LIMITS.body) return send(413, { error: 'too_large' });
  const body = read.json;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('body');
  if (isBot(body)) return send(202, { ok: true }); // silent: a bot learns nothing, nothing is counted
  // a missing city is not braga: cityConfig() has a default
  const city = typeof body.city === 'string' ? cityConfig(body.city) : null;
  if (!city?.wide_bbox) return bad('city');
  const v = validate(body, city.wide_bbox);
  if (!v.ok) return bad(v.field);
  category = v.value.category;
  // only reports that would be sent count: bots and bad requests cannot lock out a visitor
  if (!perIp(clientIp(req.headers)) || !total('all')) return send(429, { error: 'rate_limited' });
  try {
    await telegram(cfg.token, 'sendMessage', {
      chat_id: cfg.chatId,
      text: message(v.value, process.env.VERCEL_GIT_COMMIT_SHA),
      link_preview_options: { is_disabled: true },
    });
  } catch {
    return send(502, { error: 'upstream' });
  }
  return send(200, { ok: true });
}

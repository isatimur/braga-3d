// Request helpers shared by api/guide.js and api/report.js (an underscore
// file is not a route on Vercel). Moved from api/guide.js, no change.

export const MAX_BODY = 4096; // api/guide.js's cap, the default

// Same origin only: a browser's Origin (or Sec-Fetch-Site) must match the
// Host this function answers on (production, previews and localhost alike).
export function crossOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== String(req.headers['x-forwarded-host'] || req.headers.host || '');
  } catch {
    return true;
  }
}

// -> { json, size }: json is undefined when the text is not JSON; over max
// bytes -> { size } only (the caller answers 413), read no further.
export async function readBody(req, max = MAX_BODY) {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return { json: req.body, size: JSON.stringify(req.body).length };
  let text;
  if (typeof req.body === 'string') text = req.body;
  else if (Buffer.isBuffer(req.body)) text = req.body.toString('utf8');
  else {
    const chunks = [];
    let size = 0;
    for await (const ch of req) {
      size += ch.length;
      if (size > max) return { size };
      chunks.push(ch);
    }
    text = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(text) > max) return { size: Buffer.byteLength(text) };
  try {
    return { json: JSON.parse(text), size: text.length };
  } catch {
    return { json: undefined, size: text.length };
  }
}

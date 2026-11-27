// One Telegram Bot API call, shared by api/coder.js and api/report.js.
// Moved from api/coder.js, no change. The error carries no token.
export const TIMEOUT_MS = 5000;

export async function telegram(token, method, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const j = await r.json().catch(() => null);
    // the error carries no token: Telegram's description, the status
    if (!j?.ok) throw new Error(`telegram ${method}: ${r.status} ${j?.description || ''}`.trim());
    return j.result;
  } finally {
    clearTimeout(timer);
  }
}

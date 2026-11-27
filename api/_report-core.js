// "Fix the map" reports (docs/specs/public-reports.md): the pure rules,
// shared by the handler (api/report.js) and the panel (src/report.js, which
// Vite bundles). No imports, no DOM, no process.env: the handler passes the
// city's box and the deploy's version in.

export const CATEGORIES = ['missing-building', 'road', 'name', 'walk', 'looks-wrong', 'idea'];
// the data faults: the panel also offers an OpenStreetMap note
export const OSM_CATEGORIES = ['missing-building', 'road', 'name'];
// text in code points; email and body in characters and bytes. The body cap
// is 8 kB, not 4: 1000 code points of emoji or CJK text (3-4 bytes each)
// plus the other fields can pass 4096 bytes (EGM round 5, zoom-out-5-2).
export const LIMITS = { text: [10, 1000], email: 120, body: 8192, minElapsed: 2000 };
export const MODES = ['map', 'walk'];
export const LANGS = ['ru', 'pt', 'en'];
// the public fallback: an issue in the public repo, title and body as query
export const ISSUES = 'https://github.com/isatimur/braga-3d/issues/new';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
// control characters except \n and \t, and the bidi overrides and isolates
// (they can make a plain-text line read in a different order)
const ch = (code) => String.fromCharCode(code);
const CONTROL_RE = new RegExp(`[\\x00-\\x08\\x0B-\\x1F\\x7F-\\x9F${ch(0x202a)}-${ch(0x202e)}${ch(0x2066)}-${ch(0x2069)}]`, 'g');
// U+FF03 (fullwidth number sign): a report must never carry a "#<sid>" tag
// (the coder bridge routes owner replies in the same chat by that tag,
// api/_coder-core.js)
const HASH = ch(0xff03);

const round5 = (n) => Math.round(n * 1e5) / 1e5;
const fmt = (n) => String(round5(n));
const codePoints = (s) => [...s].length;

// The visitor's text as it is sent: NFC, \n line ends, no control
// characters, at most two blank lines in a row, trimmed. Links, "@" and
// e-mail addresses stay ("the shop at …"). Not a string: ''.
export function cleanReportText(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_RE, '')
    .replace(/\n(?:[ \t]*\n){3,}/g, '\n\n\n')
    .trim();
}

// A simple bot: the hidden x_note field is filled, or the form was sent
// less than 2 s after it opened (or with no time at all).
export function isBot(body) {
  const note = body?.x_note;
  if (note != null && note !== '') return true;
  const ms = body?.elapsed;
  return !(typeof ms === 'number' && Number.isFinite(ms) && ms >= LIMITS.minElapsed);
}

const inBox = (lat, lon, b) => lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;

// body: the parsed request; bbox: the city's wide_bbox { s, w, n, e }
// (no box: the city is not served here). -> { ok: true, value } or
// { ok: false, field }. Unknown fields are ignored.
export function validate(body, bbox) {
  const fail = (field) => ({ ok: false, field });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('body');
  if (typeof body.city !== 'string' || !bbox) return fail('city');
  if (!CATEGORIES.includes(body.category)) return fail('category');
  const text = cleanReportText(body.text);
  const n = codePoints(text);
  if (n < LIMITS.text[0] || n > LIMITS.text[1]) return fail('text');
  const email = body.email == null ? '' : typeof body.email === 'string' ? body.email.trim() : null;
  if (email == null || (email && (email.length > LIMITS.email || !EMAIL_RE.test(email)))) return fail('email');
  const { lat, lon } = body;
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return fail('lat');
  if (typeof lon !== 'number' || !Number.isFinite(lon)) return fail('lon');
  if (!inBox(lat, lon, bbox)) return fail(lat < bbox.s || lat > bbox.n ? 'lat' : 'lon');
  if (!MODES.includes(body.mode)) return fail('mode');
  if (!LANGS.includes(body.lang)) return fail('lang');
  return {
    ok: true,
    value: { city: body.city, category: body.category, text, email, lat: round5(lat), lon: round5(lon), mode: body.mode, lang: body.lang },
  };
}

const osmMapUrl = (lat, lon) => `https://www.openstreetmap.org/#map=19/${fmt(lat)}/${fmt(lon)}`;
const safeText = (text) => String(text).replace(/#/g, HASH);
const head = (v) => [`[report] ${v.city} · ${v.category} · ${v.lang} · ${v.mode}`, `${fmt(v.lat)}, ${fmt(v.lon)}`, osmMapUrl(v.lat, v.lon)];

// The Telegram text: plain, no parse_mode, so nothing in it renders, links
// or mentions anyone. version: the deploy's commit (the handler reads it).
export function message(value, version) {
  const sha = typeof version === 'string' && version ? version.slice(0, 7) : 'dev';
  const lines = [...head(value), `e-mail: ${value.email || 'no e-mail'}`, `version ${sha}`, '—', safeText(value.text)];
  return [...lines.join('\n')].slice(0, 4000).join('');
}

// An OpenStreetMap note at the place; it needs no account and is public.
export function osmNoteUrl(lat, lon) {
  return `https://www.openstreetmap.org/note/new#map=19/${fmt(lat)}/${fmt(lon)}`;
}

// The public fallback: a new GitHub issue with no e-mail and no version.
export function githubIssueUrl(value) {
  const text = [...String(value.text ?? '')].slice(0, LIMITS.text[1]).join('');
  const q = new URLSearchParams({
    title: `[${value.category}] ${fmt(value.lat)}, ${fmt(value.lon)}`,
    body: [...head(value), '—', safeText(text)].join('\n'),
  });
  return `${ISSUES}?${q}`;
}

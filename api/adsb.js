// GET /api/adsb: aircraft within 40 nm (74 km) of Braga, one small JSON.
//
// Why a function: none of the key-less ADS-B APIs send CORS headers
// (checked from a browser on braga-3d.com, 2026-09-28), so the page cannot
// call them itself. This Vercel function calls them server-side, normalises
// the answer and lets the Vercel CDN share it: s-maxage=10 means all
// visitors together cause at most one upstream call every 10 s.
//
// Sources, in order (the first that answers wins):
//   1. adsb.lol       https://api.adsb.lol/v2/point/41.55/-8.42/40   (ODbL data, no key)
//   2. adsb.fi        https://opendata.adsb.fi/api/v2/lat/41.55/lon/-8.42/dist/40 (open data, 1 req/s)
//   3. OpenSky        https://opensky-network.org/api/states/all?... (anonymous; cached 60 s,
//                     anonymous users have a small daily credit budget)
// airplanes.live is not used: it answers 403 and asks projects to contact it.
//
// Output: { src, now (ms), ac: [{ hex, flight, lat, lon, alt (m), gs (m/s),
//           track (deg), vr (m/s), ground, type, seen (s) }] }
const LAT = 41.55;
const LON = -8.42;
const NM = 40;
const FT = 0.3048;
const KT = 0.514444;

const SOURCES = [
  { id: 'adsb.lol', url: `https://api.adsb.lol/v2/point/${LAT}/${LON}/${NM}`, parse: readsb, maxAge: 10 },
  { id: 'adsb.fi', url: `https://opendata.adsb.fi/api/v2/lat/${LAT}/lon/${LON}/dist/${NM}`, parse: readsb, maxAge: 10 },
  {
    id: 'opensky',
    url: `https://opensky-network.org/api/states/all?lamin=${(LAT - 0.67).toFixed(2)}&lomin=${(LON - 0.9).toFixed(2)}&lamax=${(LAT + 0.67).toFixed(2)}&lomax=${(LON + 0.9).toFixed(2)}`,
    parse: opensky,
    maxAge: 60,
  },
];

// readsb / tar1090 JSON (adsb.lol, adsb.fi): feet, knots, ft/min
function readsb(j) {
  const list = j.ac || j.aircraft;
  if (!Array.isArray(list)) throw new Error('no aircraft list');
  const now = Number.isFinite(j.now) ? (j.now > 1e11 ? j.now : j.now * 1000) : Date.now();
  const ac = [];
  for (const a of list) {
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
    const ground = a.alt_baro === 'ground';
    const altFt = ground ? 0 : Number.isFinite(a.alt_geom) ? a.alt_geom : Number.isFinite(a.alt_baro) ? a.alt_baro : 0;
    const rate = Number.isFinite(a.geom_rate) ? a.geom_rate : Number.isFinite(a.baro_rate) ? a.baro_rate : 0;
    ac.push({
      hex: String(a.hex || '').replace(/^~/, ''),
      flight: String(a.flight || a.r || '').trim(),
      lat: a.lat,
      lon: a.lon,
      alt: Math.round(altFt * FT),
      gs: +((a.gs || 0) * KT).toFixed(1),
      track: Number.isFinite(a.track) ? a.track : Number.isFinite(a.true_heading) ? a.true_heading : 0,
      vr: +((rate * FT) / 60).toFixed(2),
      ground,
      type: a.t || '',
      seen: +(a.seen_pos ?? a.seen ?? 0).toFixed(1),
    });
  }
  return { now, ac };
}

// OpenSky state vectors: metres, m/s
function opensky(j) {
  if (!j || !('states' in j)) throw new Error('no states');
  const now = (j.time || Date.now() / 1000) * 1000;
  const ac = [];
  for (const s of j.states || []) {
    const [hex, call, , tPos, , lon, lat, baro, ground, vel, track, vr, , geo] = s;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    ac.push({
      hex,
      flight: String(call || '').trim(),
      lat,
      lon,
      alt: Math.round(ground ? 0 : (geo ?? baro ?? 0)),
      gs: +(vel || 0).toFixed(1),
      track: track || 0,
      vr: +(vr || 0).toFixed(2),
      ground: !!ground,
      type: '',
      seen: tPos ? Math.max(0, +(now / 1000 - tPos).toFixed(1)) : 0,
    });
  }
  return { now, ac };
}

async function getJson(url, ms = 5000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': 'braga-3d.com live map (https://braga-3d.com)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// The core, without the HTTP wrapper (node tests call it directly).
export async function fetchAircraft() {
  const errors = [];
  for (const s of SOURCES) {
    try {
      const out = s.parse(await getJson(s.url));
      return { src: s.id, maxAge: s.maxAge, errors, ...out };
    } catch (e) {
      errors.push(`${s.id}: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    }
  }
  return { src: null, maxAge: 15, errors, now: Date.now(), ac: [] };
}

export default async function handler(req, res) {
  const out = await fetchAircraft();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${out.maxAge}, stale-while-revalidate=${out.maxAge * 2}`);
  res.setHeader('X-Braga-Adsb', out.src || 'none');
  res.statusCode = out.src ? 200 : 502;
  res.end(JSON.stringify(out));
}

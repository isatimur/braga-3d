// The city an API call is for: ?city=<id>, validated against the config
// files on disk (cities/<id>.json), default braga. Shared by api/adsb.js
// and api/route.js (an underscore file is not a route on Vercel).
// vercel.json includeFiles ships cities/*.json with the functions.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CITIES = join(dirname(fileURLToPath(import.meta.url)), '..', 'cities');
const ID_RE = /^[a-z][a-z0-9-]*$/;
const cache = new Map();

// The cities this deploy serves: CITIES or VITE_CITIES (comma list), else
// VITE_CITY, else braga. A config file on disk is not enough: the deploy must
// also carry the city's data. Same rule as __KNOWN_CITIES__ in src/city.js.
const ALLOWED = (process.env.CITIES || process.env.VITE_CITIES || process.env.VITE_CITY || 'braga')
  .split(',').map((s) => s.trim()).filter(Boolean);

// { id, name, origin, aircraft: { lat, lon, radius_nm }, domain } or null
// when the id is not a known city.
export function cityConfig(id = 'braga') {
  if (!ID_RE.test(id) || !ALLOWED.includes(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const file = join(CITIES, `${id}.json`);
  let cfg = null;
  if (existsSync(file)) {
    try {
      const j = JSON.parse(readFileSync(file, 'utf8'));
      const point = j.aircraft || j.origin;
      cfg = {
        id: j.id || id,
        name: j.name?.en || id,
        domain: j.domain || null,
        origin: j.origin,
        aircraft: { lat: +point.lat, lon: +point.lon, radius_nm: +(j.aircraft?.radius_nm ?? 40) },
      };
    } catch {
      cfg = null;
    }
  }
  cache.set(id, cfg);
  return cfg;
}

// The User-Agent the upstream sees: the city's site.
export function userAgent(cfg) {
  const site = cfg?.domain || 'https://braga-3d.com';
  return `${site.replace(/^https?:\/\//, '')} live map (${site})`;
}

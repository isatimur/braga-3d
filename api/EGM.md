# api

## Overview

Vercel serverless functions for the 3D city map. Each non-underscore file is one
route: `/api/adsb`, `/api/route`, `/api/news`, `/api/guide`. The functions call
upstream services server-side (the upstreams send no CORS headers), normalise
the answer to one small JSON, and set `Cache-Control` so the Vercel CDN shares
it between visitors. `_city.js` is a shared helper, not a route.

Each route file exports its HTTP `handler` as the default export and its core
logic as named exports, so the node tests call the core without HTTP.

## Interface

### `_city.js` (shared helper, not a route)

- `cityConfig(id = 'braga')` returns
  `{ id, name, domain, origin, aircraft: { lat, lon, radius_nm } }` or `null`.
  It reads `cities/<id>.json`. `radius_nm` defaults to 40.
- `userAgent(cfg)` returns the User-Agent string sent upstream. It falls back to
  `https://braga-3d.com` when `cfg.domain` is not set.

### `adsb.js`: `GET | HEAD /api/adsb[?city=<id>]`

- `default handler(req, res)`.
  - 200: `{ src, maxAge, errors, now, ac: [{ hex, flight, call, reg, lat, lon, alt, gs, track, vr, ground, type, seen }] }`.
    Units: `alt` m, `gs` m/s, `vr` m/s, `track` deg, `seen` s, `now` ms.
  - 400: a query string with any key other than a single known `city`.
  - 405: any method other than GET or HEAD, with `Allow: GET, HEAD`.
  - Response header `X-Braga-Adsb` names the source, or `none`.
- `fetchAircraft(cfg = cityConfig('braga'))` is the core. It tries the sources
  in order (`adsb.lol`, `adsb.fi`, `opensky`); the first that answers wins.

### `route.js`: `GET | HEAD /api/route?callsign=&hex=[&city=<id>]`

- `default handler(req, res)`.
  - 200: `{ ok, callsign, hex, flight, route, aircraft }`.
    `flight`: `{ iata, icao, airline: { name, icao, iata } }` or `null`.
    `route`: `{ src, origin, destination }` or `null`; an airport is
    `{ iata, icao, name, city, country, lat, lon }`.
    `aircraft`: `{ src, registration, type, icaoType, manufacturer, operator }` or `null`.
  - 400: unknown key, duplicate key, unknown city, neither `callsign` nor `hex`,
    or a value that fails `CALLSIGN_RE` (`^[A-Z0-9]{2,8}$`) or `HEX_RE`
    (`^[0-9a-f]{6}$`).
  - 405: any method other than GET or HEAD.
  - Response header `X-Braga-Route` names the route source, or `none`.
- `lookupRoute(callsign, hex, cfg = cityConfig('braga'))` is the core.
- `haversineKm(la1, lo1, la2, lo2)` returns the great-circle distance in km.

### `news.js`: `GET /api/news[?city=braga]`

- `default handler(req, res)`.
  - 200: `{ source, checkedAt, items: [{ title, url, publishedAt, placeId }] }`.
  - 400 `unsupported_city`: `city` is set and is not `braga`.
  - 405 `method_not_allowed`: any method other than GET.
  - 503 `news_unavailable`: the feed failed; `items` is `[]`.
- `SOURCE`: `{ name, url, feed }` of the one publisher feed.
- `parseNews(xml, now = Date.now())` returns at most 6 items, newest first.
- `loadNews(fetcher = fetch, now = Date.now())` fetches the feed and parses it.

### `guide.js`: `POST /api/guide`

- `default handler(req, res)`.
  - Request JSON: `{ city?, lang: 'ru' | 'en' | 'pt', question, context?: { placeId?, viewCentre?: { lat, lon }, time?, weather? } }`.
  - 200: `{ answer, actions: [{ type: 'fly_to' | 'route_to', placeId, name, lat, lon }], sources: [{ title, url }], places, model }`.
  - Errors, always JSON `{ error }`: 400 `bad_request`, 403 `forbidden`,
    405 `POST only`, 413 `too_large`, 429 `rate_limited` (with `Retry-After`),
    503 `guide_not_configured`, 503 `guide_busy`, 503 `guide_no_data`,
    502 `guide_upstream`.
- `askGuide(input, { apiKey, fetchImpl })` is the core. It takes validated
  input and returns `{ status, body }`, plus `usage` or `reason`.
- `validate(body)` returns the validated input, or a string that says what is
  wrong.
- `loadPack(cityId, lang)` returns a promise of the knowledge pack
  `{ cityId, cityName, lang, places, byId, routes, text }`.
- `requestBody(pack, input, model)` builds the Anthropic Messages request.
- `userTurn(pack, input)` builds the per-request user message.
- `RULES` is the system prompt text.
- `rateLimited(ip, now = Date.now())` returns 0, or the seconds to wait.
- `resetLimits()` clears the rate-limit state (for tests).
- `distanceM(la1, lo1, la2, lo2)` returns the great-circle distance in metres.

## Invariants

- A city id is valid only when it matches `ID_RE` (`^[a-z][a-z0-9-]{0,39}$`),
  is in the `ALLOWED` list (env `CITIES`, else `VITE_CITIES`, else `VITE_CITY`,
  else `braga`), and `cities/<id>.json` parses. `cityConfig` caches hits only;
  it never caches a miss, so unknown ids cannot grow the map.
- `/api/adsb` accepts no query key other than `city`. Each extra key would make
  a new CDN cache key. A refused query gets a cacheable 400.
- `/api/adsb` answers 200 with `src: null` and `ac: []` when no source answers.
  It never answers 5xx for an upstream failure, because the CDN does not cache
  a 5xx.
- `/api/adsb` runs at most one upstream round per city at a time (`inflight`)
  and reuses the last answer per city for `MEMO_MS` (8 s).
- `/api/route`: `ok` is `false` only when every upstream failed. An upstream
  that answers "not known" (`Miss`, HTTP 404) gives `ok: true` with nulls.
- `/api/route` drops a route when no leg passes within `PLAUSIBLE_KM` (400 km)
  of the city's aircraft point, or when the upstream marks it
  `plausible: false`.
- `/api/route` cache holds at most `CACHE_MAX` (500) entries, oldest out. A
  success or a miss lives `TTL_MS` (10 min); a failure lives `FAIL_TTL_MS`
  (60 s). Route cache keys carry the city id for every city except `braga`.
- `/api/news` returns headlines only: title, URL, date, and a `placeId` from the
  `PLACES` list. It keeps an item only when the URL is `https:` on host
  `ominho.pt` with no credentials or port, the title is 1 to 280 characters,
  the date is within `AGE` (14 days) and not more than 5 minutes ahead, and the
  item names Braga (category, title, or a `PLACES` landmark).
- `parseNews` rejects XML with no `<rss` tag, or with `<!DOCTYPE` or `<!ENTITY`.
- `loadNews` stops reading above `MAX_BYTES` (1,500,000) and refuses redirects.
- `/api/guide` accepts same-origin requests only (`crossOrigin`), with
  `content-type: application/json`, a body of at most `MAX_BODY` (4096 bytes),
  and a question of 1 to `MAX_QUESTION` (300) characters. `validate` refuses
  unknown fields.
- `/api/guide` never answers from an empty pack (`guide_no_data`).
- The model answers through one forced tool, `answer`. `shapeReply` checks
  every place id against the pack again. Sources come from the pack data; the
  model never writes a URL. The reply holds at most 4 sources and an answer of
  at most 1200 characters.
- `userTurn` strips `<` and `>` from the question, so the question cannot close
  its `<question>` fence.
- `/api/guide` limits: `RATE_PER_MIN` (20) per client IP and `HOURLY_CAP` (600)
  per warm instance. Each instance counts on its own.
- `askGuide` tries `GUIDE_MODEL` (default `claude-sonnet-5`), then retries once
  with `FALLBACK_MODEL` only on a retryable `Upstream` error (timeout, network,
  5xx, 429, 404, bad JSON, no answer).
- `/api/guide` responses carry `Cache-Control: no-store`.
- The guide log line never holds the question or the API key.

## Side Effects

- Network, `adsb.js`: GET to `api.adsb.lol`, `opendata.adsb.fi`,
  `opensky-network.org`. Timeout 5 s per call.
- Network, `route.js`: POST to `api.adsb.lol/api/0/routeset` and
  `adsb.im/api/0/routeset`; GET to `vrs-standing-data.adsb.lol` and
  `api.adsbdb.com`. Timeout `TIMEOUT_MS` (3.5 s) per call.
- Network, `news.js`: GET to `https://ominho.pt/feed/`. Timeout 7 s.
- Network, `guide.js`: POST to `https://api.anthropic.com/v1/messages`.
  Timeouts 13 s, then 9 s for the retry. Each call costs money.
- Environment: `_city.js` reads `CITIES`, `VITE_CITIES`, `VITE_CITY` at module
  load. `guide.js` reads `ANTHROPIC_API_KEY` and `GUIDE_MODEL`.
- Disk reads: `_city.js` reads `cities/<id>.json`. `guide.js` reads
  `cities/<id>.json`, the landmarks file, `routes.json` under the city data
  directory, and imports `src/locales/<lang>.js` or `src/locales/<lang>.<city>.js`.
  These files must ship with the functions.
- Module state per warm instance: `_city.js` `cache`; `adsb.js` `memo` and
  `inflight`; `route.js` `cache`; `guide.js` `packs`, `hits`, `hour`.
- Logs: `guide.js` writes one `console.info` line per pack build and one per
  call.
- CDN: `adsb.js` sets `s-maxage` 10 (60 for `opensky`, 15 for no source);
  `route.js` sets `max-age=600` (60 when `ok` is `false`); `news.js` sets
  `s-maxage=900` on success and `no-store` on failure.

## Verification

- Run: `npm test`
- Run: `npm run verify`

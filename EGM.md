# braga-3d Blueprint

## System Overview

A true-scale 3D map of Braga that runs in the browser. Vite bundles Three.js ES modules from `src/`. Node scripts in `scripts/` fetch open map data into `data/` and check it. Four Vercel serverless functions in `api/` serve aircraft, flight routes, headlines and a talking guide. `public/` ships static files and the service worker. The repository is also the engine upstream for city forks: a fork carries its own `cities/<id>.json`, data folder and landmark models.

This file is the contract index. `README.md` is the human guide; `AGENTS.md` holds the working rules for agents.

## Local Interface & Invariants

- `[vite.config.js:default]` Vite config: `base: './'`, `publicDir: 'public'`, bundle output in `dist/static` (`build.assetsDir`), define `__KNOWN_CITIES__`.
- `[vite.config.js:knownCities]` City ids this deploy serves: env `VITE_CITIES` (comma list), else `VITE_CITY`, else every `cities/*.json` in development, else `braga`. `src/city.js` and `api/_city.js` apply the same list.
- `[vite.config.js:copyRuntimeData]` Build only: copies `data/`, `assets/` and `cities/` into the output folder at `closeBundle`. It skips any path that contains `/.cache`, and from `cities/` it ships only the configs of the known cities. A missing folder gives a warning, not a failure.
- `[vite.config.js:localNews]` Dev server only: mounts `api/news.js` at `/api/news`. Vercel owns the route in production.
- Side effects: `copyRuntimeData` writes under `dist/`; `knownCities` reads the environment and lists `cities/`.

## Subdirectories & System Boundaries

- src: [./src/EGM.md](./src/EGM.md) - Browser source. `main.js` is the entry point; it loads the city config and data, builds the scene in stages, wires the interface and the guided modes (cinema, story, quest, game, walk) and runs the render loop. Children: [./src/models/EGM.md](./src/models/EGM.md) (procedural landmark models on the `Kit` geometry class) and [./src/locales/EGM.md](./src/locales/EGM.md) (translation data).
- scripts: [./scripts/EGM.md](./scripts/EGM.md) - Node tools: city config and geo helpers, the `fetch-*.mjs` data pipeline run by `city.mjs`, generators, and the checks with `verify.mjs` as the repository gate.
- api: [./api/EGM.md](./api/EGM.md) - Vercel functions: `/api/adsb`, `/api/route`, `/api/news`, `/api/guide`; `_city.js` is a shared helper.
- public: [./EGM.public.md](./EGM.public.md) (kept outside `public/` so the build does not publish it) - Static files at the site root. The only source file is `sw.js`, the service worker.

Not documented here, because they hold no source code: `data/` (generated map data), `assets/` (images), `cities/` (city configs), `docs/` (ignored by git).

## Global Invariants

- `[src/geo.js:METRES_PER_UNIT]` 1 world unit = 4 m on all axes. +x is east, +z is south, +y is up. Local copies of `S = 1/4` in `src/road-network.js`, `src/road-structures.js` and `src/liveair.js` must equal `src/geo.js`.
- `[src/terrain.js:heightAt]` `heightAt` is the height datum for every draped object.
- `[src/fit.js:SHRINK_MIN]` A landmark model keeps real size: a rigid 1:1 transform, never under 0.97.
- `[scripts/city-lib.mjs:ID_RE]`, `[api/_city.js:ID_RE]`, `[src/city.js:ID_RE]` A city id is lower-case letters, digits and hyphens; the config is `cities/<id>.json`. The same known-city list applies at build time, in the browser and in the functions.
- `[scripts/city.mjs:FORCE]` The Braga data pipeline does not run without `--force`. `AGENTS.md` forbids hand edits of `data/*.json`.
- `[scripts/layers-manifest.mjs]`, `[src/layer-defs.js]`, `[src/perf-classes.js]` Modules that Node scripts import must stay free of browser APIs.
- `[api/guide.js:shapeReply]` The guide answers only from the site's place data; sources come from that data, never from the model.
- `[public/sw.js:fetch]` The service worker never answers or caches `/api/` paths, and it handles same-origin GET requests only.
- Engine-level changes are made here and carried to the forks; fork-only files (`cities/<id>.json`, the fork's data and models) never come back.

## Global Side Effects

- Network, build time: Overpass mirrors, Microsoft building footprints, elevation services, OSRM routing, Wikidata and the city's GTFS feed (see `scripts/EGM.md`).
- Network, run time: static data under the city data folder; own functions `/api/adsb`, `/api/route`, `/api/news`, `/api/guide`; third parties `api.open-meteo.com`, YouTube thumbnails and player, and `api.tomtom.com` with a visitor-supplied key (see `src/EGM.md`).
- Network, functions: aircraft sources (adsb.lol, adsb.fi, OpenSky), route sources, one publisher RSS feed, and the Anthropic Messages API, which costs money per call (see `api/EGM.md`).
- Disk: the pipeline writes `data/` and `data/.cache/`; generators write `public/p/`, `public/route/`, `public/og/`, `public/icons/`, `sitemap.xml` and `robots.txt`; the build writes `dist/`.
- Browser storage: `localStorage` keys with the `braga-` and `<city>-` prefixes, `sessionStorage` key `braga-intro`, and one Cache Storage cache named by `sw.js:VERSION`.
- Environment: `CITIES`, `VITE_CITIES`, `VITE_CITY`, `CITY`, `ANTHROPIC_API_KEY`, `GUIDE_MODEL`, `PLAYWRIGHT_CORE`, `CHROME_PATH`.

## System Verification

- Run: `npm test` (unit tests, `node --test scripts/*.test.mjs`)
- Run: `npm run verify` (the repository gate: build, manifests, data, geometry, traffic and triangle checks)
- Walk mode needs a served build: `node scripts/check-walk.mjs --base <url>`

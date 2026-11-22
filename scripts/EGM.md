# scripts

## Overview

`scripts/` holds the Node ESM tools that sit beside the app. They do four jobs:

1. **City config and geo helpers.** `city-lib.mjs` picks the active city and builds its paths. `geo-lib.mjs` adds the Overpass client and the metric helpers.
2. **Data pipeline.** The `fetch-*.mjs` scripts download OpenStreetMap, Microsoft, elevation, routing and GTFS data and write compact JSON under the city data dir. `city.mjs` runs them in order.
3. **Generators.** `make-og.mjs`, `route-pages.mjs`, `layers-manifest.mjs` and `pack-buildings.mjs` write site files and build artefacts.
4. **Checks.** The `check-*` scripts, `count-tris.mjs` and `smoke-flicker.mjs` test the data and the built app. `verify.mjs` is the repo gate.

Only four files export symbols: `city-lib.mjs`, `geo-lib.mjs`, `landmark-heights.mjs` and `route-pages.mjs` (plus one function in `layers-manifest.mjs`). All other files are command line scripts. The `*.test.mjs` files are unit tests and are not part of this contract.

In this file, `<data>` is the city data dir (`data/` for Braga, `data/<id>/` for other cities, unless `data_dir` is set in `cities/<id>.json`). `<cache>` is the city cache dir (`data/.cache/` for Braga).

## Interface

### Libraries

**`city-lib.mjs`** (imports no local files)

- `ROOT`, `CITIES_DIR`: repo root and `<ROOT>/cities`.
- `listCities(): string[]`: ids of `cities/*.json`.
- `cityArg(args = process.argv.slice(2)): string`: city id from `--city <id>` or `--city=<id>`, else env `CITY`, else `braga`. Removes the flag from `args`. Throws on a bad id.
- `loadCity(id = cityArg()): object`: the config plus `dataDir`, `landmarksPath`, `cacheDir`, `tileGrid`, `terrainLattice`, `probes`, `userAgent`.
- `CITY`, `DATA_DIR`: the active city and its data dir, resolved at import time.
- `dataPath(...parts)`, `cachePath(...parts)`, `landmarksPath()`, `dataRel(...parts)`: path builders.
- `loadLandmarks({ withPos = true } = {}): array`: the landmarks file, or the `landmark_candidates` merged with `<data>/new/<id>.osm.json`.

**`geo-lib.mjs`** (imports `./city-lib.mjs`)

- Re-exports `CITY`, `DATA_DIR`, `dataPath`, `cachePath`, `dataRel`, `landmarksPath`.
- `BBOX`, `CORE_BBOX`, `WIDE_BBOX`, `ORIGIN`, `USER_AGENT`, `TILE_GRID`, `TERRAIN_LATTICE`: values from `CITY`.
- `MIRRORS: string[]`: four Overpass interpreter URLs.
- `overpass(query, { rounds = 4, allowEmpty = false, label = '' } = {}): Promise<element[]>`.
- `wait(ms)`, `M_LAT`, `M_LON`, `toXY([lat, lon])`, `toLL([x, y])`, `r5(v)`, `r6(v)`.
- `simplify(pts, tol)`, `simplifyRing(ring, tol)`: Douglas-Peucker, `tol` in metres.
- `ringArea(ring)`: signed m2, positive is counter-clockwise. `centroid(ring)`: `[lat, lon]`.
- `minAreaRect(pointsLL): { bearing, long, short }`: bearing in `[0, 180)`.
- `tagHeight(tags = {}): { h, src } | null`: reads `height` or `building:height`, then `building:levels` x 3.2.

**`landmark-heights.mjs`** (imports `./city-lib.mjs`)

- `HEIGHTS_BY_CITY = { braga, guimaraes }`: height tables keyed by landmark id.
- `HEIGHTS`: the table for `CITY.id`, or `{}`.
- Entry fields: `m`, `source`, `note`, and optional `on`, `onTag`, `main_m`, `main_source`, `force`, `parts`, `width_m`, `depth_m`.

**`route-pages.mjs`** (library and CLI; imported by `make-og.mjs`)

- `LANGS = ['pt', 'en', 'ru']`.
- `loadInputs(): Promise<{ quest, landmarks, tr, site, cityName } | null>`: `null` when `data/quest.json` is absent.
- `routePagePaths(quest): string[]`.
- `renderRoutePages({ quest, landmarks, tr, site, cityName }): [{ path, html }]`.
- `writeRoutePages(pages, { check = false, log = console.log }): string[]`: returns the stale paths.
- CLI: `node scripts/route-pages.mjs [--check]`.

**`layers-manifest.mjs`**

- `transferBytes(body, ext): number`: raw length, or brotli length for a compressible file over 512 bytes.

### Pipeline scripts

| Script | Command line | Main output |
| --- | --- | --- |
| `city.mjs` | `[<city-id>] [--city <id>] [--from <step>] [--only <step>] [--force] [--dry-run]` (`npm run city -- <id>`) | Runs the steps below as child processes |
| `fetch-terrain.mjs` | `[--city <id>] [--dry-run]`, env `TERRAIN_OUT` | `<data>/terrain.json` |
| `fetch-buildings.mjs` | `[--city <id>] [--dry-run]` | `<data>/buildings.json` |
| `fetch-ms-buildings.mjs` | `[--city <id>] [--fetch \| --build] [--dry-run]` | `<data>/buildings-ms.json`, `<data>/tiles-ms/` |
| `fetch-roads.mjs` | `[--fetch] [--dry-run] [--list]` | `<data>/roads.json` (`v: 2`) |
| `fetch-nature.mjs` | `[--city <id>] [--refresh] [--dry-run]` | `<data>/nature.json` |
| `fetch-tiles.mjs` | `[--city <id>] [--fetch \| --build] [--only x_y,...] [--dry-run]` | `<data>/tiles/<x>_<y>.json`, `<data>/tiles/index.json` (`v: 2`) |
| `fetch-traffic-axes.mjs` | `[--city <id>]` | `<data>/traffic-axes.json` |
| `fetch-gtfs.mjs` | `[--city <id>] [--offline]` | `<data>/gtfs/schedule.json` |
| `fetch-footprints.mjs` | `[--city <id>] [--only=id1,id2]` | `<data>/footprints.json`, `<data>/new/<id>.osm.json` |
| `fetch-pois.mjs` | `[--city <id>] [--refresh] [--dry-run]` | `<data>/pois.json`, `<data>/streetscape.json` |
| `fetch-routes.mjs` | `[--city <id>]` | `<data>/routes.json` |
| `fetch-funicular.mjs` | `[--offline]` | `<data>/life.json` (Braga only) |

- `city.mjs` step order: `terrain`, `buildings`, `ms-buildings`, `roads`, `nature`, `tiles`, `traffic-axes`, `gtfs`. Each step runs `node scripts/fetch-<name>.mjs --city <id>`. The other four fetch scripts are not steps of `city.mjs`.
- Most fetch scripts do not parse `--city`. They get the city through `CITY` in `city-lib.mjs`.

### Generators and data edits

- `make-og.mjs [--pages] [--icons] [--og] [--only=id,id]`: no mode flag runs all modes. Env: `CITY_URL`, `BRAGA_URL`, `CITY_HERO_FROM`, `BRAGA_HERO`, `PLAYWRIGHT_CORE`, `CHROME_PATH`.
- `layers-manifest.mjs [--check] [--city <id>] [--dist <dir>]` (`npm run layers`): env `CITY`.
- `pack-buildings.mjs [--city <id>] [--check]`: only the space-separated `--city` form is parsed.
- `stash-pending.mjs [--restore] [--city <id>] <id> ...`: `--restore` with no ids restores all pending landmarks.
- `add-populo-square.mjs [dumpPath]`: default dump path `/tmp/populo-square.json`.
- `dmaria-parts.mjs`: no arguments.

### Checks

| Script | Command line | Exit codes |
| --- | --- | --- |
| `verify.mjs` | `[--city <id>]` (`npm run verify`), env `CITY` | 1 on any FAIL, else 0 |
| `check-data.mjs` | `[--online]` (`npm run check:data`) | 1 on errors |
| `check-geo.mjs` | none (`npm run check:geo`) | 1 on errors |
| `check-dimensions.mjs` | none (`npm run check:dimensions`) | 1 on errors |
| `check-fit.mjs` | `[--allow-legacy]` (`npm run check:fit`) | 1 on a bad fit |
| `check-traffic.mjs` | `[seconds]`, default 90 (`npm run check:traffic`) | 1 on errors |
| `check-discovery.mjs` | none (`npm run check:discovery`) | A failed `assert` throws |
| `count-tris.mjs` | `[--city <id>]` (`npm run check:models`) | 1 on a bad model or total |
| `pack-buildings.mjs --check` | see above | 77 skip, 1 fail, 0 pass |
| `check-layers.mjs` | `--url <url> [--out <dir>] [--size WxH]`, env `PLAYWRIGHT_CORE` | 1 on a FAIL or a page error |
| `check-walk.mjs` | `[--base URL] [--out DIR]`, env `PLAYWRIGHT_CORE` | 77 skip, 1 fail, 0 pass |
| `smoke-flicker.mjs` | `[--frames N] [--places a,b,c] [--dist DIR]`, env `SMOKE_PORT`, `PLAYWRIGHT_CORE`, `CHROME_PATH` | 77 skip, 1 fail, 0 pass |

- `verify.mjs` runs, in order: `npm run build`, `layers-manifest.mjs --check`, `npm run check:discovery` (Braga only), `route-pages.mjs --check` (Braga only), `check-data.mjs`, `check-geo.mjs`, `check-dimensions.mjs`, `check-fit.mjs`, `check-traffic.mjs`, `pack-buildings.mjs --check`, `count-tris.mjs`.
- `check-interface.browser.js` and `check-route-mobile.browser.js` are not Node scripts. Each is an `async (page) => ...` snippet. Run it in an open session: `playwright-cli run-code "$(cat scripts/<file>)"`. Each returns `{ results, errors }` and throws on the first failed check.
- `check-layers.mjs`, `check-walk.mjs`, `smoke-flicker.mjs` and the two browser snippets are not part of `verify.mjs`.

## Invariants

### City and geometry

- A city id must match `/^[a-z][a-z0-9-]*$/` [`city-lib.mjs:ID_RE`]. `cfg.id` must equal the config file name, and the config must have `origin`, `core_bbox`, `wide_bbox`, `timezone` and `name` [`city-lib.mjs:loadCity`].
- `CITY` resolves at import time. A bad `--city` value throws when any script imports `city-lib.mjs` [`city-lib.mjs:CITY`].
- Points are `[lat, lon]`. `toXY` returns `[x east m, y north m]` from `ORIGIN` [`geo-lib.mjs:toXY`].
- Two values exist for metres per degree of latitude: `geo-lib.mjs:M_LAT = 111320` and `city-lib.mjs:M_LAT = 110574`. Do not mix them inside one calculation.
- `overpass()` uses a 240000 ms timeout, a back-off of `4000 * (round + 1)` ms and 4 rounds by default. It rejects an empty `elements` array unless `allowEmpty` is set. It throws `All Overpass mirrors failed` [`geo-lib.mjs:overpass`].
- Output coordinates use 5 decimals (`r5`). `fetch-footprints.mjs` and `fetch-funicular.mjs` use 6 decimals (`r6`).

### Pipeline

- `city.mjs` refuses the Braga pipeline without `--force` and exits 1 [`city.mjs:FORCE`]. A step whose main output exists is skipped unless `--force` or `--only` is set. A failed child stops the run. The `gtfs` step needs `CITY.transit.gtfs_url`.
- `fetch-buildings.mjs`: 3 x 3 tile grid (`GRID = 3`); output cap `MAX_BYTES = 8 * 1024 * 1024`; buildings in `footprints.json` `osm_ids`, or with a centroid in an `exclude_outline` outline, are dropped. A missing `footprints.json` only prints a warning, and landmarks are then not excluded.
- `fetch-ms-buildings.mjs`: `OVERLAP = 0.15`, `MIN_M2 = 12`, `SIMPLIFY_M = 1`, `NEAR_M = 150`. `build()` throws when `<cache>/ms-raw/bbox.json` is missing. `CENTRE_R` has two values: 600 at module level (line 66, used by `heightOf`) and 700 inside `build()` (line 514, used by `centreBlob`).
- `fetch-footprints.mjs`: each landmark needs a config in `OVERRIDES_BY_CITY` (`braga`, `guimaraes`), or the script throws. The main OSM object must match the config name, have a closed ring (unless `gateWall`) and lie within 250 m of the landmark. A landmark with no OSM height tag and no `HEIGHTS` entry throws. A config with `ms` needs `<cache>/ms-raw/bbox.json`; run `fetch-ms-buildings.mjs --fetch` first.
- `fetch-roads.mjs`: output `v: 2`. Each street piece keeps a junction id at its first and last point, else the script throws `junction ids lost`. Simplify tolerance is 5 m, or 1.5 m for roundabouts, links, bridges and tunnels.
- `fetch-tiles.mjs`: `MAX_TILE_BYTES = 600 * 1024`, `CONCURRENCY = 2`, `PAD = 0.003` degrees. Core tiles are skipped. Coordinates are integers in 1e-5 degrees, delta-coded from the tile origin. Road flags: 1 one-way forward, 2 one-way back, 4 bridge, 8 tunnel, 16 roundabout, 32 arch.
- `fetch-nature.mjs`: output cap `MAX_BYTES = 3 * 1024 * 1024`; the script throws above it. `fetch-pois.mjs`: `MAX_POIS_BYTES = 1.5 * 1024 * 1024`; the script throws above it.
- `fetch-terrain.mjs`: `BATCH = 100`, `PACE_MS = 1100`, `DATASETS = ['eudem25m', 'srtm30m']`. Heights are row-major, row 0 is the south edge, columns run west to east. A non-finite height throws `grid has holes`.
- `fetch-routes.mjs`: `DELAY_MS = 1200` before each OSRM call. The leg count must equal the stop count minus 1. Only `braga` has routes; other cities exit 0.
- `fetch-gtfs.mjs`: shapes are delta-coded at 1e-5 degrees (`shapeCoding: 'delta-1e5'`). A city with no `transit.gtfs_url` exits 0.
- `fetch-funicular.mjs`: Braga only; other cities exit 0. `footprints.json` must exist.
- `fetch-traffic-axes.mjs`: a city with no `AXES_BY_CITY` entry gets `axes: {}` and no Overpass call.

### Generators

- `layers-manifest.mjs`: top-level code measures and writes on import, so an import of `transferBytes` also writes both manifest files. `--check` passes when bytes are within `max(4096, 1%)` and layer ids and flags match. Exit 2 when `dist/index.html` or a chunk is missing.
- `route-pages.mjs`: `writeRoutePages` writes only files whose content changed. `--check` writes nothing and exits 1 when a page is stale.
- `make-og.mjs`: OG images are 1200 x 630 (600 x 315 at scale 2), JPEG quality 82. Route pages are written only when `CITY.id === 'braga'`.
- `pack-buildings.mjs`: gzip level 9. `--check` never rewrites `buildings.bin.gz`. The packed file must decode to the same buildings.
- `add-populo-square.mjs` and `dmaria-parts.mjs` are idempotent one-off edits of `footprints.json`. `dmaria-parts.mjs` uses the path `data/footprints.json` relative to the working directory.

### Checks

- `verify.mjs`: a check whose input files are missing reports SKIP and does not fail the gate. Discovery and route pages run for Braga only [`verify.mjs:checks`].
- `count-tris.mjs`: `MAX_MODEL = 40000`, `MIN_MODEL = 4000`, `MAX_TOTAL = 600000`; no NaN in any position.
- `check-data.mjs`: each landmark has all contract fields; `history_ru` is 900 to 1800 code points in 3 to 5 paragraphs; `facts_ru` has 3 to 5 items of at most 110 code points; `sources` has 2 to 4 items; `gallery` has 1 to 5 JPEGs of at most 650000 bytes; `videos` has 1 to 3 items; `routes.json` has exactly 3 routes; a licence must not be NC or ND.
- `check-geo.mjs`: `bearing_deg` in `[0, 180)`; `extent_m[0] >= extent_m[1] > 0`; `height_source` is one of four fixed strings; the `osm` field of `landmarks.json` matches `footprints.json`; `buildings.json` is at most 8 MiB with at least 5000 (braga), 3000 (guimaraes) or 1000 (other) buildings; terrain probes fall in fixed height bands.
- `check-dimensions.mjs`: the ids in `dimensions.json` equal the landmark ids; each numeric leaf is finite, above 0 and covered by a source; `facade_faces` equals the 45-degree sector of `facade_azimuth_deg`.
- `check-fit.mjs`: a model fails when its deviation exceeds `DEVIATION_FAIL`, when it is legacy (without `--allow-legacy`), or when `shrinkCheck` fails. Both constants live in `src/fit.js`.
- `check-traffic.mjs`: 600 vehicles, 30 steps per second, fixed LCG seed 7. Zero tolerance for wrong-way travel, clockwise roundabouts, left-side travel and vehicles below ground.
- `check-walk.mjs`, `smoke-flicker.mjs` and `pack-buildings.mjs` exit 77 when a prerequisite is missing (Playwright, Chromium, `dist/index.html` or `buildings.json`).

## Side Effects

### Files written

- Under `<data>`: `terrain.json`, `buildings.json`, `buildings.bin.gz`, `buildings-ms.json`, `tiles-ms/*.json`, `roads.json`, `nature.json`, `tiles/*.json`, `traffic-axes.json`, `gtfs/schedule.json`, `footprints.json`, `new/<id>.osm.json`, `new/pending.json`, `pois.json`, `streetscape.json`, `routes.json`, `life.json`, `layers.json`, `dimensions.json` (by `stash-pending.mjs`).
- `fetch-footprints.mjs` rewrites the landmarks file on a full run when that file exists. `stash-pending.mjs` rewrites the landmarks file, `footprints.json`, `dimensions.json` and `new/pending.json`.
- Under `<cache>`: `ms-raw/` (CSV, `.gz` parts, `bbox.json`), `buildings-r<i>c<j>.json`, `roads-raw.json.gz`, `bridges-raw.json.gz`, `nature-raw.json`, `pois-raw.json`, `streetscape-raw.json`, `terrain-wide-raw.json`, `tiles-raw/` (job files and `manifest.json`), `gtfs/<operator>.zip` and its extracted folder.
- Under `public/`: `p/<id>/index.html`, `route/**/index.html`, `sitemap.xml`, `robots.txt`, `icons/*`, `og/*.jpg` (`make-og.mjs`); `route/**/index.html` (`route-pages.mjs`).
- Under `dist/`: `<DATA_DIR>/layers.json` (`layers-manifest.mjs`). `verify.mjs` runs `npm run build`, which writes `dist/`.
- Screenshots: `output/layers-check/*.png` (`check-layers.mjs`), `output/playwright/*.png` (both browser snippets), and the `--out` dir of `check-walk.mjs`.

### Files deleted

- `fetch-tiles.mjs` deletes empty tiles and, without `--only`, stale `<data>/tiles/<x>_<y>.json` files.
- `fetch-ms-buildings.mjs` deletes stale `<data>/tiles-ms/<x>_<y>.json` files.
- `fetch-gtfs.mjs` removes and re-creates the extracted feed folder in `<cache>/gtfs/`.

### Network

- Overpass mirrors: `maps.mail.ru`, `overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee` (`geo-lib.mjs:MIRRORS`; `fetch-nature.mjs` and `fetch-tiles.mjs` carry their own list of the first three).
- `minedbuildings.z5.web.core.windows.net` (`fetch-ms-buildings.mjs`).
- `api.opentopodata.org` and `api.open-elevation.com` (`fetch-terrain.mjs`).
- `routing.openstreetmap.de` and `router.project-osrm.org` (`fetch-routes.mjs`).
- `www.wikidata.org` (`fetch-footprints.mjs`).
- `CITY.transit.gtfs_url` (`fetch-gtfs.mjs`).
- `www.youtube.com` (`check-data.mjs`, only with `--online`).
- A local app server: `make-og.mjs` (default `http://localhost:5173`), `check-layers.mjs` (default `http://127.0.0.1:4874/`) and `check-walk.mjs` (default `http://localhost:5471/`) expect a running server. `smoke-flicker.mjs` starts its own.

### Processes and browsers

- `city.mjs` and `verify.mjs` run other scripts with `spawnSync`.
- `fetch-gtfs.mjs` runs `unzip`.
- `smoke-flicker.mjs` spawns `npx vite preview` on `SMOKE_PORT` (default 5413) and kills it at exit. It also runs `npm root -g`, as does `check-layers.mjs`.
- `make-og.mjs`, `check-layers.mjs`, `check-walk.mjs` and `smoke-flicker.mjs` launch headless Chromium through `playwright-core`.

### Other

- `check-discovery.mjs` replaces `globalThis.fetch` for one test and restores it.
- `check-route-mobile.browser.js` removes the `localStorage` key `braga-quests-braga` before each viewport.
- `make-og.mjs` holds developer-local default paths for `PLAYWRIGHT_CORE` and `CHROME_PATH` (lines 30 to 35). Set both variables on another machine.
- `fetch-routes.mjs` sends a contact email in its `User-Agent` header (line 20).

## Verification

- Run: `npm test` (unit tests: `node --test scripts/*.test.mjs`)
- Run: `npm run verify` (the repo gate: `node scripts/verify.mjs`)

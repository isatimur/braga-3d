# Cities

One JSON per city. The goal: `src/` and `scripts/` read every place-specific constant from here, so a new city is a config file, a landmark list and the usual agent rounds (data → models → integration).

## Status

| City | Config | Data pipeline | Landmarks | Live |
|---|---|---|---|---|
| Braga | `braga.json` | done (hand-coded constants, to be moved here) | 30 | https://braga-3d.com |
| Guimarães | `guimaraes.json` | not run | 18 candidates | – |
| Porto | `porto.json` | not run | 20 candidates | – |

## Refactor plan (one round)

1. `src/city.js`: loads `/cities/<id>.json` chosen by `?city=` / hostname / build-time `VITE_CITY`, exports `CITY`.
2. Replace the 15 hard-coded coordinate/bbox/timezone/GTFS/airport constants in `src/geo.js`, `live.js`, `livebus.js`, `liveair.js`, `tiles.js`, `terrain.js`, `api/*.js` and the 18 name strings in `main.js`, `intro.js`, `tour.js`, `story.js`, `share.js`, `index.html` with `CITY.*` and locale keys.
3. Scripts take `--city <id>`: `fetch-terrain`, `fetch-buildings`, `fetch-ms-buildings`, `fetch-roads`, `fetch-nature`, `fetch-tiles`, `fetch-footprints`, `fetch-routes`, `fetch-gtfs`, `make-og`, `check-*`. Data lands in `data/<city>/…` (Braga's current `data/` moves to `data/braga/` with a compatibility path).
4. `npm run city -- guimaraes` runs the whole pipeline; models live in `src/models/<city>/`; locales split per city.
5. Deploy: one Vercel project per city (own domain), same repo, `VITE_CITY` env.

## Why Guimarães before Porto

Guimarães is Braga-sized, 22 km away, its wide bbox overlaps Braga's, and it proves the multi-city pipeline cheaply. Porto is ~4× the data, with the Douro and six real bridges, and benefits from a pipeline that already works.

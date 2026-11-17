# Progress Log

<!--
Agent-agnostic repository-local session log. Any coding agent reads it at
startup and updates it before handoff when AGENTS.md tells it to. No agent
updates it automatically.
-->

## Current Verified State

- Repository root: `~/Dev/braga-3d`
- Standard startup path: `./init.sh`
- Standard verification path: `npm run verify`
- Current local work: perf round "visible only" (braga-019), ported from porto-3d, on `perf/visible-only`, not merged. Not pushed, not deployed.
- Latest check: 2026-11-17. `node --test scripts/*.test.mjs` (45/45) and `npm run verify` (10 steps) passed on `perf/visible-only`; browser checks in Session 016.
- Production state: last documented check is from 2026-10-04; not rechecked since. braga-3d.com does not have braga-014 or braga-015.

## Session Log

### Session 001

- Date: 2026-10-03
- Goal: Install the harness pack (instructions, state, verification, scope, lifecycle) for the engine source of truth.
- Completed:
  - Added `AGENTS.md` (+ `CLAUDE.md` pointer) — map, not manual; notes Braga is upstream for the forks.
  - Added `feature_list.json` — 8 features derived from commits and current checks.
  - Added `scripts/verify.mjs` + `npm run verify` — the single gate, `--city` aware (`data/` = braga, `data/<id>/` = other cities).
  - Added individual `check:*` npm scripts.
  - Added `init.sh`, `.nvmrc` (22) and `engines.node >=22`.
  - Added `.github/workflows/verify.yml`.
  - Added this progress log.
- Verification run: `npm run verify`
  - PASS build, data contract, geo, dimensions, 1:1 fit, traffic, models
  - Result: `verify: OK — 7 passed`
- Evidence captured: verify summary above; `feature_list.json` statuses.
- Commits: `braga-3d: harness pack — AGENTS.md, feature_list, progress, init.sh, verify gate, CI`.
- Files or artifacts updated: AGENTS.md, CLAUDE.md, feature_list.json, claude-progress.md,
  init.sh, .nvmrc, scripts/verify.mjs, package.json, .github/workflows/verify.yml.
- Known risk or unresolved issue:
  - 71 files are uncommitted in the working tree from other sessions (content/models/guimaraes); this session did not touch them.
  - README is 585 lines (Russian) and duplicates much of what AGENTS.md now indexes — candidate for later trimming; not done here to avoid clobbering.
  - Total triangle budget 513,554 / 600,000 — little headroom for new models.
- Next best step: keep this repo green as the forks land changes; port any engine fix here first.

### Session 002

- Date: 2026-10-03
- Goal: Build and harden the Azulejo discovery game mode (`#game`) on the live city.
- Completed:
  - `src/game.js` — fog-of-war reveal, six shards, scan/combo/medals, XP/levels, echo (`X`), orbit (`C`), overview (`V`, lifts the fog), sky-ring chain, exploration sparks placed on real streets, best score.
  - Fog of war in the shared fog shader (`src/scene.js` `SHROUD_UNIFORMS` + `createShroud`): one mask texture shared by every lit material via a `clone()` that returns itself.
  - HUD (`src/game-hud.js`), Web Audio cues + ambient pad (`src/game-audio.js`), pooled pickup sparks (`src/game-vfx.js`), localStorage save (`src/game-progress.js`), `data/game.json`, styles, RU/EN/PT strings.
  - **Flight fix (reported bug):** a plain left-drag now turns the view in game mode (`src/camera.js` `setGameMode`); the full-screen `.game-bursts` overlay was eating every drag, so turning never worked — it is now `pointer-events: none`.
  - Generated azulejo art (mural + six tiles) and saved as small JPEGs; verification screenshots switched to JPEG to stay well under the payload limit.
  - README section «Игра «Азулежу»»; `feature_list.json` braga-009.
- Verification run: `npm run verify`
  - PASS build, data contract, geo, dimensions, 1:1 fit, traffic, models
  - Result: `verify: OK`
- Evidence captured: `docs/game/*.jpg`, `docs/game/mobile/*.jpg`; `docs/game/game-verify.mjs` (turn −63.6°, orbit, overview, echo, rings, sparks, exit).
- Commits: none this session (changes left uncommitted alongside other sessions' work).
- Files or artifacts updated: src/game*.js, src/scene.js, src/camera.js, src/main.js, src/style.css,
  src/locales/ui.js, data/game.json, assets/game/*.jpg, docs/game/*, README.md, feature_list.json, claude-progress.md.
- Known risk or unresolved issue:
  - Mobile has no free-flight input (keyboard only); the «К осколку» button is the mobile path. On-screen thumbstick is a possible follow-up.
  - The game adds no committed tests beyond `docs/game/game-verify.mjs` (Playwright, manual run).
- Next best step: optional — on-screen flight stick for touch, and a persisted achievements/collection screen.

### Session 005

- Date: 2026-10-04
- Goal: Continue to a live release (user: "continue your work").
- Completed:
  - Found PR #1 already merged (`bd15fdc`, merged 22:43 UTC); `gh pr create` correctly refused a duplicate.
  - Synced local `main` to `origin/main`, deployed via `vercel --prod --yes`; aliased to https://braga-3d.com in ~31 s.
  - Live verification: fresh HTML (Last-Modified 2026-10-04 22:53 UTC, bundle `index-qWs7iU95.js`, search-input/atmo/callout present); `/api/adsb` 200 with live aircraft; `/api/news?city=braga` 200 with fresh items.
- Evidence captured: deployment output (Production URL + `Aliased: https://braga-3d.com`); curl header/body checks above.
- Files or artifacts updated: claude-progress.md (this entry).
- Known risk or unresolved issue: none for the release; mobile game touch flight remains keyboard-only by design.
- Next best step: whatever the user picks next; `./init.sh` remains the baseline.

### Session 003

- Date: 2026-10-04
- Goal: Inspect the latest Braga interface work and complete its keyboard interaction behavior (braga-010).
- Repository evidence: fetched origin; HEAD and origin/main both 71115b0 (0 ahead / 0 behind). Latest five commits are harness/CI changes. The search, atmosphere, callout, streetscape and game work was already present as uncommitted edits and new files.
- Reproduced before fixing:
  - Pressing W in Atmosphere put KeyW into the flight input.
  - ArrowRight in the language selector navigated from the cathedral to Arco da Porta Nova.
- Completed:
  - Main key dispatcher respects consumed events and leaves header/select keys with their controls; Escape still closes the menu from the select.
  - Flight input clears when focus enters an input, dialog, search or menu, preventing held movement from continuing while interacting with controls.
  - Search shortcut is disabled during game mode so it cannot focus the hidden map interface.
  - Added scripts/check-interface.browser.js, a repeatable Playwright CLI regression with failing assertions.
  - init.sh synchronized the lockfile's existing Node >=22 engine metadata.
- Verification:
  - ./init.sh: PASS; npm run verify after code changes: PASS all seven gates.
  - Browser regression PASS at 1440x900 and 390x844 with quality=low; zero JavaScript page errors. Covers search, detail opening, language-select arrows, Escape, focus return, time presets, keyboard flight, focus reset, routes and game entry/exit.
  - Additional PT/RU -> EN switch checks preserved the cathedral deep link and produced the English title.
  - Screenshots: output/playwright/{search,map}-{1440,390}.png.
  - Known existing model warnings: torre-menagem 14%, leonardo-da-vinci 13%; both within the verification tolerance. Build retains its existing large-chunk warning.
- Production evidence: https://braga-3d.com returned HTTP 200, Last-Modified 2026-10-01; HTML uses index-v20MZTRp.js and has no search-input, atmo or callout. This proves the current local redesign is not the production HTML, not that live APIs were verified.
- Acceptance: braga-010 accepted for local desktop/mobile interaction behavior. No claim of a complete production release or physical-phone performance testing.
- Remaining work / risks:
  - Publish and remotely verify the new interface; live APIs were not exercised in this session.
  - Previously documented mobile game free-flight controls are still absent; the existing Go to shard button remains its touch navigation.
  - Existing uncommitted engine, game, generated Braga/Guimaraes data and README changes were preserved. No commit was created because this narrow fix is interleaved with that broader unfinished release; no user changes were stashed or discarded.
- Restart: ./init.sh remains the baseline. Local Vite preview available at http://127.0.0.1:5173/ while its process runs.

### Session 004

- Date: 2026-10-04
- Goal: Finish and ship the discover release (user: "finish and ship").
- Completed:
  - Reviewed the full changeset on `codex/braga-discover-release` (was 0 commits ahead, all work uncommitted): 66 modified + 26 new files; benign config diffs (gitignore, vercelignore, engines metadata, local /api/news shim, discovery check in the gate); tile JSON churn is pipeline output; secret scan clean; `dist/`, `docs/`, `output/`, `.playwright-cli/` stay ignored.
  - `npm run verify` → OK (build, data contract, geo, dimensions, 1:1 fit, traffic, models).
  - Committed as `53b6c20` ("braga-3d: discover release — ...", 92 files, +10275/−352) and pushed to `origin/codex/braga-discover-release` via explicit refspec (no upstream config change, no PR created — not requested).
- Evidence captured: verify OK output; `git log` shows 53b6c20 on top of 71115b0; push confirmed `new branch HEAD -> codex/braga-discover-release`.
- Files or artifacts updated: claude-progress.md (this entry).
- Known risk or unresolved issue:
  - Not merged to main and not deployed; braga-3d.com still serves the old interface.
  - PR creation left to the user: https://github.com/isatimur/braga-3d/pull/new/codex/braga-discover-release
- Next best step: open the PR, merge, deploy to Vercel, then remotely verify the live interface and APIs.

### Session 006

- Date: 2026-10-05
- Goal: Repair the history in a separate worktree and fix deploy hygiene.
- Repository evidence: local `main` (ff52a90) was 2 ahead and 3 behind `origin/main` (bd15fdc). The working tree had 70 uncommitted paths; every one is byte-identical to `origin/main` (the discover release was committed from that tree), so none is new work.
- Completed (branch `repair/sync-origin`, worktree `~/Dev/braga-3d-sync`, built on `origin/main`):
  - Cherry-picked "stop tracking Guimarães" (modify/delete conflicts on `data/guimaraes/*` resolved as deletion) and the session 005 log (progress-log conflict resolved to the newer text).
  - `.gitignore` keeps `data/guimaraes/`, `assets/img/guimaraes/`, `cities/guimaraes.json`, `src/models/index.guimaraes.js` out.
  - Known-city allow-list: `vite.config.js` defines `__KNOWN_CITIES__` (build: `VITE_CITIES`, else `VITE_CITY`, else braga; dev: every `cities/*.json`) and copies only those configs into `dist/cities/`; `src/city.js` and `api/_city.js` apply the same list. `?city=guimaraes` now falls back to Braga.
  - `make-og.mjs --pages` now writes `robots.txt`, `sitemap.xml` (home + 30 `/p/` pages), JSON-LD and hreflang on every share page; `index.html` has JSON-LD and hreflang; added `public/favicon.ico` and a branded `public/404.html`.
  - Fit drift: leonardo-da-vinci height 13.3 % -> 5.5 % (house skirt 0.6 m, `heightRel`); torre-menagem 13.7 % documented in its rule note (external stair and crown stand outside the OSM outline).
  - Photos: Commons re-checked (API, categories, geosearch 300 m); no free photo found for leonardo-da-vinci, none new for dmaria-ii (see `data/CREDITS.md`).
- Verification run: `npm run build`, `npm run verify` -> `verify: OK`; `dist/cities/` holds `braga.json` only.
- Known risk or unresolved issue: not deployed; the Vercel project must not set `VITE_CITIES` to include other cities. Engine port plan is in `/tmp/review/engine-port-plan.md`.
- Next best step: adopt the branch (see `/tmp/review/braga-history-fix.md`), push, deploy, then curl the checks listed under braga-011.

### Session 007

- Date: 2026-10-06
- Goal: Port the guimaraes-3d engine waves 6-8 and the porto-3d perf governor into `repair/sync-origin` (plan: `/tmp/review/engine-port-plan.md`). Nothing is deployed.
- Finding that changes the plan: Braga's `facades.js`, `buildings.js`, `buildings-ms.js`, `nature.js`, `water.js` and `life.js` predate guimaraes wave 5 (the plan's "conflict hunks" are mostly missing wave-5 code, not Braga edits). A three-way merge against wave 5 therefore pulls in wave-5 features Braga never had. Each step ported only what its wave added.
- Completed, one commit each (all green: build, verify, check:fit, check:traffic 100 %):
  - Relief (`terrain.js`, `tile-worker.js`, `scene.js` createGround uses `groundMeshAt`). The Penha scarp is opt-in (`createTerrain(..., { scarp })`), off for Braga.
  - Crowd (`people.js`; `life.js` market hook gated on `LIFE.market.stalls`, which Braga lacks, so no market crowd yet).
  - Moving water (`water.js`, fountain splash rings, mist and side arcs in `life.js`, `debug.water.seek/resume` in `main.js`). Weirs left out (no data, and they need wave-5 `sampleLines`).
  - Vegetation (`nature.js`, `leaves.js`, `seasons.js`): chestnut, plane, poplar, willow, reeds along `river|stream` lines, hedgerows, meadows, per-species timing. Penha terraces, boulders and altitude pines not ported. `VALLEY_Y` is 10 for Braga.
  - Governor (`main.js`, `effects.js` `setPostLevel`, `tiles.js` `setBudgetScale`). Pauses during intro, tour, cinema, story and the game; the fx toggle stays the master switch. `__braga.setGovernorLevel(0..3)` forces a level.
  - Sky lift (`scene.js` morning and sunset presets), scaled to Braga's brighter base values.
- Blocked: building typology (`facades.js`, `buildings.js`, `buildings-ms.js`). Replacing the three files with guimaraes `eb39ba1` was denied by the auto-mode classifier, so I did not retry. To do it, review and run from the worktree: `for f in facades buildings buildings-ms; do git -C ~/Dev/guimaraes-3d show eb39ba1:src/$f.js > src/$f.js; done`, then change the `[guimaraes]` log tags back to `[braga]` (two files) and run the gate. Expect the wave-5 street detail (balconies, shutters, awnings, arcades, cornices, chimneys, dormers) to arrive with it.
- Pending by request: road surfaces, forecourts and gardens (need authored grounds), city buses.
- Frame stats (1280x800, 60 fps): overview 248 -> 245 calls; Praca da Republica 235 -> 255 calls (+8.5 %), Bom Jesus 157 -> 171 calls (+8.9 %); triangles within +-2 %. The machine was heavily loaded at the end (load average over 60), so later fps readings of 30 were the governor reacting, not a regression.
- Known risks: the unmerged `~/Dev/braga-3d` working tree was not touched; `tile-worker.js` still scatters only species 0..8 by the new mixes without the river rule; `LAND_PX` stays at 64.

### Session 008

- Date: 2026-10-06
- Goal: port the porto-3d real-time weather fix (`ed0db10`) to Braga.
- Done: weather states `drizzle` and `downpour` (the old full `rain` dials) added, `rain` is now moderate; `weatherFromCode` picks the state by WMO code and precipitation; menu, preset popover (`index.html`) and guide labels list the new states; `"default_live": true` in `cities/braga.json` turns live mode on for first visits (`braga-live`, `#live=0`, `#weather=` and `#time=` still win).
- Verification: `npm run build`, `npm run verify` green; headless fresh visit shows live badge (18 deg, thunderstorm) that matches Open-Meteo; one screenshot per state (clear, partly, overcast, drizzle, rain, downpour, fog) is distinct and ordered by intensity.
- Known gap: thunderstorm (WMO 95+) still maps to the moderate `rain` state, as in Porto.

### Session 009

- Date: 2026-10-13
- Branch: `engine-port-perf` (on top of the perf port 9b9bbb8). Nothing is pushed or deployed.
- Goal: streets in the streamed ring (braga-013), ported from porto-3d `6cd058b`.
- Cause: `tile-worker.js` read every tile v2 street record `[kind, hw, flags, ly, pts, j]` as v1, so every point was NaN. The ring had no ribbons, no lines and no tree occupancy (all 13,357 records in `data/tiles` are v2).
- Done: v2 decode with a v1 fallback; tunnels dropped; bridges on a straight deck never below the ground; near-LOD ribbons in the building mesh, no service roads or tracks, none in the far LOD; ribbon quads and line segments merged within tolerance. In `tiles.js`, ring rivers and primary lines join the core's line geometry (no glow out there), and the secondary lines get one body-only line mesh in place of the old ring river line.
- Frame stats (1440x900, class XL, headless): overview 220 -> 220 calls, +1.9 % triangles; two ring poses +8 and +9 calls (tile meshes with streets pass culling more often), +1.6 % and +1.0 % triangles.
- Verification: `npm run verify` OK.
- Loader (porto-3d `4ba38a6`): after 12 s on the loader, a slow-connection hint and a Lite mode button. Braga has no lite scene (`src/lite/` is not ported), so the button reloads with `?quality=potato`: the full scene at class P. In Braga today that is the Low build (phone module budgets, no post-processing) plus: no sun shadows, DPR capped at 1, a smaller tile and tree radius near the ground, half the label and simulation rates. The `trees`, `cars` and `people` fields of the class table are not read yet, so Potato and Low draw the same overview (215 calls, 1.41M triangles, class P vs S, headless). `perf.js` saves that choice in `braga-quality`, so later visits stay on Potato until the quality menu or `?quality=auto` changes it. Checked on the build with the bundle held 16 s: hint and button at 13 s, the click reloads at class P (`reason: url`).

### Session 010

- Date: 2026-11-05
- Goal: first mobile-usability improvement toward making Braga 3D stand out among browser-based city maps.
- Finding: Azulejo mode had touch buttons for abilities and flying to a shard, but free flight still required a keyboard.
- Done locally: added a touch directional stick and hold-to-climb/descend buttons; touch axes combine with keyboard flight input, and blur/game exit clear the controls. Added Portuguese and English labels for the new controls. Tracked as braga-014, still in progress.
- Verification: `npm run build` passed. The full repository verification gate and touch-device interaction checks were not run in this turn; braga-014 remains in progress until those checks pass.
- Files updated: `src/fly.js`, `src/game-hud.js`, `src/game.js`, `src/locales/ui.js`, `src/main.js`, `src/style.css`, `feature_list.json`.
- Next step: run `npm run verify` and the documented browser checks at portrait and landscape phone sizes, then tune the controls from the result.

### Session 011

- Date: 2026-11-07
- Goal: improve first-visit loading while continuing the mobile controls work.
- Finding: the Azulejo game, story mode, and development-only talking guide were all bundled into the initial app entry even though they are opened only on demand.
- Done locally: those modules now load dynamically when requested. Added a request token so a slow mode import cannot start after the user switches to another mode, and added translated load-error messages.
- Build result: `npm run build` passed. The entry chunk changed from 1,239.25 kB / 427.86 kB gzip to 862.61 kB / 335.70 kB gzip. The shared Three and geometry chunks are still eagerly preloaded, so the full initial module graph is about 7.4 kB gzip smaller; game (11.91 kB gzip), story (3.76 kB), and guide (6.71 kB) are separate chunks and are deferred on ordinary visits. `git diff --check` passed.
- Browser checks for `#game`, `#story`, `#cinema`, mode switching during a load, and `?guide=1` remain pending. No production deploy was made.
- Files updated: `src/main.js`, `src/locales/ui.js`, `feature_list.json` (alongside the braga-014 mobile-control changes).
- Next step: run the project verification and interaction checks when verification is requested, then continue with the biggest remaining visitor-facing gap.

### Session 012

- Date: 2026-11-15
- Branch: `feat/touch-and-lazy-modes`, merged into `main` with `--no-ff`. Nothing is pushed or deployed.
- Goal: run the pending browser checks for braga-014 and braga-015, fix what fails, commit.
- Method: headless Chromium (playwright-core) against `vite preview` of the production build; phone sizes with touch emulation and CDP touch events. "Before" is a build of `84321c5` from a temporary worktree. Emulation only, no physical phone.
- Passed:
  - `#game`, `#story`, `#cinema` open with no console errors at 1440x900, 390x844 and 844x390.
  - A plain visit fetches no game, story or guide chunk. `?guide=1` loads the guide.
  - With the mode chunk held 3.5 s: game->cinema, game->story, story->game, story->cinema never start the stale mode.
  - Game at 390x844 and 844x390: the stick moves the camera (forward, strafe), climb and descend work, stick plus climb work with two fingers, release stops the drone, blur and game exit clear the input, a new game starts with clear input. No key is needed for free flight.
  - The opening view without a mode matches the `84321c5` build at all three sizes (same camera, same DOM layout, screenshots compared).
- Fixed (found by the checks):
  - `src/style.css`: in portrait the descend button sat on the clue panel. The controls now sit 196px above the bottom and the clue panel takes the full width (its `left: 50%` had capped it at half the screen). In landscape up to 900px wide the panel starts right of the controls and stops before the action column. Checked with every clue in EN, PT and RU at six phone sizes.
  - `src/game-hud.js`: blur cleared the flight input but left the knob off-centre; blur and a hidden tab now reset the stick and the lift buttons.
  - `src/main.js`: `__braga.story` stayed null after the lazy load. Escape, opening a place or a route, or a hash without a mode during a slow import let the mode start later; `cancelModeLoad()` now drops the pending request. The mode writes its hash again after it starts.
- Still open:
  - After a failed import, a second try in the same page does not refetch in Chromium (the browser keeps the failed module). The toast shows and the map stays usable; a reload recovers. The feature text no longer claims recovery.
  - Older than these features, not changed: the compass covers the mute/help (portrait) or echo/mute (landscape) action buttons in the game; at 932x430 the clue panel overlaps the action row (same at `84321c5`).
  - Not explained: early in the session the desktop game lost `#game` from the address (empty hash, or `#weather=drizzle`) while live weather was drizzle. Later runs on this build and on `84321c5`, with real and with mocked drizzle weather, kept `#game`. The game itself ran in every case.
- Verification: `node --test scripts/*.test.mjs` passed; `npm run verify` passed.
- Evidence: screenshots and the check script (`check.mjs`) are in `/tmp/braga-touch/`; they are not in the repository.
- Next step: decide on a deploy; then the compass and action-button overlap in the game on phones.

### Session 013

- Date: 2026-11-16
- Branch: `feat/discover-route`. Nothing is pushed or deployed.
- Goal: a guided history route for a demo to the tourism office, schools and culture bodies (braga-016).
- Done:
  - `src/quest.js` (lazy chunk, with `src/quest.css`), `src/quest-progress.js`, `data/quest.json`. Entry: Menu > Modes > History route, or `#quest` (demo link `https://braga-3d.com/?lang=pt#quest`). The id is `quest`, because the left panel already has a «Discover» view.
  - Stops, in time order: Termas Romanas do Alto da Cividade, Sé de Braga, Arco da Porta Nova, Palácio do Raio, Bom Jesus do Monte. Every history, answer and visit line is a verbatim excerpt of the place card in that language; `scripts/quest.test.mjs` checks it, and checks that visit lines carry no opening hours.
  - `src/main.js`: the mode joins `startMode`, `applyHash`, the intro deep-link rule, the key dispatcher, map clicks, label clustering, the governor pause and the search block. Its stops win the label declutter while it runs.
  - `src/locales/pt.js`: Palácio do Raio year 1752–1755 -> 1752–1754, as its own text and the ru/en data say.
- Verification: `node --test scripts/*.test.mjs` 16/16; `npm run verify` OK. Browser checks with `/tmp/braga-discover/check.mjs` (headless Chromium, `vite preview` of the build): the full route at 1280x800 and 390x844 in pt and en, and behaviour checks (no chunk on a plain visit, menu entry, focus and Tab, inert map chrome, fly keys off, map clicks off, Esc restores the map, resume and start again, place card from the end, reduced motion cuts, Esc during the data load).
- First load: entry JS +1,665 bytes (+475 gzip); CSS and HTML unchanged.
- Known limits: the route keeps the visitor's light. Live mode (the default) follows the real sun, so at night the stops are dark; a forced preset would switch live mode off for good, so the route does not set one. Not checked on a physical phone or with a screen reader. The overview hides some stop labels where they collide. (Session 014 replaced this light rule.)

### Session 014

- Date: 2026-11-16
- Branch: `feat/quest-round-2`, merged into `main` when the checks pass. Nothing is pushed or deployed.
- Goal: history routes, round 2 (braga-017).
- Done:
  - Daylight: `src/live.js` `hold()` pauses the real sun and weather and keeps a preset from leaving live mode, with no storage write. `src/quest.js` keeps the visitor's time, live mode and weather, shows `day` and `clear`, and restores them on exit; `main.js` `currentHash` uses `quest.heldLight`, so the URL never carries the override; `deferLayers` calls `quest.lifeReady()` when life.js arrives during a route; it puts day and clear back at once, since life.js sets the live sun and saved weather at once (a browser check forced this order and first saw a night and rain flash, now gone). A `time=` hash edit during the route is the visitor's and stays.
  - Retry: `src/quest-progress.js` v2 save `braga-quests-<city>` (per route id, every pick kept). The round-1 save `braga-quest-<city>` is read once into `two-thousand-years`; an old wrong answer becomes a plain stamp.
  - Routes: `data/quest.json` `routes[]`; chooser; `#quest` (chooser, the only route, or the route in progress) and `#quest=<id>`. Second route `old-town-on-foot`: Biscainhos, Arco da Porta Nova, Sé, Santa Bárbara (the old archbishops' palace is the same landmark), Torre de Menagem.
  - Text version: `scripts/route-pages.mjs`, run by `make-og.mjs --pages`, writes `public/route/`; sitemap; verify step «route pages»; links from the intro, the chooser and the no-WebGL notice.
  - Events: `src/events.js` `emit()` -> `p3d:event` on window; fired from the route.
- Verification: `node --test scripts/*.test.mjs` 27/27; `npm run verify` OK. Browser checks with `/tmp/braga-quest-2/check.mjs` (sections light, late, retry, flow, behave, text; `run-all.sh` runs them on the build served by `vite preview --port 4874`): 273 checks pass, no console errors; screenshots in `/tmp/braga-quest-2/`.
- First load against round 1: entry JS +647 bytes (+267 gzip), CSS +75 (+22 gzip), HTML unchanged. Lazy: quest JS 15.1 kB (6.5 kB gzip), quest CSS 8.2 kB, data/quest.json 45.0 kB (13.5 kB gzip).
- Behaviour to know: while a route runs the hash also carries the visitor's own light (for example `#quest=old-town-on-foot&time=live&live=1`), never the daylight override. A `#quest` hash edit while a route is open goes back to the chooser.
- Known limits: story, cinema and the game still appear to end live mode on exit (read in the code, not tested). A `#quest&live=1` link loses `live=1` (older: `startMode` rewrites the hash before life.js reads it). The menu label is still «History route» and its title says «five places, five questions». Not checked on a physical phone or with a screen reader.

### Session 015

- Date: 2026-11-17
- Branch: `feat/quest-task-types`, merged into `main` when the checks pass. Nothing is pushed or deployed.
- Goal: history routes, round 3: task types, so the route uses the 3D map (braga-018).
- Done:
  - Task model: `src/quest-tasks.js` (types, the answer token of each, a shape check used by the route and the test). Each stop in `data/quest.json` has one `task` with a stable `id` and a `type`; options and sequence items have ids. Types: `multiple_choice`, `true_false`, `find_on_map`, `sequence`, `visual_detail`.
  - Routes: two-thousand-years = Termas (multiple choice), Sé (true/false, true), Arco da Porta Nova (find on the map), Palácio do Raio (multiple choice), Bom Jesus (sequence 1373/1629/1784/1882). old-town-on-foot = Biscainhos (multiple choice), Arco (true/false, false), Sé (find on the map), Santa Bárbara (sequence 1112/1336/1866/1934), Torre de Menagem (visual detail: the battlements). Stop order unchanged. Where a sequence stop's history lines held the dates, other lines of the same card replace them.
  - Find on the map: the camera shows the candidates (the route's stops and neighbours) as «?» markers; a click on a model, pin or marker picks (`main.js` asks `quest.pickable`, `landmarks.js` `pick(raycaster, only)`); a wrong pick names the place; after two, the place's marker pulses (a still ring with reduced motion); the card lists the same candidates as buttons. The history text waits until the place is found, then the camera goes to it. Every screen change, Esc and exit end the picking.
  - Progress v3 (`src/quest-progress.js`): tries by task id as id tokens, stamps by stop. The round-2 save (option indices) and the round-1 save migrate through `legacy.v2` in the data: every stamp stays, a kept question keeps its tries.
  - Events: `quest_step_completed` carries `type` (seven keys now).
  - Text pages: the intro's task sentence is left out, as the question sentence was.
- Verification: `node --test scripts/*.test.mjs` 37/37; `npm run verify` OK. Browser checks on the build served by `vite preview --host 127.0.0.1 --port 4874`: `/tmp/braga-quest-3/run-all.sh` runs `check.mjs` (flow: both routes, every stop solved by click, tap or keyboard, wrong then right, 1280x800 and 390x844, pt and en, events with the type; find: a real canvas click and a label click, a non-candidate click, the hint, a reload in the middle, Tab and the list, Esc in the middle, reduced motion cuts and a still hint; seq: focus, Tab, a reload after a check; migrate: round-1 and round-2 saves; matrix: multiple choice, true/false and visual detail with reduced motion, keyboard only and a reload in the middle, a sequence cut, the end-screen event, a category filtered out before the route) and the round-2 `check-r2.mjs` sections light, late, behave and text: 559 checks pass, no console errors.
- First load against round 2: entry JS +206 bytes (+101 gzip), CSS and HTML unchanged. Lazy: quest JS 24.2 kB (9.5 kB gzip), quest CSS 11.0 kB, data/quest.json 54.4 kB (16.2 kB gzip).
- Known limits: the find-on-map view is wide on a phone (the models are small; the markers and the list carry the task). The visual detail rests on one model (the keep), checked by eye in screenshots. Not checked on a physical phone or with a screen reader.

### Session 016

- Date: 2026-11-17
- Branch: `perf/visible-only` from `main` 08ce468. Not merged, not pushed, not deployed.
- Goal: port porto-3d perf round 3 ("draw only what is in view", porto `b0b713b..fc5545f`, porto-027) to Braga (braga-019).
- Method: headless Chromium (chrome-headless-shell), **ANGLE on Metal (Apple M1 Max) for every number**; builds served by porto's `perf-serve.mjs` (brotli, Vercel cache headers); porto's profiles `desktop-gpu` (1440x900, DPR 2, class XL) and `phone-low` (360x740, DPR 2, 6x CPU, Fast 3G, Mali-G52 string: class S). Views uncapped, governor pinned at 0, `#time=day&weather=clear&live=0`. Main and the branch measured in turn. The machine was shared (load average up to 28): frame times move between runs; draw calls and primitives do not. Scripts in `/tmp/braga-perf/bench/` (not in the repository).
- Done, one commit each:
  - `21e7d36` road cells: `src/cell-runs.js` (porto's, plus an explicit geometry), `roads.js` `prepareCells`/`updateCells`, `main.js` `cullCells()` before each render and the sort after `ready`, one object per idle slot; the postcard culls for its own aspect (`share.js` `beforeRender`). Braga adaptation: `tiles.js` joins the ring's streets to the core's primary (and water) line by giving it a new geometry; such a line draws whole, as before (cell-runs.js; two new tests). Ten road objects are culled.
  - `6c50a52` bounds: `src/bounds.js`; near tree species (`nature.js` partition) and street furniture (`streetscape.js` fillLayer) get the bounds of their ring instead of `frustumCulled = false`; an empty tree species is hidden. Braga has no tram rails.
  - `a3e2864` early route card: a `#quest` link fetches `quest.js` and `quest.json` with the map's data; the card opens once the landmarks exist; `attach()` hands it the rig, the skyline and the UI hooks. Braga builds the rest of the scene and the UI in one task after the landmarks, so `start()` yields two frames there on such a link. A find-on-map task opened early answers from the card's list (no map labels exist before the first full frame); after `attach()` its labels and the canvas pick again (`pickLabels`). The visitor's time waits behind the route's daylight (`holdTime`, the `applyHash` guard).
- Numbers, main -> branch (main-pass primitives; calls):
  - desktop-gpu: overview 2.04 -> 2.05 M (242 -> 241 calls, shadow 14 -> 2); old town 2.46 -> 2.10 M (151 -> 166); Bom Jesus 1.71 -> 1.11 M (96 -> 97); route stop (Arco) 1.99 -> 1.29 M (102 -> 109); old town at night 2.00 -> 1.37 M (108 -> 119). p50 unchanged within noise (pixel-bound).
  - phone-low: overview 1.53 -> 1.26 M (126 -> 129); old town 1.82 -> 1.19 M (105 -> 110); Bom Jesus 1.30 -> 0.60 M (74 -> 72); route stop 1.79 -> 1.04 M (96 -> 91); night 1.63 -> 0.88 M (86 -> 83).
  - Route card on `/?lang=pt&intro=0#quest=old-town-on-foot` (two interleaved runs): desktop 2.67 / 2.72 -> 2.26 / 2.34 s; phone-low 27.3 / 29.0 -> 20.5 / 21.8 s. First frame, interactive and ready unchanged. KB until the card 1307 -> 1184..1310.
  - The cell sort after `ready`: 36 ms on the desktop, 175 ms at 6x CPU in all, tasks of 50 to 90 ms; it ends 0.4 s (desktop) and 3 to 4.5 s (phone-low) after `ready`. Long-task time in the 9 s after `ready` on phone-low: main 2758 / 3027 ms, branch 2092 / 3099 ms (a 1.6 to 2.0 s task after `ready` is in both builds).
  - Entry JS +7.7 kB (+2.8 kB gzip); quest chunk +0.5 kB.
- Look: culled against whole in one JS task (`measure.mjs exact`: the frame drawn 8 times culled and 8 times with the roads whole and `frustumCulled = false` on the trees and furniture): 48 poses at desktop size and 48 at phone size (six spots, 45 degree steps, the ring view included): identical on every pixel that is stable across the 8 draws of its mode. The unstable pixels (tens to a thousand per frame) lie on z-fighting kerb edges and differ between two culled draws as well. Postcards at 9:16 and 16:9: roads to the frame edges, the only differences are distant streamed buildings.
- Checks: `node --test scripts/*.test.mjs` 45/45; `npm run verify` OK (10 steps); `/tmp/braga-perf/bench/qcheck.mjs` 45/45 (early card on desktop and phone-low, find-on-map answered from the card before the first full frame and by a label tap and a canvas click after it, `&time=night`, Esc while early, `?quality=potato`, `#quest` chooser, the menu path, console clean); the round-3 quest suite of Session 015 (a copy in `/tmp/braga-perf/q3/`) 559/559 on the branch build (flow 388, find 26, seq 4, migrate 9, matrix 38, light 50, late 8, behave 14, text 22). On `perf-serve.mjs`, which has no `/api`, nine "console clean" checks fail on the `/api/news` and `/api/adsb` 404s; on `vite preview` (as in Session 015) they pass. Game, story chapter 2 and route stop screenshots of main and the branch match (differences: streamed buildings and moving pins).
- Known limits: the tree bounds rarely cull in the main view (the camera is inside the ball around it); their gain is the hidden empty species and the shadow pass. The core primary line draws whole once ring tiles show (about 76 k primitives at Bom Jesus); porto's separate ring lines in `tiles.js` would fix it (+1 to +2 calls in ring views, no round caps on far primary lines). The early card gains less than in Porto because Braga builds its landmarks after the roads and buildings. Not checked: physical phones, other GPUs, Safari, Firefox.

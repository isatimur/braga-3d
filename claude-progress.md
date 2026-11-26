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
- Current local work: none open. `main` is 052b1d0 (era filter, route points, analytics hook, Session 021) plus one log commit; 052b1d0 is pushed. Production serves 052b1d0 since 2026-11-22 (bundle `index-CgrUdiqF.js`; era filter checked on braga-3d.com with a phone profile). Web Analytics is not enabled for the Vercel project yet, so nothing is counted. The three lines below describe the state before Session 020.
- Latest check: 2026-11-21. `node --test scripts/*.test.mjs` (79/79), `npm run verify` and `scripts/check-walk.mjs` (desktop and Pixel 7 profile) passed on `main` ed509ca.
- Production state: braga-3d.com serves `main` ed509ca (bundle `index-C8RfbSf7.js`), deployed by the owner with `vercel --prod` on 2026-11-21; `scripts/check-walk.mjs --base https://braga-3d.com` passed after the deploy.

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

### Session 017

- Date: 2026-11-18
- Branch: `ux/route-mobile-pass` from `main` 85d978d. Not merged, not pushed, not deployed.
- Goal: a mobile and UX pass on the history routes (braga-020). Bar: a tourist on a phone, in the street, one hand, sunlight.
- Method: headless Chromium (ANGLE Metal) and WebKit, the production build on `vite preview`, outside requests blocked. Each route walked whole (chooser, intro, every stop with a wrong and a right answer, end, leave) at 320x568, 375x667, 390x844, 412x915, 844x390, 768x1024 (touch) and 1280x800 in pt, en and ru; WebKit at 390x844 en, 320x568 ru, 844x390 pt. Measured: boxes against the viewport, hit areas, computed font sizes, CSS contrast, pixel contrast over photos and the map, each find-on-map marker (shown, on top, size, overlap). Scripts in `/tmp/braga-route-pass/tools/` (not in the repository).
- Found and fixed, one commit each:
  - `bf0f8ac` find on the map: the hidden header (opacity 0) still muted the labels under its parts; 3 of 7 «?» markers were gone on most phones, 4 of 7 at 320x568, the place itself and its hint among them. `body.is-quest .topbar > * { display: none }`; markers 30x26 -> 44x44 px.
  - `a3d2196` a phone on its side (844x390) got a bottom sheet: 106 px of text, 63 px on a find task (no question, no list), over a 164 px strip of map. Now a full-height card on the left; `quest.js` frames the map to its right (`side` media query). Under 400 px wide the two buttons share one row.
  - `c6dde23` 44 px targets (close 34, buttons 42, list 40, arrows 40, links 24-28 px), 12 px text (kicker, labels, credit, sources were 10.5-11.5 px), `--text-3` 4.1:1 -> 5.4:1, the photo credit over a bright photo.
  - `b37b7bd`, `0bc9db0` the verdict stays in view (a solved sequence and a 320 px answer scrolled «Right!» away); only the text box scrolls (scrollIntoView also scrolled the card and hid its head); a find task's question shows on a short sheet.
  - `12af4cc` a two-word route title keeps both words beside the stamps under 400 px. `c055d34` the hinted marker lies over a tried one.
  - `dab7774` text pages: language and back links 18 -> 44 px tall, map button 41 -> 45 px (pages regenerated, no text changed).
- Checks: `node --test scripts/*.test.mjs` 46/46 (new: quest.css targets and text sizes; red on the old stylesheet); `npm run verify` OK. New `scripts/check-route-mobile.browser.js` (playwright-cli run-code): fails on main, passes on the branch in Chromium; in WebKit every size check passes, the run ends on an aborted `buildings.json` fetch that WebKit reports as a page error when the check navigates away. Route matrix after: 0 card targets under 44 px, 0 texts under 12 px, 0 CSS contrast failures, 0 hidden markers, every target tap lands, every verdict in view, console clean (24 runs). Reload and rotation checks 17/17. The round-3 suite of Session 015 (copy in `/tmp/braga-route-pass/q3/`): 551/559; the 8 failures are one find step in the phone flow whose «click a wrong place's building on bare canvas» precondition no longer holds: a 44 px marker now covers that building's centre.
- Open decision (owner): with 44 px markers, a marker can cover a neighbour's building. 2 of 14 candidate buildings' centres lie under another place's marker at 390x844, 5 of 14 at 320x568, 1 of 14 at 1280x800. On «The old town on foot» at 320x568 the target itself is covered: one real tap on the Sé's building centre picked Arco da Porta Nova («Not this one»), so a visitor who taps the building as the prompt says loses the gold stamp (`/tmp/braga-route-pass/fixed/tap-building-320x568.jpg`; at 390x844 the same tap is right). Before the branch that building took the tap, but the Sé's own marker and its hint did not show at all. Options: smaller markers on narrow phones, 44 px only for a coarse pointer, or a pick that prefers the model under the finger; none was chosen here.
- Known limits: A reload lands on the route's intro with «Resume (n of 5)», not on the stop (existing design). Text page route titles (27 px) and source links (20 px) stay small. No `viewport-fit=cover`, so safe-area insets are 0 (Safari letterboxes). Not checked: a physical phone, sunlight, a screen reader, Firefox.

### Session 018

- Date: 2026-11-18
- Branch: `feat/layers-and-loading` from `main` 20547c0, `main` merged in at cb3f93f (place card icon buttons, `.vercelignore`; no conflict). Not merged, not pushed, not deployed.
- Goal: port lisboa-3d's layers and loading status (its Sessions 003 and 005, final state 805a229) to Braga (braga-021).
- What the visitor gets: a «Map layers» panel (menu, or «Layers» in the pill) with four layers: the ring of tiles around the centre, the Microsoft buildings, street level (calçada, lamps, people, terraces, signs) and aircraft and TUB buses. Each row shows its size (measured from `dist/` into `data/layers.json`) and its state. A layer that is off is never requested. A status pill under the header counts the ring and MS tiles of the current camera move together («Loading this area… 3 of 6»), then says «Area loaded», or «Map areas that failed to load: n» with Retry. Presets: Light (no layers) on class S and P, Full on the others. Braga has no photo-texture layer, so Standard equals Full and the panel shows two presets. Every new string is in pt, en and ru.
- Commits: `5ee3526` definitions, manifest and status logic with tests; `95b378b` engine hooks (`tiles.js` `setEnabled` and `begun`, `buildings-ms.js` `begun`, `life.js`, `streetscape.js`); `1b11136` panel and pill; `4096b1a` `scripts/check-layers.mjs`; `27a625d` its panel screenshots wait for the fade-in; `b3300b6` the failed pill on a phone puts Retry and Layers on a second row (in pt, «Zonas do mapa que falharam: 6» beside «Tentar de novo» and «Camadas» had 88 px at 360 px and lost its count; check-layers runs in en only); `d8c9abd` makes `layers-manifest.mjs --check` accept sizes within 1 % or 4 KB (a chunk imports the main chunk by its hash, so any app change moved the live layer by 4 bytes and failed verify).
- Braga differences from Lisbon: `pois.json` stays core (Discovery and the search read it); the live layer also gates `data/gtfs/`; the ring's trees live in `nature.js` and go with the ring; the MS buildings fade in by a clock `main.js` runs while the ring is off; the pill and the panel stay away from the history routes, the game, story and cinema (`body.is-quest` hides the header and puts «?» markers at the top of a phone, so the pill is hidden for a route, not moved); 44 px pill buttons on a touch screen; the line wraps to two rows under 480 px rather than lose its count.
- Checks: `node --test scripts/*.test.mjs` 70/70; `npm run build` OK; `npm run verify` OK (12 steps, new: layers manifest). `scripts/check-layers.mjs` on `vite preview`: five runs in a row at 1440x900 (40/40 each) and at 360x740 (42/42 each), on the final build (after `d8c9abd`); the same counts after the merge, before the pill fix. `scripts/check-route-mobile.browser.js` passes at 320x568, 390x844 and 844x390 in Light, Full and the class default (Light). A modes check (`/tmp/braga-layers/tools/modes.mjs`, not in the repository) at 1440x900 default and 360x740 Light and Full, 22/22 each: both routes open, the route card shows before the scene is ready on a `#quest` deep link, `#game`, `#story` and `#cinema` run with the pill hidden and the panel refused, the place card opens with its two icon buttons, road lines are culled by cell, GTFS buses run with live on (89 running, 80 routes) and are not requested with live off, `?guide=1` loads its chunk, no console errors.
- Measured on the phone-low profile (360x740, DPR 2, CPU 6x, Fast 3G, class S; brotli server; two runs each, branch built before the merge): main 2.43 MB in 38 requests, ready 25.4-28.1 s, network quiet at 30.7-33.6 s; branch Light 1.96 MB in 24 requests, ready 24.8-25.7 s, quiet at 25.3-26.2 s; branch `?layers=full` 2.43 MB in 36 requests, ready 25.3-25.6 s, quiet at 30.4-32.9 s. The optional layers load after ready, so ready does not move beyond noise; Light saves 470 KB (19 %) and ends the downloads 5-7 s sooner. Saved: MS 273 KB, live 139 KB (GTFS 127 KB), street 42 KB, ring 16-22 KB in the first view.
- What a phone visitor loses by default (screenshots `/tmp/braga-layers/views2/`, three views on main and Light): the Microsoft buildings (whole blocks in the eastern districts), the calçada on the squares (Praça da República shows bare ground), people, café terraces, lamps and shop signs, the ring beyond the centre, aircraft and buses. Landmarks, OSM buildings, roads, routes and the place card stay.
- Frame cost in the same three views (class S, main -> Light): old town 99 -> 88 draw calls, 0.95 -> 0.84 M triangles; east 93 -> 83, 0.92 -> 0.88 M; overview 143 -> 132, 1.25 -> 1.20 M. Light draws about 10 % less, not more than that.
- Pill and languages: the failed line and the longest loading line show whole in pt, ru and en at 360x740 and 320x568 (`/tmp/braga-layers/tools/pill-lang.mjs`); the panel opens in each language with no clipped text (at 320x568 it scrolls).
- Open decision (owner): Light on phones drops the MS buildings, which Braga's suburbs depend on, and the calçada of the central squares. Street level is 42 KB. Options: keep the Lisbon rule; or make the phone default Light plus street level, or plus MS; each needs a frame-time check on a weak phone, not only bytes.
- Known limits: the pill is hidden during a route, so a visitor whose ring tiles fail mid-route sees no Retry until the route ends (the tiles retry three times on their own). The measurements count transfer; the profile's competing GPU load was not applied; ring tiles come through a worker the throttle does not reach. Not checked: a physical phone, Safari, Firefox.

### Session 025 (2026-11-25, walk shadows at half rate; braga-030)

- Port of porto-033. `renderer.shadowMap.autoUpdate` is off; `atmosphere.update` fits the shadow camera and sets `needsUpdate` every `shadowEvery` frames (walk 2, else 1); `share.js` asks for a shadow update before each postcard draw.
- /play, 4 s walking, governor level 0 (`/tmp/porto-live/gpu-b.mjs`): average main-pass triangles 3,303,499 live → 2,873,235 on the branch; draw calls 265.1 → 223.3. The map at /: 241 shadow passes in 242 frames.
- Screenshots viewed: `/tmp/porto-live/braga-walk-local.png` against `braga-walk-live.png` (same shadows at the Arco da Porta Nova start), `braga-map.png`.
- `npm test` 92/92, `npm run verify` OK, `scripts/check-walk.mjs` all passed.
- Plan for the next steps (walk-mode LOD, far plane, shadow casters by walker distance): `concepts_brief.md` in the repo root (not committed; reviewed by seven reviewers).

### Session 024 (2026-11-24, walk polish and a lighter street level; braga-029)

- Branch `fix/walk-polish`. Owner asked: "continue improving the whole experience", then "really slow on my laptop".
- Solid furniture on /play: `walk.start()` read the street layer once, before it arrived, so seats and furniture never joined the collider (solids 0). `readStreet()` now runs with the surface re-read until the street object is in, and a walker or a scooter rider inside a new obstacle steps to free ground. Measured: solids 0 -> 4235, seats 0 -> 2159 within 4 s.
- Night haze: it came from the bloom over shop windows that filled the street frame (gone with `?fx=0`). At street level the bloom is weaker, tighter and has a higher threshold (`effects.update(..., street)`); lit windows within ~40 m are dimmed and a shop window's light follows its room (shelves, ceiling, woodwork). The overview at night is unchanged (beyond 60 m the dim factor is 1).
- Scooters: each one is parked along the longest open line through its spot, not along the district heading.
- Frame cost at the walk start (1440x900, DPR 2): 4.01 M -> 3.35 M triangles. The instanced crowd drew ~1100 people (each twice with the shadow) within 600 m although houses hide all but the near streets; at street level (camera under 15 m) the crowd now lives within 300 m with 30 % of the walkers (same density). With the CPU slowed 4x, frames were ~33-50 ms and mostly CPU (three.js render loop, matrix updates); the build skips the shader error check (sync wait on each new program). The real cause on the owner's laptop is not measured.
- Checks: 92/92 unit tests; `check-walk` all passed; `npm run verify` OK; mission bot won guitarra 60/110 s, pasteis 92/130 s, corrida 180/240 s with the furniture solid; day and night screenshots viewed.

### Session 023, part 6 (2026-11-24, walk through the Arco da Porta Nova)

- Owner (screenshot at the arch): "I cannot pass through". The arch's landmark outline (8 x 3 m across the street) was one solid block in the walk collider. Now `gatePiers()` (`src/walk-collide.js`) keeps only the two piers (the outer quarters of the long side) for ids in `GATES` (`src/main.js`, only `arco-porta-nova`); the middle half is the passage.
- Proof: `/tmp/arch.mjs` on braga-3d.com before: the middle is blocked, the walker stops 1.8 m short in both directions; on the served build after: the middle is free, the walker passes it westward and eastward; screenshot viewed (the walker between the piers). New unit test (a turned gate: piers block, the passage is free, a walk through it does not hit); 92/92 unit tests; `check-walk` all passed; `verify` OK.

### Session 023, part 5 (2026-11-24, the crowd as models; missions that can be won)

- Owner: "make the crowd models like the mission characters" and "work the obstacles so we can pass; now the missions are nearly impossible"; then "I cannot reach Amélia".
- Crowd: eight new passers-by (Higgsfield `gpt_image_2_6` -> `meshy_v7_image_to_3d`, 6k triangles, "Casual_Walk"; 512 px WebP; 0.55-0.64 MB each, 4.7 MB in `assets/characters/3d/crowd/`; about 600 credits, balance 1706 after). `src/crowd-models.js`: 4 clones of each (SkeletonUtils), a person within 35 m of the camera borrows one of its kind (adult, child, elderly, shopper; the least-used model first) and returns it when far; walk clip speed follows the person's speed; a standing person plays the walker's idle clip; seated people and cyclists stay instanced. Loads once the view is close (`camDist < 40`), never in lite. `src/people.js` skips the instanced figure for a person drawn as a model. `fitToHeight` and `inPlace` are now exported from `src/character-model.js`.
- Obstacles, measured (grid of `walk.free`, BFS between mission people): every leg was reachable, but the walkable route is far longer than the straight line and the timers were set by the straight line (pastéis 340 m in 80 s, corrida 700 m in 75 s, chave 860 m in 120 s). Changes in `src/walk.js`: body radius 0.45 -> 0.3 m, scooter 0.6 -> 0.4 m, a seated person's square 0.55 -> 0.3 m, pedestrians give way (radius 0.22 m, a quarter of the overlap undone per frame) and the model passers-by are bodies too; the walk starts on a lane point 2 m from any wall (the camera has room behind). Timers in `src/street-missions.js` follow the route: 130 / 240 / 110 / 180 s. Amélia stood in a niche of the Sé wall: each mission person now stands where it is free all round within 1.5 m.
- Finding: in /play the street furniture and seats never enter the collider (`solids: 0, seats: 0`): only buildings block. Not changed.
- Proof (served build): a bot (`/tmp/mission-bot.mjs`) ran W+Shift along a grid path through the live crowd and won three missions: guitarra 61 s of 110 (Amélia reached), pastéis about 96 s of 130, corrida 173 s of 240. 4-11 passers-by are skinned models near the walker, 88-120 fps under machine load, screenshots viewed; `check-walk` all passed (the pedestrian check now follows the same body for 30 frames: 0.51-0.87 m out); 91/91 unit tests; `verify` OK.
- Not done: chave (scooter) was not played by the bot; seated people are still the simple figure.

### Session 023, part 4 (2026-11-24, textured people: mission characters and the walker)

- Deploy of part 3 found a live 404 on /play: with `cleanUrls` the rewrite target `/index.html` is redirected (308) and never served. Fixed to `/` (plus `/play/`); live /play, /play/ and / return 200; the /play e2e passed on braga-3d.com.
- Owner: "make all people beautiful as on the Higgsfield images". Done for the eight mission characters and the walker; the crowd is not done (see below).
- Pipeline (Higgsfield): each portrait -> `gpt_image_2_6` full length in an A-pose, no props -> `meshy_v7_image_to_3d` (10k triangles, textured, rigged, "Idle" clip). The walker is an original traveller from a text prompt; two Meshy jobs on one drawing give the walk ("Casual_Walk", own clip) and run ("Run_02") clips. All Meshy rigs share bone names, so clips move between models. Files go through glTF-Transform: texture 2048 -> 1024 WebP, `quantize` (KHR_mesh_quantization, no decoder needed). About 0.9 MB per person, 8.4 MB in `assets/characters/3d/`; only /play loads the mission people; the walker (1.2 MB with clips) loads when walk mode starts, on / too. About 390 credits.
- Code: `src/character-model.js` (`loadCharacter(url, heightM, clips)`: fits the skinned box to the height, feet on the origin, faces -z; own clip or idle/walk/run blended by speed with timeScale following the ground speed; hips held in place). `src/street-missions.js` and `src/walk.js` keep the simple figure until the model loads, then swap. The mission beam fades within 6-16 m (it tinted the person yellow).
- Proof (served build): all 8 mission people are skinned models; the walker blends idle 1 -> walk 1 -> run 1 with W and Shift; screenshots viewed; `check-walk` all passed; 91/91 unit tests; `verify` OK; no page errors.
- Not done: the crowd (hundreds of instanced figures in `src/people.js`) is still the simple shape. A route: skinned models for the nearest 20-30 people, instanced figures beyond. The teleport in tests shows a walk frame for an instant (a jump counts as a step).

### Session 023, part 3 (2026-11-24, the /play page and e-scooters)

- Owner: keep the game apart from the map ("maybe under a different domain... you decide"). Decision: not a second repo or domain (it would fork the engine), but its own page on the same build: `braga-3d.com/play` (vercel.json rewrite to index.html; `PLAY` in `src/main.js`). It opens in walk mode at the district's `start` (cities/braga.json: start, headingDeg), skips the intro, and only it loads the street missions. The map at `/` has no missions again. A separate domain can later point at /play without code.
- E-scooters: four parked along the street beside Dona Rosa, Inês, Sr. Armando and Avó Conceição (`scooterMesh()` in `src/street-missions.js`). F rides and gets off; the riding is in `src/walk.js` (`mount`, `dismount`, `riding`; `rideStep`: throttle and brake, steering that bites with speed, reverse, Shift boost, max 30 km/h or 40 with boost, a bump off walls, a chase camera at 6.5 m). Escape or "Go up" while riding leaves the scooter parked. The prompt shows the speed.
- Fourth mission, Grandma's key (Avó Conceição to Rúben and back, 120 s): too far to run, made for the scooter.
- Proof (served build): `/` has no missions; `/play` starts at the arch facing east with missions; mount, 2.5 s of throttle reaches 30.6 km/h, then the scooter hits café tables on Rua do Souto and bounces (steering needed); Grandma's key passed on the scooter (+1175); all four missions pass and a timed-out run fails on /play; no page errors; screenshots viewed. `node --test` 91/91, `check-walk` all passed, `verify` OK.
- Found and fixed: parked scooters faced north into a wall (heading 0); they now park along the street (district headingDeg).
- Not done: cars, chases, wanted levels, a minimap; the walk hint still names the walking keys while riding; one frame shot at the live time of day (no time=day) right after a bump looked washed out in fog, not examined.

### Session 023, part 2 (2026-11-23, street missions)

- Asked for (owner): game action in the street "like GTA VI", and generated Portuguese faces, including Cristiano Ronaldo, a former president and the mayor of Braga. Declined: a copy of GTA VI (only the genre's mechanics), and the likeness of any real person (personality rights and defamation risk on a public site). Built original characters instead.
- Characters: eight fictional people of Braga, portraits generated with Higgsfield `gpt_image_2_6` (8 x 0.75 credits), saved as WebP in `assets/characters/` (240 KB in all), credited in `data/CREDITS.md`.
- Street missions (`src/street-missions.js`, `src/street-missions.css`, loaded when walk mode starts in a city with `walk_districts`): each person stands under a gold column of light as a figure (`walk-figure.js`, clothes after the portrait) that turns to the walker; E or the Talk button opens a dialogue with the portrait. Three timed missions: Hot pastéis (Dona Rosa to Sr. Joaquim, 80 s), The academic race (Inês, Rúben and back, 75 s), The forgotten guitar (Sr. Armando: Tiago, then Amélia at the cathedral, 95 s). The next stop is a blue column; the bar shows the goal, an arrow with the distance, the clock. Pass: banner, points (base + 5 per second left), the receiver's thank-you, best score saved in localStorage `braga-street-missions-v1`. Fail: banner when the clock runs out. Events `mission_start`, `mission_pass`, `mission_fail` on the `p3d:event` bus. Texts in pt, en, ru. `walk.position` and `walk.free(x, z)` added to the walk API.
- Proof: `/tmp/mission-e2e.mjs` (pt: near, prompt, dialogue, accept, bar "← 255 m 1:19", passed +690) and `/tmp/mission-all.mjs` (en: all three missions passed, a timed-out run failed, no page errors); screenshots viewed. A person placed inside the cathedral outline was moved: people now look up to 30 m for free ground. `node --test` 91/91, `check-walk` all passed, `verify` OK. Frame time unchanged (8.3 ms p50); draw calls 151 -> 222 in the district (the figures are not merged).
- Not done: driving, chases and wanted levels; voice; a minimap; missions outside the district; a phone check (the Talk button exists, not tried on a device).

### Session 023 (2026-11-23, walk district: Arco da Porta Nova to Rua do Souto)

- Goal (owner): the places are good, the rest is ugly and imprecise at eye height. Prove one street can reach place quality: Rua Dom Diogo de Sousa, from the arch east (OSM line 41.55021,-8.42967 → 41.55052,-8.42661). DGT LiDAR 50 cm is not used: every DGT download needs a signed-in account.
- Root cause of the slabs and steps, measured with a vertical-line surface stack across the street: up to four `street-minor` ribbons overlap at one point (the street, the square, the joins), each at its own way's centre-line height plus its cross slope: 0.44-0.76 m over the ground at one spot, so their edges are 10-30 cm steps. Ribbon quads span a whole way segment and do not bend with the ground near a pad (the arch). The 3 m frontage probes give saw teeth. The coarse ground grid (30 x 25 m in the core) was not the main cause; a finer grid alone changed nothing visible.
- Change: `walk_districts` in `cities/braga.json` (s, w, n, e, stepM). In a district: the ground mesh gets a grid line every 2 m (`withDetail` in `src/terrain.js`) and no microrelief (`paved`); every paving layer drapes on `heightAt` per vertex at one shared lift (`net.drapeY` in `src/road-network.js`, read by `strip()` in `src/roads.js`, frontage and the town plate in `src/streetscape.js`); ribbons are cut into 2 m pieces, the narrower way a few mm over the wider; the town plate is calçada (pattern `sidewalk`) wall to wall and the frontage strips are off. Outside a district nothing changes (one piece per segment, same heights). The test rides on `heightAt.inWalkDistrict`; the district also goes to the tile worker (`tiles.js` init grid).
- Measured (surface stack, local build): at the arch the ribbons 0.46-0.54 m over the ground (before 0.44-0.76); mid-street ribbon 0.49, squares 0.46, plate 0.36-0.42. Cost: ground build +170 ms, pads +75 ms, triangles drawn in the district 2.22 M -> 2.51 M, frame time unchanged (8.3 ms p50, 9.3 ms p95, headless Metal).
- Checks: `node --test scripts/*.test.mjs` 91/91 (two new tests in `terrain-surface.test.mjs`); `scripts/check-walk.mjs` all passed; `npm run verify` OK. Eye-height shots along the OSM line (`/tmp/street-shots.mjs`, volatile), before (live) and after, viewed.
- Not fixed: Rua Dom Frei Caetano Brandão (sett) is one flat tan colour with no stone pattern; a crossing street at the east end lies 10 cm under the district lift; a small light ledge by the blank wall near Rua do Souto; blank windowless walls; one shop front repeated; café umbrellas in the walking line. The ground grid lines cross the whole map (+127k ground vertices). Not checked on a phone. The forks do not have this.

### Session 022 (2026-11-23, heightAt is the drawn ground)

- Goal (owner): fix paving that looks tilted and roads that lie under the grass (seen in barcelos-3d; the cause is in the shared engine).
- Root cause: since `db41d79` (2026-10-06) the ground mesh is drawn from the smoothed DEM (`groundMeshAt`, Catmull-Rom), while `heightAt`, the datum of roads, paving, houses and landmarks, stayed bilinear. The DEM cell is about 120 x 100 m, so the two surfaces part by metres inside a cell. Measured over the core on a 2 m grid: drawn ground more than 0.48 m (`RIBBON_LIFT`) above `heightAt` on 22.7 % of the area, more than 0.5 m below on 23.4 %; extremes -9.9 m and +6.3 m.
- Change: `heightAt` in `src/terrain.js` now reads the triangles of the ground mesh (grid lines from `terrain.groundAxes()`, vertex heights `groundMeshAt`, the same diagonal as `createGround`). Vertex heights are filled on first use and dropped by `addPad`. `dataAt` is the old bilinear read with pads; `elevationAt` uses it. `axisLines`, `GROUND_HALF` and `groundAxes` moved from `src/scene.js` to `src/terrain.js`; `scene.js` re-exports them.
- Measured in the served app against the ground mesh (share of vertices under the ground, live site -> new build): `street-minor` 19.7 % -> 0.6 %, `street-secondary` 16.7 % -> 0.7 %, `street-primary` 7.3 % -> 1.2 %, `calcada-squares` 12.6 % -> 0 %, `lane-markings` 14.4 % -> 0 %.
- Checks: `node --test scripts/*.test.mjs` 89/89 (new `scripts/terrain-surface.test.mjs`, 3 tests); `scripts/check-walk.mjs` all passed on both profiles; `npm run verify` OK. Screenshots viewed: walk start and street at eye height, the overhead view of the centre, Bom Jesus hillside (the road the ground used to cut into pieces is whole).
- Known limits: about 1 % of road vertices are still under the ground (a road is graded along its length and level across; the ground is not cut to it). `street-plate` and `sidewalks` show 12 % below the ground by design (side walls). `scripts/verify.mjs` does not run `check-walk.mjs`. The forks other than barcelos-3d do not have this change.

### Session 021 (2026-11-22, eras, route points, analytics hook)

- Asked for: the three gaps against the owner's product specification (eras, analytics, points).
- Era filter: `src/eras.js` reads the dates in each place's `year` text and gives date-range eras (roman, medieval, early-modern, modern). The names are date ranges, not styles. A second chip row in the Places tab (`src/ui.js`) filters the list; `marks.setEra` (`src/landmarks.js`) hides pins and names, never a model. The full assignment of the 30 places is written out in `scripts/eras.test.mjs`; a new place must be added there.
- Route points: `questPoints` in `src/quest-progress.js` (100 a solved stop, 200 once for a whole route, max 700). Computed from the stamps, never stored. Shown on the route result screen (`points` string in `data/quest.json`).
- Analytics: `src/analytics.js` attaches Vercel Web Analytics to the existing `p3d:event` bus when `cities/braga.json` says `"analytics": "vercel"`; off on local hosts. New events: `city_opened`, `landmark_selected`. Nothing is sent until the owner enables Web Analytics for the project in the Vercel dashboard; until then the script path answers 404 on the live site.
- Proof: 86/86 unit tests, `scripts/check-walk.mjs` "all passed", `npm run verify` OK; headless run on the served build: 30 places, Roman era 2, Middle Ages 4, "Points: 300 of 700" with three seeded stamps, events `city_opened` and `landmark_selected`, no page errors.
- Not done: custom events need a Vercel plan that includes them (page views do not); no era data beyond dates (styles such as Baroque need a source per place); phone layout of the era row not checked.

### Session 021, part 2 (2026-11-22, walker under the terrain)

- Fault, seen in the Barcelos fork: the walker stood waist-deep in a hillside. At that spot the drawn terrain was 0.87 m above the road surface under the feet, and `surfaceAt` (`src/walk.js`) treated anything more than 0.6 m up as overhead.
- Fix: the terrain mesh (`ground`) is never overhead. When it is higher than the surface chosen, the walker stands on it. Bridges are not affected: there the terrain is below the deck.
- Proof: Braga 86/86 unit tests, `check-walk` "all passed", `verify` OK. Barcelos (same file copied): feet moved from 0.93 m to 1.85 m over `heightAt`, 5 cm over the drawn terrain; screenshot viewed; 53 tests pass, 27 skipped, `verify` OK.
- Not fixed: in Barcelos the path ribbons on that slope lie at four heights over one spot (4.55 m to 7.01 m below datum), so the paving looks tilted and part of it is under the grass. Roads follow `heightAt`; the drawn terrain is a smoother surface, and on a steep bank the two differ by up to 1.8 m.

### Session 020 (2026-11-22, walk look loop)

A loop over five open items for the walking-height look. One item per iteration; each is merged into `main` locally, never pushed or deployed by the agent.

- Before the loop, `0a18dcc` (merge `0ae6fb4`): rivers and streams drawn from a centreline block the walker (`lineRings()` in `src/nature.js` joins `waterRings`); the bank foam is ten times finer within about 50 m of the eye (`wNear` in `src/water.js`). Cause: the owner's screenshot showed white "cracks" on the water and the walker could stand chest deep in the Este.
- Item 1, ground detail: DONE. `GROUND_COLOR` and `GROUND_NORMAL` in `src/scene.js` add three finer noise octaves (2 m, 0.5 m, 0.1 m) and small bumps within 20-65 world units of the camera. The view from the air is unchanged, because each octave fades out with distance. Viewed at 1.7 m on a lawn beside a pond, third and first person. Checks: 79/79 unit tests, `check-walk` all passed, `npm run verify` OK.
- Item 2, houses sunk into slopes: BLOCKED in one iteration, measured. Of 17,012 core houses, the terrain under one footprint differs by 0.94 m (median), 2.8 m (90th percentile), 6.2 m (99th). With today's floor rule (`gmin` in `extrudeBuilding`), 3,601 houses have the uphill corner more than 0.5 m under the terrain, 1,585 more than 1 m, 620 more than 2 m. A floor at the plain mean changes that to 3,587 / 1,492 / 362 and gives 346 houses a plinth over 3 m, so the floor rule is not the lever. Cause: one level floor on terrain that is not levelled under the house; a real town terraces each plot. Route for a later session: level the ground per building block (terrain pads as the landmarks have, or extend `street-plate` to every house front and under the house), which needs a finer ground mesh in town than the 30 m quads. New debug handle `__braga.footprints` (house outlines in world units) for such checks; the measurement script was `/tmp/walk-spike/sink.mjs` (volatile). No visual change this iteration.
- Item 3, road surface under water at bridges: CLOSED, not a fault as described; no code change. The dark wedge in the shot at the Este (near world 219, 75) has the asphalt texture and hides the water behind it, so it lies above the water, not under it. The data explains it: inside that water outline the Rio Este has a piece tagged tunnel, layer -1 (a culvert), and three footbridges cross above; no car road in the data is under the water level. Most likely it is the street that crosses the river over the culvert, seen between two footbridge parapets. Two attempts were made and discarded, because neither changed the picture: a pond level held under the lowest street that crosses it, and a lower limit (2 m, was 8 m) for "this water area is level". Real open point for a later session: a river bed mapped as an area is drawn level when the terrain under its outline varies by less than 8 m (`flat` in `createWater`, `src/water.js`), and the centreline ribbon is drawn over the same reach at another height, so two water surfaces overlap there.
- Item 4, rounded kerb corners and sidewalk steps at sloped junctions: BLOCKED in one iteration; no code change. It is one piece of work with three coupled parts, and a partial version leaves holes at every junction. Design for a fresh session, from reading `sidewalk()` and `carriageways()` in `src/roads.js`:
  1. Corner piece. At each junction node with two or more car arms (`net.nodeWays[node]`, as `zebras()` reads it), sort the arms by angle. For each neighbouring pair, the two kerb lines (offset `half` towards each other) meet at the sharp corner P0. Put a circle of radius R (3 m, less when the corner is tight or an arm is short) tangent to both kerb lines, with its centre in the block. Build: the kerb face along the arc, a kerb stone ring 0.25 m wide, and the walk as a fan from the meeting point of the two outer sidewalk edges to the arc.
  2. Trim. Each arm's sidewalk must end at its tangent point (R / tan(angle / 2) from P0), not at the crossing street's kerb line as now. `sidewalk()` drops whole 3 m steps through `keep[]`; the trim needs an exact end station instead, or the corner piece and the straight piece leave a gap or overlap.
  3. Heights. Today each arm takes its own surface height (`net.surfaceY`), so on a sloped junction the two sidewalks meet as a step. The corner piece must take the height of arm A at its tangent point, of arm B at its tangent point, and blend along the arc; that removes the step.
  The area between the arc and P0 becomes carriageway; in town the `street-plate` sheet lies there, outside town it needs an asphalt fill. Checks to add: no sidewalk triangle inside another street's carriageway, and the walker's feet height across a corner (the measurement is in `/tmp/walk-spike/feet.mjs`, volatile).
- Item 5, default walk start on an empty dark square at night: DONE. Cause: `walk.start()` takes the orbit target; from the city overview (a link straight to `#walk`) that target lay 1.2 km out of the centre (world -314, -68) on a wide empty square. Now, when the camera is more than 250 world units from its target, `startMode('walk')` in `src/main.js` starts at the map origin (0, 0), the middle of the old town; a zoomed-in view starts where the visitor looks, as before. Viewed: `/?lang=ru#walk` starts at (0.1, 1.1) between old-town houses with the garden ahead. The night itself is still dark at street level; that is lighting, not the start point. Checks: 79/79 unit tests, `check-walk` all passed, `npm run verify` OK.
- Loop result: items 1 and 5 done, item 3 closed as not a fault, items 2 and 4 blocked with a measured cause and a route.
- Also this session: `EGM.md` contract files for the root, `src/`, `src/models/`, `src/locales/`, `scripts/`, `api/`, `public/` (untracked); a review of `docs/plan-walk-social-events.md` in `docs/egm-review/` (the plan does not pass; see `consolidated_review_report.md`).

### Session 019

- Date: 2026-11-21
- Branch: short branches merged into `main` one by one; `main` ends at ed509ca. Deployed by the owner after each merge. Not pushed.
- Goal (owner): from above the map looks good, at walking height the road layers do not. Rework the street level to be precise; then review the walk engine and its physics.
- Root cause: the roads lie about 0.5 m over the terrain (`RIBBON_LIFT`, a smoothed grade, level across) on a terrain grid of about 120 m per cell. From above this does not show. At eye height every road and sidewalk edge was a ledge, sidewalks were flat strips that ran across the crossing street, houses stood at the lowest terrain corner of their footprint, and the walker's height came from a model of its own.
- Commits:
  - `71df205` sidewalks are kerbed bodies (kerb face, kerb stone, walk 12 cm up, side wall) and end at a crossing street's carriageway (`sidewalk()`, `carriageways()` in `src/roads.js`).
  - `e0f75d9` town ground at street level (`street-plate` in `src/streetscape.js`: 5 m grid within 24 m of a street, off in lite, drawn only near the ground; `nature.openAt` keeps it off parks, fields and water), paved frontage between a walk and the house fronts, uncut sidewalk steps merged (838k -> 232k triangles).
  - `7653c0b` house floors at street level (`STREET_UP` and the mean ground in `extrudeBuilding`, `src/buildings.js`); `asphaltGrain()` on the carriageways and the town ground.
  - `1e5e9b9` the walker stands on the top drawn triangle (`readSurface()`, `surfaceAt()` in `src/walk.js`) and slides along a wall at any angle (`TURNS` in `src/walk-collide.js`).
  - `6243efb` open water blocks the walker, except under a drawn street, sidewalk or paved square (`wetAt`, `nature.waterRings`); `scripts/check-walk.mjs` tests the middle of every water area.
  - `3823620` zebra crossings at junctions with three arms or more (`zebras()` in `src/roads.js`; placed by rule, the data has no crossing points).
- Measured: feet against the top drawn triangle, 41 points across each of five streets: before 20-80 cm over the town ground, up to 30 cm over a carriageway, up to 57 cm sunk; after 0 cm at four of five spots. Slide along a wall at 45 degrees: 7 % of the speed before, 100 % after (unit test). Triangles near the ground on desktop: 1.85 M -> 2.11 M with the town ground; phone profile 732k -> 784k. Surface index rebuild: about 110 ms on desktop.
- Checks: `node --test scripts/*.test.mjs` 79/79; `scripts/check-walk.mjs` all passed on both profiles, locally and on braga-3d.com; `npm run verify` OK. Screenshots at 1.7 m eye height at Avenida da Liberdade, a residential street and a ring-road junction, and the overhead views of the centre, viewed before each merge.
- Known limits: kerb corners are square; on a sloped junction the sidewalk corners meet as small steps; beside a park the sidewalk drops to the lawn; a zebra has no dropped kerb; on a steep street the uphill end of a long house still sinks; streams drawn as lines, fountains, fences and landmark model parts do not block; vehicles do not stop for the walker; no stairs or jumping; one spot near a roundabout (41.5455, -8.4268) shows a ramp with a 29-54 cm gap under the feet, not examined. Not checked: a physical phone, Safari, Firefox, frame time on a real device. The forks (guimaraes-3d, porto-3d) do not have these changes.


### 2026-11-26 — walk surface index built in slices (branch fix/walk-surface-hitch, feature braga-031)

- Port of porto-038: `readSurface(x, z, now)` in `src/walk.js` starts a generator (`buildSurface`) and `pumpSurface()` runs it 3 ms per frame while the old index still covers the walker; meshes out of `SURF_R` are skipped.
- Measured: the CPU profile no longer shows `readSurface` in long tasks. The long tasks left (7 in 40 s, live and branch alike) are in the load phase: shader compile and one update function.
- Checks: npm test 92/92, check-walk all passed, npm run verify OK.

### 2026-11-26 — the coder on a balcony (branch feat/balcony-coder, feature braga-034)

- Easter egg: the site's builder sits on a 5th-floor corner balcony of the 20-sided tower by the roundabout (41.55309, -8.40728), coding on a laptop. Click him on the map, or press T within 25 m in walk mode, and a Claude Code style chat opens.
- Files: `src/balcony-coder.js` (balcony, posed figure, chair, laptop, panel, prompt), `src/balcony-coder.css`, `src/balcony-coder-replies.js` (pure reply engine: 17 intents, 54 lines per language in en, pt, ru), `scripts/balcony-coder.test.mjs`, UI strings in `src/locales/ui.js`, `balcony_coder` in `cities/braga.json`. `src/main.js`: four small hooks (state var, lazy import after the life layer, `coder?.update(dt)`, `coder?.pick(raycaster)` before the landmark pick).
- Placement: world (267.42, -74.64) corner, floor y 1.51 units; seat at (267.63, -74.42). Hidden in the game and the intro.
- Checks: npm test 97/97, check-walk all passed, npm run verify OK. Screenshots of the tower, close-ups, walk mode with the prompt and the chat in three languages (desktop and Pixel 7) viewed.
- Known limits: from below the slab hides most of him; the laptop's glowing screen faces him, so from the street you see the lid; a click through the tower from the far side can still hit his pick box; the forks do not have it (they have no config).

### 2026-11-26 — walk mode level of detail, stage 1a (branch feat/walk-lod, feature braga-032)

- Port of porto-034: one walk profile, applied in walk mode's onEnter and reverted on every exit (`walkProfile` in `src/main.js`, shared state and the shadow rule `walkCasts` in `src/walk-lod.js`). Camera far 5 km with a fade into the fog colour (`FOG_UNIFORMS.fogFarFade`); ring, MS buildings and OSM core within 1.5 km, far boxes from 1 km, roofs only from 1.5 km; shadows only from meshes within 400 m; the governor ignores 2 s after the switch. `?walklod=0` keeps the old walk.
- Braga only: a ground window (`setWalkWindow` in `src/scene.js`). The 34 km ground grid is one draw call, so it draws the full grid within 1.5 km of the walker and coarser squares outward; `src/walk.js` reads the whole grid.
- Measured (gpu-b.mjs, governor 0, DPR 2): main-pass triangles 2.77-2.88 M on main -> 2.27 M on the branch; draw calls 210-221 -> 215 (no change). 40 s walk (hitch-b.mjs, two runs each): p50 8.4 ms both, long tasks in the load phase on both. The map at /: overview 2.051 M -> 2.055 M triangles, centre view 3.73 M -> 3.71 M.
- Screenshots viewed at walk height (Avenida, Sé, Arcada, a residential street, Parque da Ponte, Bom Jesus terrace) and the map at /: the same apart from the passers-by.
- Checks: npm test 92/92, check-walk all passed (incl. the profile on, the revert and walklod=0), npm run verify OK.
- Left: draw calls. At the start most of the frame is near the walker: street plate, ground window, crowds and the road run cells (never frustum-culled). Next stages: cut the road run cells, occlusion, HLOD.

### 2026-11-26 — governor resolution steps no longer resize the canvas (branch fix/walk-periodic-hitch, feature braga-033)

- Cause: the perf governor steps every ~3.5 s (3 s cool-down plus its evaluation window, `src/governor.js`). Each step set `DPR.scale`, and `resize()` in `src/main.js` then called `renderer.setPixelRatio`/`setSize`. A canvas resize waits for the GPU to finish the frames in flight: 54-62 ms long tasks, 9-28 ms of them in `WebGLRenderer.setSize`.
- Fix: with the effects on, the canvas keeps the full ratio (`deviceDpr(1)`) and `fx.setSize(w, h, dpr, scale)` applies the governor's scale to the composer targets only (`src/effects.js`). `DPR.draw` and `sceneBufferSize()` (`src/scene.js`) give the real scene buffer, so point sizes in `life.js`, `liveair.js` and `seasons.js` stay the same. Toggling the effects re-runs `resize()`.
- Measured: governor log, main: long tasks start at the same ms as three governor steps; branch: none at eight steps. 40 s walks, long tasks over 50 ms after 15 s: main 3, 0, 3, 0; branch 1 (819 ms during host contention), 0, 0, 2. Profile after: no `setSize`, last long task at 18 s.
- Checks: npm test 92/92, check-walk all passed (desktop and phone), npm run verify OK; walk-height screenshot viewed.
- Left: shader compiles (`getProgramParameter`, up to 198 ms) and the character load (`loadCharacter`/`fitToHeight`) in the first 10 s; with the effects off a governor step still resizes the canvas.

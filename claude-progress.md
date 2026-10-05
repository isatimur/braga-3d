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
- Current highest-priority unfinished work: adopt branch `repair/sync-origin` (history repair plus deploy hygiene, braga-011), then deploy it.
- Current release limitation: braga-3d.com serves the new interface as of 2026-10-04 (build 22:53 UTC), but it still ships `cities/guimaraes.json` and answers `?city=guimaraes` with 200 and a broken city. The branch fixes that; it is not deployed yet.

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

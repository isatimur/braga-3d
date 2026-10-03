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
- Current highest-priority unfinished feature: none — all listed features passing
- Current blocker: none

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

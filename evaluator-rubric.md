# Evaluator Rubric

Use this rubric after implementation and before final acceptance.

Scored for session 006 (braga-011, branch `repair/sync-origin`), 2026-10-05.

| Category | Question | Score (0-2) | Notes |
| --- | --- | --- | --- |
| Correctness | Does the implemented behavior match the requested feature? | 2 | Build shows `dist/cities/braga.json` only; the resolver and the API accept only listed cities. Browser check of `?city=guimaraes` after deploy is still open. |
| Verification | Did the required checks actually run, with evidence? | 2 | `npm run build` and `npm run verify` both passed; `check:fit` table read; all JSON-LD blocks parsed. |
| Scope discipline | Did the session stay inside the chosen feature scope? | 2 | Work stayed in the worktree; `main`, the original tree and the sibling repos were not changed. |
| Reliability | Does the result survive restart or rerun without repair? | 1 | `make-og.mjs --pages` rewrites sitemap and robots on each run (dates change); the worktree shares `node_modules` by symlink. |
| Maintainability | Is the code and documentation clear enough for the next session? | 2 | The allow-list rule is documented in `src/city.js`, `api/_city.js` and `vite.config.js`; fit drift is noted in the model rule. |
| Handoff readiness | Can a fresh session continue work from repo artifacts only? | 2 | `session-handoff.md`, `claude-progress.md` and `feature_list.json` are current. |

## Verdict

- Accept (local). Revise after the live check.

## Required Follow-Up

- Missing evidence: live curl and browser checks after deploy (`/cities/guimaraes.json` 404, `/?city=guimaraes` shows Braga, `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, branded 404).
- Required fixes: none known.
- Next review trigger: after the user adopts the branch and deploys.

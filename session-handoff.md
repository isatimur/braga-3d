# Session handoff

Compact note for the next session. Keep it to one screen.

- Date: 2026-10-05
- Session goal: Repair the history (local `main` diverged from `origin/main`) and fix deploy hygiene, in a separate worktree.
- Verified state (last `npm run verify` result): `verify: OK` on branch `repair/sync-origin`; build green; `dist/cities/` holds `braga.json` only.
- Active feature (id): braga-011 (deploy hygiene). braga-003 is retired.
- What changed: the branch sits on `origin/main` plus the "stop tracking Guimarães" commit, the session 005 log, the known-city allow-list (`vite.config.js`, `src/city.js`, `api/_city.js`), robots/sitemap/JSON-LD/hreflang/favicon/404, a leonardo-da-vinci height fix, docs.
- What is half-done or risky: the branch is not adopted and not deployed. Local `main` still carries the old divergence. The original tree `~/Dev/braga-3d` holds 70 uncommitted paths that equal `origin/main`; they are safe to discard once the user agrees.
- Exact next step: the user runs the commands in `/tmp/review/braga-history-fix.md` (some need `!` because a hook blocks Claude), then deploys and runs the curl checks listed under braga-011.
- Files to look at first: `claude-progress.md` (session 006), `feature_list.json` (braga-011), `vite.config.js`, `src/city.js`, `api/_city.js`, `scripts/make-og.mjs`.

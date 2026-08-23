## Agent skills

### Issue tracker

Issues live as GitHub issues in this repo and are managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo. Read the root `CONTEXT.md` (when it exists) and `docs/adr/`. See `docs/agents/domain.md`.

### Tech stack

See `docs/agents/tech-stack.md` for the tools this repo uses and their documentation links.
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Two independent pieces live here, and both matter:

- **Next.js 16 web app** (root: `app/`, `components/`, `lib/`). This is the runnable product — a "stockout"/SupplyGuard demo landing page. Despite `docs/agents/tech-stack.md` mentioning Vinext/Vite/Cloudflare, `package.json` uses stock Next.js 16 (Turbopack). Scripts: `npm run dev` (dev server on `http://localhost:3000`), `npm run build`, `npm run lint` (ESLint), `npm run typecheck` (`tsc --noEmit`), `npm run format` (Prettier). The dev server is a foreground process — run it in its own terminal, not from `install`/`start`.
- **Python CALL-E smoke test** (`test/test_calle.py`, run with `pytest`, config in `pytest.ini`). It has no `requirements.txt`; its only third-party imports are `pytest` and `httpx`, installed via `pip --user` by the update script.

Non-obvious gotchas:

- `pip --user` installs the `pytest` console script to `~/.local/bin`, which is not on `PATH`. Run the tests as `python3 -m pytest test/test_calle.py -v -m "not live"` (the `-m "not live"` runs the 5 network-free tests).
- The one `live`-marked test places a real phone call and is skipped unless `CALLE_API_KEY`, `TEST_CALL_DESTINATION_NUMBER`, and `CALLE_LIVE_TEST_CONFIRM=yes-call-my-phone` are all set (see `CLAUDE.md`). Never set these just to make it run — a real call spends real money.
- Config for the app/test comes from `.env` (gitignored); copy `.env.example` to `.env` if you need CALL-E credentials. The web app does not require any env vars to run.

# ehl_hack

## Slice 1 — launch and case store

One Next.js app serves the UI and the API (Route Handlers), so frontend and
backend deploy to Vercel as a single project.

```bash
npm install
npm run dev
python -m orchestrator.run --case CASE-001 --api http://localhost:3000
```

- `POST /api/cases` — `{ "case_id": "CASE-001" }` (optionally with an inline
  `incident`). Loads `fixtures/incidents/CASE-001.json`, appends the `created`
  event, starts a Devin session, appends `session_started`, returns `201`.
- `GET /api/cases/CASE-001/events` — the append-only log.
- `/cases/CASE-001` — polls that endpoint every 2s.

Events live in an in-memory map (see `lib/cases/store.ts`): serverless has no
durable disk, and a durable store is a later slice. Money is only ever a
decimal string. Without `DEVIN_API_KEY` the session is stubbed — Slice 1 never
fails on a missing key, and this slice never places a phone call.

```bash
npm test        # route handlers, in-memory, no live Devin
npm run lint
npm run typecheck
```

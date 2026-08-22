# Devin prompt — Slice 1 only

Copy everything below the line into a Devin session.

---

Build **Slice 1 — Launch and case store** only. Spec: `docs/mvp-slices.md` (Slice 1) and `docs/mvp-flow.md` (trigger + `POST /cases` + Devin session). Do not implement Slice 2 (`/tools/*`), Slice 3, Slice 4 (CALL-E), Slice 5 (policy, cost, PR), the shortage detector, or email RFQ.

This repo is already **Next.js 16** (`app/`). Put the backend on the same app as Route Handlers so we can deploy frontend + backend to **Vercel** as one project. Do not add FastAPI, Postgres, or SQLite.

## Goal

A human runs a CLI against the API. The API creates `CASE-001` from a seeded Incident, appends events, and starts a Devin session (or a stub if no API key). After that, no more human input. A ugly page can poll events.

## Incident fixture (`CASE-001`)

Store as JSON in the repo (e.g. `fixtures/incidents/CASE-001.json`). Fields:

- `case_id`: `"CASE-001"`
- `part_id`: `"6204-2RS"` (deep-groove ball bearing)
- `qty_required`, `qty_on_hand` (integers; shortfall = max(required - on_hand, 0))
- `line_stop_at` (ISO-8601, about 12 days from a fixed demo date)
- `line_stop_cost_per_hour`, `expedite_fee` as **decimal strings**, not floats
- `currency`: `"EUR"`

No real phone numbers. No secrets in git.

## HTTP API (same origin)

- `POST /api/cases` body `{ "case_id": "CASE-001" }` (or `{ "case_id": "CASE-001", "incident": { ... } }`). Load the fixture if only `case_id` is sent. Create the case, append Event `{ ts, actor: "system", stage: "created", level, message, payload }`. Then create a Devin session. Return `201` or `202` with `{ case_id, session_id, session_url }`.
- `GET /api/cases/:id/events` returns the append-only list. CORS not required for same-origin UI; allow it if the CLI is another origin.

Event log: Vercel serverless has no durable local disk. Use an in-memory map keyed by `case_id` for this slice. Document that in a short comment. Do not add Turso/KV yet.

## Devin session

If `DEVIN_API_KEY` is set, `POST` a session to the Devin API with `case_id` and the public backend base URL (`DEVIN_BACKEND_BASE_URL` or `VERCEL_URL`). Prompt: you are launching case `{case_id}`; call this backend; do not wait for a human. If the key is missing, **stub**: still append `stage: "session_started"` with a fake `session_id` / `session_url`. Never fail Slice 1 because Devin is unset. Never commit the key.

Look up the current Devin HTTP API in their docs. Do not guess a wrong path and leave it broken. Stub is acceptable.

## CLI

Python is already in the repo (`test/test_calle.py`). Add `python -m orchestrator.run --case CASE-001 --api http://localhost:3000` (default API `http://localhost:3000`). The CLI only POSTs `/api/cases` and prints the JSON. No ERP, no CALL-E.

## UI (ugly is fine)

A page `/cases/CASE-001` that polls `GET /api/cases/CASE-001/events` every 2s and lists `stage` + `message`. No dashboard polish. Do not rewrite the marketing landing page except a link to this case page if it is one line.

## Rules

- Money: strings or Decimal-serialized JSON. No float.
- Rehearsal/default: this slice must not place phone calls or hit CALL-E.
- Tests: at least one test that POSTs a case (in-memory) and GETs events including `created`. No live Devin in CI unless the key is present (skip).
- PR against this repo. Do not push to `main` directly. Do not force-push.

## Done when

1. `npm run dev` + `python -m orchestrator.run --case CASE-001 --api http://localhost:3000` creates the case.
2. `GET /api/cases/CASE-001/events` includes `created` and `session_started` (real or stub).
3. `/cases/CASE-001` shows those stages.
4. Slice 2–5 code is absent.

Read `docs/mvp-slices.md` Slice 1 and `docs/mvp-flow.md` before coding. If they conflict with this prompt, this prompt wins for Slice 1 scope.

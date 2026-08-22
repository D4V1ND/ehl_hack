# MVP slices

Implementation slices for the mock loop in [`mvp-flow.md`](mvp-flow.md). Pick one, switch to Plan mode, then build only that slice.

**Now:** Slice 1, then Slice 2, then Slice 5 (Claim fixtures the API serves until outreach is wired).

**Not now:** Slice 3 (web search). Slice 4 (outreach). Email RFQ is out of the product path.

Shared types (keep small): `Incident`, `SupplierRecord`, `Claim`. Policy, cost, and `Decision` live in slice 5.

---

## Slice 1 — Launch and case store

**What:** Human runs a CLI against the **Vercel backend**. The API creates `CASE-001` from an Incident fixture, writes events, and starts a Devin session with `case_id` plus the public backend base URL. After that, no more human input. Frontend on Vercel reads the same API.

**In**

- Frontend and backend deployed on Vercel. The UI, the CLI, and Devin all call the public backend URL
- Command: `python -m orchestrator.run --case CASE-001 --api https://<backend>.vercel.app` (or equivalent)
- Incident fixture: part, qty, line-stop time, costs, currency
- `POST /cases` plus append-only event log the API can read across requests (not local disk)
- `POST /v1/sessions` with prompt + `case_id` + backend URL (stub the Devin client if the key is not ready)
- `GET /cases/{id}/events` so the Vercel frontend can poll

**Out**

- Shortage detector
- UI polish
- Tool logic (slice 2)
- Outreach (slice 4)

**Done when:** one command creates the case, logs `created`, and records a session id or a clear stub. No other slice is required for this to run.

---

## Slice 2 — Stub system of record

**What:** ERP access is HTTP on the Vercel backend. Devin and the frontend call these public endpoints. The handlers return bearings fixture JSON. Same paths later sit on SQLite or a real adapter.

**In**

- Public on the deployed backend:
  - `GET /tools/part/{id}` — part number, size, spec, weight, countries we may buy from
  - `GET /tools/stock` — on-hand qty, shortfall context
  - `GET /tools/suppliers` — approved `SupplierRecord[]` (masked phones, contract price, lead time, cert, known allocations)
- Dummy functions that return the example row. No real DB required
- Prompt / playbook tells Devin the Vercel base URL. Devin does not open a database

**Out**

- ERPNext
- Full 40-part catalog
- Devin opening SQLite itself
- ERP only on localhost

**Done when:** `curl https://<backend>.vercel.app/tools/part/...` (and stock, suppliers) returns schema-shaped JSON for the CASE-001 bearing. Devin can call the same URLs.

---

## Slice 3 — Web search (skipped)

**Status:** not in MVP.

Devin would do this itself from the system prompt (browse supplier sites, build `Candidate[]`). There is no Core API for search. Do not build a shortlist service now.

**Later:** add prompt text. Do not treat a web page as a Claim.

---

## Slice 4 — Outreach / CALL-E (deferred)

**Status:** do not implement and do not inspect now.

A teammate already has CALL-E working on a branch. When this slice is next, connect that branch to `POST /tools/outreach` and take Claims from it.

Until then, Slice 5 may read Claim fixtures the API serves.

**Out (still):** email RFQ, China channel, calling real distributors.

---

## Slice 5 — Decide, check, and PR

**What:** On fixture records (and Claim fixtures the API serves until Slice 4 is wired), Devin rejects one supplier by name plus rule, ranks landed cost, picks a split order that beats every single source, runs pytest, and opens a GitHub PR. The Vercel frontend may poll events and show the PR link.

**In**

- Policy rules as pure functions (blocked origin, missing cert, audit, lead time after line stop)
- Claim vs record checks (price, lead time, qty vs allocations, cert expiry)
- `cost_model.py` with Decimal: breaks, MOQ, freight, duty, carrying, expedite
- Strategy search so the winning answer is a **split order**
- pytest on policy and cost (must be green before PR)
- Write `cases/CASE-001/` artifacts and open the PR
- Optional: Vercel cockpit reads `GET /cases/{id}/events` and shows stages + `pr_url`

**Out**

- In-app approve/reject (merge the PR is the approval)
- Session fan-out
- Pretty dashboard (A1–A6 polish)
- Calling Slice 4 or 3

**Done when:** one CLI run produces a PR with decision artifacts, both suites green, and the three stage beats visible in the files. Claims may be fixtures until Slice 4 is connected.

---

## Build order

1. Slice 1
2. Slice 2
3. Slice 5 (Claim fixtures the API serves)
4. Slice 4 when you are ready: connect the CALL-E branch only
5. Slice 3 never as a service. Prompt only, after MVP

Do not implement two slices in one Plan-mode pass unless you say so.

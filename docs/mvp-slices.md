# MVP slices

Five implementation slices for the mock loop in [`mvp-flow.md`](mvp-flow.md). Each slice is a seam you can plan and build on its own after the previous URLs exist.

Do not start live CALL-E, SQLite, the shortage detector, or email RFQ in these slices.

**How to use:** pick one slice, switch to Plan mode, write the implementation plan, then build that slice only.

Shared types (keep small): `Incident`, `SupplierRecord`, `Claim`. Add `Candidate` as JSON. Policy, cost, and `Decision` live in slice 5.

---

## Slice 1 — Launch and case store

**What:** Human runs a CLI. The API creates `CASE-001` from an Incident fixture, writes events, and starts a Devin session with `case_id`. After that, no more human input.

**In**

- Command: `python -m orchestrator.run --case CASE-001` (or equivalent)
- Incident fixture: part, qty, line-stop time, costs, currency
- Case folder `cases/CASE-001/` plus append-only event log
- `POST /v1/sessions` with prompt + `case_id` (stub the Devin client if the key is not ready)
- `GET /cases/{id}/events` so later slices and the UI can poll

**Out**

- Shortage detector
- UI polish
- Real tool logic (those are slices 2–4)

**Done when:** one command creates the case, logs `created`, and records a session id or a clear stub. No other slice is required for this to run.

---

## Slice 2 — Stub system of record

**What:** Devin reads factory data only through Core API tools. The tools return bearings fixture JSON. Same URLs later sit on SQLite.

**In**

- `GET /tools/part/{id}` — part number, size, spec, weight, countries we may buy from
- `GET /tools/stock` — on-hand qty, shortfall context
- `GET /tools/suppliers` — approved `SupplierRecord[]` (masked phones, contract price, lead time, cert, known allocations)
- Dummy functions that return the example row. No real DB required

**Out**

- ERPNext
- Full 40-part catalog
- Devin opening SQLite itself

**Done when:** `curl` on those three URLs returns schema-shaped JSON for the CASE-001 bearing. Slice 1 can call them.

---

## Slice 3 — Candidate shortlist

**What:** Devin turns "who might have this part" into `Candidate[]`. MVP uses a seeded list (Konrad-style DE distributors, demo company marked preferred). Not a live site crawl.

**In**

- Seeded shortlist file: name, channel, why it might match, contact
- Output: `Candidate[]` with `why_matched` and `channel`
- Demo company is on the list and preferred for outreach

**Out**

- Live search of supplier sites or eBay
- Treating a web page as a Claim

**Done when:** given the part from slice 2, the run writes `candidates.json` (or equivalent) under the case. At least one candidate is the demo company.

---

## Slice 4 — Rehearsal outreach

**What:** Devin asks for quotes only through `POST /tools/outreach`. The API returns a typed `Claim` from a saved file. The call never raises. A garbled payload becomes confidence 0.

**In**

- `POST /tools/outreach` with surviving candidates (demo company preferred)
- Replay `fixtures/calle/recorded_001.json` (or a hand-shaped Claim until you record one call)
- Event `claim_received`
- At least one claim with `stock_status: in_stock_allocated` (stage beat)

**Out**

- Live CALL-E, webhook, ngrok (pitch swap later: same URL, dial teammate number)
- Email RFQ / China channel
- Calling real distributors

**Done when:** outreach returns a schema-valid `Claim[]` with no network. Slice 5 can consume it.

---

## Slice 5 — Decide, check, and PR

**What:** On fixture claims and records, Devin rejects one supplier by name plus rule, ranks landed cost, picks a split order that beats every single source, runs pytest, and opens a GitHub PR. A thin UI may poll events and show the PR link.

**In**

- Policy rules as pure functions (blocked origin, missing cert, audit, lead time after line stop)
- Claim vs record checks (price, lead time, qty vs allocations, cert expiry)
- `cost_model.py` with Decimal: breaks, MOQ, freight, duty, carrying, expedite
- Strategy search so the winning answer is a **split order**
- pytest on policy and cost (must be green before PR)
- Write `cases/CASE-001/` artifacts and open the PR
- Optional: cockpit reads `GET /cases/{id}/events` and shows stages + `pr_url`

**Out**

- In-app approve/reject (merge the PR is the approval)
- Session fan-out
- Pretty dashboard (A1–A6 polish)

**Done when:** one CLI run (slices 1–4 behind stubs) produces a PR with decision artifacts, both suites green, and the three stage beats visible in the files.

---

## Build order

1. Slice 1 (loop exists)
2. Slice 2 and 4 can proceed in parallel once tool URLs are named
3. Slice 3 can be a static file until 2 exists
4. Slice 5 last. It needs Claims + SupplierRecords

Do not implement two slices in one Plan-mode pass unless you say so.

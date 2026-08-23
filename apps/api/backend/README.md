# SupplyOS FastAPI backend

The backend owns deterministic sourcing state. The Cockpit should render public Case responses without rebuilding business logic.

## Start the API

Run these commands from the repository root:

```bash
pnpm install
pnpm setup:api
pnpm db:seed
pnpm dev:api
```

FastAPI starts at `http://localhost:8010`. OpenAPI is available at `http://localhost:8010/docs`.

Rehearsal is the default. Keep `FAKE_CALLS=1`. Never use live calling as a fallback.

## Public Case API

The Cockpit Case contract has five routes:

| Route | Result |
|---|---|
| `POST /cases` | Opens and runs a Case. Returns `201`. |
| `GET /cases` | Returns stable Case summaries. |
| `GET /cases/{case_id}` | Returns one safe, consistent Case snapshot. |
| `GET /cases/{case_id}/events?since=N` | Returns committed Events where `seq > N`. |
| `POST /cases/{case_id}/decision/approve` | Makes one checked Decision revision final. |

`POST /cases` accepts `part_id` and optional `qty_required`, `needed_by`, and `case_id`.

Rehearsal runs synchronously. Its response keeps PR 22's temporary `session_*` fields for compatibility.

The deterministic receipt uses `deterministic:<case_id>:<revision>`. It does not invent a Devin URL.

Approval accepts:

```json
{
  "decision_revision": 1,
  "approved_by": "buyer-id"
}
```

Approval requires a `ready` Decision with passed policy and cost checks. It changes no purchase system.

An identical approval retry is idempotent. An approved Decision is final.

## Data ownership

SupplyOS uses two separate SQLite databases:

| Database | Default path | Owns |
|---|---|---|
| Trusted system of record | `backend/record/supplyguard.db` | Parts, stock, Supplier Records, and policy inputs |
| Operational Case store | `backend/casestore/cases.db` | Incidents, Candidates, Outreach Tasks, Claims, Decisions, and Events |

Set `CASE_DATABASE_PATH` to change the operational database path. Both files are generated and ignored by Git.

The seed command can rebuild the trusted database. It never rebuilds operational Case state.

Supplier Records and Claims remain separate. A Supplier Record is trusted factory data. A Claim is a supplier statement.

## Deterministic rehearsal

The default `CaseModule` uses two offline adapters:

1. `DeterministicCaseRunner` runs the sourcing pipeline inline.
2. `RecordedOutreachAdapter` reads provider-result JSON under `backend/outreach/fixtures/`.

Recorded results are the only provider fake. They pass through the same Claim normalizer as provider output.

The normalizer converts unusable results into confidence-zero Claims. It does not crash the Case.

Claims below `0.40` remain visible for audit. They cannot affect policy, Landed Cost, Strategy, or Decision output.

CASE-001 computes four Claims and one checked Decision. It does not load a prebuilt Decision fixture.

## Money

All monetary calculations use `Decimal`. Public JSON serializes money as decimal strings.

Examples are `"1.6400"` for unit price and `"94880.00"` for a total. Do not parse money as binary floats.

## Events and approval

SQLite assigns each Event sequence once inside a write transaction. State and its Event commit together.

The cursor is exclusive. `?since=7` returns only Events with `seq > 7`, ordered by `seq`.

Sequence numbers survive process restarts. Reads never merge memory Events or renumber stored Events.

The snapshot's `last_event_seq` is read with its state in one transaction.

Approval updates the Decision and appends one `human` Event in one transaction. It never places an order.

## Public safety

Public routes return explicit projection models. They do not serialize internal models directly.

The public projection excludes:

- `Claim.raw`, `Claim.call_id`, provider storage URLs, and unstructured notes.
- Supplier email and marketplace contact URLs.
- Decision and Case pull-request URLs.
- Unknown Event payload keys.

Public free text is scrubbed recursively. E.164 phone numbers are masked. Email and secret-like values are redacted.

The raw phone number exists only in the literal guarded CALL-E request body.

## Safe verification

Run these commands from the repository root:

```bash
pnpm --filter @supplyos/api build
pnpm --filter @supplyos/api test
pnpm --filter @supplyos/api contracts:check
git diff --check
```

The default test command excludes live tests and blocks network access. Never run a live test for general verification.

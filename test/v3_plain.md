# v3 — Plain Version

Short, literal description of the project.
No reasoning. No arguments. Only what it is and what happens.

---

## 1. The Idea

A factory needs a part.
The part will run out.
When it runs out, the production line stops.
A stopped line costs money every hour.

Normally a human buyer fixes this. It takes days.

This project replaces the human buyer with Devin.

Devin does the work and delivers a **Pull Request** on GitHub.

The Pull Request contains:

- the case file
- the list of suppliers found
- the price quotes collected
- the compliance report
- the cost calculation
- the recommended purchase order

One sentence:

> A shortage goes in. A pull request comes out. No human in between.

---

## 2. Main Workflow

This is what happens when a part runs short.

```
shortage detected
  -> start Devin session
  -> Devin reads part data
  -> Devin finds candidate suppliers
  -> Devin removes suppliers that break the rules
  -> Devin contacts remaining suppliers
  -> suppliers give price quotes
  -> Devin calculates the real total cost
  -> Devin compares order strategies
  -> Devin runs the tests
  -> tests pass
  -> Devin writes files
  -> Devin opens a Pull Request
  -> screen shows the result
```

### Step by step

**Step 1 — Shortage detected**
A cron job checks stock every 60 seconds.
Stock is below the reorder point.
A human can also press a button instead.

**Step 2 — Start Devin session**
The backend sends `POST /v1/sessions` to the Devin API.
The prompt is built by code. No human types it.

**Step 3 — Devin reads part data**
Devin calls these endpoints:

```
GET /tools/part/{id}        -> what the part is
GET /tools/stock            -> how many are missing
GET /tools/suppliers        -> who can supply it
GET /tools/price_history    -> past prices
GET /tools/alternates       -> replacement parts
```

These endpoints are served by our own backend.
Behind them is fake ERP data. There is no real ERP.

**Step 4 — Find candidate suppliers**
Devin uses the supplier list plus web search.
Result: about 5 candidate suppliers.

**Step 5 — Remove suppliers that break the rules**
Four rules run as Python functions:

```
blocked_origin_country
missing_required_certification
audit_required_and_not_audited
lead_time_after_line_stop
```

Each rejected supplier is named.
The rule that rejected it is named too.

**Step 6 — Contact remaining suppliers**
Devin calls `POST /tools/outreach` on our backend.
Our backend chooses the channel:

```
supplier in a CALL-E region   -> phone call via CALL-E
supplier in China             -> email or marketplace message
```

**Step 7 — Suppliers give price quotes**
CALL-E returns structured data, not text.
Each answer becomes a `Quote` object.
About 3 suppliers answer.

**Step 8 — Calculate the real total cost**
The sticker price is not the real price.
The real price is called **landed cost**.

```
landed cost = goods + freight + duty + carrying cost + expedite fee
```

**Step 9 — Compare order strategies**
Devin does not only rank suppliers.
It also tests combinations.

Example combination:

```
20% by air  from the expensive supplier  (arrives before the line stops)
80% by sea  from the cheap supplier      (arrives later, costs less)
```

This combination can cost less than any single supplier.

**Step 10 — Run the tests**
Two `pytest` suites run:

1. tests for the policy rules
2. tests for the cost model

Both must pass.
If they fail, Devin fixes the problem and runs them again.

**Step 11 — Write files**
Devin writes into `cases/<case_id>/`:

```
sourcing_case.yaml
candidates.json
quotes/*.json
policy_report.md
cost_report.md
decision.md
po_draft.md
```

**Step 12 — Open a Pull Request**
Devin creates a branch and opens a PR on GitHub.
The PR body contains the Devin session URL.

**Step 13 — Screen shows the result**
The web UI reads the event log and displays everything.

---

## 3. Phone Call Workflow

```
OutreachTask created
  -> backend sends POST /v1/calls to CALL-E
  -> CALL-E dials the supplier
  -> AI speaks to the supplier
  -> call ends
  -> CALL-E sends a webhook to our backend
  -> backend converts the result into a Quote
  -> Quote is written to the event log
```

### What the AI says

The first two sentences must state:

1. It is an AI assistant.
2. The call is recorded.

This is required by law in Germany (§201 StGB) and the EU AI Act.

### What the AI asks

```
unit price
quantity price breaks
minimum order quantity (MOQ)
lead time
incoterm
certification
```

### CALL-E request

```
POST $CALLE_BASE_URL/v1/calls
Authorization: Bearer $CALLE_API_KEY

{
  "task": "<what to say and ask>",
  "recipients": [ {"phones": ["+49..."], "region": "DE", "locale": "de-DE"} ],
  "recipient_result_schema": { <our Quote schema> },
  "webhook_url": "https://<our-tunnel>/calle/webhook",
  "metadata": { "case_id": "CASE-001" }
}
```

### Limits

- 20 free calls per account.
- 4 accounts = 80 calls total.
- `FAKE_CALLS=1` is the default during development.
- One account is reserved for the live demo only.
- China is not supported by CALL-E.

---

## 4. Tech Stack

### By workflow step

| Step | Technology |
|---|---|
| Shortage detection | Python cron loop, every 60 seconds |
| Start Devin session | Devin API — `POST /v1/sessions` |
| Tool endpoints | FastAPI (one Python process) |
| ERP data | `MockERP` class + YAML seed files |
| Data shapes | Pydantic models |
| Policy rules | Plain Python functions |
| Cost model | Plain Python functions |
| Self-check | pytest |
| Phone calls | CALL-E Developer API |
| Receiving call results | Webhook endpoint + public tunnel (ngrok or cloudflared) |
| Storage | Files on disk. No database. |
| Artifacts | Git + GitHub Pull Requests |
| UI | Web app started with `npm`. Framework not chosen in v3. |
| Live updates | Append-only event log, polled every 2 seconds |
| Commands | `make demo`, `make replay` |
| Code review for judges | Sponsor review platform (likely Entelligence) |

### Full list

**Backend**

- Python
- FastAPI — one process serves both the Devin tool endpoints and the UI read API
- Pydantic — defines all data shapes, exports JSON Schema
- pytest — the self-check suites
- YAML — seed data and company profile

**External APIs**

- Devin API — `POST /v1/sessions`
- CALL-E Developer API — `POST /v1/calls`
- GitHub — pull requests

**Infrastructure**

- ngrok or cloudflared — public tunnel so webhooks can reach the laptop
- Git — the repository is the database

**Frontend**

- Web app, started with `npm run demo`
- Must work with the backend switched off

**Not used**

```
no Postgres
no ORM
no database migrations
no authentication
no WebSockets
no real ERP
no Docker Compose orchestration
```

---

## 5. Data Shapes

All defined in `packages/contracts/models.py` using Pydantic.
Frozen in hour 1. Changes need a group message.

```
Part          part_id, sku, description, spec, unit, criticality,
              part_class, weight_kg, hs_code

Shortage      case_id, part_id, qty_needed, needed_by, line_stop_date,
              plant_id, incumbent_supplier_id, reason

Supplier      supplier_id, name, country, channels, certifications,
              audit_status, approved, source

Candidate     case_id, supplier_ref, confidence, why_matched, channel,
              compliance

OutreachTask  task_id, case_id, supplier_ref, channel, brief

PriceBreak    min_qty, unit_price

Quote         task_id, case_id, supplier_ref, available, qty_offered,
              unit_price, price_breaks, currency, moq, lead_time_days,
              expedite_option, incoterm, certs_claimed, payment_terms,
              notes, transcript_url, recording_url, confidence, raw

LandedCost    supplier_ref, qty, goods_cost, freight, duty, tooling,
              carrying_cost, expedite_surcharge, total, unit_effective,
              breakdown_md

OrderLine     supplier_ref, qty, mode, eta, landed

Strategy      lines, total_cost, coverage_date, risk_score, rationale

Decision      case_id, strategies, recommended, runner_ups,
              policy_report_url, cost_report_url, pr_url

Event         case_id, ts, actor, stage, level, message, payload
```

`Quote` is used twice:

1. as our internal data shape
2. as CALL-E's `recipient_result_schema`

---

## 6. Build Workflow

### The four slices

Each person owns one slice.
Each slice works alone before it connects to the others.
Each slice builds a fake version first, then the real version.

| Slice | Name | What it is |
|---|---|---|
| A | Cockpit UI | The screen. Must work with the backend off. |
| B | Data & endpoints | Fake ERP, tool endpoints, event log. |
| C | CALL-E outreach | Phone calls and the webhook receiver. |
| D | Devin orchestration | Sessions, prompts, policy code, cost model, PRs. |

### Timeline

```
H0-H1    freeze data shapes
         create repo
         connect the review platform
         get CALL-E keys
         get the public tunnel working
         -> gate: contracts merged, tunnel reachable

H1-H3    build the walking skeleton
         -> gate: one command makes an empty PR and the UI shows it

H3-H8    real logic in each slice, still using fakes
         -> gate: each slice demoable alone

H8       integration checkpoint 1
         -> gate: one full case works on fakes

H8-H14   real Devin session
         real cost model
         first real phone call

H14      integration checkpoint 2
         -> gate: everything real, one full case
         -> RECORD THE BACKUP VIDEO NOW

H14-H18  polish
         better fake data
         second case

last 3h  code freeze
         rehearse 3 times
         write DEMO.md
```

### The walking skeleton

Build this before anything else. It must be ugly and fake.

```
trigger
  -> Devin session created
  -> reads one hardcoded part from the stub API
  -> writes a two-line decision.md
  -> opens a PR
  -> UI shows "done" and the PR link
```

When this works, every remaining task can be done in parallel.

### Sync

Every hour. Five minutes. Three questions:

1. What is green?
2. What do I need, and from whom?
3. Did any contract change?

---

## 7. Git Rules

```
one monorepo on GitHub
four top-level folders, one per slice

every change goes through a Pull Request
never push directly to main
never force-push
never squash-merge
never rewrite history
```

Two kinds of Pull Request:

```
feat/*        the system being built
case/CASE-xxx the artifacts the product generates
```

The `case/*` PRs prove the system is autonomous.
Several must be merged before the demo.

Required files in the repo root:

```
AGENTS.md    conventions, how to run things, tool endpoints
DEMO.md      exact commands to reproduce the demo from a clean clone
```

Commit message format:

```
slice(scope): summary
```

---

## 8. Word List

| Word | Meaning |
|---|---|
| Landed cost | The real total price. Not the sticker price. |
| Price break | Buy more, pay less per unit. |
| MOQ | Minimum order quantity. The smallest order allowed. |
| Carrying cost | Money lost by storing stock you do not need yet. |
| Line stop | The factory stops. Expensive per hour. |
| Incoterm | Rule saying who pays for shipping and insurance. |
| Expedite | Pay extra to make it arrive sooner. |
| Lead time | Days between ordering and delivery. |
| Contract (here) | An agreed data shape, so four people do not break each other. |
| Walking skeleton | A fake version that works end to end, built before real logic. |
| Vertical slice | A full strip through the whole system, owned by one person. |
| Fixture | Fake saved data used instead of a real system. |
| Event log | An append-only list of everything that happened. |
| Tunnel | A public web address that points at your laptop. |
```

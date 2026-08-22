# MVP flow — target sequence

Target end-to-end loop for the Cognition submission (Plan 2), plus the mock-first cut of it that we actually build first. Live CALL-E and the automatic trigger stay opt-in; **real Devin sessions do not** — see [ADR-0004](adr/0004-devin-sessions-are-real-from-the-first-skeleton.md).

**Trigger (for now):** human over CLI — e.g. `python -m orchestrator.run --case CASE-001`. The shortage detector (B4) is the same handoff later; do not build it first.

Related: [`PLAN.md`](PLAN.md), [`../CONTEXT.md`](../CONTEXT.md), [`adr/`](adr/), [`specs/supplyguard-plan-1-foundation-spec.md`](specs/supplyguard-plan-1-foundation-spec.md).

## Input

CLI starts a case from a seeded **Incident** (fixture), not a live ERP write:

| Field | Example role |
| --- | --- |
| `case_id` | `CASE-001` — folder + event log key |
| `part_id` | Part that is short |
| `qty_required` / `qty_on_hand` | Shortfall = required − on hand (floor 0) |
| `line_stop_at` | Deadline (~12 days in the pitch) |
| `line_stop_cost_per_hour`, `expedite_fee`, `currency` | Cost context for later |

## Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Human
    participant CLI as CLI launch
    participant API as Core API plus stubs (B)
    participant Devin as Devin session (D)
    participant Web as Supplier sites shortlist
    participant CE as CALL-E (C)
    participant Demo as Demo company our phone
    participant UI as Cockpit (A)
    participant GH as GitHub

    Human->>CLI: python -m orchestrator.run --case CASE-001
    CLI->>API: create case from Incident fixture · Event(stage="created")
    API->>Devin: POST /v1/sessions {case_id}
    Note over Devin: no human input from here on
    Note over Human,CLI: Later alternate: shortage detector (B4) calls the same create-case + session launch

    Devin->>API: GET /tools/part /tools/stock /tools/suppliers
    Note right of API: stub fixture — part number, size, qty, allowed countries, SupplierRecord[]
    API-->>Devin: Part + Incident context + SupplierRecord[]

    Devin->>Web: search seeded sites / shortlist for exact part
    Web-->>Devin: pages → Candidate[] (why_matched, channel)
    Note over Devin,Web: Candidates are who to ask, not Claims
    Devin->>Devin: policy rules (D3) → reject by name + rule
    Devin->>API: POST /tools/outreach (surviving candidates · demo company preferred)

    API->>CE: POST /v1/calls  recipients[] + Claim as recipient_result_schema
    Note over API,CE: AI disclosure first · ask tiers, MOQ, lead time, stock status
    CE->>Demo: call teammate number (rehearsal-override / pitch)
    Demo-->>CE: answers
    CE-->>API: POST /calle/webhook  structured_result + transcript + confidence
    API->>API: → Claim, never raises · Event log
    Note over API,CE: China / unreachable → email RFQ later, same Claim out

    API-->>Devin: Claim[]
    Devin->>API: GET /tools/* verify claims vs records (D6)
    Note right of Devin: claimed price vs contract · lead time vs standard<br/>qty vs known_allocations · cert vs expiry
    Devin->>Devin: cost_model.py → landed cost per option<br/>breaks · MOQ · freight · duty · carrying · expedite
    Devin->>Devin: strategy search → split order beats single source
    Devin->>Devin: pytest policy + cost suites  ← checks its own work
    Devin->>GH: PR: sourcing_case.yaml · claims/ · policy_report.md · cost_report.md · decision.md · po_draft.md
    GH-->>UI: pr_url

    loop throughout
        UI->>API: GET /cases/{id}/events
        API-->>UI: shortages · live calls · candidates · claims vs records · cost breakdown · decision
    end
    Note over UI,GH: human approves by merging the PR
```

## Which arrows are mock, and until when

Three stages. **Nothing moves to the next column until the whole loop is green in the current one.**

| Hop | M0 — mock loop (h3) | M1 — real decision (h8–14) | M2 — stretch |
|---|---|---|---|
| Trigger → session | **CLI**, one command | CLI + button in the cockpit | **detector fires on its own** |
| Devin session | **real** | real | real, possibly fan-out per candidate |
| System of record | mock, 1 hardcoded part | mock, full seed (~40 parts, 15 suppliers) | real `ERPNextAdapter` |
| Web research → candidates | fixture list of 5 | curated real distributors | free web search |
| Policy rules | none | **real, 4 rules** | more rules |
| Outreach dispatch | fake, returns instantly | fake for most + **1 real call** | all real, batched |
| Supplier answers | one saved CALL-E response, replayed | saved + one live | live |
| Webhook | not wired | **real** | real |
| Claim vs record check | none | **real** | real |
| Cost model | none | **real, with price breaks + split search** | tariff/HS refinement |
| Self-check suites | none | **real, gate the PR** | more coverage |
| PR artifacts | 2-line `decision.md` | full artifact set | + PO PDF |
| Cockpit | stage list + PR link, unstyled | all six views, fixture-driven | polish |
| Email / marketplace channel | no | no | yes |

Read the M0 column as the definition of the walking skeleton in [`PLAN.md`](PLAN.md) §11. Read the M1 column as the MVP.

## M0 — the mock loop

This is the first implementable thing and the one on `mvp-stub`. Two stubs, no network anywhere, one command.

```mermaid
sequenceDiagram
    autonumber
    actor Human
    participant CLI as CLI launch
    participant UI as Cockpit (A)
    participant API as Core API plus stubs (B)
    participant Devin as Devin session (D)
    participant Fake as Outreach fake (C)
    participant GH as GitHub

    Human->>CLI: python -m orchestrator.run --case CASE-001
    CLI->>API: create case from Incident fixture
    API->>API: mkdir cases/CASE-001/ · Event(created)
    API->>Devin: POST /v1/sessions {case_id}
    Devin-->>API: session_id · session_url
    API-->>CLI: {case_id, session_url}

    Devin->>API: GET /tools/part/BRG-6204-2RS
    Note right of API: STUB 1 — system of record<br/>hardcoded, ERPNext field names
    API-->>Devin: {item_code, item_name, actual_qty, supplier_name}

    Devin->>API: POST /tools/outreach {OutreachTask}
    API->>Fake: dispatch — rehearsal, always
    Note right of Fake: STUB 2 — CALL-E<br/>replays one saved response<br/>no network, no credits
    Fake-->>API: structured_result · transcript_turns · evidence · confidence
    API->>API: → Claim · Event(claim_received)
    API-->>Devin: Claim

    Devin->>Devin: write cases/CASE-001/decision.md (2 lines, wrong, fine)
    Devin->>GH: branch → commit → PR
    GH-->>Devin: pr_url
    Devin->>API: POST /cases/CASE-001/done {pr_url}

    loop every 2s
        UI->>API: GET /cases/CASE-001/events
        API-->>UI: [Event, ...]
    end
    UI-->>Human: "Done" · PR link · transcript
```

The point of M0 is not correctness — every number in it is wrong. It is that **every wire has had a real message pushed through it**, so M1 is four people filling in blanks instead of four people discovering their pieces don't fit.

## What the MVP (M1) contains

**In:**

- One Incident on one Part at one plant, seeded so that the naive answer is wrong.
- Mock system of record behind the two-question adapter, ERPNext-shaped ([ADR-0003](adr/0003-mock-system-of-record-behind-an-adapter.md)).
- ~5 Candidates: curated real distributors, at least one rejected by a named policy rule.
- Four policy rules: blocked origin country, missing required certification, audit required and not audited, lead time after line stop.
- Outreach via CALL-E with `Claim` as the `recipient_result_schema`, rehearsal by default, **one real call in the demo**, at least one supplier answering `in_stock_allocated`.
- Claim-vs-record verification: claimed price against contract, lead time against standard, quantity against known allocations, certification against expiry.
- Landed-cost model with price breaks, MOQ overshoot, freight by weight and mode, duty by origin, carrying cost, expedite surcharge.
- Strategy search that finds a **split order** beating every single-source option.
- Two `pytest` suites — policy and cost — that must be green before the PR opens.
- A PR per Case containing `sourcing_case.yaml`, `candidates.json`, `claims/*.json`, `policy_report.md`, `cost_report.md`, `decision.md`, `po_draft.md`.
- Cockpit: shortage dashboard, case timeline, supplier board, live calls, claim-vs-record comparison, decision view. Fully demoable with the backend off.

**Out, deliberately:** database, auth, in-app approval workflow, email and marketplace channels, real ERPNext, free web search, multiple part classes, PO PDF, purchase execution, an Entire adapter for Devin ([ADR-0007](adr/0007-no-entire-adapter-for-devin-during-the-jam.md)).

## Mock vs later

| Step | Now | Later |
| --- | --- | --- |
| SoR tools | Fixture JSON behind `/tools/*` | SQLite or real adapter, same URLs |
| Web research | Seeded shortlist + optional browse | Richer site list |
| CALL-E | Demo company → our phone / saved claim | Supplier outreach behind the same boundary |

## Stage beats

Keep these three visible on stage:

1. A supplier rejected **by name plus the rule**
2. A claim that turns out to be `in_stock_allocated`
3. The **split order** beating every single-source option

## Open

Settled since this list was written: the trigger is the human CLI above, mock vs live is the table above, and the first slice to implement is M0.

- **Demo scale.** The foundation spec's fixture is a shortfall of 8 units, at which there are no price breaks, no freight trade-off and no split order — the cost model has nothing to compute. Proposal: same 4-supplier fixture shape, scaled to ~40 000 pcs against a 12-day line stop, with price-break tiers per supplier. **Blocks the seed data**, so it needs deciding before B1 starts.
- Whether M2's session fan-out is worth the ACUs. Decide at hour 14, not now.

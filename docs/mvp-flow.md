# MVP flow — target sequence

Target end-to-end loop for the Cognition submission (Plan 2). Refine this diagram next so the same flow runs with **mock inputs**: system of record, web research, CALL-E calls, and claims. Live CALL-E and real Devin sessions stay opt-in.

**Trigger (for now):** human over CLI — e.g. `python -m orchestrator.run --case CASE-001`. The shortage detector (B4) is the same handoff later; do not build it first.

Related: [`PLAN.md`](PLAN.md), [`specs/supplyguard-plan-1-foundation-spec.md`](specs/supplyguard-plan-1-foundation-spec.md).

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
    participant API as Core API (B)
    participant Devin as Devin session (D)
    participant SOR as System of record (B1, ERP adapter)
    participant CE as CALL-E (C)
    participant Sup as Suppliers
    participant UI as Cockpit (A)
    participant GH as GitHub

    Human->>CLI: python -m orchestrator.run --case CASE-001
    CLI->>API: create case from Incident fixture · Event(stage="created")
    API->>Devin: POST /v1/sessions {case_id}
    Note over Devin: no human input from here on
    Note over Human,CLI: Later alternate: shortage detector (B4) calls the same create-case + session launch

    Devin->>SOR: part spec · stock · BOM · approved suppliers · price history
    SOR-->>Devin: Part + Incident + SupplierRecord[]
    Devin->>Devin: web research → Candidate[] (why_matched, channel)
    Devin->>Devin: policy rules (D3) → reject by name + rule
    Devin->>API: POST /tools/outreach  (surviving candidates)

    API->>CE: POST /v1/calls  recipients[] + Claim as recipient_result_schema
    CE->>Sup: parallel calls · AI disclosure first · ask tiers, MOQ, lead time, stock status · negotiate in [target, floor]
    Sup-->>CE: answers
    CE-->>API: POST /calle/webhook  structured_result + transcript + confidence
    API->>API: → Claim, never raises · Event log
    Note over API,CE: China / unreachable → email RFQ, same Claim out

    API-->>Devin: Claim[]
    Devin->>SOR: verify claims vs our records (D6)
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

## Stage beats

Keep these three visible on stage:

1. A supplier rejected **by name plus the rule**
2. A claim that turns out to be `in_stock_allocated`
3. The **split order** beating every single-source option

## Next (refine here)

- [x] Trigger: human CLI (`orchestrator.run --case CASE-001`); detector later
- [ ] Mark which arrows are mock vs live for the first implementable MVP slice
- [ ] Pull a few slices out of this flow to implement first
- [ ] Devin setup and the tool endpoints Devin calls — after the mock loop walks

# MVP flow — target sequence

Target end-to-end loop for the Cognition submission (Plan 2). This diagram is the **mock MVP**: fixtures behind tool URLs, then policy/cost/PR logic on that data.

**Not in the MVP path:** live web search, email RFQ, shortage detector, SQLite, China channel. **Outreach** is already on the teammate CALL-E branch. Do not implement or inspect it now. Wire it when that slice is next.

**Trigger (for now):** human over CLI against the deployed backend — e.g. `python -m orchestrator.run --case CASE-001 --api https://<backend>.vercel.app`.

**Deploy:** frontend and backend on **Vercel**. They talk over HTTPS. Devin also calls that public backend. ERP access is HTTP on the backend (`/tools/part`, `/tools/stock`, `/tools/suppliers`, and later more). Devin never talks to SQLite or an ERP directly.

Those tools return fixture JSON now. Later they can sit on SQLite or a real adapter behind the same URLs. Serverless has no durable local disk. Serve fixtures from the repo. Put case events in something the API can read across requests (JSON in-repo, KV, or files Devin commits).

Web search is skipped. If we add it later, it is Devin following the system prompt, not a Core API feature.

Slices to implement: [`mvp-slices.md`](mvp-slices.md). Related: [`PLAN.md`](PLAN.md), [`specs/supplyguard-plan-1-foundation-spec.md`](specs/supplyguard-plan-1-foundation-spec.md).

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
    participant API as Vercel backend ERP tools (B)
    participant Devin as Devin session (D)
    participant GH as GitHub
    participant UI as Vercel frontend (A)

    Human->>CLI: python -m orchestrator.run --case CASE-001 --api https://backend.vercel.app
    CLI->>API: POST /cases from Incident fixture · Event(stage="created")
    API->>Devin: POST /v1/sessions {case_id, backend_base_url}
    Note over Devin: no human input from here on
    Note over Human,CLI: Later alternate: shortage detector (B4) or UI button, same POST /cases

    Devin->>API: GET /tools/part /tools/stock /tools/suppliers
    Note right of API: public ERP stubs — part number, size, qty, allowed countries, SupplierRecord[]
    API-->>Devin: Part + Incident context + SupplierRecord[]
    Note over Devin: Web search skipped in MVP. Later: system prompt tells Devin to search. Not a Core API.

    Devin->>Devin: policy rules (D3) → reject by name + rule (fixture data)
    Note over Devin,API: Outreach later. Connect teammate CALL-E branch on Slice 4. Do not build or inspect it now.
    Note over Devin,API: Until then Slice 5 may read Claim fixtures the API serves.

    Devin->>API: GET /tools/* verify claims vs records (D6)
    Note right of Devin: claimed price vs contract · lead time vs standard<br/>qty vs known_allocations · cert vs expiry
    Devin->>Devin: cost_model.py → landed cost per option (fixture prices)
    Devin->>Devin: strategy search → split order beats single source
    Devin->>Devin: pytest policy + cost suites  ← checks its own work
    Devin->>GH: PR: sourcing_case.yaml · claims/ · policy_report.md · cost_report.md · decision.md · po_draft.md
    GH-->>API: pr_url · Event(stage="done")

    loop throughout
        UI->>API: GET /cases/{id}/events
        API-->>UI: stages · suppliers · claims vs records · cost · decision · pr_url
    end
    Note over UI,GH: human approves by merging the PR
```

## Mock vs later

| Step | MVP (this diagram) | Later |
| --- | --- | --- |
| Host | Frontend + backend on Vercel. Public HTTPS | Unchanged |
| Trigger | CLI `--case CASE-001` against the Vercel API | Shortage detector (B4) or UI button |
| ERP / SoR | Public `/tools/part`, `/stock`, `/suppliers` on the backend | SQLite or real adapter, same URLs |
| Web search | Skipped | System prompt. Devin searches. Not a Core API |
| Outreach | Skip for now | Wire existing CALL-E branch (Slice 4). Do not inspect until then |
| Claims until Slice 4 | Fixture JSON the API serves | Real Claims from CALL-E |
| Verify / cost / policy | Real functions on fixture data | Same, richer seed |
| PR | Real GitHub PR with case artifacts | Unchanged |
| UI | Reads event log (can be ugly) | Full cockpit polish |
| Out of path | — | Email RFQ, China channel, detector, live distributor calls |

## Stage beats

Keep these three visible. Seed the fixtures so they happen:

1. A supplier rejected **by name plus the rule**
2. A claim that turns out to be `in_stock_allocated`
3. The **split order** beating every single-source option

## Next

- [x] Trigger: human CLI. Detector later
- [x] Mock vs live arrows for the MVP path
- [x] No email RFQ. No web-search slice. Outreach deferred to teammate CALL-E branch
- [x] Implementation slices: [`mvp-slices.md`](mvp-slices.md)
- [x] Vercel host. Devin and UI call public backend. ERP is `/tools/*`
- [ ] Devin setup detail when you implement the launch slice

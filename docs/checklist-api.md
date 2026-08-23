# The checklist API

The cockpit no longer tries to show what the agent is *doing* — it shows what it
has *finished*. That is a to-do list: eight fixed headers that exist from the
moment a case is opened, plus one line per supplier that only appears once the
agent decides that supplier is worth screening or calling.

Fixed so the frontend can be designed before a run exists. Dynamic underneath so
the number of suppliers is still the agent's call.

## The read model

`GET /cases/{case_id}/plan` → `CasePlan`

```jsonc
{
  "case_id": "CASE-001",
  "active_step_id": "outreach:SUP-RUL",
  "done": 12,
  "total": 20,
  "sections": [
    {
      "group": "outreach",
      "label": "Calling suppliers",          // fixed, never changes
      "status": "active",                    // derived from the steps below
      "steps": [
        { "step_id": "outreach:brief", "label": "Writing the call brief", "status": "done" },
        { "step_id": "outreach:SUP-KBY", "label": "Calling Kugellager Bayern GmbH",
          "status": "done", "detail": "free_in_stock, 500,000 pcs at EUR 3.50",
          "supplier_ref": "SUP-KBY", "dynamic": true }
      ]
    }
  ]
}
```

Section status is derived, never posted: `active` if any step is active, `done`
when every step has finished (a `failed` or `skipped` step still counts as
finished — a rejected supplier must not leave the header spinning forever),
otherwise `pending`.

Statuses are `pending`, `active`, `done`, `failed`, `skipped`.

The eight headers, in order:

| group | header |
| --- | --- |
| `intake` | Reading the incident |
| `erp` | Pulling part data |
| `suppliers` | Finding registered suppliers |
| `screening` | Screening against procurement policy |
| `outreach` | Calling suppliers |
| `claims` | Collecting answers |
| `costing` | Pricing every option |
| `review` | Handing a ranked shortlist to the buyer |

The eleven steps seeded with the case: `intake:incident`, `erp:part`,
`erp:stock`, `erp:open_pos`, `erp:price_history`, `suppliers:list`,
`screening:policy`, `outreach:brief`, `claims:normalise`, `costing:landed`,
`review:package`.

## The write model

`POST /tools/plan/step?case_id=…&step_id=…&status=…` — one transition. Optional
`detail`, and `group` + `label` + `supplier_ref` when the id is new.

```
POST /tools/plan/step?case_id=CASE-001&step_id=erp:part&status=active
POST /tools/plan/step?case_id=CASE-001&step_id=erp:part&status=done&detail=6204-2RS%2C%200.11%20kg
```

`POST /tools/plan/steps?case_id=…` with a JSON list of the same fields — the
fan-out door. Five suppliers being called at once is one request, and they all
appear in the same poll instead of trickling in.

```jsonc
[
  { "step_id": "outreach:SUP-KBY", "group": "outreach",
    "label": "Calling Kugellager Bayern", "supplier_ref": "SUP-KBY", "status": "active" },
  { "step_id": "outreach:SUP-RUL", "group": "outreach",
    "label": "Calling Rulmenti", "supplier_ref": "SUP-RUL", "status": "active" }
]
```

Both return the whole `CasePlan`, so a caller never has to read back.

Rules the endpoints enforce:

- **Idempotent on `step_id`.** A retry updates the line; it never adds a second
  one. This is what makes it safe for an agent that repeats itself.
- **A new id needs a `label` and a `group`**, or it is a 422. An unlabelled line
  on a screen a human is watching is worse than a missing one.
- **`started_at` / `completed_at` are set by the backend**, not the caller.
- Every transition is also appended to the event log, so the existing event dock
  and the checklist can never disagree.

## Who writes it

Both paths write the same list, which is why the recorded demo and a live run
look identical:

- `backend/flow/conductor.py` — the deterministic run, sub-second, used on stage.
- The Devin session — instructed in `backend/launch/devin.py::session_prompt`
  with the exact ids above and the naming convention for dynamic ones
  (`screening:<SUPPLIER_REF>`, `outreach:<SUPPLIER_REF>`).

Held-back supplier: `POST /flow/run?hold_for=SUP-KBY` leaves that supplier's
outreach line `active` with detail "holding for the live call" — which is
precisely the frame the video pauses on before the phone rings.

## Storage

`cases/<case_id>/plan.json`, beside `events.jsonl`. Written atomically; a
corrupt row is dropped on read rather than taking the screen down mid-demo.

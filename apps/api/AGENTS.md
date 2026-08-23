# SupplyOS API

This is the repository's only backend application. Python source lives under
`src/supplyos_api/`; the one FastAPI entry point is `supplyos_api.main:app`.
Keep canonical domain and wire models in `packages/contracts/` and regenerate
their checked-in projections with `python run.py contracts`.

The durable case store is `casestore/case_store.py`. The outreach buffer is
temporary provider state, not a second case store. YAML under
`record/demo_data/` is the editable mock-ERP source; `apps/api/data/erp.db` is a
generated, ignored artifact.

Run `python run.py test` from the repository root, or use
`uv run --project apps/api --extra dev pytest`. Tests must remain offline.
Rehearsal is the default; preserve the two explicit live-call opt-ins, exact
`Decimal` money, phone masking outside the literal outbound request, and the
no-secrets rule.

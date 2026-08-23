# Repository guide

SupplyOS is a monorepo with three applications and one shared contract package:

- `apps/erp/` is the mock ERP and system-of-record interface.
- `apps/web/` is the SupplyOS product interface.
- `apps/api/` is the only Python service; its import package is `supplyos_api`.
- `packages/contracts/` owns shared Pydantic models, JSON Schema, and generated
  TypeScript contracts.

The product flow and ownership boundaries live in `docs/PLAN.md`. Read the
nearest app-level `AGENTS.md` before changing an application.

## Commands

Run repository workflows from the root:

- `python run.py setup` installs both Python distributions and both Next apps.
- `python run.py test` runs API tests plus ERP and SupplyOS checks offline.
- `python run.py build` builds both Next apps.
- `python run.py` starts the API, ERP, and SupplyOS together.
- `python run.py api`, `python run.py erp`, and `python run.py web` start one app.
- `python -m supplyos_api.cli ...` drives sourcing cases through the API.

## Boundaries

Keep one FastAPI entry point: `supplyos_api.main:app`. ERP opens an incident and
hands its case ID to SupplyOS; SupplyOS presents and works that case. Shared wire
and domain types belong in `packages/contracts/`; frontend code imports the
generated `packages/contracts/generated/contracts.ts`. Run
`python run.py contracts` after changing contracts and commit the generated
outputs.

Rehearsal is the default. Tests, setup, and ordinary development stay offline
and may not place calls. Preserve exact `Decimal` money values, mask phone
numbers outside the literal outbound-call request, and keep secrets and real
numbers out of Git. Live calling requires both the server confirmation and an
explicit CLI/UI request.

## References

- Runtime flow, setup, and safety: `README.md`
- Product decisions and ownership: `docs/PLAN.md`
- Detailed behavior: `docs/specs/`
- Stack-specific documentation: `docs/agents/tech-stack.md`
- Issues and labels: `docs/agents/issue-tracker.md` and
  `docs/agents/triage-labels.md`
- Domain context and ADR routing: `docs/agents/domain.md`

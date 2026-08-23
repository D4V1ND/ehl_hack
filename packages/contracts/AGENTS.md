# packages/contracts — the frozen contract

Pydantic models are the source. Everything else is generated from them by `python run.py fixtures` (`packages.contracts.export`):

- `schema/*.json` — JSON Schema, also what CALL-E gets as `recipient_result_schema`.
- `apps/erp/lib/contracts.ts` — TypeScript types for the cockpit.
- `apps/erp/lib/fixtures/*.json` — a recorded case, so the ERP app runs with no backend.

Never hand-edit the generated files; change the model and re-export. Do not re-export as a drive-by either — the fixtures encode a recorded demo run, and regenerating them from a different local database rewrites the demo.

A model change is a breaking change for the backend, both Next apps and CALL-E at once. Ping the group before renaming or removing a field; add optional fields instead when you can.

Money is `Decimal` in Python and a string on the wire. `unknown` is a real value in every claim field, not a null.

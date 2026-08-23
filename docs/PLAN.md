# SupplyOS product plan

This is the canonical living plan for the repository. Behavioral details live
in `docs/specs/`; completed implementation plans remain available in Git history
instead of competing with this document.

## Product

SupplyOS resolves a production shortage without pretending an agent can approve
a purchase. It reads trusted ERP records, collects supplier claims, checks those
claims against policy and records, calculates landed recovery plans, and gives a
buyer a traceable ranked recommendation.

The domain keeps three ideas separate:

- **Incident:** the trusted factory shortage derived from the system of record.
- **Claim:** what a supplier said; evidence, not automatically a fact.
- **Decision:** a costed, policy-screened recommendation awaiting a human.

## Resolved ownership

| Component | Owns | Does not own |
| --- | --- | --- |
| `apps/erp/` | Inventory, approved supplier records, incident trigger | Sourcing cockpit, candidate ranking, case orchestration |
| `apps/web/` | SupplyOS case experience and buyer handoff | ERP data ownership, a second case store or launch API |
| `apps/api/` | The only HTTP API, workflow, records, outreach, policy, costing, case artifacts | Product UI |
| `packages/contracts/` | Canonical domain/wire types and generated frontend contracts | Runtime workflow or voice-provider behavior |

The stable repository shape is:

```text
apps/{api,erp,web}
packages/contracts
cases
docs
```

FastAPI has one entry point, `supplyos_api.main:app`. The workflow CLI is
`python -m supplyos_api.cli`.

## Runtime flow

1. ERP lists inventory from `GET /inventory`.
2. A user chooses a part; ERP calls `POST /cases`.
3. The API derives an incident from stock, consumption, BOM, open-PO, and
   supplier records and creates the case artifact.
4. ERP hands the returned case ID to SupplyOS.
5. The workflow reads records, screens approved suppliers, gathers claims,
   calculates every viable single-source and split plan, and ranks on-time plans
   before late plans and then by landed cost.
6. SupplyOS shows records, claims, exclusions, plan progress, and the ranked
   buyer handoff.
7. Publishing prepares a reviewable pull request. A human approves any purchase.

Both the deterministic rehearsal and a Devin-driven run use the same API,
contracts, case store, event log, and checklist. There is no Next.js case API or
app-local case store.

## System boundaries

The API's `SystemOfRecord` seam answers inventory/incident and approved-supplier
questions. YAML is editable demo source; SQLite is the default compiled adapter.
A real ERP replaces this adapter without changing the sourcing workflow.

`packages/contracts/` defines the shared vocabulary. Generated JSON Schema and
`packages/contracts/generated/contracts.ts` are checked for drift in CI.
Provider-specific call results are
transport DTOs; `Claim` remains the normalized domain evidence used by policy,
costing, and presentation.

Case files are the audit trail. Seed fixtures `CASE-001` and `CASE-002` live on
main; operational cases belong to their run or review branch and should not
accumulate as fixtures.

## Non-negotiable behavior

- Rehearsal is the default and all automated tests remain offline.
- Live calling requires an explicit server confirmation and an explicit request.
- The call begins with AI disclosure and makes no commitment.
- Raw phone numbers cross only the literal outbound-call boundary.
- Money uses exact decimal arithmetic and string serialization.
- Unknown or incomplete supplier answers remain first-class unknowns.
- A malformed call becomes low-confidence evidence rather than crashing a case.
- Policy exclusions identify the rule and evidence that caused them.
- The agent ranks options; a buyer makes the purchasing decision.
- Secrets, real numbers, transcripts, and runtime databases stay out of Git.

## Delivery standard

Repository cleanup and feature work are complete only when:

- `python run.py test` is green without network access;
- `python run.py build` builds ERP and SupplyOS;
- contract generation leaves the worktree unchanged;
- `supplyos_api.main:app` boots and `/healthz` reports rehearsal by default;
- an ERP-triggered case opens the matching SupplyOS case;
- no second API, case store, shared contract definition, or product identity is
  introduced.

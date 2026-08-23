# Turborepo consolidation note

This note records how the SupplyOS Cockpit and `slice-b/calls-from-cockpit` were consolidated. It describes commit `f8ab85c`.

## Inputs

- SupplyOS Cockpit: `lorenzkrinner/mvp-ui` at `563fe4b`.
- Mock ERP and API: `slice-b/calls-from-cockpit` at `cd9a6a8`.
- Method: selective file consolidation, not a Git merge commit.

## Result

| Workspace | Source | Responsibility |
|---|---|---|
| `apps/web` | Existing Cockpit root | SupplyOS UI, calls, Claims, Candidates, and Decisions |
| `apps/erp` | Slice B `ui/` | Mock system-of-record UI and Incident handoff |
| `apps/api` | Slice B Python modules | FastAPI, SQLite, contracts, orchestration, and offline tests |

The root now owns pnpm workspaces and Turborepo tasks. Each app keeps its own dependencies and commands.

## Consolidation steps

1. Fast-forward the working branch to the Cockpit snapshot.
2. Move the root Next.js Cockpit into `apps/web` without redesigning it.
3. Port Slice B's `ui/` into `apps/erp` and Python code into `apps/api`.
4. Remove call controls from the ERP. Calls and human approval stay in SupplyOS.
5. Add root Turbo tasks for development, linting, type checks, builds, tests, and seeding.

## ERP handoff

The ERP builds `${NEXT_PUBLIC_SUPPLYOS_URL}?case=<case_id>`. The **Request fix via agent** link opens that URL in a new tab with `noopener noreferrer`.

Only the Case ID crosses the browser boundary. Trusted records remain behind the API. Supplier Claims remain separate.

## Current boundary

The ERP handoff URL and API are present. The Cockpit still replays scripted CASE-001 data and does not yet load the Case ID from SQLite. Rehearsal remains deterministic, and live calling remains opt-in.

## Verification used

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

The consolidation passed all four checks, including 211 offline API tests.

# SupplyOS

SupplyOS is an auditable sourcing demo for a German automotive manufacturer.
The repository uses Turborepo with three workspaces.

| Workspace | Purpose | Local URL |
|---|---|---|
| `apps/web` | SupplyOS Cockpit, Calls, Claims, and Decision | `http://localhost:3000` |
| `apps/erp` | Mock ERP and shortage trigger | `http://localhost:3001` |
| `apps/api` | FastAPI, SQLite, CALL-E, and orchestration | `http://localhost:8010` |

## Setup

```bash
pnpm install
pnpm setup:api
pnpm db:seed
pnpm dev
```

`apps/web` and `apps/erp` use deterministic fixtures by default. Live calling
is never a fallback. Copy each workspace's `.env.example` only when needed.

## Commands

```bash
pnpm dev          # start all workspaces
pnpm dev:web      # start the SupplyOS Cockpit
pnpm dev:erp      # start the mock ERP
pnpm dev:api      # start FastAPI
pnpm test         # run safe workspace tests
```

The mock ERP will link Incidents into `apps/web`. Calls remain in SupplyOS.
The browser accesses SQLite through `apps/api`; it never opens the database.

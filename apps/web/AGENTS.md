# SupplyOS web app

This Next.js application is the SupplyOS product interface. It attaches to a
case created by ERP, renders workflow evidence and progress, and presents the
buyer handoff. Keep ERP inventory and supplier-record screens in `apps/erp/` and
keep case orchestration and persistence in `apps/api/`.

Use the canonical FastAPI service through `NEXT_PUBLIC_API_BASE`; do not add a
Next.js API or app-local store. Shared domain and wire types come from
`packages/contracts/generated/contracts.ts`.

Run `npm run typecheck` and `npm run build` from this directory. Run the root
`python run.py test` for the complete offline verification.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/erp — the ERP

The mock system of record with a face: item master, stock cover, cases and the cockpit. Product name in the UI is **ERP**. Root `AGENTS.md` holds the domain rules.

- Runs standalone. `NEXT_PUBLIC_DATA_SOURCE=fixtures` (the default) reads `lib/fixtures/*.json` and needs no Python; `live` reads the API at `NEXT_PUBLIC_API_BASE`, default `http://localhost:8010`.
- `app/api/cases/` are Route Handlers, not pages: the Slice 1 launch path, so a case can start from a Vercel deployment with no backend. Their event store is a module-level map — serverless has no durable disk, and `backend/casestore/` is the durable one.
- `lib/contracts.ts` and `lib/fixtures/*.json` are generated from `packages/contracts`. Never edit them by hand.
- Colours, type scale and spacing come from the root `DESIGN.md`, expressed as tokens in `app/globals.css`. Use the tokens (`text-ink`, `bg-canvas`, `border-hairline`, …), not raw hex or arbitrary values. Extend the primitives in `components/` before adding a parallel one.
- Money arrives as a string and is rendered as a string. Never `parseFloat` a price.
- Never render a raw phone number: the API only ever sends masked ones.

Verify with `npm run typecheck`, `npm run lint` and `npm test` (route handlers, in-memory, no live Devin).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

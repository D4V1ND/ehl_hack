# apps/web — the SupplyOS cockpit

The agent-facing surface: the chat, the plan checklist, candidate comparison and the decision bar. Root `AGENTS.md` holds the domain rules.

- It talks to the FastAPI service through `app/backend/[...path]/route.ts`, a same-origin proxy to `NEXT_PUBLIC_API_BASE` (default `http://localhost:8010`). Call `/backend/...` from components; do not fetch the API origin directly, and do not add a second proxy.
- Chat UI primitives live in `components/ai-elements/`; the sourcing-specific ones in `components/cockpit/`. Extend those before creating a parallel component.
- Colour tokens live in `app/globals.css`. Use only those; this app has its own palette and does not share the ERP's `DESIGN.md` tokens.
- `hooks/use-live-rehearsal.ts` drives the live path, `use-deterministic-rehearsal.ts` the scripted one. Keep the scripted path working: it is what runs if the network dies on stage.
- Money arrives as a string and is rendered as a string. Never `parseFloat` a price. Never render a raw phone number.
- `app/prototype/` is a design sandbox, not a shipped route. Nothing in the live flow may import from it.

Verify with `npm run typecheck` and `npm run lint`; `npm run build` when routing or bundling changed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

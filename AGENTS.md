# Stockout

An EHL Game Jam sourcing demo for a German automotive manufacturer. A bearing shortage launches an agent that gathers structured CALL-E Claims, checks policy and landed cost, and presents a human-approved Decision in Stockout.

Planning documents still use the working name **SupplyGuard**. The product UI currently uses **Stockout**. Keep the name of the surface you are changing unless the developer asks for a rename.

## A note from the maintainers

We like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity because it exists. Do not add machinery because it looks impressive. Find the real constraint, then build the smallest model that makes correct behavior unsurprising.

Channel both "measure twice, cut once" and YAGNI. Fight scope creep. Honor the developer's intent in a minimal, realistic way.

These instructions are good defaults. The developer's explicit request can override them.

## What makes Stockout special

We will not trade these away as we iterate.

1. **Auditable sourcing.** Cases, Claims, checks, costs, and Decisions remain traceable.
2. **Claims are not facts.** What a supplier says stays separate from the factory's trusted records.
3. **Self-checking decisions.** Compliance and landed-cost logic are executable and tested before a recommendation ships.
4. **Human approval.** The agent recommends. A human marks the Decision approved in Stockout; approved is final.

## Who is who

- **you** — the agent reading this file and changing Stockout.
- **we, us** — the maintainers and developers you are talking to.
- **user** — the person resolving a factory shortage with Stockout.
- **supplier** — the party contacted for availability, price, stock status, and certification.

Use the domain words from `docs/PLAN.md` and `docs/specs/supplyguard-plan-1-foundation-spec.md`: Incident, Supplier Record, Claim, Candidate, Outreach Task, Landed Cost, Strategy, and Decision. Do not invent synonyms for these concepts.

## How it works

The planned path is shortage trigger → Devin Session → system-of-record lookup → parallel supplier outreach → structured Claims → compliance and landed-cost checks → Decision → human approval in Stockout. The Cockpit renders progress and the approved final state.

The repository is still a walking skeleton. It currently contains the Next.js landing page, the `/chat` Cockpit (scripted CASE-001 rehearsal), planning documents, and a standalone CALL-E smoke test. The implementation remains fixture-driven. Confirm that a planned module exists before extending it.

## Where code lives

- `app/` — Next.js App Router pages, layout, and global styles.
- `components/` — shared React components; `components/ui/` contains shadcn primitives; `components/ai-elements/` is the Cockpit chat kit.
- `docs/PLAN.md` — MVP architecture, contracts, vertical slices, and delivery plan.
- `docs/specs/` — durable behavior and safety requirements.
- `app/globals.css` — UI colour tokens. Use only these colours.
- `docs/agents/` — task-specific agent guidance.

## Three ways to hurt this repo

1. **An accidental real call.** Rehearsal is always the default. Live calling requires every explicit guard and can spend money or contact a person.
2. **A Claim treated as truth.** Supplier statements and trusted factory records remain separate types through every layer.
3. **A shortcut around the audit trail.** Decisions retain executable checks and human review, not opaque prose or automatic purchasing.

## Non-negotiable domain rules

- Validate phone numbers as E.164 when they enter the system. Mask them everywhere except the literal outbound request body.
- Keep rehearsal offline and deterministic. Live mode is an explicit opt-in, never a fallback.
- Start every call with the mandatory AI disclosure. End the call when the callee requests a human or asks to stop.
- Model missing or unclear answers as `unknown`. Convert unusable call results into confidence-zero Claims instead of crashing.
- Use exact decimal arithmetic for money.
- Use only reserved fictional phone numbers in code, tests, fixtures, and documentation. Keep secrets in the local environment.
- Produce purchase recommendations only. A human approves any purchase through review.

## Taste

SQLite is the intended operational datastore. This implementation remains fixture-driven; Supabase is explicitly out of scope and ignored. Prefer pure functions and narrow adapters. Keep external systems at the boundary.

Build fixtures before live integrations. Keep policy rules and cost functions deterministic. Use one shared contract for backend types, JSON Schema, and UI consumers when those layers exist.

For UI work, use only the colours defined in `app/globals.css`. Extend shadcn primitives before creating parallel components.

Comments explain how a thing is used or why a constraint exists. Prefer one useful comment over line-by-line narration.

If a rule here conflicts with the requested task, explain the conflict and get developer approval before breaking it.

## Pull requests

Never create a pull request unless the developer asks. Do not create a draft by default. When asked, create a ready-for-review pull request and include the relevant Devin Session URL.

Never force-push or amend unless the developer asks. Do not push directly to `main`.

## Responses

- Match the user's language.
- Use ASD-STE100 English. Keep instructions under 20 words.
- Respond for an ADHD reader. Number steps, keep lists to five items, restate state, and give concrete time estimates.
- Disable this response style when the user says `stop adhd mode`.

## Verifying

Use the smallest proof that covers the change.

- Frontend: `npm run lint` and `npm run typecheck` for changed TypeScript or React code.
- Build: `npm run build` when routing, bundling, or production behavior changed.
- CALL-E: `pytest -v -m "not live"` for safe offline tests.
- Live CALL-E: run `pytest -v` only when the developer explicitly requests a real call and all three environment guards are set.

Never run a live test as general verification. A user-visible behavior change must update the matching spec, plan, or design document in the same change.

## Documentation loop

For every implementation task:

1. Read the matching documents from **Read when** before editing.
2. Compare the completed diff with those documents before verification.
3. Update any document whose behavior, architecture, vocabulary, or UI guidance changed.
4. Report `Docs: updated <files>` or `Docs: no change — <specific reason>` before finishing.

The task is incomplete until every affected document is updated or the no-change reason is recorded.

## Docs 

- `docs/PLAN.md` — before changing product scope, architecture, contracts, case artifacts, orchestration, or the demo flow.
- `docs/design.md` — before changing Cockpit layout, Candidate cards or panel, call modal, status rail, Decision bar, or design references.
- `docs/agents/devin-mcp.md` — before using Devin MCP for repository research, Sessions, Knowledge, playbooks, schedules, or integrations.
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` — when creating, reading, or labeling GitHub issues.
- `docs/agents/domain.md` — when changing domain vocabulary or architectural decisions.

Durable truth lives in the files above. GitHub issues hold work in flight.

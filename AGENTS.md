# SupplyOS

An EHL Game Jam sourcing demo for a German automotive manufacturer. A bearing shortage launches an agent that gathers structured CALL-E Claims, checks policy and landed cost, and presents a human-approved Decision.

Planning documents still use the working name **SupplyGuard**. The cockpit is **SupplyOS**; the mock system of record it reads is **ERP**.

## A note from the maintainers

We like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity because it exists. Do not add machinery because it looks impressive. Find the real constraint, then build the smallest model that makes correct behavior unsurprising.

Channel both "measure twice, cut once" and YAGNI. Fight scope creep. Honor the developer's intent in a minimal, realistic way.

These instructions are good defaults. The developer's explicit request can override them.

## What makes this special

We will not trade these away as we iterate.

1. **Auditable sourcing.** Cases, Claims, checks, costs, and Decisions remain traceable — `cases/<id>/` is the datastore.
2. **Claims are not facts.** What a supplier says stays separate from the factory's trusted records.
3. **Self-checking decisions.** Compliance and landed-cost logic are executable and tested before a recommendation ships.
4. **Human approval.** The agent recommends. A human approves by merging the pull request.

## Who is who

- **you** — the agent reading this file and changing this repo.
- **we, us** — the maintainers and developers you are talking to.
- **user** — the person resolving a factory shortage.
- **supplier** — the party contacted for availability, price, stock status, and certification.

Use the domain words from `docs/PLAN.md` and `docs/specs/supplyguard-plan-1-foundation-spec.md`: Incident, Supplier Record, Claim, Candidate, Outreach Task, Landed Cost, Strategy, and Decision. Do not invent synonyms.

## How it works

Shortage trigger → Devin Session → system-of-record lookup → supplier outreach through CALL-E → structured Claims → compliance and landed-cost checks → Decision → human approval by merging the PR. The cockpit renders progress and the final state.

## Where code lives

- `backend/` — the FastAPI service: `backend.api.main:app` on :8010. Devin tool endpoints and the cockpit read API in one process.
- `backend/record/` — the system of record behind one port, two adapters: `mock_erp.py` (YAML, the seed source) and `sqlite_erp.py` (the compiled `.db`, a build artifact).
- `packages/contracts/` — the frozen contract: Pydantic models, plus the JSON Schema and TypeScript types generated from them. Shared by every consumer; changes need a group ping.
- `orchestrator/` — the CLI that drives a case through the stages. Thin: the logic belongs in `backend/`.
- `apps/erp/` — the ERP Next.js app: item master, stock, cases, cockpit. Runs fixture-only with no backend.
- `apps/web/` — the SupplyOS cockpit and chat, proxying to the API through `app/backend/[...path]`.
- `cases/` — case artifacts, one directory per case.
- `docs/PLAN.md` — MVP architecture, contracts, slices, delivery plan.
- `docs/agents/` — task-specific agent guidance.

Each of those directories has its own `AGENTS.md`. Read it before changing code there.

## Three ways to hurt this repo

1. **An accidental real call.** Rehearsal is always the default. Live calling requires every explicit guard and can spend money or contact a person.
2. **A Claim treated as truth.** Supplier statements and trusted factory records remain separate types through every layer.
3. **A shortcut around the audit trail.** Decisions retain executable checks and human review, not opaque prose or automatic purchasing.

## Non-negotiable domain rules

- Validate phone numbers as E.164 when they enter the system. Mask them everywhere except the literal outbound request body.
- Keep rehearsal offline and deterministic. Live mode is an explicit opt-in (`LIVE_CALLS=yes-place-real-calls` **and** `FAKE_CALLS=0`), never a fallback.
- Start every call with the mandatory AI disclosure. End the call when the callee requests a human or asks to stop.
- Model missing or unclear answers as `unknown`. Convert unusable call results into confidence-zero Claims instead of crashing.
- Use exact decimal arithmetic for money, serialized as a string. No floats.
- Use only reserved fictional phone numbers in code, tests, fixtures, and documentation. Keep secrets in the local environment.
- Produce purchase recommendations only. A human approves any purchase through review.

## Taste

Prefer pure functions and narrow adapters. Keep external systems at the boundary. Build fixtures before live integrations. Keep policy rules and cost functions deterministic. One shared contract serves backend types, JSON Schema, and UI consumers.

Comments explain how a thing is used or why a constraint exists. Prefer one useful comment over line-by-line narration.

If a rule here conflicts with the requested task, explain the conflict and get developer approval before breaking it.

## Verifying

Use the smallest proof that covers the change. `run.py` works the same on Windows, macOS and Linux.

```bash
python run.py setup   # once per machine: venv, npm install, build the database
python run.py test    # backend tests + ERP typecheck. Never touches the network.
python run.py         # API on :8010 and the ERP on :3000
```

- Backend or contracts change: `python run.py test`.
- Frontend change: `npm run typecheck` and `npm run lint` in the app you touched; `npm test` in `apps/erp` for the route handlers.
- Live CALL-E: only when the developer explicitly asks for a real call and all guards are set.

Never run a live test as general verification. A user-visible behavior change must update the matching spec, plan, or design document in the same change.

## Pull requests

Never create a pull request unless the developer asks. Do not create a draft by default. When asked, create a ready-for-review pull request and include the relevant Devin Session URL.

Never force-push or amend unless the developer asks. Do not push directly to `main`.

## Docs

- `docs/PLAN.md` — before changing product scope, architecture, contracts, case artifacts, orchestration, or the demo flow.
- `DESIGN.md` — the design tokens the ERP app implements: colours, type scale, spacing.
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` — when creating, reading, or labeling GitHub issues.
- `docs/agents/domain.md` — when changing domain vocabulary or architectural decisions.
- `docs/agents/tech-stack.md` — the tools this repo uses and their documentation links.

Durable truth lives in the files above. GitHub issues hold work in flight.

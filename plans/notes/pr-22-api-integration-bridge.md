# PR 22 API integration bridge

**Status:** recommended next integration step

**PR authority:** [PR 22](https://github.com/D4V1ND/ehl_hack/pull/22), commit `f02321f`

**Related:** [Turborepo consolidation](./turborepo-consolidation.md)

## Decision

Move deterministic behavior behind FastAPI now.

The Cockpit should use real HTTP, polling, mapping, and error handling.

Only the external systems remain simulated:

- A deterministic Case runner stands in for Devin.
- A recorded Outreach adapter stands in for CALL-E.
- Both produce normal Case state and Events.
- The Cockpit never knows which adapter ran.

This creates the real integration seam before the final schema settles.

## Authority order

1. `docs/PLAN.md` owns product behavior.
2. The foundation spec owns Claim and safety rules.
3. PR 22 Pydantic models are the temporary wire contract.
4. `apps/web` owns approved presentation behavior.
5. Recorded responses are test data, never contract authority.

Do not make PR 22's old PR-approval flow part of SupplyOS.

## Current state

Physical consolidation completed at `f8ab85c`.

`apps/web` still owns workflow state through `SCRIPT`, timers, and local approval.

PR 22 already provides most required transport behavior:

| Route | Present use |
|---|---|
| `POST /cases` | Derive an Incident and start or stub a Devin Session |
| `GET /cases/{case_id}` | Return one joined `CaseSnapshot` |
| `GET /cases/{case_id}/events?since=` | Return append-only Events after a cursor |
| `GET /cases` | Return Session sidebar summaries |
| `POST /flow/run?case_id=` | Run the existing deterministic backend procedure |

PR 22's useful temporary types are:

- `OpenedCase`
- `CaseSnapshot`
- `Event`
- `Claim`
- `Decision`

Use the Pydantic models, not PR 22's committed TypeScript.

The generated TypeScript omits `Claim.transcript` and `Claim.summary`.

## What PR 22 does not solve

1. Its recorded CASE-001 contains no Candidates, Claims, or Decision.
2. Its exporter records disk state without running a clean rehearsal.
3. Decision approval has no durable SupplyOS endpoint.
4. `/tools/outreach` only creates tasks and does not dispatch calls.
5. `Claim.raw` can expose private provider data through `CaseSnapshot`.

The current and PR 22 CASE-001 scenarios also disagree.

The approved product story in `docs/design.md` remains authoritative.

## Target flow

```text
ERP
  -> POST /cases
  -> FastAPI Case Module
       -> deterministic Case runner today
       -> Devin Case runner later
       -> recorded Outreach adapter today
       -> CALL-E Outreach adapter later
       -> Case repository and Event log

SupplyOS
  -> GET /cases/{case_id}
  -> GET /cases/{case_id}/events?since=<seq>
  -> POST /cases/{case_id}/decision/approve
```

The HTTP flow stays unchanged when external adapters change.

## Backend Module

Create one deep Case Module.

```python
class CaseModule:
    def open_case(self, command: OpenCase) -> CaseSnapshot: ...
    def get_case(self, case_id: str) -> CaseSnapshot: ...
    def get_events(self, case_id: str, after_seq: int = 0) -> EventPage: ...
    def execute(self, command: StartOutreach | ApproveDecision) -> CaseSnapshot: ...
```

FastAPI becomes a transport adapter over this Interface.

The Module hides these details:

- Incident derivation and Supplier Record lookup
- Candidate screening and Outreach Task creation
- Devin and CALL-E adapter selection
- Claim normalization and checks
- Decision persistence, approval, and Events

### Case runner seam

```python
class CaseRunner(Protocol):
    def start(self, context: CaseRunContext) -> RunReceipt: ...
```

Use two adapters:

- `DeterministicCaseRunner`
- `DevinCaseRunner`

`POST /cases` calls the configured runner after persisting the Incident.

The deterministic runner invokes the private workflow in-process.

The Devin runner starts the Session and returns immediately.

Do not silently stub Devin when Devin mode is configured.

A failed Devin launch should append a failed Event and preserve the Case.

### Outreach seam

```python
class OutreachAdapter(Protocol):
    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt: ...
```

Use two adapters now:

- `RecordedOutreachAdapter`
- `CalleOutreachAdapter`

The recorded adapter must read saved supplier outputs.

It must never derive Claim fields from trusted Supplier Records.

Every adapter normalizes output into one Claim and appends one Event.

## FastAPI routes

Keep these public Case routes:

```text
POST /cases
GET  /cases
GET  /cases/{case_id}
GET  /cases/{case_id}/events?since=<seq>
POST /cases/{case_id}/decision/approve
```

Optional manual outreach comes later:

```text
POST /cases/{case_id}/outreach
```

The browser must not call `/flow/*` or `/tools/*`.

During migration, `DeterministicCaseRunner` may wrap existing `run_case` internally.

Delete that wrapper after the Case Module owns the procedure.

## Frontend Module

Create one deep `cockpitData` Module.

```ts
interface CockpitData {
  open(caseId: string): Promise<CockpitOpen>
  poll(caseId: string, afterSeq: number): Promise<CockpitPoll>
  execute(command: CockpitCommand): Promise<CockpitMutation>
}
```

Use two adapters:

- `HttpCockpitData`
- `FixtureCockpitData`

Use a single hook as the common caller:

```ts
const run = useCockpitCase({ caseId, callId, fixturePreview })
```

The hook hides:

- Loading and typed failures
- Event polling and deduplication
- Snapshot refreshes
- Wire-to-view mapping
- Approval and optional outreach commands

Keep fixtures as the default offline source.

Enable HTTP explicitly with `NEXT_PUBLIC_CASE_SOURCE=api`.

Do not call this source `live`.

Frontend HTTP selection must never change backend call mode.

Never fall back from failed HTTP to fixtures.

## Polling behavior

1. Load the CaseSnapshot.
2. Load Events from cursor zero.
3. Poll Events every two seconds.
4. Refresh the CaseSnapshot after a non-empty Event batch.
5. Advance the cursor after applying that batch.

Keep the last good view during a failed poll.

Mark that view stale and show a retry action.

No WebSocket is needed.

Do not poll `/tools/quotes`.

## PR 22 projection

The projection joins data by stable identifiers.

```ts
type CandidateView = {
  candidate: Candidate
  supplierRecord: SupplierRecord | null
  latestClaim: Claim | null
  outreachTask: OutreachTask | null
  recommendedOrderLines: readonly OrderLine[]
}
```

Keep `candidate`, `supplierRecord`, and `latestClaim` nested.

Never copy trusted record values into a Claim.

### Mapping rules

1. Join Candidate and Supplier Record by `supplier_ref`.
2. Join Claim and Outreach Task by `task_id`.
3. Select the highest Claim round, then latest receipt time.
4. Keep money as decimal strings until formatting.
5. Map missing answers to `unknown` or `unclear`.

Call detail can initially combine Outreach Task, Claim, Supplier Record, and Events.

PR 22's Claim transcript is enough after regeneration.

Do not expose `Claim.raw` in any Cockpit response.

## Deterministic rehearsal

The current React `SCRIPT` is presentation data and workflow truth together.

Split those responsibilities:

- FastAPI owns Case state and Events.
- Recorded supplier outputs own rehearsal Claims.
- Policy and cost code produce the Decision.
- React only presents received Events.
- Replay controls presentation, never approved state.

The initial runner may finish quickly.

The Cockpit can reveal received Events gradually for presentation.

That reveal cursor is not Case state.

Tests should apply Events immediately without waiting.

## Complete recording generation

Fix the exporter before using PR 22 recordings.

The exporter should:

1. Create an isolated temporary Case repository.
2. Use fixed IDs, dates, timestamps, and ordering.
3. Run the complete deterministic Case flow.
4. Record CaseSnapshot and Event endpoint responses.
5. Validate every recording against Pydantic.

The output must include the approved product beats:

- Five Candidates
- One Shenzhen policy rejection
- Four Claims
- Munich Motion allocated stock
- SKF/FAG 20/80 Strategy

## Approval while the schema changes

Read integration does not need to wait for final Decision fields.

HTTP mode must not fake approval in React.

Until the endpoint exists, show approval as unavailable.

Then add:

```text
POST /cases/{case_id}/decision/approve
```

The command must be idempotent and final.

It must reject missing, unchecked, or stale Decisions.

It must persist approval and its Event together.

It never places an order.

## Migration sequence

### 1. Contract and generation — 1–2 hours

- Port PR 22's Pydantic contract into `apps/api`.
- Fix the exporter paths for `apps/web` and `apps/erp`.
- Regenerate transcript fields and recorded responses.
- Exclude `Claim.raw` from Cockpit responses.

### 2. Frontend reads — 2–3 hours

- Add `cockpitData`, both adapters, and `useCockpitCase`.
- Parse `/chat?case=<case_id>`.
- Replace `SCRIPT` timing with Event polling.
- Drive Incident and Candidate status from the projection.

### 3. Deterministic runner — 2–3 hours

- Put `run_case` behind `DeterministicCaseRunner`.
- Replace Supplier Record-derived Claims with saved results.
- Record one complete CASE-001 rehearsal.
- Keep rehearsal network-free.

### 4. Decision and calls — 2–3 hours

- Add durable, final Decision approval.
- Map transcript-backed call detail.
- Disable unsupported manual outreach.
- Preserve existing UI behavior.

### 5. Main integration — 1–2 hours

- Merge current `main` once through the structural ownership map.
- Keep `apps/web` as the Cockpit.
- Reconcile backend code into `apps/api`.
- Regenerate contracts and recordings.

Estimated total: 8–13 person-hours.

Two developers can finish this in one focused day.

## Parallel ownership

### API developer

- Port PR 22 backend changes.
- Fix contract generation.
- Add deterministic adapters.
- Add approval persistence.
- Own generated outputs.

### Web developer

- Build `cockpitData` and the hook.
- Build the PR 22 projection.
- Replace direct fixture imports incrementally.
- Add loading, stale, and failure states.
- Keep presentation behavior unchanged.

Both developers should agree on generated types before starting.

## Acceptance gates

1. `/chat?case=...` loads through the frontend Module.
2. Fixture and HTTP adapters produce the same normalized view.
3. Event cursors remain stable across polling and restart.
4. Rehearsal performs no network requests.
5. No public payload contains a raw phone number.

Additional product gates:

- Claims never inherit Supplier Record values.
- Broken outreach becomes a confidence-zero Claim.
- Approval persists and Replay cannot clear it.
- The approved CASE-001 story remains unchanged.
- HTTP failures never display fixture facts.

## Risks

1. PR 22 recordings are empty and cannot replace the Cockpit rehearsal.
2. PR 22 generated TypeScript already drifted from Pydantic.
3. PR 22 and Slice B assign different behavior to `/tools/outreach`.
4. PR 22's scenario does not match the approved product story.
5. PR 22 still contains PR-based product approval language.

## Source record

- Product architecture: `docs/PLAN.md`
- Claim safety: `docs/specs/supplyguard-plan-1-foundation-spec.md`
- Approved Cockpit: `docs/design.md`
- Domain language: `CONTEXT.md`
- Temporary implementation: PR 22 at `f02321f`

The Devin Wiki was queried as an architecture map.

Its PR 22 answer mixed older paths and behavior.

All decisions above were verified against PR 22 code and current local documents.

## Immediate next action

Generate PR 22's safe `CaseSnapshot` and `Event` types into `apps/web`.

Then implement `open()` and `poll()` before changing any Cockpit component.

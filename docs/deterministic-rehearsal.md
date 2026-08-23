# Deterministic CASE-001 rehearsal

SupplyOS has two deterministic layers during backend integration:

1. FastAPI computes and persists a Case from recorded provider results.
2. The Cockpit still presents its existing client-side CASE-001 fixture.

Both layers make no network request. The backend is now the business-state authority. The current Cockpit remains independently demoable.

## Backend rehearsal sequence

`POST /cases` runs this sequence by default:

1. Read the trusted Part, Incident, Supplier Records, and company policy.
2. Persist the Case and initial Event in operational SQLite.
3. Screen Supplier Records into policy-checked Candidates.
4. Persist Outreach Tasks for compliant Candidates.
5. Read recorded provider results from `apps/api/backend/outreach/fixtures/`.
6. Normalize each result into a Claim linked to its Outreach Task.
7. Run policy, Landed Cost, Strategy, and Decision functions.
8. Persist the ready Decision and its Event when both checks pass.

`DeterministicCaseRunner` runs synchronously. Its receipt is `deterministic:<case_id>:<revision>` and contains no fabricated Devin URL.

Recorded provider output is the only provider fake. It passes through the same defensive normalizer as CALL-E output.

A malformed result becomes a confidence-zero Claim. Missing answer-sheet values stay `unknown`; missing stock state becomes `unclear`.

Claims below `0.40` remain persisted and public. They cannot influence checks, Landed Cost, Strategy, or Decision output.

## Backend Case API

The Cockpit will use only these public Case routes:

```text
POST /cases
GET /cases
GET /cases/{case_id}
GET /cases/{case_id}/events?since=N
POST /cases/{case_id}/decision/approve
```

The contracts derive from PR 22 Pydantic models. Pydantic also generates JSON Schema and TypeScript.

All monetary values use exact `Decimal` arithmetic. JSON emits decimal text, never a binary float.

Operational Case state lives in `apps/api/backend/casestore/cases.db` by default. The trusted ERP database remains separate.

The Case database stores Incident snapshots, Candidates, Outreach Tasks, Claims, Decisions, and Events. Rebuilding ERP seed data does not delete Cases.

SQLite assigns each Event `seq` once inside a write transaction. State and its matching Event commit together.

The Event cursor is exclusive. `?since=7` returns only Events where `seq > 7`, ordered by `seq`.

Reads never merge memory Events or renumber stored Events. `last_event_seq` is read with the snapshot.

## Public safety and approval

Public routes use explicit safe projections. They never dump internal provider models directly.

Public Claims exclude raw provider output, call IDs, provider storage URLs, and notes. Claims remain separate from trusted Supplier Records.

Public Supplier Records exclude email and marketplace URLs. Public Decisions and summaries exclude pull-request URLs.

Event payload keys are allowlisted. Public free text is recursively scrubbed for phone, email, and secret-like values.

A Decision becomes `ready` only after policy and cost checks pass. A human approves one exact revision in SupplyOS.

Approval updates the Decision and appends one `human` Event atomically. An identical retry appends no second Event.

Approved is final. Approval never places an order.

## Backend CASE-001 result

The recorded backend rehearsal computes this result:

- Part `6204-2RS`; Munich and Stuttgart plants.
- Required 40,000; on hand 8,000; shortfall 32,000.
- Five Candidates and four Claims.
- Shenzhen fails only `blocked_origin_country`.
- Munich Motion reports `in_stock_allocated` and is not selected.
- The Strategy orders 6,400 SKF units by air.
- The Strategy orders 25,600 FAG units by sea.
- The computed total is `"94880.00"`.
- Revision 1 starts `ready` with both checks passed.

The backend does not load a prebuilt Decision fixture. It computes the accepted Strategy from recorded provider results.

## Cockpit fixture runtime sequence

The client uses fixed CASE-001 data, fixed tool results, fixed timing, and a timer state machine.

1. `CockpitChat` mounts `useDeterministicRehearsal` in `streaming` status.
2. Each script step shows a pending Tool when it has an HTTP method and path.
3. The step waits for its fixed `waitMs` value.
4. Its tool result becomes complete and its assistant summary streams three characters every 32 ms.
5. Its structured extras appear when the summary is complete.
6. The state machine settles for 260 ms, then advances to the next step.
7. The final step changes the run to `complete`.
8. The completed turns collapse into one summary, with the recommendation below it.

The fixed waits total 20,350 ms. The eleven settle periods add 2,860 ms. Text time is `ceil(summary.length / 3) * 32 ms` per step.

| Step        | Surface                      | Fixed wait |
| ----------- | ---------------------------- | ---------: |
| `part`      | `GET /tools/part/6204-2RS`   |     550 ms |
| `stock`     | `GET /tools/stock`           |     850 ms |
| `suppliers` | `GET /tools/suppliers`       |   1,200 ms |
| `prices`    | `GET /tools/price_history`   |     650 ms |
| `policy`    | `GET /tools/policy`          |   1,050 ms |
| `outreach`  | `POST /tools/outreach`       |   4,200 ms |
| `claims`    | Four fixture Claims          |   5,200 ms |
| `deltas`    | Claim versus Supplier Record |   1,100 ms |
| `strategy`  | Strategy search              |   2,600 ms |
| `tests`     | Fixture test result          |   2,300 ms |
| `decision`  | Fixture Decision             |     650 ms |

Composer submission has one separate fixed delay: `SEND_DELAY_MS` is 1,500 ms. Submission trims the draft, clears it immediately, shows the shadcn `Spinner`, and appends the local user message after the delay. It does not create an assistant response.

## Stop and replay behavior

The composer maps rehearsal status to the AI SDK `ChatStatus` vocabulary:

- `submitted` shows the spinner during the 1.5-second local send.
- `streaming` shows the square stop icon and calls `rehearsal.stop()`.
- `ready` shows the arrow submit icon.

Stopping changes the state to `stopped`. React effect cleanup clears the current timeout. Completed turns remain. Partial assistant text remains when text had started. A pending step that produced no result disappears. No server process or network request exists to abort.

Replay resets the state to the first pending step. When reduced motion is requested, Replay reveals the completed fixture immediately.

## Deterministic source files

| File                                   | Temporary responsibility                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/web/lib/case-001/script.ts`               | Script order, text, tool labels, all timing constants, and the 1.5-second send delay |
| `apps/web/lib/case-001/types.ts`                | Fixture-only script, Claim, call, and status types                                   |
| `apps/web/lib/case-001/incident.ts`             | Fixed Incident and mock Session rows                                                 |
| `apps/web/lib/case-001/supplier-records.ts`     | Fixed trusted Supplier Records                                                       |
| `apps/web/lib/case-001/claims.ts`               | Fixed supplier Claims                                                                |
| `apps/web/lib/case-001/outreach-tasks.ts`       | Fixed Outreach Tasks                                                                 |
| `apps/web/lib/case-001/calls.ts`                | Fixed call state, evidence, and transcripts                                          |
| `apps/web/lib/case-001/candidates.ts`           | Fixed Candidate comparisons and Landed Cost rows                                     |
| `apps/web/lib/case-001/decision.ts`             | Fixed Strategies and Decision                                                        |
| `apps/web/lib/case-001/index.ts`                | Re-exports the entire CASE-001 fixture boundary                                      |
| `apps/web/hooks/use-deterministic-rehearsal.ts` | Timer state machine, incremental text, stop, and replay                              |
| `apps/web/components/cockpit/cockpit-chat.tsx`  | Connects fixture playback to the Cockpit and delays local message submission         |

## Fixture-bound UI consumers

These files are presentational, but currently import CASE-001 directly:

- Run: `assistant-turn.tsx`, `run-status-button.tsx`, and `incident-request-message.tsx`.
- Incident: `incident-header.tsx` and `session-sidebar.tsx`.
- Candidates: `candidate-panel.tsx`, `candidate-comparison.tsx`, `candidate-status.ts`, and `candidate-types.ts`.
- Calls: `call-detail-dialog.tsx`, `call-layout.tsx`, `call-stage.tsx`, `call-history.tsx`, `call-claim.tsx`, and `call-transcript.tsx`.
- Decision: `decision-bar.tsx`.

All paths above are relative to `apps/web/components/cockpit/`.

## Backend integration and live Devin replacement

1. Replace `useDeterministicRehearsal` with a mapper over the public Case snapshot and Event feed.
2. Drive `MessageComposer` from the live `status`, `sendMessage`, and `stop` values.
3. Map live messages and tool parts into `AssistantTurn`, or render AI SDK parts directly.
4. Pass live Incident, Candidate, Claim, call, Strategy, and Decision data into the fixture-bound consumers.
5. Submit approval with `decision_revision` and `approved_by`; do not recompute approval state.
6. Delete `apps/web/lib/case-001/` and `apps/web/hooks/use-deterministic-rehearsal.ts` after no imports remain.

Do not delete `apps/web/components/ui/spinner.tsx` or the generic `PromptInputSubmit` status behavior. They match the live transport states and are not deterministic logic.

The UI maps snake-case public models into presentation models. It does not recalculate policy, Landed Cost, Strategy, Event order, or approval.

Replay stays a presentation action. It must not mutate the persisted Case or its approved Decision.

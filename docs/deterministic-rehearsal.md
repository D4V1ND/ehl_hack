# Deterministic CASE-001 rehearsal

This document is the deletion map for the fixture-driven Cockpit. It records every deterministic boundary that a live Devin Session must replace.

The rehearsal makes no network request. It uses fixed CASE-001 data, fixed tool results, fixed timing, and a client-side timer state machine. The generic chat primitives, shadcn `Spinner`, and composer status UI are not rehearsal-specific and can stay.

## Exact runtime sequence

1. `CockpitChat` mounts `useDeterministicRehearsal` in `streaming` status.
2. Each script step shows a pending Tool when it has an HTTP method and path.
3. The step waits for its fixed `waitMs` value.
4. Its tool result becomes complete and its assistant summary streams three characters every 32 ms.
5. Its structured extras appear when the summary is complete.
6. The state machine settles for 260 ms, then advances to the next step.
7. The final step changes the run to `complete`.

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
| `lib/case-001/script.ts`               | Script order, text, tool labels, all timing constants, and the 1.5-second send delay |
| `lib/case-001/types.ts`                | Fixture-only script, Claim, call, and status types                                   |
| `lib/case-001/incident.ts`             | Fixed Incident and mock Session rows                                                 |
| `lib/case-001/supplier-records.ts`     | Fixed trusted Supplier Records                                                       |
| `lib/case-001/claims.ts`               | Fixed supplier Claims                                                                |
| `lib/case-001/outreach-tasks.ts`       | Fixed Outreach Tasks                                                                 |
| `lib/case-001/calls.ts`                | Fixed call state, evidence, and transcripts                                          |
| `lib/case-001/candidates.ts`           | Fixed Candidate comparisons and Landed Cost rows                                     |
| `lib/case-001/decision.ts`             | Fixed Strategies and Decision                                                        |
| `lib/case-001.ts`                      | Re-exports the entire CASE-001 fixture boundary                                      |
| `hooks/use-deterministic-rehearsal.ts` | Timer state machine, incremental text, stop, and replay                              |
| `components/cockpit/cockpit-chat.tsx`  | Connects fixture playback to the Cockpit and delays local message submission         |

## Fixture-bound UI consumers

These files are presentational, but currently import CASE-001 directly:

- Run: `assistant-turn.tsx`, `run-status-button.tsx`, and `incident-request-message.tsx`.
- Incident: `incident-header.tsx` and `session-sidebar.tsx`.
- Candidates: `candidate-panel.tsx`, `candidate-comparison.tsx`, `candidate-status.ts`, and `candidate-types.ts`.
- Calls: `call-detail-dialog.tsx`, `call-layout.tsx`, `call-stage.tsx`, `call-history.tsx`, `call-claim.tsx`, and `call-transcript.tsx`.
- Decision: `decision-bar.tsx`.

All paths above are relative to `components/cockpit/`.

## Live Devin replacement

1. Replace `useDeterministicRehearsal` with the Devin Session transport and event stream.
2. Drive `MessageComposer` from the live `status`, `sendMessage`, and `stop` values.
3. Map live messages and tool parts into `AssistantTurn`, or render AI SDK parts directly.
4. Pass live Incident, Candidate, Claim, call, Strategy, and Decision data into the fixture-bound consumers.
5. Delete `lib/case-001.ts`, `lib/case-001/`, and `hooks/use-deterministic-rehearsal.ts` after no imports remain.

Do not delete `components/ui/spinner.tsx` or the generic `PromptInputSubmit` status behavior. They match the live transport states and are not deterministic logic.

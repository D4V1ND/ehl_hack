# To-do: the pitch video and the checklist behind it

The pitch is a screen recording that pauses for one real phone call. Everything
below is scoped to that, ordered by what breaks the video if it is missing.

## The shape of the video

1. ERP inventory screen: a part is running out next month, nothing scheduled,
   the incumbent cannot deliver. Press **Source this part**.
2. The cockpit checklist ticks itself: incident read → part data pulled → stock,
   open POs, price history → suppliers listed → each supplier screened by name,
   with the rule that rejected the ones that fail.
3. The checklist fans out: one line per supplier being called, several at once.
4. **Stop the recording here.** Run the call script by hand, one of us answers,
   ~30 s of conversation with CALL-E, hang up.
5. Resume: the remaining supplier answers are rehearsed, the claims are
   normalised, every single-source and split plan is priced.
6. End on the ranked shortlist. A human buyer picks. Nothing is ordered.

---

## P0 — the video cannot be recorded without these

- [x] Fixed checklist: eight headers, eleven seeded steps, same on every case.
- [x] Dynamic per-supplier steps the agent creates itself
      (`screening:<REF>`, `outreach:<REF>`), idempotent on `step_id`.
- [x] `GET /cases/{id}/plan` read model with derived section status and a
      done/total count.
- [x] `POST /tools/plan/step` and `POST /tools/plan/steps` (the bulk/fan-out
      call), both returning the whole plan.
- [x] Seed the checklist when `POST /cases` opens a case, so the screen shows
      the work ahead before anything happens.
- [x] The deterministic run (`backend/flow/conductor.py`) ticks the same list,
      so the on-stage path and the agent path produce the same screen.
- [x] Devin's prompt names the step ids and the dynamic naming convention.
- [x] `hold_for` leaves the live-call supplier's line `active` — the frame the
      video pauses on.
- [x] Checklist rendered in the cockpit: sections, per-supplier rows, progress
      bar, spinner on the active line.
- [x] Plan fixtures exported (`ui/lib/fixtures/CASE-00{1,2}.plan.json`) so the
      cockpit shows a full checklist with the backend switched off.
- [ ] **Record a dry run end to end** and watch for a step that never ticks.
      That is the only test that matters before tomorrow.

## P1 — the video is noticeably worse without these

- [ ] Pace the fan-out. The deterministic run finishes in 0.4 s, so all the
      supplier lines appear in one frame. Either record the Devin session (slow
      but real) or add a `?pace_ms=` delay to `/flow/run` used for recording only.
- [ ] Mock the supplier answers that are *not* the live call so the prices on
      screen are plausible and differ from each other
      (`backend/flow/rehearsal.py` already produces these — review the numbers
      once and fix any that look invented).
- [ ] Write the exact live-call handoff into the run sheet: which case, which
      supplier is held, which script places the call, what to say, where the
      recording resumes.
- [ ] Verify the resume point: after `POST /flow/collect`, the held supplier's
      line flips to `done` with the real answer in `detail`.
- [ ] A visible "waiting for the buyer" end state — the review step done, the
      approval gate explicitly *not* crossed.

## P2 — polish, only if the P0/P1 list is clear

- [ ] Checklist animations: staggered fade-in per new line, a check that draws
      itself, the progress bar easing. CSS first.
- [ ] Remotion for the title/outro cards and to smooth the cut around the phone
      call. Do not rebuild the checklist in Remotion — record the real one.
- [ ] Elapsed time per step, from `started_at`/`completed_at` (already stored).
- [ ] Sound design on the tick.
- [ ] Collapse the ERP section once it is done, so the screen stays short.

## P3 — after the pitch

- [ ] Child sessions: one per supplier, screened and called in parallel. The
      checklist already supports it (that is what the bulk endpoint is for);
      what is missing is the fan-out in the session itself.
- [ ] Mirror the Devin session's own messages into the event log via polling
      `GET /v1/sessions/{id}` — there is no verified stream for session
      messages, so polling is the honest option.
- [ ] Waiver path: when nothing compliant can cover the shortage, rank the
      excluded suppliers too, with the rule each fails and what a waiver costs
      against a line stop.
- [ ] Per-part-class checklists (a microcontroller case wants different steps
      from a bearing case).
- [ ] Persist plans somewhere other than the case directory if more than one
      backend process ever serves the same case.

## Known limits, stated on purpose

- CALL-E took ~18 minutes to return a result in testing. Nothing in the video
  may depend on a call result landing in time; the live segment is the
  conversation, not the data.
- A live Devin session takes tens of minutes and costs ACU. It belongs in the
  recorded part. The on-stage path is deterministic and sub-second.
- `npm run lint` reports three pre-existing `react-hooks/set-state-in-effect`
  errors (cockpit page, countdown, use-events). Not introduced here, not fixed
  here.

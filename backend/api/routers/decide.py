"""Screening and the decision, as two endpoints a Devin session can call.

`POST /tools/screen` answers "who may we buy from, and why not the others".
`POST /tools/decide` prices the plans, picks one, and writes the review package
into the case directory. Both are idempotent: calling `decide` again after a
round of calls rewrites the artifacts from whatever is currently known, which is
exactly the loop the session runs.

Neither endpoint places an order. The output is markdown a human approves by
merging.
"""

from __future__ import annotations

import time
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.deps import erp, settings, store
from backend.api.settings import Settings
from backend.casestore.case_store import CaseStore
from backend import settings as runtime_settings
from backend.decide.run import run, single_source_blockers
from backend.flow.collect import collect_quotes, wait_for_pending_calls
from backend.policy.screen import screen
from backend.publish.github_pr import publish
from backend.launch.resolve import resolve_incident
from backend.record.ports import SystemOfRecord
from backend.store import STORE
from packages.contracts.enums import Level, Stage, Actor
from packages.contracts.models import Candidate, Decision

router = APIRouter(prefix="/tools", tags=["devin-tools"])

# The demo's "now", same constant the cockpit reads. A real deployment reads the
# clock; a demo cannot, because the seeded line-stop date is fixed.
TODAY = date(2026, 8, 22)


@router.post(
    "/screen",
    response_model=list[Candidate],
    summary="Apply the policy rules to every approved supplier for a case",
)
def post_screen(
    case_id: str,
    today: date = Query(default=TODAY, description="Demo clock. Defaults to the seeded date."),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
) -> list[Candidate]:
    incident = resolve_incident(case_id, records, cases)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"no incident {case_id}")
    part = records.get_part(incident.part_id)
    if part is None:
        raise HTTPException(status_code=404, detail=f"no part {incident.part_id}")

    candidates = screen(
        case_id=case_id,
        suppliers=records.get_suppliers_for_part(incident.part_id),
        part=part,
        profile=records.get_company_profile(),
        today=today,
        claims={c.supplier_ref: c for c in cases.read_claims(case_id)},
    )
    cases.write_candidates(case_id, candidates)
    return candidates


@router.get(
    "/single_source_blockers",
    summary="Which suppliers cannot cover the case alone in time, by rule",
)
def get_single_source_blockers(
    case_id: str,
    today: date = Query(default=TODAY),
    records: SystemOfRecord = Depends(erp),
) -> dict[str, list[str]]:
    """The fourth policy rule. It is about an order, not a supplier, which is why
    it is reported here rather than on a candidate."""
    return single_source_blockers(case_id=case_id, records=records, today=today)


@router.post(
    "/decide",
    response_model=Decision,
    summary="Price the plans, pick one, and write the review package",
)
def post_decide(
    case_id: str,
    today: date = Query(default=TODAY),
    devin_session_url: str | None = Query(default=None),
    wait_for_calls: bool = Query(default=True),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
    config: Settings = Depends(settings),
) -> Decision:
    """Writes `policy_report.md`, `cost_report.md`, `decision.md`, `po_draft.md`
    and `decision.json` under the case directory, and logs one event.

    Safe before any call has come back: with no claims it decides on our own
    files alone and says so in the artifacts.
    """
    if wait_for_calls:
        pending = STORE.pending_calls(case_id, float("inf"))
        if config.live_calls_enabled and not pending:
            deadline = time.monotonic() + runtime_settings.LIVE_CALL_GRACE
            while time.monotonic() < deadline and not STORE.pending_calls(case_id, float("inf")):
                time.sleep(min(1.0, deadline - time.monotonic()))
        elapsed, timed_out, _, still_pending = wait_for_pending_calls(
            case_id, timeout_s=runtime_settings.CALL_WAIT_TIMEOUT
        )
        if timed_out:
            suppliers = ", ".join(entry["supplier_ref"] for entry in still_pending)
            cases.append_event(
                case_id,
                actor=Actor.DEVIN,
                stage=Stage.COSTING,
                level=Level.WARN,
                message=(
                    "decision priced without supplier answer"
                    + (f": {suppliers}" if suppliers else "")
                ),
                payload={"still_pending": still_pending, "waited_s": elapsed},
            )
        try:
            collect_quotes(case_id=case_id, records=records, cases=cases, today=today)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        outcome = run(
            case_id=case_id,
            records=records,
            cases=cases,
            today=today,
            devin_session_url=devin_session_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return outcome.decision


@router.post("/publish_pr", summary="File the decided case as a pull request")
def post_publish_pr(
    case_id: str,
    today: date = Query(default=TODAY),
    wait_for_calls: bool = Query(default=True),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
    config: Settings = Depends(settings),
) -> dict[str, object]:
    """The last step of the flow, and the only human gate: merging is approving.

    With `GITHUB_TOKEN`/`GITHUB_REPO` unset this is a rehearsal and returns the
    branch, file list and body it would have pushed, with `pr_url: null`.
    """
    if wait_for_calls:
        pending = STORE.pending_calls(case_id, float("inf"))
        if config.live_calls_enabled and not pending:
            deadline = time.monotonic() + runtime_settings.LIVE_CALL_GRACE
            while time.monotonic() < deadline and not STORE.pending_calls(case_id, float("inf")):
                time.sleep(min(1.0, deadline - time.monotonic()))
        elapsed, timed_out, _, still_pending = wait_for_pending_calls(
            case_id, timeout_s=runtime_settings.CALL_WAIT_TIMEOUT
        )
        if timed_out:
            suppliers = ", ".join(entry["supplier_ref"] for entry in still_pending)
            cases.append_event(
                case_id,
                actor=Actor.DEVIN,
                stage=Stage.COSTING,
                level=Level.WARN,
                message=(
                    "decision priced without supplier answer before publishing"
                    + (f": {suppliers}" if suppliers else "")
                ),
                payload={"still_pending": still_pending, "waited_s": elapsed},
            )
        try:
            collect_quotes(case_id=case_id, records=records, cases=cases, today=today)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        result = publish(
            case_id=case_id,
            cases=cases,
            token=config.github_token,
            repo=config.github_repo,
            base=config.github_base_branch,
            today=today,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "case_id": result.case_id,
        "pr_url": result.pr_url,
        "branch": result.branch,
        "files": result.files,
        "title": result.title,
        "dry_run": result.dry_run,
        "reason": result.reason,
        "warnings": result.warnings,
    }

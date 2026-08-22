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

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.deps import erp, store
from backend.casestore.case_store import CaseStore
from backend.decide.run import run, single_source_blockers
from backend.policy.screen import screen
from backend.record.ports import SystemOfRecord
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
    incident = records.get_incident(case_id)
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
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
) -> Decision:
    """Writes `policy_report.md`, `cost_report.md`, `decision.md`, `po_draft.md`
    and `decision.json` under the case directory, and logs one event.

    Safe before any call has come back: with no claims it decides on our own
    files alone and says so in the artifacts.
    """
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

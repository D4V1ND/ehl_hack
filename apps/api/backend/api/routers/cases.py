"""The UI read API.

Everything the cockpit needs, joined server-side, so the frontend never has to
stitch two responses together. The event feed is the only endpoint it polls.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.api.deps import case_module, erp, store
from backend.cases.module import (
    ApproveDecisionCommand,
    CaseConflictError,
    CaseMissingError,
    CaseModule,
    OpenCaseCommand,
    PartMissingError,
)
from packages.contracts.enums import Stage
from packages.contracts.models import (
    ApproveDecisionRequest,
    OpenCaseRequest,
    OpenCaseResponse,
    PublicCaseSnapshot,
    PublicCaseSummary,
    PublicEvent,
    ShortageAlert,
)
from backend.record.ports import SystemOfRecord
from backend.casestore.case_store import CaseStore

router = APIRouter(tags=["cockpit"])

TODAY = date(2026, 8, 22)  # the demo's "now". Real deployments read the clock.


@router.get("/dashboard/shortages", response_model=list[ShortageAlert], summary="Parts at risk, worst first")
def get_shortages(records: SystemOfRecord = Depends(erp), cases: CaseStore = Depends(store)) -> list[ShortageAlert]:
    """Everything below its reorder point, or covered by a PO that has slipped past its need date.

    This is the same scan the shortage detector (B4) runs; here it just renders
    instead of launching a session.
    """
    incidents = {i.part_id: i for i in records.list_incidents()}
    delayed_pos = {po.part_id: po for po in records.get_open_pos() if po.is_delayed}
    known_cases = set(cases.list_case_ids())

    alerts: list[ShortageAlert] = []
    for stock in records.list_stock():
        part = records.get_part(stock.part_id)
        if part is None:
            continue
        incident = incidents.get(stock.part_id)
        below_reorder = stock.available_qty < stock.reorder_level
        if not below_reorder and incident is None:
            continue

        cover_days = stock.available_qty / stock.daily_consumption if stock.daily_consumption else 999.0
        line_stop_at = (
            incident.line_stop_at
            if incident
            else datetime.combine(TODAY, datetime.min.time()).replace(tzinfo=timezone.utc)
        )
        alerts.append(
            ShortageAlert(
                part_id=part.part_id,
                item_code=part.item_code,
                item_name=part.item_name,
                plant_id=stock.plant_id,
                qty_on_hand=stock.actual_qty,
                reorder_level=stock.reorder_level,
                qty_required=incident.qty_required if incident else stock.reorder_level * 4,
                days_to_line_stop=round(cover_days, 1),
                line_stop_at=line_stop_at,
                line_stop_cost_per_hour=(
                    incident.line_stop_cost_per_hour if incident else part.standard_cost * 100
                ),
                criticality=part.criticality,
                case_id=(incident.case_id if incident and incident.case_id in known_cases else None),
                delayed_po_id=delayed_pos[part.part_id].po_id if part.part_id in delayed_pos else None,
            )
        )

    return sorted(alerts, key=lambda a: a.days_to_line_stop)


@router.post(
    "/cases",
    response_model=OpenCaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Open and run a Case",
)
def open_case(
    body: OpenCaseRequest, module: CaseModule = Depends(case_module)
) -> OpenCaseResponse:
    try:
        result = module.open_case(
            OpenCaseCommand(
                part_id=body.part_id,
                qty_required=body.qty_required,
                needed_by=body.needed_by,
                case_id=body.case_id,
            )
        )
    except PartMissingError as error:
        raise HTTPException(status_code=404, detail=f"no part {error}") from error
    except CaseConflictError as error:
        raise HTTPException(status_code=409, detail=f"case already exists: {error}") from error
    return OpenCaseResponse(
        case_id=result.case_id,
        incident=result.incident,
        session_id=result.session_id,
        session_url=result.session_url,
        stubbed=result.stubbed,
        session_error=result.session_error,
    )


@router.get(
    "/cases", response_model=list[PublicCaseSummary], summary="Every persisted Case"
)
def list_cases(module: CaseModule = Depends(case_module)) -> list[PublicCaseSummary]:
    return module.list_cases()


@router.get(
    "/cases/{case_id}", response_model=PublicCaseSnapshot, summary="One persisted Case snapshot"
)
def get_case(
    case_id: str, module: CaseModule = Depends(case_module)
) -> PublicCaseSnapshot:
    try:
        return module.get_case(case_id)
    except CaseMissingError as error:
        raise HTTPException(status_code=404, detail=f"no case {case_id}") from error


@router.get(
    "/cases/{case_id}/events",
    response_model=list[PublicEvent],
    summary="Append-only feed. Poll with ?since=",
)
def get_events(
    case_id: str,
    since: int = Query(default=0, ge=0),
    module: CaseModule = Depends(case_module),
) -> list[PublicEvent]:
    try:
        return module.get_events(case_id, since)
    except CaseMissingError as error:
        raise HTTPException(status_code=404, detail=f"no case {case_id}") from error


@router.post(
    "/cases/{case_id}/decision/approve",
    response_model=PublicCaseSnapshot,
    summary="Mark one checked Decision revision approved",
)
def approve_decision(
    case_id: str,
    body: ApproveDecisionRequest,
    module: CaseModule = Depends(case_module),
) -> PublicCaseSnapshot:
    try:
        return module.approve_decision(
            case_id,
            ApproveDecisionCommand(
                decision_revision=body.decision_revision,
                approved_by=body.approved_by,
            ),
        )
    except CaseMissingError as error:
        raise HTTPException(status_code=404, detail=f"no ready Decision for {case_id}") from error
    except CaseConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

"""The UI read API.

Everything the cockpit needs, joined server-side, so the frontend never has to
stitch two responses together. The event feed is the only endpoint it polls.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.deps import erp, store
from packages.contracts.models import (
    CaseSnapshot,
    CaseSummary,
    Event,
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


@router.get("/cases", response_model=list[CaseSummary], summary="Every case on disk")
def list_cases(records: SystemOfRecord = Depends(erp), cases: CaseStore = Depends(store)) -> list[CaseSummary]:
    summaries: list[CaseSummary] = []
    for case_id in cases.list_case_ids():
        incident = records.get_incident(case_id)
        if incident is None:
            continue
        part = records.get_part(incident.part_id)
        events = cases.read_events(case_id)
        decision = cases.read_decision(case_id)
        summaries.append(
            CaseSummary(
                case_id=case_id,
                part_id=incident.part_id,
                item_name=part.item_name if part else incident.part_id,
                stage=events[-1].stage if events else cases.current_stage(case_id),
                qty_required=incident.qty_required,
                line_stop_at=incident.line_stop_at,
                opened_at=events[0].ts if events else datetime.now(timezone.utc),
                pr_url=decision.pr_url if decision else None,
            )
        )
    return summaries


@router.get("/cases/{case_id}", response_model=CaseSnapshot, summary="Everything the case page needs, in one response")
def get_case(case_id: str, records: SystemOfRecord = Depends(erp), cases: CaseStore = Depends(store)) -> CaseSnapshot:
    incident = records.get_incident(case_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"no case {case_id}")
    part = records.get_part(incident.part_id)
    if part is None:
        raise HTTPException(status_code=500, detail=f"case {case_id} references unknown part {incident.part_id}")

    profile = records.get_company_profile()
    candidates = cases.read_candidates(case_id)
    supplier_ids = {c.supplier_id for c in candidates} or {
        s.supplier_id for s in records.get_suppliers_for_part(incident.part_id)
    }
    decision = cases.read_decision(case_id)
    events = cases.read_events(case_id)

    return CaseSnapshot(
        case_id=case_id,
        stage=events[-1].stage if events else cases.current_stage(case_id),
        incident=incident,
        part=part,
        profile_summary={
            "legal_entity": profile.legal_entity,
            "blocked_origin_countries": profile.blocked_origin_countries,
            "required_certifications": [
                c for c in profile.required_certifications.get(part.part_class, [])
            ],
            "audit_required_above_criticality": profile.audit_required_above_criticality.value,
            "wacc": profile.wacc,
        },
        candidates=candidates,
        supplier_records=[s for sid in sorted(supplier_ids) if (s := records.get_supplier(sid))],
        outreach_tasks=cases.read_outreach_tasks(case_id),
        claims=cases.read_claims(case_id),
        decision=decision,
        devin_session_url=decision.devin_session_url if decision else None,
        last_event_seq=events[-1].seq if events else 0,
    )


@router.get("/cases/{case_id}/events", response_model=list[Event], summary="Append-only feed. Poll with ?since=")
def get_events(case_id: str, since: int = Query(default=0, ge=0), cases: CaseStore = Depends(store)) -> list[Event]:
    if not cases.exists(case_id):
        raise HTTPException(status_code=404, detail=f"no case {case_id}")
    return cases.read_events(case_id, since=since)


@router.get("/cases/{case_id}/artifacts", summary="The files this case has produced")
def get_artifacts(case_id: str, cases: CaseStore = Depends(store)) -> dict:
    if not cases.exists(case_id):
        raise HTTPException(status_code=404, detail=f"no case {case_id}")
    return {"case_id": case_id, "artifacts": cases.list_artifacts(case_id)}


@router.get("/cases/{case_id}/artifacts/{name:path}", summary="One artifact, raw")
def get_artifact(case_id: str, name: str, cases: CaseStore = Depends(store)) -> dict:
    body = cases.read_artifact(case_id, name)
    if body is None:
        raise HTTPException(status_code=404, detail=f"no artifact {name} in {case_id}")
    return {"case_id": case_id, "name": name, "body": body}

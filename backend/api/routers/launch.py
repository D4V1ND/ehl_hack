"""Opening a case, from the inventory screen.

`GET /inventory` is the trigger list: every part in the item master with what is
in the bin, how many days of cover that is, and whether a case is already open.
`POST /cases` opens one for whichever row the human clicked, derives the shortage
from the records, and starts the Devin session that works it.

The session is started, not awaited. A sourcing run takes minutes; the browser
gets the case id and the session URL immediately and then watches the event feed.
"""

from __future__ import annotations

import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from backend import plan
from backend.api.deps import erp, store
from backend.casestore.case_store import CaseStore
from backend.launch.devin import start_session
from backend.launch.incident import incident_for_part
from backend.record.ports import SystemOfRecord
from packages.contracts.enums import Actor, Level, Stage
from packages.contracts.models import Incident, StockLevel

router = APIRouter(tags=["launcher"])

TODAY = date(2026, 8, 22)  # the demo's "now". Real deployments read the clock.


class InventoryRow(BaseModel):
    """One triggerable part. Everything the button needs and nothing else."""

    part_id: str
    item_code: str
    item_name: str
    part_class: str
    criticality: str
    plant_id: str
    on_hand: int
    reorder_level: int
    daily_consumption: int
    days_of_cover: float | None
    below_reorder: bool
    delayed_po: str | None
    suppliers: int
    open_case_id: str | None


class OpenCaseRequest(BaseModel):
    part_id: str
    qty_required: int | None = None
    needed_by: date | None = None
    case_id: str | None = None


class OpenCaseResponse(BaseModel):
    case_id: str
    incident: Incident
    session_id: str
    session_url: str
    stubbed: bool
    session_error: str | None = None


def _backend_base_url(request: Request) -> str:
    """What the session should call back on.

    Behind the demo tunnel the request URL is localhost, so an explicit
    `PUBLIC_BASE_URL` wins — Devin cannot reach our laptop otherwise.
    """
    configured = os.environ.get("PUBLIC_BASE_URL", "").strip() or os.environ.get(
        "DEVIN_BACKEND_BASE_URL", ""
    ).strip()
    return (configured or str(request.base_url)).rstrip("/")


@router.get("/inventory", response_model=list[InventoryRow], summary="Every part we could open a case for")
def get_inventory(
    records: SystemOfRecord = Depends(erp), cases: CaseStore = Depends(store)
) -> list[InventoryRow]:
    """The whole item master, thinnest cover first.

    Not only the parts already at risk: the point is that any part can be
    triggered, so the screen shows the whole inventory and lets the human decide
    what is urgent.
    """
    # One row per part: the bin that runs out first is the one with a problem.
    stock_by_part: dict[str, StockLevel] = {}
    for level in records.list_stock():
        current = stock_by_part.get(level.part_id)
        if current is None or level.available_qty < current.available_qty:
            stock_by_part[level.part_id] = level

    delayed = {po.part_id: po.po_id for po in records.get_open_pos() if po.is_delayed}
    seeded = {i.part_id: i.case_id for i in records.list_incidents()}
    open_cases: dict[str, str] = dict(seeded)
    for case_id in cases.list_case_ids():
        incident = cases.read_incident(case_id)
        if incident is not None:
            open_cases[incident.part_id] = case_id

    rows: list[InventoryRow] = []
    for part in records.list_parts():
        level = stock_by_part.get(part.part_id)
        on_hand = level.available_qty if level is not None else 0
        take = level.daily_consumption if level is not None else 0
        reorder = level.reorder_level if level is not None else 0
        rows.append(
            InventoryRow(
                part_id=part.part_id,
                item_code=part.item_code,
                item_name=part.item_name,
                part_class=part.part_class.value,
                criticality=part.criticality.value,
                plant_id=level.plant_id if level is not None else "",
                on_hand=on_hand,
                reorder_level=reorder,
                daily_consumption=take,
                days_of_cover=round(on_hand / take, 1) if take else None,
                below_reorder=on_hand < reorder,
                delayed_po=delayed.get(part.part_id),
                suppliers=len(records.get_suppliers_for_part(part.part_id)),
                open_case_id=open_cases.get(part.part_id),
            )
        )
    rows.sort(key=lambda r: (r.days_of_cover if r.days_of_cover is not None else 9_999.0))
    return rows


@router.post("/cases", response_model=OpenCaseResponse, status_code=201, summary="Open a case for a part and launch Devin")
def open_case(
    body: OpenCaseRequest,
    request: Request,
    today: date = Query(default=TODAY, description="Demo clock. Defaults to the seeded date."),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
) -> OpenCaseResponse:
    try:
        incident = incident_for_part(
            records=records,
            part_id=body.part_id,
            case_id=body.case_id,
            qty_required=body.qty_required,
            needed_by=body.needed_by,
            today=today,
            existing_cases=set(cases.list_case_ids()),
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    part = records.get_part(incident.part_id)
    if part is None:  # unreachable: incident_for_part already resolved it
        raise HTTPException(status_code=404, detail=f"no part {incident.part_id}")

    cases.write_incident(incident)
    # The checklist exists from the first second, all pending: the cockpit shows
    # the work ahead before anything has happened.
    plan.seed(incident.case_id, cases)
    cases.append_event(
        case_id=incident.case_id,
        actor=Actor.SYSTEM,
        stage=Stage.DETECTED,
        message=(
            f"{part.item_code} — {incident.shortfall:,} short of {incident.qty_required:,} by "
            f"{incident.needed_by}. {incident.reason}"
        ),
        level=Level.WARN,
        payload={
            "part_id": incident.part_id,
            "item_name": part.item_name,
            "part_class": part.part_class.value,
            "criticality": part.criticality.value,
            "plant_id": incident.plant_id,
            "production_line": incident.production_line,
            "qty_required": incident.qty_required,
            "qty_on_hand": incident.qty_on_hand,
            "needed_by": incident.needed_by.isoformat(),
            "line_stop_at": incident.line_stop_at.isoformat(),
            "line_stop_cost_per_hour": str(incident.line_stop_cost_per_hour),
            "incumbent_supplier_id": incident.incumbent_supplier_id,
        },
    )

    base_url = _backend_base_url(request)
    session = start_session(incident, part, base_url)
    cases.append_event(
        case_id=incident.case_id,
        actor=Actor.SYSTEM,
        stage=Stage.RESEARCHING,
        message=(
            f"Devin session {session.session_id} started on {base_url}"
            if not session.stubbed
            else f"No DEVIN_API_KEY — stub session {session.session_id}. The case is open and can be run by hand."
        ),
        level=Level.WARN if session.stubbed else Level.INFO,
        payload={
            "session_id": session.session_id,
            "session_url": session.session_url,
            "stubbed": session.stubbed,
            "backend_base_url": base_url,
            "error": session.error,
        },
    )

    return OpenCaseResponse(
        case_id=incident.case_id,
        incident=incident,
        session_id=session.session_id,
        session_url=session.session_url,
        stubbed=session.stubbed,
        session_error=session.error,
    )

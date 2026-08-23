"""Detect shortages from trusted system-of-record signals.

Two signals, both read straight off the system of record:

1. available stock has fallen below the reorder point, or
2. an open PO has been revised to land after the date the stock runs out.

Either signal can open a case directory and write the first event. This module
calls a launch hook and stops there, keeping detection independent from the
workflow that handles an opened case.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Callable

from packages.contracts.enums import Actor, Level, Stage
from packages.contracts.models import Incident
from supplyos_api.deps import erp as default_record
from supplyos_api.record.ports import SystemOfRecord
from supplyos_api.casestore.case_store import CaseStore, get_case_store

TODAY = date(2026, 8, 22)  # the demo's "now". A real deployment reads the clock.

LaunchHook = Callable[[Incident], str | None]
"""Given an incident, return a session URL when one was started."""


@dataclass(frozen=True)
class Detection:
    case_id: str
    part_id: str
    reason: str
    days_of_cover: float
    already_open: bool


def scan(records: SystemOfRecord | None = None, cases: CaseStore | None = None) -> list[Detection]:
    """Find every part that needs a sourcing case. Read-only; opens nothing."""
    records = records or default_record()
    cases = cases or get_case_store()
    open_cases = set(cases.list_case_ids())

    delayed = {po.part_id: po for po in records.get_open_pos() if po.is_delayed}
    incidents = {i.part_id: i for i in records.list_incidents()}

    detections: list[Detection] = []
    for stock in records.list_stock():
        reasons: list[str] = []
        cover = stock.available_qty / stock.daily_consumption if stock.daily_consumption else 999.0

        if stock.available_qty < stock.reorder_level:
            reasons.append(
                f"available {stock.available_qty:,} is below the reorder point "
                f"{stock.reorder_level:,} ({cover:.0f} days of cover)"
            )
        po = delayed.get(stock.part_id)
        if po is not None and (po.revised_date - TODAY).days > cover:
            reasons.append(
                f"{po.po_id} revised {po.promised_date} -> {po.revised_date}, "
                f"which lands after cover runs out"
            )
        if not reasons:
            continue

        incident = incidents.get(stock.part_id)
        if incident is None:
            # Nothing on record describes this shortage yet. A real deployment
            # would raise one; the demo only sources parts it has an incident for.
            continue

        detections.append(
            Detection(
                case_id=incident.case_id,
                part_id=stock.part_id,
                reason="; ".join(reasons),
                days_of_cover=round(cover, 1),
                already_open=incident.case_id in open_cases,
            )
        )

    return sorted(detections, key=lambda d: d.days_of_cover)


def open_case(
    detection: Detection,
    *,
    records: SystemOfRecord | None = None,
    cases: CaseStore | None = None,
    launch: LaunchHook | None = None,
) -> str:
    """Open the case directory and write its first events. Idempotent.

    Calling this twice for the same case does not produce two cases; it is a
    cron job, so it will be called again.
    """
    records = records or default_record()
    cases = cases or get_case_store()

    if cases.exists(detection.case_id):
        return detection.case_id

    incident = records.get_incident(detection.case_id)
    part = records.get_part(detection.part_id)

    cases.append_event(
        detection.case_id,
        actor=Actor.SYSTEM,
        stage=Stage.DETECTED,
        level=Level.WARN,
        message=f"{part.item_code if part else detection.part_id}: {detection.reason}",
        payload={"part_id": detection.part_id, "days_of_cover": detection.days_of_cover},
    )
    cases.append_event(
        detection.case_id,
        actor=Actor.SYSTEM,
        stage=Stage.DETECTED,
        message=(
            f"{detection.case_id} opened: {incident.qty_required:,} pcs of "
            f"{part.item_code if part else detection.part_id} needed by {incident.needed_by}"
        ),
        payload={
            "case_id": detection.case_id,
            "qty_required": incident.qty_required,
            "needed_by": str(incident.needed_by),
            "line_stop_at": incident.line_stop_at.isoformat(),
        },
    )
    cases.write_sourcing_case(
        detection.case_id,
        {
            "case_id": detection.case_id,
            "opened_at": datetime.now(timezone.utc).isoformat(),
            "opened_by": "shortage_detector",
            "part": {
                "part_id": part.part_id,
                "item_code": part.item_code,
                "part_class": part.part_class.value,
                "criticality": part.criticality.value,
                "spec": part.spec,
            } if part else {"part_id": detection.part_id},
            "plant_id": incident.plant_id,
            "production_line": incident.production_line,
            "qty_required": incident.qty_required,
            "qty_on_hand": incident.qty_on_hand,
            "needed_by": str(incident.needed_by),
            "line_stop_at": incident.line_stop_at.isoformat(),
            "line_stop_cost_per_hour": str(incident.line_stop_cost_per_hour),
            "trigger": detection.reason,
        },
    )

    if launch is not None:
        session_url = launch(incident)
        if session_url:
            cases.append_event(
                detection.case_id,
                actor=Actor.SYSTEM,
                stage=Stage.DETECTED,
                message="Sourcing session launched. No human wrote this prompt.",
                payload={"session_url": session_url},
            )

    return detection.case_id


def run_once(launch: LaunchHook | None = None) -> list[str]:
    """One pass. Wire this to a 60-second cron once the happy path is green."""
    return [open_case(d, launch=launch) for d in scan() if not d.already_open]


if __name__ == "__main__":
    for detection in scan():
        flag = "open" if detection.already_open else "NEW "
        print(f"[{flag}] {detection.case_id}  {detection.part_id:20} {detection.days_of_cover:>5.1f}d  {detection.reason}")

"""Build an `Incident` for any part in the item master.

The two seeded cases are hand-written so the demo has a known story. This is the
same object derived from the records instead: what is in the bin, what the line
takes per day, which line and plant consume the part, who we buy it from today,
and — if a purchase order has slipped — that as the reason.

Nothing here is bearing-specific. The forty parts in the item master are all
triggerable, which is the point: the procedure is about the *policy* for a part
class, not about one bearing.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from backend.record.ports import SystemOfRecord
from packages.contracts.enums import Criticality
from packages.contracts.models import Incident, Part, StockLevel

COVER_HORIZON_DAYS = 30
"""How far ahead we buy. A shortage is "the next month of demand we cannot cover"."""

STANDING_COST_BY_CRITICALITY = {
    Criticality.CRITICAL: Decimal("18400.00"),
    Criticality.HIGH: Decimal("18400.00"),
    Criticality.MEDIUM: Decimal("9200.00"),
    Criticality.LOW: Decimal("2400.00"),
}
"""What an hour of standstill costs, when the line itself has no figure on file.
A property of the line, so a known line's own cost always wins over this."""

NO_LINE = "UNASSIGNED"
"""A part that no BOM consumes: stocked, but not on an assembly line today."""


def _line_stop_cost(
    records: SystemOfRecord, plant_id: str, production_line: str, part: Part
) -> Decimal:
    """The hourly cost of this line standing still.

    Lines we have already costed — the seeded cases carry the figure — keep their
    own number, so a derived case for a part on ASSY-3 is priced exactly like the
    hand-written one. Anything else falls back to what a part of this criticality
    is worth per hour.
    """
    for incident in records.list_incidents():
        if incident.plant_id == plant_id and incident.production_line == production_line:
            return incident.line_stop_cost_per_hour
    return STANDING_COST_BY_CRITICALITY[part.criticality]


def case_id_for(part: Part, existing: set[str]) -> str:
    """`CASE-6204-2RS`, or `-2` on the end if that case is already open.

    Named after the part rather than a counter, because in the cockpit
    "CASE-M8X40" says what it is and "CASE-007" does not.
    """
    stem = "CASE-" + "".join(
        ch if ch.isalnum() or ch == "-" else "-" for ch in part.item_code.upper()
    ).strip("-")
    if stem not in existing:
        return stem
    n = 2
    while f"{stem}-{n}" in existing:
        n += 1
    return f"{stem}-{n}"


def _worst_bin(stock: list[StockLevel]) -> StockLevel | None:
    """The plant that runs out first — that is the one with a shortage."""
    if not stock:
        return None
    return min(
        stock,
        key=lambda s: (
            s.available_qty / s.daily_consumption if s.daily_consumption else 10_000.0
        ),
    )


def incident_for_part(
    *,
    records: SystemOfRecord,
    part_id: str,
    case_id: str | None = None,
    qty_required: int | None = None,
    needed_by: date | None = None,
    today: date,
    existing_cases: set[str] | None = None,
) -> Incident:
    """Derive the shortage from the records. Raises `LookupError` on an unknown part."""
    part = records.get_part(part_id)
    if part is None:
        raise LookupError(f"no such part: {part_id}")

    stock = records.get_stock(part_id)
    bin_ = _worst_bin(stock)
    on_hand = bin_.available_qty if bin_ is not None else 0
    take_rate = bin_.daily_consumption if bin_ is not None else 0
    plant_id = bin_.plant_id if bin_ is not None else "PLANT-MUC"

    bom = records.get_bom_for_part(part_id)
    production_line = bom["production_line"] if bom is not None else NO_LINE
    if bom is not None and bom["plant_id"]:
        plant_id = bom["plant_id"]

    # A month of demand, or at least enough to clear the reorder point: asking
    # for less than the reorder level would open a case that buys nothing.
    if qty_required is None:
        month = take_rate * COVER_HORIZON_DAYS
        floor = bin_.reorder_level if bin_ is not None else 0
        qty_required = max(month, floor, on_hand + 1)

    # The line stops when the bin runs dry at the current take rate.
    if needed_by is None:
        days_of_cover = on_hand // take_rate if take_rate else COVER_HORIZON_DAYS
        needed_by = today + timedelta(days=int(days_of_cover))
    line_stop_at = datetime.combine(needed_by, time(6, 0), tzinfo=timezone.utc)

    suppliers = records.get_suppliers_for_part(part_id)
    incumbent = next((s.supplier_id for s in suppliers if s.incumbent), None)

    consumer = production_line if production_line != NO_LINE else plant_id
    slipped = [po for po in records.get_open_pos(part_id) if po.is_delayed]
    if slipped:
        po = slipped[0]
        reason = (
            f"{po.po_id} ({po.qty:,} pcs, {po.supplier_id}) slipped from "
            f"{po.promised_date} to {po.revised_date}. On-hand cover is "
            f"{on_hand // take_rate if take_rate else 0} days at {consumer}'s "
            f"take rate of {take_rate}/day."
        )
    elif take_rate:
        reason = (
            f"No supply scheduled. {on_hand:,} pcs on hand covers "
            f"{on_hand // take_rate} days at {consumer}'s take rate of "
            f"{take_rate}/day; the next {COVER_HORIZON_DAYS} days need "
            f"{qty_required:,}."
        )
    else:
        reason = f"{on_hand:,} pcs on hand against a requirement of {qty_required:,}."

    return Incident(
        case_id=case_id or case_id_for(part, existing_cases or set()),
        part_id=part_id,
        plant_id=plant_id,
        production_line=production_line,
        qty_required=int(qty_required),
        qty_on_hand=on_hand,
        needed_by=needed_by,
        line_stop_at=line_stop_at,
        line_stop_cost_per_hour=_line_stop_cost(records, plant_id, production_line, part),
        incumbent_supplier_id=incumbent,
        reason=reason,
    )

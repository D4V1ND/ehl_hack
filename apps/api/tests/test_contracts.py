from datetime import date
from decimal import Decimal

from packages.contracts.models import (
    Channel,
    Currency,
    OutreachBrief,
    OutreachTask,
    PriceBreak,
    Quote,
)


def _task() -> OutreachTask:
    return OutreachTask(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        channel=Channel.VOICE,
        brief=OutreachBrief(
            part_spec="Deep groove ball bearing 6204-2RS (DIN 625)",
            qty=5000,
            needed_by=date(2026, 9, 3),
            target_price=Decimal("1.85"),
            floor_price=Decimal("2.40"),
        ),
    )


def test_outreach_task_defaults_the_must_ask_list():
    assert _task().brief.must_ask == [
        "price_breaks",
        "moq",
        "lead_time",
        "incoterm",
        "cert",
    ]


def test_a_garbled_call_still_produces_a_valid_quote():
    """A quote with nothing known must construct, not raise."""
    q = Quote(task_id="T-001", case_id="CASE-001", supplier_ref="SUP-ATLAS")
    assert q.available is False
    assert q.qty_offered == 0
    assert q.unit_price is None
    assert q.currency is Currency.UNKNOWN
    assert q.price_breaks == []
    assert q.confidence == 0.0


def test_money_fields_are_decimal_not_float():
    pb = PriceBreak(min_qty=1000, unit_price="2.15")
    assert isinstance(pb.unit_price, Decimal)
    assert pb.unit_price == Decimal("2.15")


def test_price_breaks_must_be_sorted_by_min_qty():
    q = Quote(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        price_breaks=[
            PriceBreak(min_qty=5000, unit_price="1.90"),
            PriceBreak(min_qty=100, unit_price="2.40"),
        ],
    )
    assert [pb.min_qty for pb in q.price_breaks] == [100, 5000]

from datetime import date
from decimal import Decimal

from backend.outreach.fake import make_fake_quote
from packages.contracts.models import Channel, OutreachBrief, OutreachTask


def _task(task_id: str = "T-001", supplier: str = "SUP-ATLAS") -> OutreachTask:
    return OutreachTask(
        task_id=task_id,
        case_id="CASE-001",
        supplier_ref=supplier,
        channel=Channel.VOICE,
        brief=OutreachBrief(
            part_spec="Deep groove ball bearing 6204-2RS (DIN 625)",
            qty=5000,
            needed_by=date(2026, 9, 3),
            target_price=Decimal("1.85"),
            floor_price=Decimal("2.40"),
        ),
    )


def test_same_task_id_always_gives_the_same_quote():
    assert make_fake_quote(_task()) == make_fake_quote(_task())


def test_different_task_ids_give_different_quotes():
    a = make_fake_quote(_task("T-001"))
    b = make_fake_quote(_task("T-002"))
    assert (a.unit_price, a.lead_time_days) != (b.unit_price, b.lead_time_days)


def test_an_available_quote_has_usable_numbers():
    q = make_fake_quote(_task("T-AVAILABLE"))
    if q.available:
        assert q.unit_price is not None and q.unit_price > 0
        assert q.qty_offered > 0
        assert q.lead_time_days is not None and q.lead_time_days > 0
        assert q.moq is not None


def test_price_breaks_get_cheaper_as_quantity_rises():
    q = make_fake_quote(_task("T-BREAKS"))
    if q.price_breaks:
        prices = [pb.unit_price for pb in q.price_breaks]
        assert prices == sorted(prices, reverse=True)


def test_all_money_is_decimal():
    q = make_fake_quote(_task())
    if q.unit_price is not None:
        assert isinstance(q.unit_price, Decimal)
    for pb in q.price_breaks:
        assert isinstance(pb.unit_price, Decimal)


def test_some_suppliers_are_unavailable():
    """The cost model must handle a 'no' — make sure fakes produce them."""
    results = [make_fake_quote(_task(f"T-{i:03d}")).available for i in range(40)]
    assert False in results, "no unavailable quote in 40 tries"
    assert True in results, "no available quote in 40 tries"


def test_confidence_is_between_zero_and_one():
    q = make_fake_quote(_task())
    assert 0.0 <= q.confidence <= 1.0

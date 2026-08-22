"""Landed cost arithmetic, checked by hand against the seeded numbers.

Every expected value below is written out longhand from the company profile, so
a reader can verify it with a calculator and nothing is asserted against the
implementation's own output.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from packages.contracts.enums import FreightMode
from packages.contracts.models import Claim, ExpediteOption, PriceBreak
from backend.cost.cost_model import Line, available_modes, default_mode, eta, landed_cost, unit_price

PART = "PRT-6204"
TODAY = date(2026, 8, 22)
NEEDED_BY = date(2026, 9, 3)
TAKE_RATE = 350


@pytest.fixture
def part(erp):
    return erp.get_part(PART)


@pytest.fixture
def profile(erp):
    return erp.get_company_profile()


@pytest.fixture
def suppliers(erp):
    return {s.supplier_id: s for s in erp.get_suppliers_for_part(PART)}


def test_price_break_is_a_step_function_not_a_curve(suppliers):
    kby = suppliers["SUP-KBY"]
    assert unit_price(kby.price_breaks, 4999) == Decimal("1.68")
    assert unit_price(kby.price_breaks, 5000) == Decimal("1.58")
    assert unit_price(kby.price_breaks, 29999) == Decimal("1.49")
    assert unit_price(kby.price_breaks, 30000) == Decimal("1.42")


def test_below_the_smallest_tier_the_contract_price_is_the_honest_answer(suppliers):
    kby = suppliers["SUP-KBY"]
    assert unit_price(kby.price_breaks, 500, kby.contract_unit_price) == Decimal("1.42")
    assert unit_price([], 500) == Decimal("0")


def test_landed_cost_adds_freight_duty_and_carrying_by_hand(suppliers, part, profile):
    """4 000 pcs from the incumbent, by road.

    goods    4 000 x 1.68  (below the 5 000 tier)      = 6 720.00
    freight  4 000 x 0.102 kg = 408 kg x 1.15/kg       =   469.20
    duty     DE is 0.0                                 =     0.00
    """
    kby = suppliers["SUP-KBY"]
    arrival = date(2026, 9, 1)
    cost = landed_cost(
        line=Line(supplier=kby, qty=4000, mode=FreightMode.ROAD, eta=arrival),
        part=part,
        profile=profile,
        needed_by=NEEDED_BY,
        daily_consumption=TAKE_RATE,
    )
    assert cost.goods_cost == Decimal("6720.00")
    assert cost.freight == Decimal("469.20")
    assert cost.duty == Decimal("0.00")
    assert cost.carrying_cost > 0, "capital and pallet-months are never free"
    assert cost.total == cost.goods_cost + cost.freight + cost.duty + cost.carrying_cost
    assert cost.unit_effective > Decimal("1.68"), "landed is always above the sticker"


def test_duty_is_ad_valorem_on_goods_plus_freight(suppliers, part, profile):
    """The blocked CN supplier is still priceable; policy rejects it, not maths."""
    npb = suppliers["SUP-NPB"]
    cost = landed_cost(
        line=Line(supplier=npb, qty=10000, mode=FreightMode.SEA, eta=date(2026, 9, 25)),
        part=part,
        profile=profile,
        needed_by=NEEDED_BY,
        daily_consumption=TAKE_RATE,
    )
    goods = Decimal("10000") * Decimal("0.92")
    freight = Decimal("10000") * Decimal("0.102") * Decimal("0.42")
    assert cost.goods_cost == goods
    assert cost.freight == freight.quantize(Decimal("0.01"))
    assert cost.duty == ((goods + cost.freight) * Decimal("0.082")).quantize(Decimal("0.01"))


def test_every_component_is_decimal_not_float(suppliers, part, profile):
    kby = suppliers["SUP-KBY"]
    cost = landed_cost(
        line=Line(supplier=kby, qty=12000, mode=FreightMode.ROAD, eta=date(2026, 9, 1)),
        part=part,
        profile=profile,
        needed_by=NEEDED_BY,
        daily_consumption=TAKE_RATE,
    )
    for value in (cost.goods_cost, cost.freight, cost.duty, cost.carrying_cost, cost.total):
        assert isinstance(value, Decimal)


def test_air_buys_days_and_charges_for_them(suppliers, part, profile):
    """Sea to air on the same supplier: earlier arrival, much larger freight bill."""
    npb = suppliers["SUP-NPB"]
    by_sea = eta(supplier=npb, profile=profile, mode=FreightMode.SEA, today=TODAY)
    by_air = eta(supplier=npb, profile=profile, mode=FreightMode.AIR, today=TODAY)
    assert (by_sea - by_air).days == 30, "air saves the sea/air transit difference"

    sea_cost = landed_cost(
        line=Line(supplier=npb, qty=10000, mode=FreightMode.SEA, eta=by_sea),
        part=part, profile=profile, needed_by=NEEDED_BY, daily_consumption=TAKE_RATE,
    )
    air_cost = landed_cost(
        line=Line(supplier=npb, qty=10000, mode=FreightMode.AIR, eta=by_air),
        part=part, profile=profile, needed_by=NEEDED_BY, daily_consumption=TAKE_RATE,
    )
    assert air_cost.freight > sea_cost.freight * 10


def test_modes_offered_are_the_normal_one_plus_air(suppliers):
    assert default_mode("RO") is FreightMode.ROAD
    assert default_mode("CN") is FreightMode.SEA
    assert available_modes("RO") == (FreightMode.ROAD, FreightMode.AIR)


def test_a_claim_overrides_the_file_on_price_and_lead_time(suppliers, part, profile):
    """What they said on the phone is newer than what our file says."""
    skf = suppliers["SUP-SKF"]
    claim = Claim(
        task_id="T-1",
        case_id="CASE-001",
        supplier_ref="SUP-SKF",
        available=True,
        qty_offered=8000,
        price_breaks=[PriceBreak(min_qty=1000, unit_price=Decimal("2.00"))],
        lead_time_days=4,
        expedite_option=ExpediteOption(days=2, surcharge=Decimal("1200.00")),
        confidence=0.9,
    )
    arrival = eta(
        supplier=skf, profile=profile, mode=FreightMode.ROAD, today=TODAY, claim=claim, expedited=True
    )
    assert arrival == date(2026, 8, 24), "4 claimed days, 2 bought back by the expedite"

    cost = landed_cost(
        line=Line(
            supplier=skf, qty=8000, mode=FreightMode.ROAD, eta=arrival, expedited=True, claim=claim
        ),
        part=part,
        profile=profile,
        needed_by=NEEDED_BY,
        daily_consumption=TAKE_RATE,
    )
    assert cost.goods_cost == Decimal("16000.00"), "claimed 2.00/pc, not the filed 1.88"
    assert cost.expedite_surcharge == Decimal("1200.00")


def test_breakdown_is_auditable_markdown(suppliers, part, profile):
    kby = suppliers["SUP-KBY"]
    cost = landed_cost(
        line=Line(supplier=kby, qty=12000, mode=FreightMode.ROAD, eta=date(2026, 9, 1)),
        part=part,
        profile=profile,
        needed_by=NEEDED_BY,
        daily_consumption=TAKE_RATE,
    )
    for token in ("goods", "freight", "duty", "carrying", "landed total", str(cost.total)):
        assert token in cost.breakdown_md

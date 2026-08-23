"""The split-order search on CASE-001.

The seed data guarantees no single compliant supplier can both cover 36 000
pieces and beat the line stop. These tests assert the search finds the bridge
plan, that it beats the plan a hurried buyer would write, and that feasibility is
decided by simulating the line rather than by comparing one date.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from packages.contracts.models import Claim
from packages.contracts.enums import StockStatus
from supplyos_api.cost.strategy import Option, StrategyBuilder, round_up_lot, simulate
from supplyos_api.policy.screen import screen

CASE = "CASE-001"
PART = "PRT-6204"
TODAY = date(2026, 8, 22)
TAKE_RATE = 350


@pytest.fixture
def compliant(erp):
    part = erp.get_part(PART)
    board = screen(
        case_id=CASE,
        suppliers=erp.get_suppliers_for_part(PART),
        part=part,
        profile=erp.get_company_profile(),
        today=TODAY,
    )
    cleared = {c.supplier_ref for c in board if c.compliance.passed}
    return [s for s in erp.get_suppliers_for_part(PART) if s.supplier_id in cleared]


@pytest.fixture
def builder(erp, compliant):
    return StrategyBuilder(
        incident=erp.get_incident(CASE),
        part=erp.get_part(PART),
        profile=erp.get_company_profile(),
        options=[Option(supplier=s) for s in compliant],
        daily_consumption=TAKE_RATE,
        today=TODAY,
    )


def test_simulation_catches_a_line_that_runs_dry_before_the_bulk_lands():
    """4 200 on hand at 350/day is exactly 12 days. A day-21 delivery is too late."""
    runs, coverage = simulate(
        arrivals=[(date(2026, 9, 12), 36000)],
        qty_on_hand=4200,
        daily_consumption=TAKE_RATE,
        start=TODAY,
        qty_required=36000,
    )
    assert not runs
    assert coverage == date(2026, 9, 12)

    runs, _ = simulate(
        arrivals=[(date(2026, 9, 1), 4000), (date(2026, 9, 12), 32000)],
        qty_on_hand=4200,
        daily_consumption=TAKE_RATE,
        start=TODAY,
        qty_required=36000,
    )
    assert runs, "a 4 000-piece bridge carries the line to the cheap shipment"


def test_lots_are_rounded_up_because_nobody_orders_4137_pieces():
    assert round_up_lot(4137) == 5000
    assert round_up_lot(4000) == 4000


def test_the_recommended_plan_is_a_split_that_keeps_the_line_running(builder):
    plans = builder.build()
    assert plans, "the search found nothing to recommend"

    best = plans[0]
    assert best.meets_line_stop
    assert len(best.lines) >= 2, "a single source cannot solve this case"
    assert sum(line.qty for line in best.lines) == 36000


def test_the_bridge_plan_beats_the_obvious_split(builder):
    """The demo's punchline, as a test.

    The obvious plan takes every fast piece on offer and pays a premium on stock
    that was not needed early. The bridge plan buys only the days it needs.
    """
    plans = builder.build()
    best = plans[0]
    obvious = next(
        (p for p in plans if p.label.startswith("Split: everything the fast suppliers")), None
    )
    assert obvious is not None, "the naive plan should still be priced for comparison"
    assert obvious.meets_line_stop, "the naive plan is feasible; it is just expensive"

    saving = (obvious.total_cost - best.total_cost) / obvious.total_cost
    assert saving > Decimal("0.08"), f"expected >8% better than the naive split, got {saving:.1%}"


def test_the_cheapest_source_alone_is_ranked_below_any_feasible_plan(builder):
    """Cheapest landed cost is not the answer if the line stops."""
    plans = builder.build()
    rul_alone = next(
        p
        for p in plans
        if len(p.lines) == 1
        and p.lines[0].supplier_ref == "SUP-RUL"
        and p.lines[0].mode.value == "road"
    )
    assert not rul_alone.meets_line_stop
    assert rul_alone.total_cost < plans[0].total_cost, "it really is the cheapest cash outlay"
    assert plans.index(rul_alone) > 0, "and it is still not the recommendation"


def test_downtime_is_priced_so_freight_can_be_worth_it(builder, erp):
    """Nine days of a stopped ASSY-3 dwarfs any freight bill on this case."""
    exposure = builder.downtime_cost([(date(2026, 9, 12), 36000)])
    assert exposure == Decimal("18400.00") * 24 * 9

    plans = builder.build()
    assert plans[0].total_cost < exposure, "the whole order costs less than the downtime"


def test_every_plan_reports_its_own_rationale_and_risk(builder):
    for plan in builder.build():
        assert plan.rationale.endswith(".")
        assert 0.0 <= plan.risk_score <= 1.0
        assert plan.coverage_date >= TODAY


def test_an_allocated_claim_shrinks_the_plan_it_can_appear_in(erp, compliant):
    """The incumbent says on the phone that only 2 000 are actually free.

    Its own file allows 12 000, so a plan built on the file could lean on it. The
    claim caps every line it appears in at what was really offered.
    """
    allocated = Claim(
        task_id="T-9",
        case_id=CASE,
        supplier_ref="SUP-KBY",
        available=True,
        qty_offered=2000,
        stock_status=StockStatus.IN_STOCK_ALLOCATED,
        lead_time_days=10,
        confidence=0.85,
    )
    builder = StrategyBuilder(
        incident=erp.get_incident(CASE),
        part=erp.get_part(PART),
        profile=erp.get_company_profile(),
        options=[
            Option(supplier=s, claim=allocated if s.supplier_id == "SUP-KBY" else None)
            for s in compliant
        ],
        daily_consumption=TAKE_RATE,
        today=TODAY,
    )
    for plan in builder.build():
        for line in plan.lines:
            if line.supplier_ref == "SUP-KBY":
                assert line.qty <= 2000, "planned more than the supplier actually offered"

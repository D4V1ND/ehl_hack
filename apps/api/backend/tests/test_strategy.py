"""The provider-backed Strategy for CASE-001.

The trusted Incident is 40,000 required minus 8,000 on hand. Four recorded
Claims remain auditable, but only eligible stock may shape the 32,000-piece
recommendation. Feasibility is still verified by simulating the line.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from packages.contracts.models import OutreachBrief, OutreachTask
from backend.cost.strategy import Option, StrategyBuilder, round_up_lot, simulate
from backend.decide.run import DECISION_CONFIDENCE_THRESHOLD, build_recorded_decision
from backend.outreach.normalize import normalize_claim_result
from backend.outreach.recorded import RecordedOutreachAdapter
from backend.policy.screen import screen

CASE = "CASE-001"
PART = "PRT-6204"
TODAY = date(2026, 8, 22)
TAKE_RATE = 640
NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)


@pytest.fixture
def candidates(erp):
    part = erp.get_part(PART)
    return screen(
        case_id=CASE,
        suppliers=erp.get_suppliers_for_part(PART),
        part=part,
        profile=erp.get_company_profile(),
        today=TODAY,
    )


@pytest.fixture
def compliant(erp, candidates):
    cleared = {candidate.supplier_ref for candidate in candidates if candidate.compliance.passed}
    return [
        supplier
        for supplier in erp.get_suppliers_for_part(PART)
        if supplier.supplier_id in cleared
    ]


@pytest.fixture
def recorded_claims(erp, candidates):
    incident = erp.get_incident(CASE)
    tasks = [
        OutreachTask(
            task_id=f"OUT-{candidate.supplier_ref}",
            case_id=CASE,
            supplier_ref=candidate.supplier_ref,
            channel=candidate.channel,
            brief=OutreachBrief(
                part_spec="6204-2RS DIN 625",
                qty=incident.shortfall,
                needed_by=incident.needed_by,
            ),
        )
        for candidate in candidates
        if candidate.compliance.passed
    ]
    return [
        normalize_claim_result(
            task_id=result.task_id,
            case_id=result.case_id,
            supplier_ref=result.supplier_ref,
            payload=result.payload,
            received_at=NOW,
        )
        for result in RecordedOutreachAdapter().dispatch(tasks)
    ]


@pytest.fixture
def decision(erp, candidates, recorded_claims):
    incident = erp.get_incident(CASE)
    suppliers = erp.get_suppliers_for_part(PART)
    eligible_claims = {
        claim.supplier_ref: claim
        for claim in recorded_claims
        if claim.confidence >= DECISION_CONFIDENCE_THRESHOLD
    }
    checked_candidates = screen(
        case_id=CASE,
        suppliers=suppliers,
        part=erp.get_part(PART),
        profile=erp.get_company_profile(),
        today=TODAY,
        claims=eligible_claims,
    )
    return build_recorded_decision(
        case_id=CASE,
        incident=incident,
        part=erp.get_part(PART),
        profile=erp.get_company_profile(),
        suppliers=suppliers,
        candidates=checked_candidates,
        claims=recorded_claims,
        today=TODAY,
        decided_at=NOW,
    )


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
    """8,000 on hand cannot reach a day-21 bulk delivery without the bridge."""
    runs, coverage = simulate(
        arrivals=[(date(2026, 9, 12), 32000)],
        qty_on_hand=8000,
        daily_consumption=TAKE_RATE,
        start=TODAY,
        qty_required=32000,
    )
    assert not runs
    assert coverage == date(2026, 9, 12)

    runs, _ = simulate(
        arrivals=[(date(2026, 9, 1), 6400), (date(2026, 9, 12), 25600)],
        qty_on_hand=8000,
        daily_consumption=TAKE_RATE,
        start=TODAY,
        qty_required=32000,
    )
    assert runs, "the 6,400-piece bridge carries the line to the bulk shipment"


def test_lots_are_rounded_up_because_nobody_orders_4137_pieces():
    assert round_up_lot(4137) == 5000
    assert round_up_lot(4000) == 4000


def test_the_recommended_plan_is_the_approved_provider_backed_split(decision):
    assert decision.checks.policy_passed
    assert decision.checks.cost_model_passed
    best = decision.strategies[0]
    assert best.meets_line_stop
    assert [
        (line.supplier_ref, line.qty, line.mode.value)
        for line in best.lines
    ] == [("SUP-SKF", 6400, "air"), ("SUP-FAG", 25600, "sea")]
    assert sum(line.qty for line in best.lines) == 32000
    assert best.total_cost == Decimal("94880.00")


def test_all_four_claims_stay_auditable_while_only_eligible_stock_is_used(
    decision, recorded_claims
):
    assert {claim.supplier_ref for claim in recorded_claims} == {
        "SUP-SKF",
        "SUP-FAG",
        "SUP-NSK",
        "SUP-MUN",
    }
    used = {line.supplier_ref for line in decision.strategies[0].lines}
    assert used == {"SUP-SKF", "SUP-FAG"}


def test_a_low_confidence_bargain_cannot_influence_the_strategy(
    decision, recorded_claims
):
    nsk = next(claim for claim in recorded_claims if claim.supplier_ref == "SUP-NSK")
    assert nsk.unit_price == Decimal("0.5000")
    assert nsk.confidence < DECISION_CONFIDENCE_THRESHOLD
    assert "SUP-NSK" not in {
        line.supplier_ref for line in decision.strategies[0].lines
    }


def test_downtime_is_priced_so_freight_can_be_worth_it(builder, decision):
    """Nine days of stopped ASSY-3 production dwarfs the procurement cost."""
    exposure = builder.downtime_cost([(date(2026, 9, 12), 32000)])
    assert exposure == Decimal("4000.00") * 24 * 9

    assert decision.strategies[0].total_cost < exposure


def test_every_plan_reports_its_own_rationale_and_risk(decision):
    for plan in decision.strategies:
        assert plan.rationale.endswith(".")
        assert 0.0 <= plan.risk_score <= 1.0
        assert plan.coverage_date >= TODAY


def test_allocated_munich_stock_cannot_appear_in_the_strategy(
    decision, recorded_claims
):
    munich = next(
        claim for claim in recorded_claims if claim.supplier_ref == "SUP-MUN"
    )
    assert munich.stock_status.value == "in_stock_allocated"
    assert "SUP-MUN" not in {
        line.supplier_ref for line in decision.strategies[0].lines
    }

"""The policy rules, against the seeded case. Runs once per adapter.

`test_seed_scenario.py` asserts the *data* makes the naive answer wrong, using
its own longhand reading of the company profile. These tests assert the real
implementation reaches the same verdicts, so the two can never drift: if someone
loosens a rule, the seed test still passes and this one goes red.
"""

from __future__ import annotations

from datetime import date

import pytest

from packages.contracts.enums import Answer, PolicyRule, StockStatus
from packages.contracts.models import Claim
from supplyos_api.policy.rules import check_lead_time, deliverable_qty, evaluate_supplier
from supplyos_api.policy.screen import screen

CASE = "CASE-001"
PART = "PRT-6204"
TODAY = date(2026, 8, 22)


@pytest.fixture
def board(erp):
    part = erp.get_part(PART)
    return screen(
        case_id=CASE,
        suppliers=erp.get_suppliers_for_part(PART),
        part=part,
        profile=erp.get_company_profile(),
        today=TODAY,
    )


def test_three_suppliers_clear_and_three_are_rejected(board):
    cleared = {c.supplier_ref for c in board if c.compliance.passed}
    assert cleared == {"SUP-KBY", "SUP-SKF", "SUP-RUL"}


def test_each_rejection_cites_a_different_rule(board):
    cited = {
        c.supplier_ref: c.compliance.failed_rules for c in board if not c.compliance.passed
    }
    assert cited == {
        "SUP-NPB": [PolicyRule.BLOCKED_ORIGIN_COUNTRY],
        "SUP-PUL": [PolicyRule.MISSING_REQUIRED_CERTIFICATION],
        "SUP-NBT": [PolicyRule.AUDIT_REQUIRED_AND_NOT_AUDITED],
    }


def test_every_rejection_carries_an_explanation(board):
    for candidate in board:
        for rule in candidate.compliance.failed_rules:
            explanation = candidate.compliance.explanations[rule]
            assert explanation.endswith("."), f"{rule} explanation should read as a sentence"
            assert candidate.supplier_ref in explanation or candidate.country in explanation


def test_blocked_origin_routes_to_email_because_calle_has_no_cn_region(board):
    npb = next(c for c in board if c.supplier_ref == "SUP-NPB")
    assert npb.channel.value in {"email", "marketplace"}


def test_no_single_compliant_supplier_can_beat_the_line_stop(erp, board):
    """The fourth rule, and the reason the answer has to be a split."""
    incident = erp.get_incident(CASE)
    suppliers = {s.supplier_id: s for s in erp.get_suppliers_for_part(PART)}
    cleared = [suppliers[c.supplier_ref] for c in board if c.compliance.passed]

    coverers = [
        s
        for s in cleared
        if deliverable_qty(s) >= incident.qty_required
        and check_lead_time(supplier=s, incident=incident, today=TODAY).passed
    ]
    assert coverers == [], "a single compliant supplier could cover the case; demo is dead"

    rul = suppliers["SUP-RUL"]
    result = check_lead_time(supplier=rul, incident=incident, today=TODAY)
    assert result.failed_rules == [PolicyRule.LEAD_TIME_AFTER_LINE_STOP]
    assert "past the line stop" in result.explanations[PolicyRule.LEAD_TIME_AFTER_LINE_STOP]


def test_unknown_lead_time_is_not_a_pass(erp):
    """An unknown does not get the benefit of the doubt."""
    incident = erp.get_incident(CASE)
    supplier = next(
        s for s in erp.get_suppliers_for_part(PART) if s.supplier_id == "SUP-KBY"
    ).model_copy(update={"standard_lead_days": None})

    result = check_lead_time(supplier=supplier, incident=incident, today=TODAY)
    assert not result.passed
    assert "cannot be shown to arrive" in result.explanations[PolicyRule.LEAD_TIME_AFTER_LINE_STOP]


def test_a_call_can_only_make_compliance_stricter(erp):
    """Our file says the incumbent holds the certification; the call says no."""
    part = erp.get_part(PART)
    supplier = next(s for s in erp.get_suppliers_for_part(PART) if s.supplier_id == "SUP-KBY")
    profile = erp.get_company_profile()

    assert evaluate_supplier(
        supplier=supplier, part=part, profile=profile, today=TODAY
    ).passed

    denied = Claim(
        task_id="T-1",
        case_id=CASE,
        supplier_ref=supplier.supplier_id,
        available=True,
        qty_offered=12000,
        certification_current=Answer.NO,
    )
    result = evaluate_supplier(
        supplier=supplier, part=part, profile=profile, today=TODAY, claim=denied
    )
    assert result.failed_rules == [PolicyRule.MISSING_REQUIRED_CERTIFICATION]
    assert "on the call" in result.explanations[PolicyRule.MISSING_REQUIRED_CERTIFICATION]


def test_allocated_stock_shrinks_what_we_will_plan_around(erp):
    """The punchline field: "yes, we have 20 000" that is already promised."""
    supplier = next(s for s in erp.get_suppliers_for_part(PART) if s.supplier_id == "SUP-KBY")
    assert deliverable_qty(supplier) == 12000

    allocated = Claim(
        task_id="T-2",
        case_id=CASE,
        supplier_ref=supplier.supplier_id,
        available=True,
        qty_offered=6000,
        stock_status=StockStatus.IN_STOCK_ALLOCATED,
        confidence=0.8,
    )
    assert deliverable_qty(supplier, allocated) == 6000

    unavailable = Claim(
        task_id="T-3", case_id=CASE, supplier_ref=supplier.supplier_id, available=False
    )
    assert deliverable_qty(supplier, unavailable) == 0

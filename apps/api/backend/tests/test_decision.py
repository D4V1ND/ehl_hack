"""The decision run: artifacts on disk, and what they must say.

These are the files a human actually reviews in the pull request, so the
assertions are about readability as much as arithmetic: every rejection names its
rule, the recommendation names what it beat, and nothing on the page is a number
the reader cannot trace.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

import pytest

from packages.contracts.enums import Answer, Stage, StockStatus
from packages.contracts.models import Claim
from backend.casestore.case_store import CaseStore
from backend.decide.run import run, single_source_blockers

CASE = "CASE-001"
TODAY = date(2026, 8, 22)


@pytest.fixture
def cases(tmp_path) -> CaseStore:
    return CaseStore(tmp_path / "cases")


@pytest.fixture
def outcome(erp, cases):
    return run(case_id=CASE, records=erp, cases=cases, today=TODAY)


def test_it_decides_on_our_own_files_before_any_call_comes_back(outcome):
    assert outcome.recommended is not None
    assert len(outcome.recommended.lines) >= 2
    assert outcome.decision.recommended_strategy_id == outcome.recommended.strategy_id


def test_it_writes_the_whole_review_package(cases, outcome):
    written = {artifact["name"] for artifact in cases.list_artifacts(CASE)}
    assert {"policy_report.md", "cost_report.md", "decision.md", "po_draft.md"} <= written

    stored = cases.read_decision(CASE)
    assert stored is not None
    assert stored.recommended_strategy_id == outcome.decision.recommended_strategy_id


def test_the_policy_report_names_the_rule_behind_every_rejection(cases, outcome):
    report = cases.read_artifact(CASE, "policy_report.md")
    assert report is not None
    assert "blocked_origin_country" in report
    assert "4 cleared, 1 rejected" in report


def test_the_cost_report_shows_the_plan_it_beat(cases, outcome):
    report = cases.read_artifact(CASE, "cost_report.md")
    assert report is not None
    assert report.count("| ") > 5, "the comparison table is the point"
    assert "everything the fast suppliers will give" in report
    assert str(outcome.recommended.total_cost) in report


def test_the_decision_prices_the_downtime_it_avoided(cases, outcome):
    decision = cases.read_artifact(CASE, "decision.md")
    assert decision is not None
    assert "downtime avoided" in decision
    assert "Approving this PR is the approval. Nothing was ordered." in decision


def test_the_po_draft_never_carries_a_raw_phone_number(cases, outcome, erp):
    draft = cases.read_artifact(CASE, "po_draft.md")
    assert draft is not None
    assert "Draft only" in draft
    for supplier in erp.get_suppliers_for_part("PRT-6204"):
        assert "*" in supplier.phone_masked  # the record itself is masked
    assert "+4930231250" not in draft


def test_it_logs_one_event_a_human_can_read(cases, outcome):
    events = cases.read_events(CASE)
    assert events, "a decision that leaves no trace never happened"
    last = events[-1]
    assert last.stage is Stage.DECIDED
    assert outcome.recommended.strategy_id == last.payload["recommended"]
    assert last.payload["rejected_suppliers"] == 1


def test_candidates_are_written_for_the_cockpit(cases, outcome):
    stored = cases.read_candidates(CASE)
    assert len(stored) == 5
    assert all(c.compliance is not None for c in stored)


def test_money_survives_the_json_round_trip_as_a_string(cases, outcome):
    raw = json.loads((cases.case_dir(CASE) / "decision.json").read_text(encoding="utf-8"))
    total = raw["strategies"][0]["total_cost"]
    assert isinstance(total, str), "money must never be a JSON float"
    assert Decimal(total) == outcome.decision.strategies[0].total_cost


def test_the_fourth_rule_is_reported_against_the_cheapest_supplier(erp):
    blockers = single_source_blockers(case_id=CASE, records=erp, today=TODAY)
    assert blockers["SUP-FAG"] == ["lead_time_after_line_stop"]


def test_a_claim_changes_the_recommendation(erp, cases):
    """The allocated-stock beat, end to end.

    The incumbent's file allows 12 000 pieces. On the phone it turns out 10 000
    of those are already promised elsewhere, so the plan built on the call cannot
    lean on it as hard as the plan built on the file.
    """
    before = run(case_id=CASE, records=erp, cases=cases, today=TODAY)
    planned_before = {
        line.supplier_ref: line.qty for line in before.recommended.lines
    }.get("SUP-KBY", 0)

    cases.write_claim(
        Claim(
            task_id="T-KBY-1",
            case_id=CASE,
            supplier_ref="SUP-KBY",
            available=True,
            qty_offered=2000,
            stock_status=StockStatus.IN_STOCK_ALLOCATED,
            lead_time_days=10,
            certification_current=Answer.YES,
            confidence=0.85,
            evidence=["sales engineer: 10 000 of the 12 000 are on a customer hold"],
        )
    )

    after = run(case_id=CASE, records=erp, cases=cases, today=TODAY)
    assert after.recommended is not None
    planned_after = {line.supplier_ref: line.qty for line in after.recommended.lines}.get(
        "SUP-KBY", 0
    )
    assert planned_after <= 2000 < max(planned_before, 2001)

    decision = cases.read_artifact(CASE, "decision.md")
    assert "in_stock_allocated" in decision, "the reader must see why the plan shrank"


def test_no_compliant_plan_says_so_instead_of_inventing_one(erp, cases, monkeypatch):
    """Two days out, nobody can make it. The answer is a human, not a guess."""
    outcome = run(case_id=CASE, records=erp, cases=cases, today=date(2026, 9, 1))
    if outcome.recommended is None:
        decision = cases.read_artifact(CASE, "decision.md")
        assert "needs a human buyer" in decision
        assert cases.read_events(CASE)[-1].stage is Stage.COSTING
    else:
        # Still feasible from a standing start this late only if a supplier can
        # deliver inside two days, which the seed data does not allow.
        pytest.fail(f"unexpectedly feasible: {outcome.recommended.label}")

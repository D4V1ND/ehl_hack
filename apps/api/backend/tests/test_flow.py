"""The launcher: one run must produce the whole story, unattended.

What is asserted here is the demo's spine — a run narrates itself into the case
log, holds back the supplier that gets called live, files claims that agree with
the supplier's own record, and ends with a ranked set of plans rather than a
single opaque answer. Also asserted: a live call cannot happen because someone
passed a query parameter.
"""

from __future__ import annotations

import time
from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.api.deps import settings, store
from backend.api.main import app
from backend.api.settings import get_settings
from backend.casestore.case_store import CaseStore
from backend.flow.claims import claim_from_quote
from backend.flow.conductor import run_case
from backend.flow.rehearsal import rehearsed_quote
from backend.record.mock_erp import get_mock_erp
from backend.store import STORE
from packages.contracts.enums import Answer, StockStatus
from packages.contracts.models import Channel, OutreachBrief, OutreachTask, Quote

TODAY = date(2026, 8, 22)


@pytest.fixture(autouse=True)
def quote_buffer():
    """The in-process quote buffer is global, so a rehearsed call here would
    otherwise show up in another module's case."""
    yield
    STORE.clear_quotes("CASE-001")


@pytest.fixture
def cases(tmp_path) -> CaseStore:
    return CaseStore(tmp_path / "cases")


@pytest.fixture
def records():
    return get_mock_erp()


@pytest.fixture
def client(tmp_path):
    store_ = CaseStore(tmp_path / "cases")
    rehearsal = replace(get_settings(), github_token=None, github_repo=None)
    app.dependency_overrides[store] = lambda: store_
    app.dependency_overrides[settings] = lambda: rehearsal
    with TestClient(app) as test_client:
        yield test_client, store_
    app.dependency_overrides.pop(store)
    app.dependency_overrides.pop(settings)


def _task(supplier_ref: str) -> OutreachTask:
    return OutreachTask(
        task_id=f"OUT-CASE-001-{supplier_ref}-test",
        case_id="CASE-001",
        supplier_ref=supplier_ref,
        channel=Channel.VOICE,
        brief=OutreachBrief(part_spec="6204-2RS", qty=36000, needed_by=date(2026, 9, 3)),
    )


def test_one_run_tells_the_whole_story(cases, records):
    result = run_case(case_id="CASE-001", records=records, cases=cases, today=TODAY)

    stages = [e.stage.value for e in cases.read_events("CASE-001")]
    assert stages[0] == "detected"
    assert "researching" in stages and "calling" in stages
    assert stages[-1] == "decided"
    assert result.outcome is not None and result.outcome.recommended is not None


def test_the_part_details_are_read_before_any_supplier_work(cases, records):
    run_case(case_id="CASE-001", records=records, cases=cases, today=TODAY)

    first = cases.read_events("CASE-001")[0]
    assert "6204-2RS" in first.message
    assert first.payload["hs_code"]  # the number that drives duty
    assert first.payload["weight_kg"]  # the number that drives freight


def test_every_rejected_supplier_is_named_with_its_reason(cases, records):
    run_case(case_id="CASE-001", records=records, cases=cases, today=TODAY)

    rejections = {
        e.payload["supplier_ref"]: e.payload["failed_rules"]
        for e in cases.read_events("CASE-001")
        if e.payload.get("passed") is False
    }
    assert rejections["SUP-NPB"] == ["blocked_origin_country"]
    assert rejections["SUP-PUL"] == ["missing_required_certification"]
    assert rejections["SUP-NBT"] == ["audit_required_and_not_audited"]


def test_the_live_call_supplier_is_left_uncalled(cases, records):
    result = run_case(
        case_id="CASE-001", records=records, cases=cases, today=TODAY, hold_for="SUP-KBY"
    )

    assert "SUP-KBY" not in [t.supplier_ref for t in result.tasks]
    assert "SUP-KBY" not in [c.supplier_ref for c in result.claims]
    # ...and the run still gets to a decision on what it has.
    assert result.outcome is not None and result.outcome.recommended is not None


def test_a_late_claim_caps_what_that_supplier_can_be_asked_for(cases, records):
    """The call is what tightens the plan: a supplier who says "8,000, the rest is
    promised" must not appear in any plan for more than 8,000."""
    run_case(case_id="CASE-001", records=records, cases=cases, today=TODAY, hold_for="SUP-SKF")

    supplier = records.get_supplier("SUP-SKF")
    incident = records.get_incident("CASE-001")
    assert supplier is not None and incident is not None
    claim = claim_from_quote(
        rehearsed_quote(_task("SUP-SKF"), supplier=supplier, incident=incident),
        qty_requested=incident.qty_required,
        supplier=supplier,
        today=TODAY,
    )
    assert claim.stock_status is StockStatus.IN_STOCK_ALLOCATED
    cases.write_claim(claim)

    after = run_case(case_id="CASE-001", records=records, cases=cases, today=TODAY)

    assert after.outcome is not None
    ordered = [
        line.qty
        for strategy in after.outcome.strategies
        for line in strategy.lines
        if line.supplier_ref == "SUP-SKF"
    ]
    assert ordered and max(ordered) <= claim.qty_offered


def test_rehearsed_quotes_agree_with_the_supplier_record(records):
    supplier = records.get_supplier("SUP-KBY")
    incident = records.get_incident("CASE-001")
    assert supplier is not None and incident is not None

    quote = rehearsed_quote(_task("SUP-KBY"), supplier=supplier, incident=incident)

    assert quote.lead_time_days is not None
    assert quote.lead_time_days >= (supplier.standard_lead_days or 0)
    assert quote.unit_price is not None
    assert quote.unit_price > (supplier.contract_unit_price or 0) * Decimal("0.9")
    # Their file says most of the stock is promised elsewhere, so they cannot
    # offer the whole order.
    assert 0 < quote.qty_offered < incident.qty_required


def test_rehearsed_quotes_are_the_same_every_run(records):
    supplier = records.get_supplier("SUP-RUL")
    incident = records.get_incident("CASE-001")
    assert supplier is not None and incident is not None

    first = rehearsed_quote(_task("SUP-RUL"), supplier=supplier, incident=incident)
    second = rehearsed_quote(_task("SUP-RUL"), supplier=supplier, incident=incident)
    assert first.model_dump() == second.model_dump()


def test_a_partial_offer_reads_as_allocated_stock(records):
    supplier = records.get_supplier("SUP-KBY")
    quote = Quote(
        task_id="OUT-1",
        case_id="CASE-001",
        supplier_ref="SUP-KBY",
        available=True,
        qty_offered=12000,
        lead_time_days=10,
    )

    claim = claim_from_quote(quote, qty_requested=36000, supplier=supplier, today=TODAY)

    assert claim.stock_status is StockStatus.IN_STOCK_ALLOCATED
    assert any("committed elsewhere" in note for note in claim.evidence)


def test_a_silent_call_stays_unknown_rather_than_optimistic(records):
    quote = Quote(task_id="OUT-2", case_id="CASE-001", supplier_ref="SUP-RUL")

    claim = claim_from_quote(quote, qty_requested=36000, today=TODAY)

    assert claim.stock_status is StockStatus.UNAVAILABLE
    assert claim.certification_current is Answer.UNKNOWN
    assert claim.part_number_confirmed is Answer.UNKNOWN
    assert claim.price_quoted is Answer.UNKNOWN


def test_an_expired_certificate_on_file_contradicts_the_claim(records):
    supplier = records.get_supplier("SUP-PUL")
    assert supplier is not None
    quote = Quote(
        task_id="OUT-3",
        case_id="CASE-001",
        supplier_ref="SUP-PUL",
        available=True,
        qty_offered=36000,
        lead_time_days=8,
        certs_claimed=["ISO_9001"],
    )

    claim = claim_from_quote(quote, qty_requested=36000, supplier=supplier, today=TODAY)

    assert claim.certification_current is Answer.NO


def test_run_endpoint_returns_ranked_options_for_a_buyer(client):
    test_client, _ = client
    body = test_client.post(
        "/flow/run", params={"case_id": "CASE-001", "hold_for": "SUP-KBY"}
    ).json()

    assert body["held_for"] == "SUP-KBY"
    assert sorted(body["rejected"]) == ["SUP-NBT", "SUP-NPB", "SUP-PUL"]
    options = body["decision"]["options"]
    assert len(options) > 1
    assert sum(1 for o in options if o["recommended"]) == 1
    assert "nothing is ordered" in body["decision"]["approval"]


def test_a_live_call_cannot_be_triggered_by_a_query_parameter(client):
    test_client, cases_ = client
    response = test_client.post(
        "/flow/call", params={"case_id": "CASE-001", "supplier_ref": "SUP-KBY", "live": True}
    )

    assert response.status_code == 409
    assert "LIVE_CALLS" in response.json()["detail"]
    assert cases_.read_claims("CASE-001") == []


def test_a_call_answered_later_is_collected_into_the_case(client):
    """The whole point of holding a supplier back: the answer arrives after the
    run, and collecting it re-prices the case rather than being dropped."""
    test_client, cases_ = client
    test_client.post("/flow/run", params={"case_id": "CASE-001", "hold_for": "SUP-KBY"})

    body = test_client.post(
        "/flow/call", params={"case_id": "CASE-001", "supplier_ref": "SUP-KBY"}
    ).json()
    assert body["provider"] == "rehearsal"
    assert body["live"] is False
    calling = [e for e in cases_.read_events("CASE-001") if e.stage.value == "calling"]
    assert calling and calling[-1].payload["live"] is False

    deadline = time.monotonic() + 10
    filed: list[str] = []
    while time.monotonic() < deadline and not filed:
        time.sleep(0.2)
        filed = test_client.post("/flow/collect", params={"case_id": "CASE-001"}).json()["filed"]

    assert filed == ["SUP-KBY"]
    assert "SUP-KBY" in [c.supplier_ref for c in cases_.read_claims("CASE-001")]
    # And a second collect is a no-op: one answer, one claim.
    assert test_client.post("/flow/collect", params={"case_id": "CASE-001"}).json()["filed"] == []


def test_state_reports_where_the_run_has_got_to(client):
    test_client, _ = client
    test_client.post("/flow/run", params={"case_id": "CASE-001"})

    body = test_client.get("/flow/state", params={"case_id": "CASE-001"}).json()
    assert body["stage"] == "decided"
    assert body["candidates"] == 6
    assert body["decision"]["options"]


def test_the_cockpit_snapshot_survives_a_screened_case(client):
    """Regression: the snapshot read `supplier_id` off a candidate, which only has
    a `supplier_ref`, so the case page 500'd as soon as a run had screened anyone."""
    test_client, _ = client
    test_client.post("/flow/run", params={"case_id": "CASE-001"})

    response = test_client.get("/cases/CASE-001")
    assert response.status_code == 200
    body = response.json()
    assert len(body["candidates"]) == 6
    assert len(body["supplier_records"]) == 6


def test_state_of_an_unknown_case_is_a_404(client):
    test_client, _ = client
    assert test_client.get("/flow/state", params={"case_id": "CASE-999"}).status_code == 404

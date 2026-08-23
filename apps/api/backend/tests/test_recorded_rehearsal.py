"""CASE-001 executes from recorded provider results with zero network access."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from backend.api.deps import case_module
from backend.api.main import create_app
from backend.cases.module import CaseModule, OpenCaseCommand
from backend.outreach.recorded import ProviderResult, RecordedOutreachAdapter
from backend.record.mock_erp import MockERP
from packages.contracts.models import OutreachTask


NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)


class LowConfidenceOutreach:
    def __init__(self) -> None:
        self.recorded = RecordedOutreachAdapter()

    def dispatch(self, tasks: list[OutreachTask]) -> list[ProviderResult]:
        results: list[ProviderResult] = []
        for result in self.recorded.dispatch(tasks):
            payload = deepcopy(result.payload)
            payload["completion_confidence"] = {"score": 0.0, "label": "low"}
            results.append(
                ProviderResult(
                    task_id=result.task_id,
                    case_id=result.case_id,
                    supplier_ref=result.supplier_ref,
                    payload=payload,
                )
            )
        return results


def test_case_001_is_computed_from_recorded_supplier_results(tmp_path, monkeypatch, erp):
    def block_network(*_args, **_kwargs):
        raise AssertionError("recorded rehearsal attempted a network connection")

    monkeypatch.setattr("socket.create_connection", block_network)
    monkeypatch.setattr("socket.socket.connect", block_network)
    module = CaseModule(
        records=erp,
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-001",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        opened = client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-001"}
        )
        snapshot = client.get("/cases/CASE-001").json()
        events = client.get("/cases/CASE-001/events").json()

    assert opened.status_code == 201
    assert snapshot["incident"]["qty_required"] == 40000
    assert snapshot["incident"]["qty_on_hand"] == 8000
    assert len(snapshot["incident"]["plants"]) == 2
    assert [candidate["supplier_name"] for candidate in snapshot["candidates"]] == [
        "SKF Nordic",
        "Schaeffler FAG",
        "NSK Europe",
        "Shenzhen Bearing Co",
        "Munich Motion",
    ]
    assert len(snapshot["claims"]) == 4
    assert len(snapshot["outreach_tasks"]) == 4
    assert all(claim["task_id"] for claim in snapshot["claims"])
    assert all(claim["round"] == 1 for claim in snapshot["claims"])

    rejected = [candidate for candidate in snapshot["candidates"] if not candidate["compliance"]["passed"]]
    assert rejected[0]["supplier_name"] == "Shenzhen Bearing Co"
    assert rejected[0]["compliance"]["failed_rules"] == ["blocked_origin_country"]

    records = {record["supplier_id"]: record for record in snapshot["supplier_records"]}
    claims = {claim["supplier_ref"]: claim for claim in snapshot["claims"]}
    assert claims["SUP-SKF"]["unit_price"] != records["SUP-SKF"]["contract_unit_price"]
    assert claims["SUP-MUN"]["stock_status"] == "in_stock_allocated"

    decision = snapshot["decision"]
    assert decision["revision"] == 1
    assert decision["status"] == "ready"
    assert decision["checks"] == {"policy_passed": True, "cost_model_passed": True}
    recommended = next(
        strategy
        for strategy in decision["strategies"]
        if strategy["strategy_id"] == decision["recommended_strategy_id"]
    )
    assert [
        (line["supplier_ref"], line["qty"], line["mode"])
        for line in recommended["lines"]
    ] == [("SUP-SKF", 6400, "air"), ("SUP-FAG", 25600, "sea")]
    assert recommended["total_cost"] == "94880.00"
    assert "SUP-NSK" not in {line["supplier_ref"] for line in recommended["lines"]}
    assert "SUP-MUN" not in {line["supplier_ref"] for line in recommended["lines"]}

    assert [event["seq"] for event in events] == list(range(1, len(events) + 1))
    assert snapshot["last_event_seq"] == events[-1]["seq"]


def test_failed_checks_do_not_create_a_ready_decision_or_ready_event(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-FAILED",
        outreach=LowConfidenceOutreach(),
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        opened = client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-FAILED"}
        )
        snapshot = client.get("/cases/CASE-FAILED").json()
        events = client.get("/cases/CASE-FAILED/events").json()

    assert opened.status_code == 201
    assert snapshot["decision"] is None
    assert not any("ready for human approval" in event["message"] for event in events)
    assert any(
        event["payload"].get("policy_passed") is False
        and event["payload"].get("cost_model_passed") is False
        for event in events
    )


def test_missing_recordings_become_persisted_unknown_claims(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        outreach=RecordedOutreachAdapter(tmp_path / "missing-recordings"),
    )

    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-MISSING"))
    snapshot = module.get_case("CASE-MISSING")

    assert len(snapshot.claims) == 4
    assert all(claim.confidence == 0.0 for claim in snapshot.claims)
    assert all(claim.stock_status.value == "unclear" for claim in snapshot.claims)
    assert all(claim.price_quoted.value == "unknown" for claim in snapshot.claims)
    assert snapshot.decision is None


def test_invalid_json_recording_becomes_a_persisted_unknown_claim(tmp_path):
    fixtures_root = tmp_path / "recordings"
    case_directory = fixtures_root / "CASE-INVALID-JSON"
    case_directory.mkdir(parents=True)
    (case_directory / "skf.json").write_text("{not-json", encoding="utf-8")
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        outreach=RecordedOutreachAdapter(fixtures_root),
    )

    module.open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-INVALID-JSON")
    )
    snapshot = module.get_case("CASE-INVALID-JSON")

    assert len(snapshot.claims) == 4
    assert all(claim.confidence == 0.0 for claim in snapshot.claims)
    assert all(claim.stock_status.value == "unclear" for claim in snapshot.claims)
    assert snapshot.decision is None


def test_schema_invalid_recording_becomes_a_persisted_unknown_claim(tmp_path):
    fixtures_root = tmp_path / "recordings"
    case_directory = fixtures_root / "CASE-INVALID-SCHEMA"
    case_directory.mkdir(parents=True)
    (case_directory / "skf.json").write_text(
        json.dumps(
            {
                "fixture_version": 1,
                "supplier_ref": "SUP-SKF",
                "structured_result": {
                    "available": True,
                    "qty_offered": [6400],
                    "unit_price": "3.1000",
                    "stock_status": "free_in_stock",
                    "price_quoted": "yes",
                },
                "completion_confidence": {"score": 0.99, "label": "high"},
            }
        ),
        encoding="utf-8",
    )
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        outreach=RecordedOutreachAdapter(fixtures_root),
    )

    module.open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-INVALID-SCHEMA")
    )
    snapshot = module.get_case("CASE-INVALID-SCHEMA")
    skf = next(claim for claim in snapshot.claims if claim.supplier_ref == "SUP-SKF")

    assert skf.confidence == 0.0
    assert skf.available is False
    assert skf.qty_offered == 0
    assert skf.unit_price is None
    assert skf.stock_status.value == "unclear"
    assert skf.price_quoted.value == "unknown"
    assert snapshot.decision is None

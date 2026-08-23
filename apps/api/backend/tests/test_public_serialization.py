"""Public Case routes project persisted state through the safe DTO boundary."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from backend.api.deps import case_module
from backend.api.main import create_app
from backend.cases.module import CaseModule
from backend.outreach.recorded import ProviderResult, RecordedOutreachAdapter
from backend.record.mock_erp import MockERP
from packages.contracts.enums import Actor, Stage
from packages.contracts.models import Event, OutreachTask


NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)
RAW_PHONE = "+4930231250199"
RAW_EMAIL = "buyer@example.invalid"


class TaintedRecordedOutreach:
    """Add provider secrets to one recorded result before normalizing it."""

    def __init__(self) -> None:
        self.recorded = RecordedOutreachAdapter()

    def dispatch(self, tasks: list[OutreachTask]) -> list[ProviderResult]:
        results: list[ProviderResult] = []
        for result in self.recorded.dispatch(tasks):
            if result.supplier_ref != "SUP-SKF":
                results.append(result)
                continue
            payload = deepcopy(result.payload)
            payload["authorization"] = "Bearer provider-secret"
            payload["request_body"] = {"phone": RAW_PHONE}
            payload["summary"] = f"Call {RAW_PHONE}; email {RAW_EMAIL}; token=provider-secret"
            payload["evidence"] = [f"Confirmed by {RAW_EMAIL}"]
            payload["transcript_turns"][1]["text"] = f"Call me at {RAW_PHONE}"
            results.append(
                ProviderResult(
                    task_id=result.task_id,
                    case_id=result.case_id,
                    supplier_ref=result.supplier_ref,
                    payload=payload,
                )
            )
        return results


def _keys(value):
    if isinstance(value, dict):
        return set(value) | {key for item in value.values() for key in _keys(item)}
    if isinstance(value, list):
        return {key for item in value for key in _keys(item)}
    return set()


def test_public_case_and_event_routes_exclude_and_scrub_internal_data(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-SAFE",
        outreach=TaintedRecordedOutreach(),
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-SAFE"}
        ).status_code == 201
        module.store.append_event(
            Event(
                case_id="CASE-SAFE",
                ts=NOW,
                actor=Actor.SYSTEM,
                stage=Stage.DECIDED,
                message=f"Contact {RAW_PHONE}",
                payload={
                    "approved_by": RAW_EMAIL,
                    "strategy_id": "STR-01 token=provider-secret",
                    "raw": {"authorization": "Bearer provider-secret"},
                },
            )
        )
        snapshot = client.get("/cases/CASE-SAFE").json()
        events = client.get("/cases/CASE-SAFE/events").json()

    forbidden = {
        "raw",
        "call_id",
        "transcript_url",
        "recording_url",
        "notes",
        "email",
        "marketplace_url",
        "pr_url",
        "authorization",
        "request_body",
    }
    assert forbidden.isdisjoint(_keys(snapshot))
    assert forbidden.isdisjoint(_keys(events))

    serialized = json.dumps({"snapshot": snapshot, "events": events})
    assert RAW_PHONE not in serialized
    assert RAW_EMAIL not in serialized
    assert "provider-secret" not in serialized

    skf = next(claim for claim in snapshot["claims"] if claim["supplier_ref"] == "SUP-SKF")
    assert skf["summary"] == (
        "Call +49*******0199; email [redacted-email]; token=[redacted]"
    )
    assert skf["transcript"][1]["text"] == "Call me at +49*******0199"
    assert skf["evidence"] == ["Confirmed by [redacted-email]"]
    assert events[-1]["message"] == "Contact +49*******0199"
    assert events[-1]["payload"] == {
        "approved_by": "[redacted-email]",
        "strategy_id": "STR-01 token=[redacted]",
    }

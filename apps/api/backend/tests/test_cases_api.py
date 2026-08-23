"""Public Cockpit Case routes use the persisted Case module."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.api.deps import case_module
from backend.api.main import create_app
from backend.cases.module import CaseModule, OpenCaseCommand
from backend.record.mock_erp import MockERP


NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)


def test_post_case_returns_201_and_is_visible_through_public_reads(tmp_path):
    database_path = tmp_path / "cases.db"
    module = CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "CASE-HTTP",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        opened = client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-HTTP"}
        )
        listed = client.get("/cases")
        snapshot = client.get("/cases/CASE-HTTP")

    assert opened.status_code == 201
    assert opened.json()["session_id"] == "deterministic:CASE-HTTP:1"
    assert [item["case_id"] for item in listed.json()] == ["CASE-HTTP"]
    assert snapshot.json()["case_id"] == "CASE-HTTP"


def test_case_commands_map_domain_and_validation_failures_without_mutation(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-HTTP",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-HTTP"}
        ).status_code == 201
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-HTTP"}
        ).status_code == 409
        assert client.post(
            "/cases", json={"part_id": "PRT-NOT-FOUND", "case_id": "CASE-MISSING"}
        ).status_code == 404
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "qty_required": 0}
        ).status_code == 422
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "unexpected": True}
        ).status_code == 422
        listed = client.get("/cases").json()

    assert [item["case_id"] for item in listed] == ["CASE-HTTP"]


def test_case_list_is_stable_and_snapshots_survive_a_new_module(tmp_path):
    database_path = tmp_path / "cases.db"
    records = MockERP()
    for case_id, opened_at in (
        ("CASE-Z", NOW),
        ("CASE-B", NOW + timedelta(hours=1)),
        ("CASE-A", NOW + timedelta(hours=1)),
    ):
        CaseModule(
            records=records,
            database_path=database_path,
            clock=lambda opened_at=opened_at: opened_at,
            id_generator=lambda case_id=case_id: case_id,
        ).open_case(OpenCaseCommand(part_id="PRT-6204", case_id=case_id))

    restarted = CaseModule(
        records=records,
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "UNUSED",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: restarted

    with TestClient(app) as client:
        listed = client.get("/cases")
        snapshot = client.get("/cases/CASE-Z")

    assert listed.status_code == 200
    assert [item["case_id"] for item in listed.json()] == ["CASE-A", "CASE-B", "CASE-Z"]
    assert snapshot.status_code == 200
    assert snapshot.json()["decision"]["status"] == "ready"


def test_openapi_contains_only_the_public_case_contract():
    schema = create_app().openapi()

    assert {path for path in schema["paths"] if path.startswith("/cases")} == {
        "/cases",
        "/cases/{case_id}",
        "/cases/{case_id}/events",
        "/cases/{case_id}/decision/approve",
    }

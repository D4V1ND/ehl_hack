"""A checked Decision becomes final only through human approval."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.api.deps import case_module
from backend.api.main import create_app
from backend.cases.module import (
    ApproveDecisionCommand,
    CaseConflictError,
    CaseModule,
    OpenCaseCommand,
)
from backend.cases.runners import CaseRunContext, RunnerReceipt
from backend.casestore.sqlite_case_store import DecisionFinalError
from backend.record.mock_erp import MockERP
from packages.contracts.enums import Actor, DecisionStatus, Stage
from packages.contracts.models import DecisionChecks, Event


NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)


class NoopRunner:
    def start(self, context: CaseRunContext) -> RunnerReceipt:
        return RunnerReceipt(run_id=f"noop:{context.case_id}")


class ErrorReceiptRunner:
    def start(self, context: CaseRunContext) -> RunnerReceipt:
        return RunnerReceipt(
            run_id=f"failed:{context.case_id}:{context.revision}",
            error="runner unavailable",
        )


def test_approval_is_atomic_final_and_idempotent(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-001",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-001"}
        ).status_code == 201
        before = client.get("/cases/CASE-001").json()
        approved = client.post(
            "/cases/CASE-001/decision/approve",
            json={"decision_revision": 1, "approved_by": "buyer@example.invalid"},
        )
        retry = client.post(
            "/cases/CASE-001/decision/approve",
            json={"decision_revision": 1, "approved_by": "buyer@example.invalid"},
        )
        altered = client.post(
            "/cases/CASE-001/decision/approve",
            json={"decision_revision": 1, "approved_by": "other@example.invalid"},
        )
        after = client.get("/cases/CASE-001").json()
        events = client.get("/cases/CASE-001/events").json()

    assert approved.status_code == 200
    assert approved.json()["decision"]["status"] == "approved"
    assert approved.json()["decision"]["approved_by"] == "[redacted-email]"
    assert approved.json()["decision"]["revision"] == 1
    assert retry.status_code == 200
    assert retry.json()["last_event_seq"] == approved.json()["last_event_seq"]
    assert altered.status_code == 409
    assert after["last_event_seq"] == before["last_event_seq"] + 1
    assert events[-1]["actor"] == "human"
    assert events[-1]["payload"] == {
        "decision_revision": 1,
        "approved_by": "[redacted-email]",
    }
    assert sum(event["actor"] == "human" for event in events) == 1

    persisted = module.store.get_case("CASE-001").decision
    assert persisted is not None
    rerun = persisted.model_copy(
        update={
            "revision": 2,
            "status": DecisionStatus.READY,
            "approved_at": None,
            "approved_by": None,
        }
    )
    with pytest.raises(DecisionFinalError):
        module.store.save_decision(
            rerun,
            Event(
                case_id="CASE-001",
                ts=NOW,
                actor=Actor.DEVIN,
                stage=Stage.DECIDED,
                message="runner tried to replace an approved Decision",
            ),
        )
    final = module.store.get_case("CASE-001")
    assert final.decision is not None
    assert final.decision.revision == 1
    assert final.last_event_seq == after["last_event_seq"]


def test_approval_rejects_missing_and_invalid_commands(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-001",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        missing = client.post(
            "/cases/NO-CASE/decision/approve",
            json={"decision_revision": 1, "approved_by": "buyer"},
        )
        invalid = client.post(
            "/cases/NO-CASE/decision/approve",
            json={"decision_revision": 0, "approved_by": ""},
        )

    assert missing.status_code == 404
    assert invalid.status_code == 422


def test_approval_rejects_a_missing_decision(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-NO-DECISION",
        runner=NoopRunner(),
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        assert client.post(
            "/cases",
            json={"part_id": "PRT-6204", "case_id": "CASE-NO-DECISION"},
        ).status_code == 201
        response = client.post(
            "/cases/CASE-NO-DECISION/decision/approve",
            json={"decision_revision": 1, "approved_by": "buyer"},
        )

    assert response.status_code == 404
    assert module.get_case("CASE-NO-DECISION").decision is None


def test_approval_rejects_stale_revision_and_failed_checks_without_mutation(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-CHECKS",
    )
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        assert client.post(
            "/cases", json={"part_id": "PRT-6204", "case_id": "CASE-CHECKS"}
        ).status_code == 201
        before_stale = client.get("/cases/CASE-CHECKS").json()
        stale = client.post(
            "/cases/CASE-CHECKS/decision/approve",
            json={"decision_revision": 2, "approved_by": "buyer"},
        )
        after_stale = client.get("/cases/CASE-CHECKS").json()

        decision = module.store.get_case("CASE-CHECKS").decision
        assert decision is not None
        failed = decision.model_copy(
            update={
                "revision": 2,
                "checks": DecisionChecks(
                    policy_passed=False,
                    cost_model_passed=True,
                )
            }
        )
        module.store.save_decision(
            failed,
            Event(
                case_id="CASE-CHECKS",
                ts=NOW,
                actor=Actor.DEVIN,
                stage=Stage.DECIDED,
                message="Decision checks failed",
            ),
        )
        before_failed = client.get("/cases/CASE-CHECKS").json()
        failed_checks = client.post(
            "/cases/CASE-CHECKS/decision/approve",
            json={"decision_revision": 2, "approved_by": "buyer"},
        )
        after_failed = client.get("/cases/CASE-CHECKS").json()

    assert stale.status_code == 409
    assert after_stale == before_stale
    assert failed_checks.status_code == 409
    assert after_failed == before_failed


def test_failed_newer_run_makes_the_older_ready_decision_unapprovable(tmp_path):
    database_path = tmp_path / "cases.db"
    CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "CASE-STALE-READY",
    ).open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-STALE-READY")
    )
    module = CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        runner=ErrorReceiptRunner(),
    )

    failed = module.rerun_case("CASE-STALE-READY")
    before = module.get_case("CASE-STALE-READY")

    assert failed.session_id == "failed:CASE-STALE-READY:2"
    assert before.decision is not None
    assert before.decision.revision == 1
    with pytest.raises(CaseConflictError, match="approvable"):
        module.approve_decision(
            "CASE-STALE-READY",
            ApproveDecisionCommand(decision_revision=1, approved_by="buyer"),
        )

    assert module.get_case("CASE-STALE-READY") == before
    assert not any(
        event.actor == Actor.HUMAN
        for event in module.get_events("CASE-STALE-READY", 0)
    )

"""The persisted Case interface survives process-local module state."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pytest

from backend.cases.module import (
    ApproveDecisionCommand,
    CaseConflictError,
    CaseModule,
    OpenCaseCommand,
)
from backend.cases.runners import CaseRunContext, RunnerReceipt
from backend.record.mock_erp import MockERP


NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)


class RaisingRunner:
    def start(self, context: CaseRunContext) -> RunnerReceipt:
        raise RuntimeError(f"run {context.revision} failed before execution")


class ErrorReceiptRunner:
    def start(self, context: CaseRunContext) -> RunnerReceipt:
        return RunnerReceipt(
            run_id=f"failed:{context.case_id}:{context.revision}",
            error="runner unavailable",
        )


def test_opened_case_is_readable_from_a_new_module_instance(tmp_path):
    database_path = tmp_path / "cases.db"
    records = MockERP()
    module = CaseModule(
        records=records,
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "CASE-OPENED",
    )

    opened = module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-OPENED"))

    restarted = CaseModule(
        records=records,
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "UNUSED",
    )
    snapshot = restarted.get_case(opened.case_id)
    assert snapshot.case_id == "CASE-OPENED"
    assert snapshot.incident.part_id == "PRT-6204"
    assert snapshot.last_event_seq >= 1
    assert restarted.store.get_case(opened.case_id).runner_id == "deterministic:CASE-OPENED:1"
    assert any(
        event.message == "Case runner receipt persisted"
        for event in restarted.get_events(opened.case_id, 0)
    )


def test_generated_case_id_retries_a_collision(tmp_path):
    database_path = tmp_path / "cases.db"
    records = MockERP()
    first = CaseModule(
        records=records,
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "CASE-COLLISION",
    )
    first.open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-COLLISION")
    )

    generated = iter(("CASE-COLLISION", "CASE-GENERATED"))
    second = CaseModule(
        records=records,
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: next(generated),
    )

    opened = second.open_case(OpenCaseCommand(part_id="PRT-6204"))

    assert opened.case_id == "CASE-GENERATED"
    assert [case.case_id for case in second.list_cases()] == [
        "CASE-COLLISION",
        "CASE-GENERATED",
    ]


def test_rerun_increments_revision_and_cannot_mutate_an_approved_case(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-RERUN",
    )
    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-RERUN"))

    receipt = module.rerun_case("CASE-RERUN")
    rerun = module.get_case("CASE-RERUN")

    assert receipt.session_id == "deterministic:CASE-RERUN:2"
    assert rerun.decision is not None
    assert rerun.decision.revision == 2
    assert any(
        event.payload.get("decision_revision") == 2
        for event in module.get_events("CASE-RERUN", 0)
    )

    module.approve_decision(
        "CASE-RERUN",
        ApproveDecisionCommand(decision_revision=2, approved_by="buyer"),
    )
    approved = module.get_case("CASE-RERUN")

    with pytest.raises(CaseConflictError, match="approved"):
        module.rerun_case("CASE-RERUN")

    assert module.get_case("CASE-RERUN") == approved


def test_rerun_preserves_prior_outreach_and_links_the_next_round_to_revision(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-ROUNDS",
    )
    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-ROUNDS"))
    first = module.get_case("CASE-ROUNDS")
    first_task_ids = {task.task_id for task in first.outreach_tasks}
    first_claim_ids = {claim.task_id for claim in first.claims}

    module.rerun_case("CASE-ROUNDS")
    rerun = module.get_case("CASE-ROUNDS")

    assert rerun.decision is not None
    assert rerun.decision.revision == 2
    assert first_task_ids < {task.task_id for task in rerun.outreach_tasks}
    assert first_claim_ids < {claim.task_id for claim in rerun.claims}
    assert len(rerun.outreach_tasks) == 8
    assert len(rerun.claims) == 8
    assert {task.round for task in rerun.outreach_tasks} == {1, 2}
    assert {claim.round for claim in rerun.claims} == {1, 2}
    second_round_tasks = {
        task.task_id for task in rerun.outreach_tasks if task.round == rerun.decision.revision
    }
    assert {
        claim.task_id for claim in rerun.claims if claim.round == rerun.decision.revision
    } == second_round_tasks


def test_failed_initial_and_rerun_attempts_never_reuse_a_revision(tmp_path):
    database_path = tmp_path / "cases.db"
    with pytest.raises(RuntimeError, match="run 1 failed"):
        CaseModule(
            records=MockERP(),
            database_path=database_path,
            clock=lambda: NOW,
            id_generator=lambda: "CASE-FAILED-RUNS",
            runner=RaisingRunner(),
        ).open_case(
            OpenCaseCommand(part_id="PRT-6204", case_id="CASE-FAILED-RUNS")
        )

    failed_rerun = CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        runner=ErrorReceiptRunner(),
    ).rerun_case("CASE-FAILED-RUNS")
    assert failed_rerun.session_id == "failed:CASE-FAILED-RUNS:2"
    assert failed_rerun.session_error == "runner unavailable"

    recovered = CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
    )
    receipt = recovered.rerun_case("CASE-FAILED-RUNS")
    snapshot = recovered.get_case("CASE-FAILED-RUNS")

    assert receipt.session_id == "deterministic:CASE-FAILED-RUNS:3"
    assert snapshot.decision is not None
    assert snapshot.decision.revision == 3
    assert {task.round for task in snapshot.outreach_tasks} == {3}
    assert {claim.round for claim in snapshot.claims} == {3}


def test_task_completion_and_claim_rescreening_have_matching_events(tmp_path):
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "CASE-AUDIT-PAIRS",
    )

    module.open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-AUDIT-PAIRS")
    )
    snapshot = module.get_case("CASE-AUDIT-PAIRS")
    events = module.get_events("CASE-AUDIT-PAIRS", 0)

    completion = next(
        event
        for event in events
        if event.payload.get("round") == 1
        and event.payload.get("status") == "completed"
    )
    rescreen = next(
        event
        for event in events
        if event.message == "Re-screened 5 Candidates with round 1 Claims"
    )

    assert all(task.status.value == "completed" for task in snapshot.outreach_tasks)
    assert completion.payload["candidate_count"] == len(snapshot.outreach_tasks)
    assert rescreen.payload == {
        "candidate_count": len(snapshot.candidates),
        "rejected_count": sum(
            not candidate.compliance.passed for candidate in snapshot.candidates
        ),
        "round": 1,
        "failed_rules": [
            rule.value
            for candidate in snapshot.candidates
            if not candidate.compliance.passed
            for rule in candidate.compliance.failed_rules
        ],
    }
    assert completion.seq < rescreen.seq


def test_existing_case_database_backfills_the_reserved_revision(tmp_path):
    database_path = tmp_path / "cases.db"
    CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "CASE-EXISTING-DB",
    ).open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-EXISTING-DB")
    )
    with sqlite3.connect(database_path) as connection:
        connection.execute("ALTER TABLE cases DROP COLUMN run_revision")

    restarted = CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
    )
    receipt = restarted.rerun_case("CASE-EXISTING-DB")

    assert receipt.session_id == "deterministic:CASE-EXISTING-DB:2"
    assert restarted.get_case("CASE-EXISTING-DB").decision.revision == 2

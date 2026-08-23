"""Committed Events are immutable state-change cursors, not a merged view."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Event as ThreadEvent

import pytest
from fastapi.testclient import TestClient

from backend.api.deps import case_module
from backend.api.main import create_app
from backend.cases.module import CaseModule, OpenCaseCommand
from backend.cases.runners import CaseRunContext, RunnerReceipt
from backend.record.mock_erp import MockERP
from packages.contracts.enums import Actor, Stage
from packages.contracts.models import Candidate, ComplianceResult, Event


NOW = datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc)


class NewestRunWinsRunner:
    def __init__(self) -> None:
        self.newer_committed = ThreadEvent()

    def start(self, context: CaseRunContext) -> RunnerReceipt:
        if context.revision == 2:
            assert self.newer_committed.wait(timeout=5)
            context.execute()
        else:
            context.execute()
            self.newer_committed.set()
        return RunnerReceipt(
            run_id=f"concurrent:{context.case_id}:{context.revision}"
        )


def _module(tmp_path):
    return CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: NOW,
        id_generator=lambda: "UNUSED",
    )


def test_state_and_event_for_different_cases_roll_back_together(tmp_path):
    module = _module(tmp_path)
    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-A"))
    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-B"))
    candidates_before = module.store.get_case("CASE-A").candidates
    candidate = Candidate(
        case_id="CASE-A",
        supplier_ref="SUP-SKF",
        supplier_name="SKF Nordic",
        country="DE",
        confidence=1,
        why_matched="trusted record",
        channel="voice",
        compliance=ComplianceResult(passed=True),
    )
    wrong_event = Event(
        case_id="CASE-B",
        ts=NOW,
        actor=Actor.SYSTEM,
        stage=Stage.RESEARCHING,
        message="screened candidate",
    )

    with pytest.raises(ValueError, match="same Case"):
        module.store.replace_candidates("CASE-A", [candidate], [wrong_event])

    assert module.store.get_case("CASE-A").candidates == candidates_before
    assert len(module.get_events("CASE-B", 0)) == module.get_case("CASE-B").last_event_seq


def test_cursor_is_gap_free_strict_and_stable_across_restart(tmp_path):
    module = _module(tmp_path)
    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-CURSOR"))
    initial_high_water = module.get_case("CASE-CURSOR").last_event_seq

    def append(index: int):
        return module.store.append_event(
            Event(
                case_id="CASE-CURSOR",
                ts=NOW,
                actor=Actor.SYSTEM,
                stage=Stage.RESEARCHING,
                message=f"writer {index}",
            )
        )

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(append, range(8)))

    restarted = _module(tmp_path)
    assert [event.seq for event in restarted.get_events("CASE-CURSOR", 0)] == list(
        range(1, initial_high_water + 9)
    )
    assert [
        event.seq
        for event in restarted.get_events("CASE-CURSOR", initial_high_water + 4)
    ] == list(range(initial_high_water + 5, initial_high_water + 9))
    assert restarted.get_events("CASE-CURSOR", initial_high_water + 8) == []
    assert restarted.get_case("CASE-CURSOR").last_event_seq == initial_high_water + 8


def test_public_event_cursor_rejects_bad_values_and_unknown_cases(tmp_path):
    module = _module(tmp_path)
    module.open_case(OpenCaseCommand(part_id="PRT-6204", case_id="CASE-CURSOR"))
    app = create_app()
    app.dependency_overrides[case_module] = lambda: module

    with TestClient(app) as client:
        assert client.get("/cases/CASE-CURSOR/events", params={"since": -1}).status_code == 422
        assert client.get(
            "/cases/CASE-CURSOR/events", params={"since": "later"}
        ).status_code == 422
        assert client.get("/cases/CASE-MISSING/events").status_code == 404


def test_concurrent_reruns_leave_only_the_winning_run_state_and_events(tmp_path):
    database_path = tmp_path / "cases.db"
    CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        id_generator=lambda: "CASE-CONCURRENT-RUNS",
    ).open_case(
        OpenCaseCommand(part_id="PRT-6204", case_id="CASE-CONCURRENT-RUNS")
    )
    module = CaseModule(
        records=MockERP(),
        database_path=database_path,
        clock=lambda: NOW,
        runner=NewestRunWinsRunner(),
    )

    with ThreadPoolExecutor(max_workers=2) as pool:
        attempts = [
            pool.submit(module.rerun_case, "CASE-CONCURRENT-RUNS")
            for _ in range(2)
        ]
        outcomes = []
        errors = []
        for attempt in attempts:
            try:
                outcomes.append(attempt.result())
            except RuntimeError as error:
                errors.append(error)

    snapshot = module.get_case("CASE-CONCURRENT-RUNS")
    events = module.get_events("CASE-CONCURRENT-RUNS", 0)

    assert [outcome.session_id for outcome in outcomes] == [
        "concurrent:CASE-CONCURRENT-RUNS:3"
    ]
    assert len(errors) == 1
    assert snapshot.decision is not None
    assert snapshot.decision.revision == 3
    assert {task.round for task in snapshot.outreach_tasks} == {1, 3}
    assert {claim.round for claim in snapshot.claims} == {1, 3}
    assert not any(event.payload.get("round") == 2 for event in events)

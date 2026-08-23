"""The checklist the cockpit renders.

Two properties matter more than the rest. The fixed headers must be identical on
every case, because the frontend is designed against them before any run exists.
And an update must be idempotent on `step_id`: an agent that retries a call, or
a deterministic run replayed on top of one, must not leave the buyer looking at
"Calling Kugellager Bayern" three times.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend import plan
from backend.api.deps import settings, store
from backend.api.main import app
from backend.api.settings import get_settings
from backend.casestore.case_store import CaseStore
from backend.flow.conductor import run_case
from backend.record.mock_erp import get_mock_erp
from packages.contracts.enums import PlanGroup, StepStatus

TODAY = date(2026, 8, 22)


@pytest.fixture
def cases(tmp_path) -> CaseStore:
    return CaseStore(tmp_path / "cases")


@pytest.fixture
def records():
    return get_mock_erp()


@pytest.fixture
def client(tmp_path):
    store_ = CaseStore(tmp_path / "cases")
    app.dependency_overrides[store] = lambda: store_
    app.dependency_overrides[settings] = lambda: replace(
        get_settings(), github_token=None, github_repo=None
    )
    with TestClient(app) as test_client:
        yield test_client, store_
    app.dependency_overrides.pop(store)
    app.dependency_overrides.pop(settings)


def test_seed_gives_every_case_the_same_headers_in_the_same_order(cases):
    seeded = plan.seed("CASE-001", cases)

    assert [s.group for s in seeded.sections] == list(plan.SECTION_ORDER)
    assert [s.label for s in seeded.sections] == [
        plan.SECTION_LABELS[g] for g in plan.SECTION_ORDER
    ]
    assert seeded.done == 0
    assert seeded.total == len(plan.SEEDED_STEPS)
    assert all(step.status is StepStatus.PENDING for s in seeded.sections for step in s.steps)


def test_seeding_twice_does_not_duplicate_or_reset(cases):
    plan.seed("CASE-001", cases)
    plan.advance("CASE-001", cases, step_id="erp:part", status=StepStatus.DONE)

    again = plan.seed("CASE-001", cases)

    assert again.total == len(plan.SEEDED_STEPS)
    assert again.done == 1


def test_an_agent_adds_the_suppliers_it_decided_to_call(cases):
    plan.seed("CASE-001", cases)

    for ref, name in (("SUP-KBY", "Kugellager Bayern"), ("SUP-RUL", "Rulmenti")):
        plan.upsert(
            "CASE-001",
            cases,
            step_id=plan.supplier_step_id(PlanGroup.OUTREACH, ref),
            group=PlanGroup.OUTREACH,
            label=f"Calling {name}",
            supplier_ref=ref,
            status=StepStatus.ACTIVE,
        )

    outreach = next(s for s in plan.read("CASE-001", cases).sections if s.group is PlanGroup.OUTREACH)
    dynamic = [step for step in outreach.steps if step.dynamic]
    assert [step.label for step in dynamic] == ["Calling Kugellager Bayern", "Calling Rulmenti"]
    # The fixed brief stays first: dynamic work is appended, never interleaved.
    assert outreach.steps[0].step_id == "outreach:brief"


def test_a_retried_update_is_the_same_line(cases):
    plan.seed("CASE-001", cases)
    step_id = plan.supplier_step_id(PlanGroup.OUTREACH, "SUP-KBY")
    for _ in range(3):
        plan.upsert(
            "CASE-001",
            cases,
            step_id=step_id,
            group=PlanGroup.OUTREACH,
            label="Calling Kugellager Bayern",
            supplier_ref="SUP-KBY",
            status=StepStatus.ACTIVE,
        )
    plan.upsert("CASE-001", cases, step_id=step_id, status=StepStatus.DONE, detail="free in stock")

    steps = [s for s in plan.read("CASE-001", cases).sections for s in s.steps]
    matching = [s for s in steps if s.step_id == step_id]
    assert len(matching) == 1
    assert matching[0].status is StepStatus.DONE
    assert matching[0].started_at is not None and matching[0].completed_at is not None


def test_a_new_step_without_a_label_is_refused(cases):
    plan.seed("CASE-001", cases)
    with pytest.raises(ValueError):
        plan.upsert("CASE-001", cases, step_id="outreach:SUP-NEW", status=StepStatus.ACTIVE)


def test_advance_never_invents_a_step(cases):
    """A typo in a step id must not add a line nobody planned."""
    plan.seed("CASE-001", cases)
    assert plan.advance("CASE-001", cases, step_id="erp:prt", status=StepStatus.DONE) is None
    assert plan.read("CASE-001", cases).total == len(plan.SEEDED_STEPS)


def test_section_status_and_active_step_follow_the_steps(cases):
    plan.seed("CASE-001", cases)
    plan.advance("CASE-001", cases, step_id="intake:incident", status=StepStatus.DONE)
    plan.advance("CASE-001", cases, step_id="erp:part", status=StepStatus.ACTIVE)

    read = plan.read("CASE-001", cases)
    by_group = {s.group: s for s in read.sections}
    assert by_group[PlanGroup.INTAKE].status is StepStatus.DONE
    assert by_group[PlanGroup.ERP].status is StepStatus.ACTIVE
    assert by_group[PlanGroup.REVIEW].status is StepStatus.PENDING
    assert read.active_step_id == "erp:part"
    assert (read.done, read.total) == (1, len(plan.SEEDED_STEPS))


def test_a_failed_step_does_not_stall_the_section(cases):
    plan.seed("CASE-001", cases)
    for step_id in ("erp:part", "erp:stock", "erp:open_pos"):
        plan.advance("CASE-001", cases, step_id=step_id, status=StepStatus.DONE)
    plan.advance(
        "CASE-001", cases, step_id="erp:price_history", status=StepStatus.SKIPPED,
    )
    erp_section = next(s for s in plan.read("CASE-001", cases).sections if s.group is PlanGroup.ERP)
    assert erp_section.status is StepStatus.DONE


def test_a_corrupt_row_is_dropped_rather_than_killing_the_screen(cases, tmp_path):
    plan.seed("CASE-001", cases)
    path = cases.case_dir("CASE-001") / "plan.json"
    path.write_text('[{"step_id": "junk"}]\n', encoding="utf-8")
    assert plan.read("CASE-001", cases).total == 0


def test_a_deterministic_run_ticks_the_whole_list(cases, records):
    run_case(case_id="CASE-001", records=records, cases=cases, today=TODAY, hold_for="SUP-KBY")

    read = plan.read("CASE-001", cases)
    steps = {s.step_id: s for section in read.sections for s in section.steps}
    assert steps["erp:part"].status is StepStatus.DONE
    assert steps["review:package"].status is StepStatus.DONE
    # The held supplier is the live-call moment: it stays open on the screen.
    held = steps[plan.supplier_step_id(PlanGroup.OUTREACH, "SUP-KBY")]
    assert held.status is StepStatus.ACTIVE
    assert any(
        s.dynamic and s.status is StepStatus.DONE and s.group is PlanGroup.OUTREACH
        for s in steps.values()
    )
    assert any(s.status is StepStatus.FAILED and s.group is PlanGroup.SCREENING for s in steps.values())


def test_opening_a_case_seeds_the_checklist_over_http(client):
    test_client, _ = client
    opened = test_client.post("/cases", json={"part_id": "PRT-6204"})
    assert opened.status_code == 201
    case_id = opened.json()["case_id"]

    read = test_client.get(f"/cases/{case_id}/plan")
    assert read.status_code == 200
    body = read.json()
    assert [s["label"] for s in body["sections"]] == [
        plan.SECTION_LABELS[g] for g in plan.SECTION_ORDER
    ]
    assert body["done"] == 0


def test_an_agent_drives_the_checklist_over_http(client):
    test_client, _ = client
    case_id = test_client.post("/cases", json={"part_id": "PRT-6204"}).json()["case_id"]

    started = test_client.post(
        "/tools/plan/step",
        params={"case_id": case_id, "step_id": "erp:part", "status": "active"},
    )
    assert started.status_code == 200
    assert started.json()["active_step_id"] == "erp:part"

    fanned = test_client.post(
        "/tools/plan/steps",
        params={"case_id": case_id},
        json=[
            {
                "step_id": "outreach:SUP-KBY",
                "group": "outreach",
                "label": "Calling Kugellager Bayern",
                "supplier_ref": "SUP-KBY",
                "status": "active",
            },
            {
                "step_id": "outreach:SUP-RUL",
                "group": "outreach",
                "label": "Calling Rulmenti",
                "supplier_ref": "SUP-RUL",
                "status": "active",
            },
        ],
    )
    assert fanned.status_code == 200
    labels = [
        s["label"]
        for section in fanned.json()["sections"]
        for s in section["steps"]
        if s["dynamic"]
    ]
    assert labels == ["Calling Kugellager Bayern", "Calling Rulmenti"]

    # Every move is also a line in the log the cockpit already polls.
    messages = [e["message"] for e in test_client.get(f"/cases/{case_id}/events").json()]
    assert any("Calling Rulmenti" in m for m in messages)


def test_a_new_step_over_http_without_a_label_is_a_422(client):
    test_client, _ = client
    case_id = test_client.post("/cases", json={"part_id": "PRT-6204"}).json()["case_id"]
    refused = test_client.post(
        "/tools/plan/step",
        params={"case_id": case_id, "step_id": "outreach:SUP-NEW", "status": "active"},
    )
    assert refused.status_code == 422


def test_the_plan_of_an_unknown_case_is_a_404(client):
    test_client, _ = client
    assert test_client.get("/cases/CASE-NOPE/plan").status_code == 404

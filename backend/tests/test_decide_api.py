"""The two endpoints a session calls to screen and to decide.

Same reasoning as the other tool-contract tests: Devin pays for every second it
spends working out why a call shaped up differently than documented, so the shape
is asserted here. The case store is redirected to a temp directory -- deciding
must never write into the repo's `cases/` during a test run.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from backend.api.deps import settings, store
from backend.api.main import app
from backend.api.settings import get_settings
from backend.casestore.case_store import CaseStore
from packages.contracts.models import Candidate, Decision


@pytest.fixture
def client(tmp_path):
    cases = CaseStore(tmp_path / "cases")
    # A machine that has a GITHUB_TOKEN exported must not push a branch because
    # someone ran the test suite, so the publish credentials are cleared here too.
    rehearsal = replace(get_settings(), github_token=None, github_repo=None)
    app.dependency_overrides[store] = lambda: cases
    app.dependency_overrides[settings] = lambda: rehearsal
    with TestClient(app) as test_client:
        yield test_client, cases
    app.dependency_overrides.pop(store)
    app.dependency_overrides.pop(settings)


def test_screen_returns_three_rejections_with_their_rules(client):
    test_client, _ = client
    body = test_client.post("/tools/screen", params={"case_id": "CASE-001"}).json()
    candidates = [Candidate(**c) for c in body]
    assert len(candidates) == 6
    rejected = [c for c in candidates if not c.compliance.passed]
    assert len(rejected) == 3
    assert all(c.compliance.failed_rules for c in rejected)
    assert all(c.compliance.explanations for c in rejected)


def test_decide_writes_the_review_package_and_recommends_a_split(client):
    test_client, cases = client
    response = test_client.post("/tools/decide", params={"case_id": "CASE-001"})
    assert response.status_code == 200
    decision = Decision(**response.json())

    assert decision.recommended_strategy_id is not None
    recommended = next(
        s for s in decision.strategies if s.strategy_id == decision.recommended_strategy_id
    )
    assert len(recommended.lines) >= 2
    assert recommended.meets_line_stop

    written = {artifact["name"] for artifact in cases.list_artifacts("CASE-001")}
    assert {"policy_report.md", "cost_report.md", "decision.md", "po_draft.md"} <= written


def test_decide_is_idempotent_so_the_session_can_rerun_it_after_calls(client):
    test_client, _ = client
    first = test_client.post("/tools/decide", params={"case_id": "CASE-001"}).json()
    second = test_client.post("/tools/decide", params={"case_id": "CASE-001"}).json()
    assert first["recommended_strategy_id"] == second["recommended_strategy_id"]
    assert first["strategies"][0]["total_cost"] == second["strategies"][0]["total_cost"]


def test_single_source_blockers_names_the_lead_time_rule(client):
    test_client, _ = client
    body = test_client.get("/tools/single_source_blockers", params={"case_id": "CASE-001"}).json()
    assert body["SUP-RUL"] == ["lead_time_after_line_stop"]


def test_publish_is_a_rehearsal_until_a_token_is_configured(client):
    """No GITHUB_TOKEN in a test run, so this must describe rather than push."""
    test_client, _ = client
    test_client.post("/tools/decide", params={"case_id": "CASE-001"})
    body = test_client.post("/tools/publish_pr", params={"case_id": "CASE-001"}).json()
    assert body["dry_run"] is True
    assert body["pr_url"] is None
    assert body["branch"] == "procurement/case-001-2026-08-22"
    assert "procurement/CASE-001/decision.md" in body["files"]


def test_publishing_before_deciding_is_a_409(client):
    test_client, _ = client
    assert test_client.post("/tools/publish_pr", params={"case_id": "CASE-001"}).status_code == 409


def test_an_unknown_case_is_a_404_not_a_500(client):
    test_client, _ = client
    assert test_client.post("/tools/decide", params={"case_id": "CASE-999"}).status_code == 404
    assert test_client.post("/tools/screen", params={"case_id": "CASE-999"}).status_code == 404

"""Publishing the case as a pull request, against a fake GitHub.

No test here talks to github.com. The live path is exercised through an httpx
mock transport so the request sequence (blobs -> tree -> commit -> ref -> pull) is
actually asserted rather than assumed, and the default path -- no token -- is
asserted to push nothing at all.
"""

from __future__ import annotations

import base64
import json
from datetime import date

import httpx
import pytest

from supplyos_api.casestore.case_store import CaseStore
from supplyos_api.decide.run import run
from supplyos_api.publish.github_pr import branch_name, publish

CASE = "CASE-001"
TODAY = date(2026, 8, 22)
REPO = "D4V1ND/ehl_hack"
PR_URL = f"https://github.com/{REPO}/pull/42"


@pytest.fixture
def decided(erp, tmp_path) -> CaseStore:
    cases = CaseStore(tmp_path / "cases")
    run(case_id=CASE, records=erp, cases=cases, today=TODAY)
    return cases


@pytest.fixture
def github():
    """A GitHub that records what it was asked to do."""
    calls: list[tuple[str, str, dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path.replace(f"/repos/{REPO}", "")
        body = json.loads(request.content) if request.content else {}
        calls.append((request.method, path, body))
        if path.startswith("/git/ref/heads/"):
            return httpx.Response(200, json={"object": {"sha": "base-sha"}})
        if path == "/git/blobs":
            return httpx.Response(201, json={"sha": f"blob-{len(calls)}"})
        if path == "/git/trees":
            return httpx.Response(201, json={"sha": "tree-sha"})
        if path == "/git/commits":
            return httpx.Response(201, json={"sha": "commit-sha"})
        if path == "/git/refs":
            return httpx.Response(201, json={"ref": body["ref"]})
        if path == "/pulls":
            return httpx.Response(201, json={"html_url": PR_URL})
        return httpx.Response(404, json={"message": f"unexpected {path}"})

    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return client, calls


def test_without_a_token_it_pushes_nothing_and_says_what_it_would_have(decided):
    result = publish(case_id=CASE, cases=decided, token=None, repo=None, today=TODAY)
    assert result.dry_run
    assert result.pr_url is None
    assert "GITHUB_TOKEN" in result.reason
    assert result.branch == "procurement/case-001-2026-08-22"
    assert f"procurement/{CASE}/decision.md" in result.files


def test_the_pr_carries_the_six_artifacts_and_not_the_event_log(decided, github):
    client, _ = github
    result = publish(
        case_id=CASE, cases=decided, token="t", repo=REPO, today=TODAY, client=client
    )
    names = {path.rsplit("/", 1)[-1] for path in result.files}
    assert {"decision.md", "policy_report.md", "cost_report.md", "po_draft.md"} <= names
    assert "events.jsonl" not in names, "the log is operational, not part of the review"


def test_it_lands_as_one_commit_on_a_new_branch(decided, github):
    client, calls = github
    publish(case_id=CASE, cases=decided, token="t", repo=REPO, today=TODAY, client=client)
    paths = [path for _, path, _ in calls]
    assert paths.count("/git/commits") == 1, "one commit, not one per file"
    assert paths.index("/git/trees") < paths.index("/git/commits") < paths.index("/git/refs")
    ref = next(body for _, path, body in calls if path == "/git/refs")
    assert ref["ref"] == f"refs/heads/{branch_name(CASE, TODAY)}"
    assert ref["sha"] == "commit-sha"


def test_the_pr_body_is_the_decision_a_human_reads(decided, github):
    client, calls = github
    result = publish(
        case_id=CASE, cases=decided, token="t", repo=REPO, today=TODAY, client=client
    )
    pull = next(body for _, path, body in calls if path == "/pulls")
    assert pull["base"] == "main"
    assert pull["head"] == result.branch
    assert "Recommendation:" in pull["body"]
    assert "Nothing was ordered." in pull["body"]
    assert "EUR" in pull["title"]


def test_the_committed_files_are_the_files_on_disk(decided, github):
    client, calls = github
    publish(case_id=CASE, cases=decided, token="t", repo=REPO, today=TODAY, client=client)
    blobs = [body for _, path, body in calls if path == "/git/blobs"]
    decoded = [base64.b64decode(b["content"]).decode() for b in blobs]
    assert decided.read_artifact(CASE, "decision.md") in decoded


def test_publishing_records_the_pr_url_on_the_case(decided, github):
    client, _ = github
    result = publish(
        case_id=CASE, cases=decided, token="t", repo=REPO, today=TODAY, client=client
    )
    assert result.pr_url == PR_URL
    assert decided.read_decision(CASE).pr_url == PR_URL
    assert PR_URL in decided.read_events(CASE)[-1].message


def test_publishing_an_undecided_case_refuses_instead_of_opening_an_empty_pr(tmp_path):
    empty = CaseStore(tmp_path / "cases")
    with pytest.raises(ValueError, match="decide first"):
        publish(case_id=CASE, cases=empty, token="t", repo=REPO, today=TODAY)

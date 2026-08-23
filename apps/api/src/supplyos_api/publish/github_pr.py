"""Publish a decided case as a pull request against this repo.

One commit on a fresh branch containing `procurement/<case_id>/*`, and a PR whose
body is the decision. Uses the Git data API (blob -> tree -> commit -> ref) so the
whole case lands as a single commit rather than one commit per file.

Rehearsal is the default here too: without a token this returns the exact branch
name, file list and body it *would* have pushed, and `pr_url=None`. A demo can
therefore run the full flow with nothing configured and still show the artifact.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from datetime import date

import httpx

from supplyos_api.casestore.case_store import ARTIFACT_FILES, CaseStore
from packages.contracts.enums import Actor, Level, Stage

API = "https://api.github.com"
TIMEOUT = httpx.Timeout(20.0)


@dataclass(frozen=True)
class PublishResult:
    case_id: str
    branch: str
    files: list[str]
    title: str
    body: str
    pr_url: str | None = None
    dry_run: bool = True
    reason: str = ""
    warnings: list[str] = field(default_factory=list)


def branch_name(case_id: str, today: date) -> str:
    return f"procurement/{case_id.lower()}-{today.isoformat()}"


def _collect(cases: CaseStore, case_id: str) -> dict[str, str]:
    """The case directory, minus the event log.

    `events.jsonl` stays out of the PR on purpose: it is an append-only operational
    log, and a reviewer reading a diff wants the six artifacts, not every step that
    produced them. It remains available from the cockpit.
    """
    out: dict[str, str] = {}
    for name in (*ARTIFACT_FILES, "decision.json"):
        body = cases.read_artifact(case_id, name)
        if body is not None:
            out[f"procurement/{case_id}/{name}"] = body
    return out


def _title(case_id: str, cases: CaseStore) -> str:
    decision = cases.read_decision(case_id)
    if decision is None or decision.recommended_strategy_id is None:
        return f"procurement({case_id}): no compliant plan — needs a buyer"
    recommended = next(
        (s for s in decision.strategies if s.strategy_id == decision.recommended_strategy_id),
        None,
    )
    if recommended is None:
        return f"procurement({case_id}): decision"
    return f"procurement({case_id}): {recommended.label} — EUR {recommended.total_cost}"


class GitHub:
    """The four Git-data calls we need, and nothing else."""

    def __init__(self, token: str, repo: str, client: httpx.Client | None = None) -> None:
        self.repo = repo
        self._client = client or httpx.Client(
            timeout=TIMEOUT,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    def _post(self, path: str, payload: dict[str, object]) -> dict[str, object]:
        response = self._client.post(f"{API}/repos/{self.repo}{path}", json=payload)
        response.raise_for_status()
        return response.json()

    def head_sha(self, base: str) -> str:
        response = self._client.get(f"{API}/repos/{self.repo}/git/ref/heads/{base}")
        response.raise_for_status()
        return str(response.json()["object"]["sha"])

    def commit_files(self, *, base_sha: str, files: dict[str, str], message: str) -> str:
        tree = [
            {
                "path": path,
                "mode": "100644",
                "type": "blob",
                "sha": self._post(
                    "/git/blobs",
                    {"content": base64.b64encode(body.encode()).decode(), "encoding": "base64"},
                )["sha"],
            }
            for path, body in sorted(files.items())
        ]
        new_tree = self._post("/git/trees", {"base_tree": base_sha, "tree": tree})
        commit = self._post(
            "/git/commits",
            {"message": message, "tree": new_tree["sha"], "parents": [base_sha]},
        )
        return str(commit["sha"])

    def create_branch(self, *, branch: str, sha: str) -> None:
        self._post("/git/refs", {"ref": f"refs/heads/{branch}", "sha": sha})

    def open_pr(self, *, branch: str, base: str, title: str, body: str) -> str:
        pr = self._post("/pulls", {"title": title, "head": branch, "base": base, "body": body})
        return str(pr["html_url"])


def publish(
    *,
    case_id: str,
    cases: CaseStore,
    token: str | None,
    repo: str | None,
    base: str = "main",
    today: date | None = None,
    client: httpx.Client | None = None,
) -> PublishResult:
    """Push the case as a PR, or describe what would have been pushed."""
    today = today or date.today()
    files = _collect(cases, case_id)
    if not files:
        raise ValueError(f"{case_id} has no artifacts to publish; decide first")

    decision_body = files.get(f"procurement/{case_id}/decision.md", "")
    branch = branch_name(case_id, today)
    title = _title(case_id, cases)
    warnings: list[str] = []
    stored = cases.read_decision(case_id)
    if stored is not None and stored.recommended_strategy_id is None:
        warnings.append("no feasible plan; the PR asks a buyer to intervene")

    if not token or not repo:
        return PublishResult(
            case_id=case_id,
            branch=branch,
            files=sorted(files),
            title=title,
            body=decision_body,
            dry_run=True,
            reason="GITHUB_TOKEN or GITHUB_REPO unset — nothing was pushed",
            warnings=warnings,
        )

    api = GitHub(token, repo, client=client)
    base_sha = api.head_sha(base)
    commit = api.commit_files(base_sha=base_sha, files=files, message=title)
    api.create_branch(branch=branch, sha=commit)
    url = api.open_pr(branch=branch, base=base, title=title, body=decision_body)

    cases.append_event(
        case_id,
        actor=Actor.DEVIN,
        # `decided` is the last stage in the frozen contract, and opening the PR is
        # the act of filing that decision -- not a new stage of reasoning. Adding a
        # `pr_open` stage would change an enum three other components read.
        stage=Stage.DECIDED,
        level=Level.WARN if warnings else Level.INFO,
        message=f"procurement PR opened: {url}",
        payload={"pr_url": url, "branch": branch, "files": sorted(files)},
    )
    if stored is not None:
        cases.write_decision(stored.model_copy(update={"pr_url": url}))

    return PublishResult(
        case_id=case_id,
        branch=branch,
        files=sorted(files),
        title=title,
        body=decision_body,
        pr_url=url,
        dry_run=False,
        warnings=warnings,
    )

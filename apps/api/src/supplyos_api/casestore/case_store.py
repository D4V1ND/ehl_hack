"""`cases/<case_id>/` is the database.

There is no Postgres and no ORM, because a case is about eight files and we want
them in Git anyway. The artifact *is* the datastore, so there is zero gap between
what the system knows and what a reviewer can walk through in a pull request.

Writes are atomic (temp file + rename) so a reader polling the directory never
sees a half-written artifact.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import yaml

from packages.contracts.enums import Actor, Level, Stage
from packages.contracts.models import (
    Candidate,
    Claim,
    Decision,
    Event,
    Incident,
    OutreachTask,
    PlanStep,
)
from supplyos_api.casestore import events as event_log
from supplyos_api.settings import REPO_ROOT

CASES_DIR = REPO_ROOT / "cases"

ARTIFACT_FILES = (
    "sourcing_case.yaml",
    "candidates.json",
    "policy_report.md",
    "cost_report.md",
    "decision.md",
    "po_draft.md",
)


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    # fsync the handle the bytes were written through: on Windows a read-only
    # descriptor cannot be flushed and raises EBADF.
    with tmp.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


class CaseStore:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or CASES_DIR

    # -- paths --------------------------------------------------------------

    def case_dir(self, case_id: str) -> Path:
        return self.root / case_id

    def events_path(self, case_id: str) -> Path:
        return self.case_dir(case_id) / "events.jsonl"

    def exists(self, case_id: str) -> bool:
        return self.case_dir(case_id).is_dir()

    def list_case_ids(self) -> list[str]:
        if not self.root.is_dir():
            return []
        return sorted(d.name for d in self.root.iterdir() if d.is_dir() and not d.name.startswith("."))

    # -- events -------------------------------------------------------------

    def append_event(
        self,
        case_id: str,
        *,
        actor: Actor,
        stage: Stage,
        message: str,
        level: Level = Level.INFO,
        payload: dict | None = None,
    ) -> Event:
        return event_log.append_event(
            self.events_path(case_id),
            case_id=case_id,
            actor=actor,
            stage=stage,
            message=message,
            level=level,
            payload=payload,
        )

    def read_events(self, case_id: str, since: int = 0) -> list[Event]:
        return event_log.read_events(self.events_path(case_id), since=since)

    def current_stage(self, case_id: str) -> Stage:
        events = self.read_events(case_id)
        return events[-1].stage if events else Stage.DETECTED

    # -- typed artifacts ----------------------------------------------------

    def write_candidates(self, case_id: str, candidates: list[Candidate]) -> None:
        _atomic_write(
            self.case_dir(case_id) / "candidates.json",
            json.dumps([json.loads(c.model_dump_json()) for c in candidates], indent=2) + "\n",
        )

    def read_candidates(self, case_id: str) -> list[Candidate]:
        return [Candidate(**row) for row in self._read_json(self.case_dir(case_id) / "candidates.json", [])]

    def write_incident(self, incident: Incident) -> None:
        """The shortage this case is about.

        Seeded cases live in the ERP, but a case opened for any part in the item
        master is derived rather than looked up — so the case directory has to
        hold it, or nothing downstream could read the case back.
        """
        _atomic_write(
            self.case_dir(incident.case_id) / "incident.json",
            incident.model_dump_json(indent=2) + "\n",
        )

    def read_incident(self, case_id: str) -> Incident | None:
        row = self._read_json(self.case_dir(case_id) / "incident.json", None)
        if not row:
            return None
        try:
            return Incident(**row)
        except (ValueError, TypeError):
            return None

    def write_claim(self, claim: Claim) -> Path:
        path = self.case_dir(claim.case_id) / "claims" / f"{claim.supplier_ref}-r{claim.round}.json"
        _atomic_write(path, claim.model_dump_json(indent=2) + "\n")
        return path

    def read_claims(self, case_id: str) -> list[Claim]:
        claims_dir = self.case_dir(case_id) / "claims"
        if not claims_dir.is_dir():
            return []
        claims: list[Claim] = []
        for path in sorted(claims_dir.glob("*.json")):
            try:
                claims.append(Claim(**json.loads(path.read_text(encoding="utf-8"))))
            except (json.JSONDecodeError, ValueError, TypeError):
                continue  # a garbled claim file must not take down the case view
        return claims

    def write_outreach_tasks(self, case_id: str, tasks: list[OutreachTask]) -> None:
        _atomic_write(
            self.case_dir(case_id) / "outreach.json",
            json.dumps([json.loads(t.model_dump_json()) for t in tasks], indent=2) + "\n",
        )

    def read_outreach_tasks(self, case_id: str) -> list[OutreachTask]:
        return [OutreachTask(**row) for row in self._read_json(self.case_dir(case_id) / "outreach.json", [])]

    def write_decision(self, decision: Decision) -> None:
        _atomic_write(
            self.case_dir(decision.case_id) / "decision.json",
            decision.model_dump_json(indent=2) + "\n",
        )

    def read_decision(self, case_id: str) -> Decision | None:
        row = self._read_json(self.case_dir(case_id) / "decision.json", None)
        if not row:
            return None
        try:
            return Decision(**row)
        except (ValueError, TypeError):
            return None

    # -- the checklist ------------------------------------------------------

    def write_plan_steps(self, case_id: str, steps: list[PlanStep]) -> None:
        _atomic_write(
            self.case_dir(case_id) / "plan.json",
            json.dumps([json.loads(s.model_dump_json()) for s in steps], indent=2) + "\n",
        )

    def read_plan_steps(self, case_id: str) -> list[PlanStep]:
        rows = self._read_json(self.case_dir(case_id) / "plan.json", [])
        steps: list[PlanStep] = []
        for row in rows:
            try:
                steps.append(PlanStep(**row))
            except (ValueError, TypeError):
                continue  # one broken line must not blank the whole checklist
        return steps

    # -- free-form artifacts (Devin writes most of these) -------------------

    def write_sourcing_case(self, case_id: str, data: dict[str, Any]) -> None:
        _atomic_write(
            self.case_dir(case_id) / "sourcing_case.yaml",
            yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        )

    def write_markdown(self, case_id: str, filename: str, body: str) -> None:
        _atomic_write(self.case_dir(case_id) / filename, body)

    def list_artifacts(self, case_id: str) -> list[dict[str, Any]]:
        directory = self.case_dir(case_id)
        if not directory.is_dir():
            return []
        artifacts = []
        for path in sorted(directory.rglob("*")):
            if path.is_dir() or path.name.endswith(".tmp"):
                continue
            artifacts.append({
                "name": str(path.relative_to(directory)),
                "size_bytes": path.stat().st_size,
                "is_markdown": path.suffix == ".md",
            })
        return artifacts

    def read_artifact(self, case_id: str, name: str) -> str | None:
        """Read one artifact by name. Refuses to escape the case directory."""
        directory = self.case_dir(case_id).resolve()
        target = (directory / name).resolve()
        if not target.is_file() or directory not in target.parents and target.parent != directory:
            return None
        return target.read_text(encoding="utf-8")

    # -- helpers ------------------------------------------------------------

    @staticmethod
    def _read_json(path: Path, default: Any) -> Any:
        if not path.is_file():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return default


_STORE: CaseStore | None = None


def get_case_store() -> CaseStore:
    global _STORE
    if _STORE is None:
        _STORE = CaseStore()
    return _STORE

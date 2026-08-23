"""Durable operational Case state with immutable per-Case Event cursors."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterator, Sequence

from packages.contracts.enums import DecisionStatus
from packages.contracts.models import (
    Candidate,
    Claim,
    CompanyProfile,
    Decision,
    Event,
    Incident,
    OutreachTask,
    Part,
    SupplierRecord,
)


class DuplicateCaseError(RuntimeError):
    pass


class CaseNotFoundError(LookupError):
    pass


class DecisionNotFoundError(LookupError):
    pass


class ApprovalConflictError(RuntimeError):
    pass


class DecisionFinalError(RuntimeError):
    pass


class DecisionRevisionError(RuntimeError):
    pass


class StaleRunError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredCase:
    case_id: str
    stage: str
    incident: Incident
    part: Part
    profile: CompanyProfile
    supplier_records: list[SupplierRecord]
    candidates: list[Candidate]
    outreach_tasks: list[OutreachTask]
    claims: list[Claim]
    decision: Decision | None
    opened_at: datetime
    runner_id: str | None
    runner_url: str | None
    runner_error: str | None
    last_event_seq: int


class SqliteCaseStore:
    """One concrete adapter for production and temporary-file tests."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        schema = Path(__file__).with_name("case_schema.sql").read_text(encoding="utf-8")
        with self._connection() as connection:
            connection.executescript(schema)
            columns = {
                str(row["name"])
                for row in connection.execute("PRAGMA table_info(cases)").fetchall()
            }
            if "run_revision" not in columns:
                connection.execute(
                    "ALTER TABLE cases ADD COLUMN run_revision INTEGER NOT NULL DEFAULT 0"
                )
            connection.execute(
                """
                UPDATE cases
                   SET run_revision = MAX(
                       run_revision,
                       COALESCE((
                           SELECT MAX(revision) FROM decisions
                            WHERE decisions.case_id = cases.case_id
                       ), 0),
                       COALESCE((
                           SELECT MAX(round) FROM outreach_tasks
                            WHERE outreach_tasks.case_id = cases.case_id
                       ), 0),
                       COALESCE((
                           SELECT MAX(round) FROM claims
                            WHERE claims.case_id = cases.case_id
                       ), 0)
                   )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.database_path,
            timeout=30,
            isolation_level=None,
            check_same_thread=False,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        return connection

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = self._connect()
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def _write(self) -> Iterator[sqlite3.Connection]:
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _json(model: object) -> str:
        serializer = getattr(model, "model_dump_json", None)
        if serializer is not None:
            return serializer()
        return json.dumps(model)

    @staticmethod
    def _json_list(models: Sequence[object]) -> str:
        return "[" + ",".join(SqliteCaseStore._json(model) for model in models) + "]"

    @staticmethod
    def _next_seq(connection: sqlite3.Connection, case_id: str) -> int:
        row = connection.execute(
            "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM events WHERE case_id = ?",
            (case_id,),
        ).fetchone()
        return int(row["next_seq"])

    @classmethod
    def _insert_event(cls, connection: sqlite3.Connection, event: Event) -> Event:
        seq = cls._next_seq(connection, event.case_id)
        committed = event.model_copy(update={"seq": seq})
        connection.execute(
            "INSERT INTO events(case_id, seq, ts, event_json) VALUES (?, ?, ?, ?)",
            (committed.case_id, seq, committed.ts.isoformat(), cls._json(committed)),
        )
        return committed

    def create_case(
        self,
        *,
        incident: Incident,
        part: Part,
        profile: CompanyProfile,
        supplier_records: list[SupplierRecord],
        opened_at: datetime,
        initial_event: Event,
    ) -> Event:
        try:
            with self._write() as connection:
                connection.execute(
                    """
                    INSERT INTO cases(
                        case_id, part_id, incident_json, part_json, profile_json,
                        supplier_records_json, opened_at, stage
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        incident.case_id,
                        incident.part_id,
                        self._json(incident),
                        self._json(part),
                        self._json(profile),
                        self._json_list(supplier_records),
                        opened_at.isoformat(),
                        initial_event.stage.value,
                    ),
                )
                return self._insert_event(connection, initial_event)
        except sqlite3.IntegrityError as error:
            if self.exists(incident.case_id):
                raise DuplicateCaseError(incident.case_id) from error
            raise

    def exists(self, case_id: str) -> bool:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT 1 FROM cases WHERE case_id = ?", (case_id,)
            ).fetchone()
        return row is not None

    def list_case_ids(self) -> list[str]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT case_id FROM cases ORDER BY opened_at DESC, case_id ASC"
            ).fetchall()
        return [str(row["case_id"]) for row in rows]

    def reserve_run(
        self,
        case_id: str,
        event_factory: Callable[[int], Event],
    ) -> int:
        with self._write() as connection:
            row = connection.execute(
                """
                SELECT cases.run_revision, decisions.status AS decision_status
                  FROM cases
             LEFT JOIN decisions USING (case_id)
                 WHERE cases.case_id = ?
                """,
                (case_id,),
            ).fetchone()
            if row is None:
                raise CaseNotFoundError(case_id)
            if row["decision_status"] == "approved":
                raise DecisionFinalError(case_id)
            revision = int(row["run_revision"]) + 1
            event = event_factory(revision)
            self._require_matching_events(case_id, [event])
            connection.execute(
                "UPDATE cases SET run_revision = ? WHERE case_id = ?",
                (revision, case_id),
            )
            self._insert_event(connection, event)
            return revision

    def update_runner(
        self,
        case_id: str,
        *,
        revision: int,
        runner_id: str,
        runner_url: str | None,
        runner_error: str | None,
        event: Event,
    ) -> Event:
        with self._write() as connection:
            self._require_matching_events(case_id, [event])
            state = connection.execute(
                """
                SELECT cases.run_revision, decisions.status AS decision_status
                  FROM cases
             LEFT JOIN decisions USING (case_id)
                 WHERE cases.case_id = ?
                """,
                (case_id,),
            ).fetchone()
            if state is None:
                raise CaseNotFoundError(case_id)
            if state["decision_status"] == "approved":
                raise DecisionFinalError(case_id)
            if int(state["run_revision"]) != revision:
                raise StaleRunError(
                    f"run revision {revision} is no longer current"
                )
            changed = connection.execute(
                """
                UPDATE cases
                   SET runner_id = ?, runner_url = ?, runner_error = ?
                 WHERE case_id = ?
                """,
                (runner_id, runner_url, runner_error, case_id),
            ).rowcount
            if not changed:
                raise CaseNotFoundError(case_id)
            committed = self._insert_event(connection, event)
            connection.execute(
                "UPDATE cases SET stage = ? WHERE case_id = ?",
                (committed.stage.value, case_id),
            )
            return committed

    def commit_run(
        self,
        *,
        case_id: str,
        revision: int,
        candidates: list[Candidate],
        tasks: list[OutreachTask],
        claims: list[Claim],
        decision: Decision | None,
        events: list[Event],
    ) -> list[Event]:
        with self._write() as connection:
            self._require_matching_events(case_id, events)
            state = connection.execute(
                """
                SELECT cases.run_revision, decisions.status AS decision_status,
                       decisions.revision AS decision_revision
                  FROM cases
             LEFT JOIN decisions USING (case_id)
                 WHERE cases.case_id = ?
                """,
                (case_id,),
            ).fetchone()
            if state is None:
                raise CaseNotFoundError(case_id)
            if state["decision_status"] == "approved":
                raise DecisionFinalError(case_id)
            if int(state["run_revision"]) != revision:
                raise StaleRunError(
                    f"run revision {revision} is no longer current"
                )

            connection.execute("DELETE FROM candidates WHERE case_id = ?", (case_id,))
            connection.executemany(
                """
                INSERT INTO candidates(case_id, supplier_ref, position, candidate_json)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (case_id, candidate.supplier_ref, position, self._json(candidate))
                    for position, candidate in enumerate(candidates)
                ],
            )
            connection.executemany(
                """
                INSERT INTO outreach_tasks(
                    task_id, case_id, supplier_ref, round, status, task_json
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    status = excluded.status,
                    task_json = excluded.task_json
                """,
                [
                    (
                        task.task_id,
                        case_id,
                        task.supplier_ref,
                        task.round,
                        task.status.value,
                        self._json(task),
                    )
                    for task in tasks
                ],
            )
            connection.executemany(
                """
                INSERT INTO claims(
                    case_id, task_id, supplier_ref, round, received_at, claim_json
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        claim.case_id,
                        claim.task_id,
                        claim.supplier_ref,
                        claim.round,
                        claim.received_at.isoformat() if claim.received_at else None,
                        self._json(claim),
                    )
                    for claim in claims
                ],
            )
            if decision is not None:
                previous_revision = (
                    int(state["decision_revision"])
                    if state["decision_revision"] is not None
                    else 0
                )
                if decision.revision != revision or revision <= previous_revision:
                    raise DecisionRevisionError(
                        f"Decision revision must be current run {revision}"
                    )
                connection.execute(
                    """
                    INSERT INTO decisions(
                        case_id, revision, status, decision_json, approved_at, approved_by
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(case_id) DO UPDATE SET
                        revision = excluded.revision,
                        status = excluded.status,
                        decision_json = excluded.decision_json,
                        approved_at = excluded.approved_at,
                        approved_by = excluded.approved_by
                    """,
                    (
                        decision.case_id,
                        decision.revision,
                        decision.status.value,
                        self._json(decision),
                        decision.approved_at,
                        decision.approved_by,
                    ),
                )
            return self._commit_events_and_stage(connection, case_id, events)

    def replace_candidates(
        self, case_id: str, candidates: list[Candidate], events: list[Event]
    ) -> list[Event]:
        with self._write() as connection:
            self._require_case(connection, case_id)
            connection.execute("DELETE FROM candidates WHERE case_id = ?", (case_id,))
            connection.executemany(
                """
                INSERT INTO candidates(case_id, supplier_ref, position, candidate_json)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (case_id, candidate.supplier_ref, position, self._json(candidate))
                    for position, candidate in enumerate(candidates)
                ],
            )
            return self._commit_events_and_stage(connection, case_id, events)

    def replace_outreach_tasks(
        self, case_id: str, tasks: list[OutreachTask], events: list[Event]
    ) -> list[Event]:
        with self._write() as connection:
            self._require_case(connection, case_id)
            connection.executemany(
                """
                INSERT INTO outreach_tasks(task_id, case_id, supplier_ref, round, status, task_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    status = excluded.status,
                    task_json = excluded.task_json
                """,
                [
                    (
                        task.task_id,
                        case_id,
                        task.supplier_ref,
                        getattr(task, "round", 1),
                        getattr(getattr(task, "status", "pending"), "value", getattr(task, "status", "pending")),
                        self._json(task),
                    )
                    for task in tasks
                ],
            )
            return self._commit_events_and_stage(connection, case_id, events)

    def add_claim(self, claim: Claim, event: Event) -> Event:
        with self._write() as connection:
            self._require_case(connection, claim.case_id)
            self._require_matching_events(claim.case_id, [event])
            connection.execute(
                """
                INSERT OR REPLACE INTO claims(
                    case_id, task_id, supplier_ref, round, received_at, claim_json
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    claim.case_id,
                    claim.task_id,
                    claim.supplier_ref,
                    claim.round,
                    claim.received_at.isoformat() if claim.received_at else None,
                    self._json(claim),
                ),
            )
            committed = self._insert_event(connection, event)
            connection.execute(
                "UPDATE cases SET stage = ? WHERE case_id = ?",
                (committed.stage.value, claim.case_id),
            )
            return committed

    def save_decision(self, decision: Decision, event: Event) -> Event:
        with self._write() as connection:
            self._require_case(connection, decision.case_id)
            self._require_matching_events(decision.case_id, [event])
            current = connection.execute(
                "SELECT status, revision FROM decisions WHERE case_id = ?", (decision.case_id,)
            ).fetchone()
            if current is not None and current["status"] == "approved":
                raise DecisionFinalError(decision.case_id)
            expected_revision = 1 if current is None else int(current["revision"]) + 1
            if decision.revision != expected_revision:
                raise DecisionRevisionError(
                    f"Decision revision must be {expected_revision}, got {decision.revision}"
                )
            connection.execute(
                """
                INSERT INTO decisions(
                    case_id, revision, status, decision_json, approved_at, approved_by
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(case_id) DO UPDATE SET
                    revision = excluded.revision,
                    status = excluded.status,
                    decision_json = excluded.decision_json,
                    approved_at = excluded.approved_at,
                    approved_by = excluded.approved_by
                """,
                (
                    decision.case_id,
                    getattr(decision, "revision", 1),
                    getattr(getattr(decision, "status", "ready"), "value", getattr(decision, "status", "ready")),
                    self._json(decision),
                    getattr(decision, "approved_at", None),
                    getattr(decision, "approved_by", None),
                ),
            )
            committed = self._insert_event(connection, event)
            connection.execute(
                "UPDATE cases SET stage = ? WHERE case_id = ?",
                (committed.stage.value, decision.case_id),
            )
            return committed

    def append_event(self, event: Event) -> Event:
        with self._write() as connection:
            self._require_case(connection, event.case_id)
            committed = self._insert_event(connection, event)
            connection.execute(
                "UPDATE cases SET stage = ? WHERE case_id = ?",
                (committed.stage.value, event.case_id),
            )
            return committed

    def get_events(self, case_id: str, since: int = 0) -> list[Event]:
        with self._connection() as connection:
            self._require_case(connection, case_id)
            rows = connection.execute(
                """
                SELECT event_json FROM events
                 WHERE case_id = ? AND seq > ?
                 ORDER BY seq ASC
                """,
                (case_id, since),
            ).fetchall()
        return [Event.model_validate_json(row["event_json"]) for row in rows]

    def get_case(self, case_id: str) -> StoredCase:
        connection = self._connect()
        try:
            connection.execute("BEGIN")
            row = connection.execute(
                "SELECT * FROM cases WHERE case_id = ?", (case_id,)
            ).fetchone()
            if row is None:
                raise CaseNotFoundError(case_id)
            candidates = connection.execute(
                "SELECT candidate_json FROM candidates WHERE case_id = ? ORDER BY position",
                (case_id,),
            ).fetchall()
            tasks = connection.execute(
                "SELECT task_json FROM outreach_tasks WHERE case_id = ? ORDER BY task_id",
                (case_id,),
            ).fetchall()
            claims = connection.execute(
                """
                SELECT claim_json FROM claims
                 WHERE case_id = ? ORDER BY supplier_ref, round, task_id
                """,
                (case_id,),
            ).fetchall()
            decision_row = connection.execute(
                "SELECT decision_json FROM decisions WHERE case_id = ?", (case_id,)
            ).fetchone()
            high_water = connection.execute(
                "SELECT COALESCE(MAX(seq), 0) AS seq FROM events WHERE case_id = ?",
                (case_id,),
            ).fetchone()
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

        return StoredCase(
            case_id=case_id,
            stage=row["stage"],
            incident=Incident.model_validate_json(row["incident_json"]),
            part=Part.model_validate_json(row["part_json"]),
            profile=CompanyProfile.model_validate_json(row["profile_json"]),
            supplier_records=[SupplierRecord.model_validate(item) for item in json.loads(row["supplier_records_json"])],
            candidates=[Candidate.model_validate_json(item["candidate_json"]) for item in candidates],
            outreach_tasks=[OutreachTask.model_validate_json(item["task_json"]) for item in tasks],
            claims=[Claim.model_validate_json(item["claim_json"]) for item in claims],
            decision=Decision.model_validate_json(decision_row["decision_json"]) if decision_row else None,
            opened_at=datetime.fromisoformat(row["opened_at"]),
            runner_id=row["runner_id"],
            runner_url=row["runner_url"],
            runner_error=row["runner_error"],
            last_event_seq=int(high_water["seq"]),
        )

    def approve_decision(
        self,
        *,
        case_id: str,
        decision_revision: int,
        approved_by: str,
        approved_at: datetime,
        event_factory,
    ) -> bool:
        """Approve once. Return whether this request appended the human Event."""
        with self._write() as connection:
            self._require_case(connection, case_id)
            row = connection.execute(
                """
                SELECT decisions.*, cases.run_revision
                  FROM decisions
                  JOIN cases USING (case_id)
                 WHERE decisions.case_id = ?
                """,
                (case_id,),
            ).fetchone()
            if row is None:
                raise DecisionNotFoundError(case_id)
            decision = Decision.model_validate_json(row["decision_json"])
            current_revision = int(row["revision"])
            current_status = str(row["status"])
            if current_status == "approved":
                if current_revision == decision_revision and row["approved_by"] == approved_by:
                    return False
                raise ApprovalConflictError("approved Decision is final")
            checks = getattr(decision, "checks", None)
            if (
                current_status != "ready"
                or current_revision != decision_revision
                or current_revision != int(row["run_revision"])
                or checks is None
                or not checks.policy_passed
                or not checks.cost_model_passed
            ):
                raise ApprovalConflictError("Decision is not an approvable ready revision")

            updated = decision.model_copy(
                update={
                    "status": DecisionStatus.APPROVED,
                    "approved_at": approved_at,
                    "approved_by": approved_by,
                }
            )
            connection.execute(
                """
                UPDATE decisions
                   SET status = 'approved', decision_json = ?, approved_at = ?, approved_by = ?
                 WHERE case_id = ?
                """,
                (self._json(updated), approved_at.isoformat(), approved_by, case_id),
            )
            event = event_factory(approved_at)
            self._require_matching_events(case_id, [event])
            self._insert_event(connection, event)
            connection.execute(
                "UPDATE cases SET stage = 'decided' WHERE case_id = ?", (case_id,)
            )
            return True

    @classmethod
    def _commit_events_and_stage(
        cls, connection: sqlite3.Connection, case_id: str, events: list[Event]
    ) -> list[Event]:
        cls._require_matching_events(case_id, events)
        committed = [cls._insert_event(connection, event) for event in events]
        if committed:
            connection.execute(
                "UPDATE cases SET stage = ? WHERE case_id = ?",
                (committed[-1].stage.value, case_id),
            )
        return committed

    @staticmethod
    def _require_matching_events(case_id: str, events: list[Event]) -> None:
        if any(event.case_id != case_id for event in events):
            raise ValueError("state and Event must belong to the same Case")

    @staticmethod
    def _require_case(connection: sqlite3.Connection, case_id: str) -> None:
        exists = connection.execute(
            "SELECT 1 FROM cases WHERE case_id = ?", (case_id,)
        ).fetchone()
        if exists is None:
            raise CaseNotFoundError(case_id)

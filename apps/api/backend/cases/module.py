"""The deep Case module used by FastAPI and module-level behavior tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Callable

from backend.cases.runners import CaseRunContext, CaseRunner, DeterministicCaseRunner
from backend.casestore.sqlite_case_store import (
    ApprovalConflictError,
    CaseNotFoundError,
    DecisionFinalError,
    DecisionNotFoundError,
    DuplicateCaseError,
    SqliteCaseStore,
)
from backend.record.ports import SystemOfRecord
from backend.decide.run import DECISION_CONFIDENCE_THRESHOLD, build_recorded_decision
from backend.outreach.normalize import normalize_claim_result
from backend.outreach.recorded import OutreachAdapter, RecordedOutreachAdapter
from backend.policy.screen import screen
from packages.contracts.enums import Actor, Level, OutreachStatus, Stage
from packages.contracts.models import (
    CaseSnapshot,
    CaseSummary,
    Event,
    Incident,
    OutreachBrief,
    OutreachTask,
    Part,
    PublicCaseSnapshot,
    PublicCaseSummary,
    PublicEvent,
)
from packages.contracts.safe import (
    project_public_case_snapshot,
    project_public_case_summary,
    project_public_event,
    project_public_profile_summary,
)


class CaseMissingError(LookupError):
    pass


class PartMissingError(LookupError):
    pass


class CaseConflictError(RuntimeError):
    pass


@dataclass(frozen=True)
class OpenCaseCommand:
    part_id: str
    qty_required: int | None = None
    needed_by: date | None = None
    case_id: str | None = None


@dataclass(frozen=True)
class OpenCaseResult:
    case_id: str
    incident: Incident
    session_id: str
    session_url: str
    stubbed: bool
    session_error: str | None = None


@dataclass(frozen=True)
class CaseRunResult:
    case_id: str
    session_id: str
    session_url: str
    stubbed: bool
    session_error: str | None = None


@dataclass(frozen=True)
class ApproveDecisionCommand:
    decision_revision: int
    approved_by: str


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _generated_case_id() -> str:
    import uuid

    return f"CASE-{uuid.uuid4().hex[:12].upper()}"


class CaseModule:
    """Own Case creation, durable reads, immutable Events, and approval."""

    def __init__(
        self,
        *,
        records: SystemOfRecord,
        database_path: Path,
        clock: Callable[[], datetime] = _utc_now,
        id_generator: Callable[[], str] = _generated_case_id,
        runner: CaseRunner | None = None,
        outreach: OutreachAdapter | None = None,
    ) -> None:
        self.records = records
        self.store = SqliteCaseStore(database_path)
        self.clock = clock
        self.id_generator = id_generator
        self.runner = runner or DeterministicCaseRunner()
        self.outreach = outreach or RecordedOutreachAdapter()

    def open_case(self, command: OpenCaseCommand) -> OpenCaseResult:
        part = self.records.get_part(command.part_id)
        if part is None:
            raise PartMissingError(command.part_id)

        explicit_id = command.case_id is not None
        attempts = 1 if explicit_id else 20
        duplicate: DuplicateCaseError | None = None
        for _ in range(attempts):
            case_id = command.case_id or self.id_generator()
            incident = self._incident_for(part, case_id, command)
            opened_at = self.clock()
            event = Event(
                case_id=case_id,
                ts=opened_at,
                actor=Actor.SYSTEM,
                stage=Stage.DETECTED,
                level=Level.WARN,
                message=(
                    f"{part.item_code} — {incident.shortfall:,} short of "
                    f"{incident.qty_required:,} by {incident.needed_by}"
                ),
                payload={
                    "part_id": incident.part_id,
                    "item_name": part.item_name,
                    "part_class": part.part_class.value,
                    "criticality": part.criticality.value,
                    "plant_id": incident.plant_id,
                    "production_line": incident.production_line,
                    "qty_required": incident.qty_required,
                    "qty_on_hand": incident.qty_on_hand,
                    "needed_by": incident.needed_by.isoformat(),
                    "line_stop_at": incident.line_stop_at.isoformat(),
                    "line_stop_cost_per_hour": str(incident.line_stop_cost_per_hour),
                    "incumbent_supplier_id": incident.incumbent_supplier_id,
                },
            )
            try:
                self.store.create_case(
                    incident=incident,
                    part=part,
                    profile=self.records.get_company_profile(),
                    supplier_records=self.records.get_suppliers_for_part(part.part_id),
                    opened_at=opened_at,
                    initial_event=event,
                )
            except DuplicateCaseError as error:
                duplicate = error
                if explicit_id:
                    raise CaseConflictError(case_id) from error
                continue
            break
        else:
            raise CaseConflictError("could not allocate a unique case id") from duplicate

        run = self._start_run(case_id)
        return OpenCaseResult(
            case_id=case_id,
            incident=incident,
            session_id=run.session_id,
            session_url=run.session_url,
            stubbed=run.stubbed,
            session_error=run.session_error,
        )

    def rerun_case(self, case_id: str) -> CaseRunResult:
        try:
            return self._start_run(case_id)
        except CaseNotFoundError as error:
            raise CaseMissingError(case_id) from error
        except DecisionFinalError as error:
            raise CaseConflictError("approved Decision is final") from error

    def list_cases(self) -> list[PublicCaseSummary]:
        summaries: list[PublicCaseSummary] = []
        for case_id in self.store.list_case_ids():
            case = self.store.get_case(case_id)
            summaries.append(
                project_public_case_summary(CaseSummary(
                    case_id=case.case_id,
                    part_id=case.incident.part_id,
                    item_name=case.part.item_name,
                    stage=case.stage,
                    qty_required=case.incident.qty_required,
                    line_stop_at=case.incident.line_stop_at,
                    opened_at=case.opened_at,
                    pr_url=None,
                ))
            )
        return summaries

    def get_case(self, case_id: str) -> PublicCaseSnapshot:
        try:
            case = self.store.get_case(case_id)
        except CaseNotFoundError as error:
            raise CaseMissingError(case_id) from error
        snapshot = CaseSnapshot(
            case_id=case.case_id,
            stage=case.stage,
            incident=case.incident,
            part=case.part,
            profile_summary={},
            candidates=case.candidates,
            supplier_records=case.supplier_records,
            outreach_tasks=case.outreach_tasks,
            claims=case.claims,
            decision=case.decision,
            devin_session_url=case.runner_url,
            last_event_seq=case.last_event_seq,
        )
        return project_public_case_snapshot(
            snapshot,
            profile_summary=project_public_profile_summary(
                case.profile, target_currency=case.incident.currency
            ),
        )

    def get_events(self, case_id: str, since: int) -> list[PublicEvent]:
        try:
            return [
                project_public_event(event) for event in self.store.get_events(case_id, since)
            ]
        except CaseNotFoundError as error:
            raise CaseMissingError(case_id) from error

    def approve_decision(
        self, case_id: str, command: ApproveDecisionCommand
    ) -> PublicCaseSnapshot:
        try:
            self.store.approve_decision(
                case_id=case_id,
                decision_revision=command.decision_revision,
                approved_by=command.approved_by,
                approved_at=self.clock(),
                event_factory=lambda approved_at: Event(
                    case_id=case_id,
                    ts=approved_at,
                    actor=Actor.HUMAN,
                    stage=Stage.DECIDED,
                    message=f"Decision revision {command.decision_revision} approved by {command.approved_by}",
                    payload={
                        "decision_revision": command.decision_revision,
                        "approved_by": command.approved_by,
                    },
                ),
            )
        except (CaseNotFoundError, DecisionNotFoundError) as error:
            raise CaseMissingError(case_id) from error
        except ApprovalConflictError as error:
            raise CaseConflictError(str(error)) from error
        return self.get_case(case_id)

    def _start_run(self, case_id: str) -> CaseRunResult:
        case = self.store.get_case(case_id)
        revision = self.store.reserve_run(
            case_id,
            lambda reserved: Event(
                case_id=case_id,
                ts=self.clock(),
                actor=Actor.SYSTEM,
                stage=Stage(case.stage),
                message=f"Case run revision {reserved} reserved",
                payload={
                    "status": "started",
                    "decision_revision": reserved,
                },
            ),
        )
        receipt = self.runner.start(
            CaseRunContext(
                case_id=case_id,
                revision=revision,
                execute=lambda: self._run_case(case_id, revision=revision),
            )
        )
        case = self.store.get_case(case_id)
        self.store.update_runner(
            case_id,
            revision=revision,
            runner_id=receipt.run_id,
            runner_url=receipt.url,
            runner_error=receipt.error,
            event=Event(
                case_id=case_id,
                ts=self.clock(),
                actor=Actor.SYSTEM,
                stage=Stage(case.stage),
                level=Level.WARN if receipt.error else Level.INFO,
                message="Case runner receipt persisted",
                payload={
                    "status": "failed" if receipt.error else "completed",
                    "decision_revision": revision,
                    "devin_session_url": receipt.url,
                },
            ),
        )
        return CaseRunResult(
            case_id=case_id,
            session_id=receipt.run_id,
            session_url=receipt.url or "",
            stubbed=receipt.stubbed,
            session_error=receipt.error,
        )

    def _run_case(self, case_id: str, *, revision: int) -> None:
        case = self.store.get_case(case_id)
        if case.decision is not None and case.decision.status.value == "approved":
            raise DecisionFinalError(case_id)
        screened_candidates = screen(
            case_id=case_id,
            suppliers=case.supplier_records,
            part=case.part,
            profile=case.profile,
            today=self.clock().date(),
        )
        rejected = [
            candidate
            for candidate in screened_candidates
            if not candidate.compliance.passed
        ]
        events = [
            Event(
                case_id=case_id,
                ts=self.clock(),
                actor=Actor.DEVIN,
                stage=Stage.RESEARCHING,
                level=Level.WARN if rejected else Level.INFO,
                message=(
                    f"Screened {len(screened_candidates)} Candidates; "
                    f"{len(rejected)} rejected by policy"
                ),
                payload={
                    "candidate_count": len(screened_candidates),
                    "rejected_count": len(rejected),
                    "round": revision,
                    "failed_rules": [
                        rule.value
                        for candidate in rejected
                        for rule in candidate.compliance.failed_rules
                    ],
                },
            )
        ]

        tasks = [
            OutreachTask(
                task_id=f"OUT-{case_id}-{candidate.supplier_ref}-R{revision}",
                case_id=case_id,
                supplier_ref=candidate.supplier_ref,
                channel=candidate.channel,
                brief=OutreachBrief(
                    part_spec=f"{case.part.item_code} — {case.part.description}",
                    qty=case.incident.shortfall,
                    needed_by=case.incident.needed_by,
                ),
                round=revision,
                status=OutreachStatus.IN_PROGRESS,
                started_at=self.clock(),
            )
            for candidate in screened_candidates
            if candidate.compliance.passed
        ]
        events.append(
            Event(
                case_id=case_id,
                ts=self.clock(),
                actor=Actor.SYSTEM,
                stage=Stage.CALLING,
                message=(
                    f"Dispatched {len(tasks)} recorded Outreach Tasks "
                    f"for round {revision}"
                ),
                payload={
                    "candidate_count": len(tasks),
                    "round": revision,
                    "status": "in_progress",
                },
            )
        )

        claims = []
        for result in self.outreach.dispatch(tasks):
            claim = normalize_claim_result(
                task_id=result.task_id,
                case_id=result.case_id,
                supplier_ref=result.supplier_ref,
                payload=result.payload,
                received_at=self.clock(),
                round_=revision,
            )
            claims.append(claim)
            events.append(
                Event(
                    case_id=case_id,
                    ts=self.clock(),
                    actor=Actor.CALLE,
                    stage=Stage.CALLING,
                    level=(
                        Level.WARN
                        if claim.confidence < DECISION_CONFIDENCE_THRESHOLD
                        else Level.INFO
                    ),
                    message=(
                        f"Recorded Claim from {claim.supplier_ref}: "
                        f"{claim.stock_status.value}, confidence {claim.confidence:.2f}"
                    ),
                    payload={
                        "supplier_ref": claim.supplier_ref,
                        "task_id": claim.task_id,
                        "round": claim.round,
                        "stock_status": claim.stock_status.value,
                        "confidence": claim.confidence,
                    },
                )
            )

        completed_at = self.clock()
        completed_tasks = [
            task.model_copy(
                update={
                    "status": OutreachStatus.COMPLETED,
                    "completed_at": completed_at,
                }
            )
            for task in tasks
        ]
        events.append(
            Event(
                case_id=case_id,
                ts=completed_at,
                actor=Actor.SYSTEM,
                stage=Stage.CALLING,
                message=f"Completed {len(completed_tasks)} Outreach Tasks for round {revision}",
                payload={
                    "candidate_count": len(completed_tasks),
                    "round": revision,
                    "status": "completed",
                },
            )
        )

        eligible_claims = {
            claim.supplier_ref: claim
            for claim in claims
            if claim.confidence >= DECISION_CONFIDENCE_THRESHOLD
        }
        candidates = screen(
            case_id=case_id,
            suppliers=case.supplier_records,
            part=case.part,
            profile=case.profile,
            today=self.clock().date(),
            claims=eligible_claims,
        )
        post_claim_rejected = [
            candidate for candidate in candidates if not candidate.compliance.passed
        ]
        events.append(
            Event(
                case_id=case_id,
                ts=self.clock(),
                actor=Actor.DEVIN,
                stage=Stage.COSTING,
                level=Level.WARN if post_claim_rejected else Level.INFO,
                message=f"Re-screened {len(candidates)} Candidates with round {revision} Claims",
                payload={
                    "candidate_count": len(candidates),
                    "rejected_count": len(post_claim_rejected),
                    "round": revision,
                    "failed_rules": [
                        rule.value
                        for candidate in post_claim_rejected
                        for rule in candidate.compliance.failed_rules
                    ],
                },
            )
        )
        decision = build_recorded_decision(
            case_id=case_id,
            incident=case.incident,
            part=case.part,
            profile=case.profile,
            suppliers=case.supplier_records,
            candidates=candidates,
            claims=claims,
            today=self.clock().date(),
            decided_at=self.clock(),
            revision=revision,
        )
        if decision is None:
            events.append(
                Event(
                    case_id=case_id,
                    ts=self.clock(),
                    actor=Actor.DEVIN,
                    stage=Stage.COSTING,
                    level=Level.WARN,
                    message="Decision checks did not pass; no Decision is ready",
                    payload={
                        "policy_passed": False,
                        "cost_model_passed": False,
                        "decision_revision": revision,
                    },
                )
            )
        else:
            events.append(
                Event(
                    case_id=case_id,
                    ts=self.clock(),
                    actor=Actor.DEVIN,
                    stage=Stage.DECIDED,
                    level=(
                        Level.INFO
                        if decision.checks.policy_passed
                        and decision.checks.cost_model_passed
                        else Level.WARN
                    ),
                    message=f"Decision revision {revision} is ready for human approval",
                    payload={
                        "strategy_id": decision.recommended_strategy_id,
                        "total_cost": (
                            decision.strategies[0].total_cost
                            if decision.strategies
                            else None
                        ),
                        "policy_passed": decision.checks.policy_passed,
                        "cost_model_passed": decision.checks.cost_model_passed,
                        "decision_revision": decision.revision,
                    },
                )
            )
        self.store.commit_run(
            case_id=case_id,
            revision=revision,
            candidates=candidates,
            tasks=completed_tasks,
            claims=claims,
            decision=decision,
            events=events,
        )

    def _incident_for(
        self, part: Part, case_id: str, command: OpenCaseCommand
    ) -> Incident:
        source = next(
            (incident for incident in self.records.list_incidents() if incident.part_id == part.part_id),
            None,
        )
        if source is not None:
            updates = {"case_id": case_id}
            if command.qty_required is not None:
                updates["qty_required"] = command.qty_required
            if command.needed_by is not None:
                updates["needed_by"] = command.needed_by
                updates["line_stop_at"] = datetime.combine(
                    command.needed_by, time(6, 0), tzinfo=timezone.utc
                )
            return source.model_copy(update=updates)

        stock = self.records.get_stock(part.part_id)
        level = min(
            stock,
            key=lambda item: item.available_qty / item.daily_consumption
            if item.daily_consumption
            else 10_000,
            default=None,
        )
        qty_on_hand = level.available_qty if level else 0
        take_rate = level.daily_consumption if level else 0
        needed_by = command.needed_by or (
            self.clock().date() + timedelta(days=qty_on_hand // take_rate if take_rate else 30)
        )
        qty_required = command.qty_required or max(
            take_rate * 30,
            level.reorder_level if level else 0,
            qty_on_hand + 1,
        )
        suppliers = self.records.get_suppliers_for_part(part.part_id)
        incumbent = next((supplier.supplier_id for supplier in suppliers if supplier.incumbent), None)
        return Incident(
            case_id=case_id,
            part_id=part.part_id,
            plant_id=level.plant_id if level else "PLANT-MUC",
            production_line="UNASSIGNED",
            qty_required=qty_required,
            qty_on_hand=qty_on_hand,
            needed_by=needed_by,
            line_stop_at=datetime.combine(needed_by, time(6, 0), tzinfo=timezone.utc),
            line_stop_cost_per_hour=part.standard_cost * 100,
            incumbent_supplier_id=incumbent,
            reason="Derived from trusted stock and demand records.",
        )

"""Run a case from detection to pull request, narrating every step.

This is the procedure a Devin session follows, written down once so the same
ordering runs whether a session drives it over HTTP or the demo drives it locally.
Each step appends to the case log before doing the work, so the cockpit shows
*what is happening now* rather than only what finished.

Two things are deliberate:

- `hold_for` leaves one supplier uncalled. The demo places that call live, and the
  claim lands later via the CALL-E route; the run continues and decides on what it
  has, then decides again once the claim arrives. That is the same code path a real
  case takes when one supplier is slow to answer.
- Nothing here places a real call by itself. Outreach goes through the configured
  provider, which is the fake one unless live calling was explicitly turned on.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date

from backend import plan
from backend.casestore.case_store import CaseStore
from backend.decide.run import DecisionOutcome, run as decide
from backend.flow.claims import claim_from_quote
from backend.flow.rehearsal import rehearsed_quote
from backend.outreach.router import route_channel
from backend.policy.screen import screen
from backend.launch.resolve import resolve_incident
from backend.record.ports import SystemOfRecord
from packages.contracts.enums import Actor, Level, PlanGroup, Stage, StepStatus
from packages.contracts.models import (
    Candidate,
    Claim,
    Incident,
    OutreachBrief,
    OutreachTask,
    Part,
)


def _tick(
    cases: CaseStore,
    case_id: str,
    step_id: str,
    status: StepStatus,
    *,
    detail: str | None = None,
    label: str | None = None,
    group: PlanGroup | None = None,
    supplier_ref: str | None = None,
) -> None:
    """Move the checklist along.

    The deterministic run has to tick the same list a Devin session does, or the
    recorded demo and the live one would show different screens.
    """
    plan.upsert(
        case_id,
        cases,
        step_id=step_id,
        status=status,
        detail=detail,
        label=label,
        group=group,
        supplier_ref=supplier_ref,
    )


@dataclass(frozen=True)
class FlowResult:
    case_id: str
    candidates: list[Candidate]
    tasks: list[OutreachTask]
    claims: list[Claim]
    outcome: DecisionOutcome | None
    held_for: str | None = None
    notes: list[str] = field(default_factory=list)


def _task(incident: Incident, part: Part | None, supplier_ref: str, country: str) -> OutreachTask:
    return OutreachTask(
        task_id=f"OUT-{incident.case_id}-{supplier_ref}-{uuid.uuid4().hex[:6]}",
        case_id=incident.case_id,
        supplier_ref=supplier_ref,
        channel=route_channel(country),
        brief=OutreachBrief(
            part_spec=f"{part.item_code} — {part.description}" if part else incident.part_id,
            qty=incident.qty_required,
            needed_by=incident.needed_by,
            target_price=None,
            floor_price=None,
        ),
    )


def run_case(
    *,
    case_id: str,
    records: SystemOfRecord,
    cases: CaseStore,
    today: date | None = None,
    hold_for: str | None = None,
    rehearse: bool = True,
) -> FlowResult:
    """The whole procedure. Safe to run again: every step overwrites its own output."""
    today = today or date.today()
    incident = resolve_incident(case_id, records, cases)
    if incident is None:
        raise ValueError(f"no incident {case_id}")
    part = records.get_part(incident.part_id)
    if part is None:
        raise ValueError(f"no part {incident.part_id}")

    notes: list[str] = []
    plan.seed(case_id, cases)  # a case run by hand has no checklist yet

    # 1. What our own records say about the shortage and the part.
    _tick(cases, case_id, "intake:incident", StepStatus.DONE, detail=incident.reason or None)
    for step_id, detail in (
        ("erp:part", f"{part.item_code}, {part.weight_kg} kg, HS {part.hs_code}"),
        ("erp:stock", f"{incident.qty_on_hand:,} on hand at {incident.plant_id}"),
        ("erp:open_pos", incident.reason or "no delivery scheduled in time"),
        ("erp:price_history", "what we paid before, by quarter"),
    ):
        _tick(cases, case_id, step_id, StepStatus.DONE, detail=detail)
    cases.append_event(
        case_id,
        actor=Actor.DEVIN,
        stage=Stage.DETECTED,
        level=Level.WARN,
        message=(
            f"{part.item_code} ({part.description}): short {incident.shortfall:,} of "
            f"{incident.qty_required:,} pcs, {incident.plant_id}/{incident.production_line} "
            f"stops {incident.line_stop_at.date()} at EUR {incident.line_stop_cost_per_hour}/h"
        ),
        payload={
            "part_id": part.part_id,
            "hs_code": part.hs_code,
            "weight_kg": part.weight_kg,
            "criticality": part.criticality.value,
            "shortfall": incident.shortfall,
        },
    )

    # 2. Who we are allowed to buy from, and why not the others.
    registered = records.get_suppliers_for_part(incident.part_id)
    _tick(
        cases,
        case_id,
        "suppliers:list",
        StepStatus.DONE,
        detail=f"{len(registered)} approved for {part.item_code}",
    )
    _tick(cases, case_id, "screening:policy", StepStatus.ACTIVE)
    claims_before = {c.supplier_ref: c for c in cases.read_claims(case_id)}
    candidates = screen(
        case_id=case_id,
        suppliers=registered,
        part=part,
        profile=records.get_company_profile(),
        today=today,
        claims=claims_before,
    )
    cases.write_candidates(case_id, candidates)
    for candidate in candidates:
        rejected = not candidate.compliance.passed
        _tick(
            cases,
            case_id,
            plan.supplier_step_id(PlanGroup.SCREENING, candidate.supplier_ref),
            StepStatus.FAILED if rejected else StepStatus.DONE,
            label=f"Screening {candidate.supplier_name}",
            group=PlanGroup.SCREENING,
            supplier_ref=candidate.supplier_ref,
            detail=(
                "; ".join(candidate.compliance.explanations.values())
                if rejected
                else "cleared policy"
            ),
        )
        cases.append_event(
            case_id,
            actor=Actor.DEVIN,
            stage=Stage.RESEARCHING,
            level=Level.WARN if rejected else Level.INFO,
            message=(
                f"{candidate.supplier_name} ({candidate.country}): "
                + (
                    "; ".join(candidate.compliance.explanations.values())
                    if rejected
                    else f"cleared policy — {candidate.why_matched}"
                )
            ),
            payload={
                "supplier_ref": candidate.supplier_ref,
                "passed": candidate.compliance.passed,
                "failed_rules": [r.value for r in candidate.compliance.failed_rules],
            },
        )

    compliant = [c for c in candidates if c.compliance.passed]
    _tick(
        cases,
        case_id,
        "screening:policy",
        StepStatus.DONE,
        detail=f"{len(compliant)} of {len(candidates)} cleared",
    )
    _tick(
        cases,
        case_id,
        "outreach:brief",
        StepStatus.DONE,
        detail=f"{incident.qty_required:,} pcs by {incident.needed_by}",
    )
    cases.append_event(
        case_id,
        actor=Actor.DEVIN,
        stage=Stage.RESEARCHING,
        message=(
            f"{len(compliant)} of {len(candidates)} suppliers cleared policy; "
            f"asking each of them for a quote"
        ),
        payload={"compliant": [c.supplier_ref for c in compliant]},
    )

    # 3. Ask them. One supplier can be held back for a live call.
    tasks: list[OutreachTask] = []
    for candidate in compliant:
        # Every compliant supplier gets a line before any of them is called, so
        # the screen shows the fan-out starting together.
        _tick(
            cases,
            case_id,
            plan.supplier_step_id(PlanGroup.OUTREACH, candidate.supplier_ref),
            StepStatus.ACTIVE,
            label=f"Calling {candidate.supplier_name}",
            group=PlanGroup.OUTREACH,
            supplier_ref=candidate.supplier_ref,
            detail="holding for the live call" if candidate.supplier_ref == hold_for else None,
        )
        if candidate.supplier_ref == hold_for:
            continue
        tasks.append(_task(incident, part, candidate.supplier_ref, candidate.country))
    cases.write_outreach_tasks(case_id, tasks)

    if hold_for is not None:
        notes.append(f"{hold_for} was not contacted here; its call is placed separately")
        cases.append_event(
            case_id,
            actor=Actor.SYSTEM,
            stage=Stage.CALLING,
            message=f"holding {hold_for} for a live call",
            payload={"supplier_ref": hold_for},
        )

    filed: list[Claim] = []
    for task in tasks:
        if not rehearse:
            # Live dispatch is the call route's job: it owns the phone numbers, the
            # provider and the webhook. Reaching here means the caller asked for a
            # live run through the wrong door, and guessing would place real calls.
            raise ValueError("live outreach runs through /calls/dispatch, not the conductor")
        supplier = records.get_supplier(task.supplier_ref)
        if supplier is None:
            continue
        claim = claim_from_quote(
            rehearsed_quote(task, supplier=supplier, incident=incident, part=part),
            qty_requested=incident.qty_required,
            part=part,
            supplier=supplier,
            today=today,
        )
        cases.write_claim(claim)
        filed.append(claim)
        _tick(
            cases,
            case_id,
            plan.supplier_step_id(PlanGroup.OUTREACH, task.supplier_ref),
            StepStatus.DONE,
            supplier_ref=task.supplier_ref,
            detail=(
                f"{claim.stock_status.value}, {claim.qty_offered:,} pcs"
                + (f" at EUR {claim.unit_price}" if claim.unit_price is not None else "")
            ),
        )
        cases.append_event(
            case_id,
            actor=Actor.CALLE,
            stage=Stage.CALLING,
            level=Level.WARN if claim.confidence < 0.4 else Level.INFO,
            message=(
                f"{supplier.supplier_name}: "
                f"{claim.stock_status.value}, {claim.qty_offered:,} pcs"
                + (f" at EUR {claim.unit_price}" if claim.unit_price is not None else "")
                + f", {claim.evidence[0] if claim.evidence else ''}"
            ),
            payload={
                "supplier_ref": task.supplier_ref,
                "stock_status": claim.stock_status.value,
                "qty_offered": claim.qty_offered,
                "confidence": claim.confidence,
                "rehearsal": True,
            },
        )

    # 4. Price every plan and write the review package.
    _tick(
        cases,
        case_id,
        "claims:normalise",
        StepStatus.DONE,
        detail=f"{len(filed)} answers turned into claims",
    )
    _tick(cases, case_id, "costing:landed", StepStatus.ACTIVE)
    outcome = decide(case_id=case_id, records=records, cases=cases, today=today)
    _tick(
        cases,
        case_id,
        "costing:landed",
        StepStatus.DONE,
        detail=f"{len(outcome.strategies)} plans priced",
    )
    _tick(
        cases,
        case_id,
        "review:package",
        StepStatus.DONE,
        detail=(
            f"recommended {outcome.recommended.strategy_id}"
            if outcome.recommended is not None
            else "no plan keeps the line running"
        ),
    )
    if outcome.recommended is None:
        notes.append("no plan keeps the line running; a buyer has to intervene")

    return FlowResult(
        case_id=case_id,
        candidates=candidates,
        tasks=tasks,
        claims=filed,
        outcome=outcome,
        held_for=hold_for,
        notes=notes,
    )

"""The to-do list the cockpit renders and the agent ticks off.

The screen has to be laid out before anything runs, so the eight section headers
are fixed and always present in the same order. What is *not* fixed is how much
work happens inside them: the agent decides how many suppliers it researches and
how many it calls, and each of those becomes a step it creates at run time.

So there are two kinds of step:

- **seeded** — the eight sections' own steps, written when the case opens, all
  `pending`. They never disappear, so the checklist looks the same on every case.
- **dynamic** — `outreach:SUP-KBY`, `research:SUP-RUL`, … created by whoever is
  driving (the deterministic conductor or a Devin session) via `upsert`.

`step_id` is the identity: calling `upsert` twice with the same id moves the
existing line rather than adding a second one, which is what makes this safe for
an agent that retries. Nothing here judges whether a step *should* exist; the
plan is a display of intent, and the case artifacts remain the source of truth.
"""

from __future__ import annotations

from datetime import datetime, timezone

from supplyos_api.casestore.case_store import CaseStore
from packages.contracts.enums import PlanGroup, StepStatus
from packages.contracts.models import CasePlan, PlanSection, PlanStep

SECTION_LABELS: dict[PlanGroup, str] = {
    PlanGroup.INTAKE: "Reading the incident",
    PlanGroup.ERP: "Pulling part data",
    PlanGroup.SUPPLIERS: "Finding registered suppliers",
    PlanGroup.SCREENING: "Screening against procurement policy",
    PlanGroup.OUTREACH: "Calling suppliers",
    PlanGroup.CLAIMS: "Collecting answers",
    PlanGroup.COSTING: "Pricing every option",
    PlanGroup.REVIEW: "Handing a ranked shortlist to the buyer",
}

SECTION_ORDER: tuple[PlanGroup, ...] = tuple(SECTION_LABELS)

# The steps that exist on every case, in order. Labels are what the audience
# reads, so they are written as statements of work, not as function names.
SEEDED_STEPS: tuple[tuple[PlanGroup, str, str], ...] = (
    (PlanGroup.INTAKE, "intake:incident", "Reading the shortage the ERP raised"),
    (PlanGroup.ERP, "erp:part", "Pulling the part record, spec, weight and HS code"),
    (PlanGroup.ERP, "erp:stock", "Reading on-hand stock, reservations and take rate"),
    (PlanGroup.ERP, "erp:open_pos", "Checking open purchase orders for a delivery"),
    (PlanGroup.ERP, "erp:price_history", "Reading what we paid for it before"),
    (PlanGroup.SUPPLIERS, "suppliers:list", "Listing the approved suppliers for this part"),
    (PlanGroup.SCREENING, "screening:policy", "Applying the procurement policy to each supplier"),
    (PlanGroup.OUTREACH, "outreach:brief", "Writing the call brief"),
    (PlanGroup.CLAIMS, "claims:normalise", "Turning every answer into a structured claim"),
    (PlanGroup.COSTING, "costing:landed", "Costing single-source and split plans"),
    (PlanGroup.REVIEW, "review:package", "Writing the review package for a buyer"),
)

PLAN_FILE = "plan.json"


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def seed(case_id: str, cases: CaseStore) -> CasePlan:
    """Write the fixed checklist. Never clobbers a plan that already has progress."""
    existing = cases.read_plan_steps(case_id)
    if existing:
        return read(case_id, cases)
    return reset(case_id, cases)


def reset(case_id: str, cases: CaseStore) -> CasePlan:
    """A fresh checklist: every fixed step pending again, dynamic steps dropped.

    A re-run replaces the plan rather than appending to it, so the cockpit shows
    one run's progress and not the remains of the previous one.
    """
    steps = [
        PlanStep(
            step_id=step_id,
            case_id=case_id,
            group=group,
            label=label,
            status=StepStatus.PENDING,
            seq=index,
        )
        for index, (group, step_id, label) in enumerate(SEEDED_STEPS)
    ]
    cases.write_plan_steps(case_id, steps)
    return read(case_id, cases)


def upsert(
    case_id: str,
    cases: CaseStore,
    *,
    step_id: str,
    group: PlanGroup | None = None,
    label: str | None = None,
    status: StepStatus | None = None,
    detail: str | None = None,
    supplier_ref: str | None = None,
) -> PlanStep:
    """Create or move one step. Timestamps are set here, not by the caller."""
    steps = cases.read_plan_steps(case_id)
    by_id = {step.step_id: step for step in steps}
    current = by_id.get(step_id)

    if current is None:
        if group is None or label is None:
            raise ValueError(f"new step {step_id} needs a group and a label")
        current = PlanStep(
            step_id=step_id,
            case_id=case_id,
            group=group,
            label=label,
            dynamic=True,
            seq=100 + len([s for s in steps if s.group == group]),
        )
        steps.append(current)

    updated = current.model_copy(
        update={
            "label": label or current.label,
            "group": group or current.group,
            "detail": detail if detail is not None else current.detail,
            "supplier_ref": supplier_ref or current.supplier_ref,
            "status": status or current.status,
        }
    )
    if updated.status is StepStatus.ACTIVE and updated.started_at is None:
        updated = updated.model_copy(update={"started_at": _now()})
    if updated.status in (StepStatus.DONE, StepStatus.FAILED, StepStatus.SKIPPED):
        updated = updated.model_copy(
            update={
                "started_at": updated.started_at or _now(),
                "completed_at": updated.completed_at or _now(),
            }
        )

    steps = [updated if s.step_id == step_id else s for s in steps]
    if updated.step_id not in {s.step_id for s in steps}:
        steps.append(updated)
    cases.write_plan_steps(case_id, steps)
    return updated


def advance(
    case_id: str,
    cases: CaseStore,
    *,
    step_id: str,
    status: StepStatus,
    detail: str | None = None,
) -> PlanStep | None:
    """Move a step that is expected to exist. A typo must not invent a line."""
    if step_id not in {s.step_id for s in cases.read_plan_steps(case_id)}:
        return None
    return upsert(case_id, cases, step_id=step_id, status=status, detail=detail)


def _section_status(steps: list[PlanStep]) -> StepStatus:
    if not steps:
        return StepStatus.PENDING
    if any(s.status is StepStatus.ACTIVE for s in steps):
        return StepStatus.ACTIVE
    if any(s.status is StepStatus.FAILED for s in steps):
        return StepStatus.FAILED
    if all(s.status in (StepStatus.DONE, StepStatus.SKIPPED) for s in steps):
        return StepStatus.DONE
    if any(s.status is StepStatus.DONE for s in steps):
        return StepStatus.ACTIVE  # part of the section is behind us
    return StepStatus.PENDING


def read(case_id: str, cases: CaseStore) -> CasePlan:
    """The checklist, grouped and ordered, with the section states derived."""
    steps = cases.read_plan_steps(case_id)
    sections: list[PlanSection] = []
    for group in SECTION_ORDER:
        in_group = sorted(
            (s for s in steps if s.group is group),
            key=lambda s: (s.seq, s.step_id),
        )
        sections.append(
            PlanSection(
                group=group,
                label=SECTION_LABELS[group],
                status=_section_status(in_group),
                steps=in_group,
            )
        )

    active = next((s.step_id for s in steps if s.status is StepStatus.ACTIVE), None)
    stamps = [s.completed_at or s.started_at for s in steps if s.completed_at or s.started_at]
    return CasePlan(
        case_id=case_id,
        sections=sections,
        active_step_id=active,
        updated_at=max(stamps) if stamps else None,
        done=len([s for s in steps if s.status in (StepStatus.DONE, StepStatus.SKIPPED)]),
        total=len(steps),
    )


def supplier_step_id(group: PlanGroup, supplier_ref: str) -> str:
    """`outreach:SUP-KBY`. One id per supplier per group, so retries are idempotent."""
    return f"{group.value}:{supplier_ref}"

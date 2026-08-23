"""Move asynchronous call results into claims before re-pricing a case."""

from __future__ import annotations

import time
from datetime import date

from backend import plan
from backend import settings as runtime_settings
from backend.casestore.case_store import CaseStore
from backend.decide.run import DecisionOutcome, run as decide
from backend.flow.claims import claim_from_quote
from backend.launch.resolve import resolve_incident
from backend.record.ports import SystemOfRecord
from backend.store import STORE
from packages.contracts.enums import Actor, Level, PlanGroup, Stage, StepStatus


def collect_quotes(
    *,
    case_id: str,
    records: SystemOfRecord,
    cases: CaseStore,
    today: date,
) -> tuple[list[str], DecisionOutcome | None]:
    incident = resolve_incident(case_id, records, cases)
    if incident is None:
        raise ValueError(f"no incident {case_id}")
    part = records.get_part(incident.part_id)

    known = {(c.supplier_ref, c.task_id) for c in cases.read_claims(case_id)}
    filed: list[str] = []
    for quote in STORE.quotes_for(case_id):
        if (quote.supplier_ref, quote.task_id) in known:
            continue
        claim = claim_from_quote(
            quote,
            qty_requested=incident.qty_required,
            part=part,
            supplier=records.get_supplier(quote.supplier_ref),
            today=today,
        )
        cases.write_claim(claim)
        filed.append(claim.supplier_ref)
        plan.upsert(
            case_id,
            cases,
            step_id=plan.supplier_step_id(PlanGroup.OUTREACH, claim.supplier_ref),
            group=PlanGroup.OUTREACH,
            label=f"Calling {claim.supplier_ref}",
            supplier_ref=claim.supplier_ref,
            status=StepStatus.DONE,
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
                f"{claim.supplier_ref} answered: {claim.stock_status.value}, "
                f"{claim.qty_offered:,} pcs"
                + (f" at EUR {claim.unit_price}" if claim.unit_price is not None else "")
            ),
            payload={
                "supplier_ref": claim.supplier_ref,
                "stock_status": claim.stock_status.value,
                "confidence": claim.confidence,
            },
        )

    outcome = None
    if filed:
        plan.upsert(
            case_id,
            cases,
            step_id="claims:normalise",
            status=StepStatus.DONE,
            detail=f"{len(cases.read_claims(case_id))} claims on file",
        )
        outcome = decide(case_id=case_id, records=records, cases=cases, today=today)
        plan.upsert(
            case_id,
            cases,
            step_id="costing:landed",
            status=StepStatus.DONE,
            detail=f"re-priced: {len(outcome.strategies)} plans",
        )
    return filed, outcome


def wait_for_pending_calls(
    case_id: str,
    *,
    timeout_s: float,
    supplier_ref: str | None = None,
) -> tuple[float, bool, list[dict], list[dict]]:
    started = time.monotonic()
    initial = STORE.pending_calls(case_id, float("inf"))
    if supplier_ref:
        initial = [entry for entry in initial if entry["supplier_ref"] == supplier_ref]
    if not initial:
        return 0.0, False, [], []

    initial_tasks = {entry["task_id"] for entry in initial}
    timed_out = False
    while True:
        current = STORE.pending_calls(case_id, timeout_s)
        if supplier_ref:
            current = [entry for entry in current if entry["supplier_ref"] == supplier_ref]
        if not current:
            break
        elapsed = time.monotonic() - started
        if elapsed >= timeout_s:
            timed_out = True
            break
        time.sleep(min(1.0, timeout_s - elapsed))

    elapsed = time.monotonic() - started
    quotes = {
        quote.task_id
        for quote in STORE.quotes_for(case_id)
        if quote.task_id in initial_tasks
    }
    resolved = [entry for entry in initial if entry["task_id"] in quotes]
    still_pending = [
        entry
        for entry in STORE.pending_calls(case_id, timeout_s)
        if entry["task_id"] in initial_tasks
        and (not supplier_ref or entry["supplier_ref"] == supplier_ref)
    ]
    unresolved = [entry for entry in initial if entry["task_id"] not in quotes]
    if not still_pending and unresolved and any(
        time.monotonic() - entry["started_at"] >= timeout_s for entry in unresolved
    ):
        timed_out = True
    if timed_out and not still_pending:
        still_pending = [{**entry, "expired": True} for entry in unresolved]
    return elapsed, timed_out, resolved, still_pending

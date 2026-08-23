"""The launcher: four endpoints that drive a whole case.

A Devin session (or the demo) calls these in order:

    POST /flow/run      detect -> part -> screen -> ask -> price -> write artifacts
    POST /flow/call     place the one call we held back, live if explicitly allowed
    POST /flow/collect  turn call results into claims and decide again
    GET  /flow/state    where the run has got to, for the cockpit

`run` is idempotent, and `collect` is the reason: every new claim rewrites the
review package from whatever is currently known, so a late answer changes the
recommendation instead of being lost.

Live calling is refused unless it was turned on deliberately. `live=true` with
`LIVE_CALLS` unset is an error, never a quiet rehearsal and never a quiet dial.
"""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from supplyos_api import plan
from supplyos_api.deps import erp, settings, store
from supplyos_api.settings import LIVE_CALLS_CONFIRMATION, Settings
from supplyos_api.casestore.case_store import CaseStore
from supplyos_api.decide.run import run as decide
from supplyos_api.flow.claims import claim_from_quote
from supplyos_api.flow.workflow import run_case
from supplyos_api.flow.provider import RehearsalOutreachProvider
from supplyos_api.outreach.protocol import OutreachProvider
from supplyos_api.outreach.router import route_channel
from supplyos_api.launch.resolve import resolve_incident
from supplyos_api.record.ports import SystemOfRecord
from supplyos_api.outreach.buffer import OUTREACH_BUFFER
from packages.contracts.enums import Actor, Level, PlanGroup, Stage, StepStatus
from packages.contracts.models import OutreachBrief, OutreachTask

router = APIRouter(prefix="/flow", tags=["launcher"])

# (case_id, supplier_ref) pairs already promised to a live call. A rehearsal for
# the same pair would answer first and be priced instead of the real call.
_reserved_for_live: set[tuple[str, str]] = set()

TODAY = date(2026, 8, 22)


def _strategy_view(case_id: str, cases: CaseStore) -> dict[str, object] | None:
    """Every priced plan, ranked, not just the winner.

    The person who signs the order is choosing between offers; handing them one
    answer and hiding the runners-up would make the analysis less useful than the
    spreadsheet it replaces.
    """
    decision = cases.read_decision(case_id)
    if decision is None:
        return None
    return {
        "recommended_strategy_id": decision.recommended_strategy_id,
        "options": [
            {
                "strategy_id": s.strategy_id,
                "label": s.label,
                "total_cost": str(s.total_cost),
                "unit_effective": str(s.unit_effective),
                "coverage_date": s.coverage_date.isoformat(),
                "meets_line_stop": s.meets_line_stop,
                "recommended": s.strategy_id == decision.recommended_strategy_id,
                "suppliers": [
                    {"supplier_ref": line.supplier_ref, "qty": line.qty, "eta": line.eta.isoformat()}
                    for line in s.lines
                ],
            }
            for s in decision.strategies
        ],
        "pr_url": decision.pr_url,
        "approval": "a buyer picks one of these; nothing is ordered by the agent",
    }


@router.post("/run", summary="Run the case: detect, screen, ask, price, write the review package")
def post_run(
    case_id: str,
    hold_for: str | None = Query(
        default=None,
        description="Supplier to leave uncalled, e.g. the one called live on stage.",
    ),
    pace_ms: int = Query(
        default=0,
        ge=0,
        le=5000,
        description="Dwell per checklist step, so a screen recording can follow along.",
    ),
    today: date = Query(default=TODAY),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
) -> dict[str, object]:
    # A re-run asks again, so last run's answers must not be collected a second
    # time as though they were fresh.
    OUTREACH_BUFFER.clear_quotes(case_id)
    try:
        result = run_case(
            case_id=case_id,
            records=records,
            cases=cases,
            today=today,
            hold_for=hold_for,
            pace=pace_ms / 1000,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "case_id": case_id,
        "screened": len(result.candidates),
        "compliant": [c.supplier_ref for c in result.candidates if c.compliance.passed],
        "rejected": {
            c.supplier_ref: [r.value for r in c.compliance.failed_rules]
            for c in result.candidates
            if not c.compliance.passed
        },
        "asked": [t.supplier_ref for t in result.tasks],
        "held_for": result.held_for,
        "claims": [
            {
                "supplier_ref": c.supplier_ref,
                "stock_status": c.stock_status.value,
                "qty_offered": c.qty_offered,
                "unit_price": str(c.unit_price) if c.unit_price is not None else None,
                "confidence": c.confidence,
            }
            for c in result.claims
        ],
        "decision": _strategy_view(case_id, cases),
        "notes": result.notes,
        "rehearsal": True,
    }


@router.post("/call", summary="Place the held-back call — rehearsed unless live is turned on")
def post_call(
    case_id: str,
    supplier_ref: str,
    live: bool = Query(default=False, description="Requires LIVE_CALLS to be set."),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
    config: Settings = Depends(settings),
) -> dict[str, object]:
    incident = resolve_incident(case_id, records, cases)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"no incident {case_id}")
    supplier = records.get_supplier(supplier_ref)
    if supplier is None:
        raise HTTPException(status_code=404, detail=f"no supplier {supplier_ref}")
    if live and not config.live_calls_enabled:
        raise HTTPException(
            status_code=409,
            detail=(
                "live call requested but live calling is off; set "
                f'LIVE_CALLS="{LIVE_CALLS_CONFIRMATION}" and FAKE_CALLS=0 to dial for real'
            ),
        )

    part = records.get_part(incident.part_id)
    task = OutreachTask(
        task_id=f"OUT-{case_id}-{supplier_ref}-{uuid.uuid4().hex[:6]}",
        case_id=case_id,
        supplier_ref=supplier_ref,
        channel=route_channel(supplier.country),
        brief=OutreachBrief(
            part_spec=f"{part.item_code} — {part.description}" if part else incident.part_id,
            qty=incident.qty_required,
            needed_by=incident.needed_by,
            target_price=supplier.contract_unit_price,
            floor_price=None,
        ),
    )

    provider: OutreachProvider
    if live:
        # Imported here so a rehearsal run never even loads the live client.
        from supplyos_api.outreach.calle import CalleOutreachProvider

        provider = CalleOutreachProvider()
        _reserved_for_live.add((case_id, supplier_ref))
    elif (case_id, supplier_ref) in _reserved_for_live:
        # Someone is on the phone as this supplier right now. Rehearsing it would
        # file invented numbers before they finish answering.
        cases.append_event(
            case_id,
            actor=Actor.DEVIN,
            stage=Stage.CALLING,
            message=(
                f"skipped the rehearsal for {supplier.supplier_name}: "
                "a live call is already in flight"
            ),
            payload={"supplier_ref": supplier_ref, "live": False, "skipped": True},
        )
        return {
            "case_id": case_id,
            "supplier_ref": supplier_ref,
            "task_id": None,
            "provider": "skipped",
            "live": False,
            "note": "a live call holds this supplier; its answer will be the claim",
        }
    else:
        provider = RehearsalOutreachProvider(records)

    plan.upsert(
        case_id,
        cases,
        step_id=plan.supplier_step_id(PlanGroup.OUTREACH, supplier_ref),
        group=PlanGroup.OUTREACH,
        label=f"Calling {supplier.supplier_name}",
        supplier_ref=supplier_ref,
        status=StepStatus.ACTIVE,
        detail="dialling now, live" if live else "rehearsal",
    )
    cases.append_event(
        case_id,
        actor=Actor.DEVIN,
        stage=Stage.CALLING,
        message=(
            f"calling {supplier.supplier_name} about {incident.qty_required:,} pcs "
            f"({'live' if live else 'rehearsal'})"
        ),
        payload={"supplier_ref": supplier_ref, "task_id": task.task_id, "live": live},
    )

    try:
        receipt = provider.dispatch([task])
    except Exception as exc:
        plan.upsert(
            case_id,
            cases,
            step_id=plan.supplier_step_id(PlanGroup.OUTREACH, supplier_ref),
            status=StepStatus.FAILED,
            detail=str(exc)[:120],
        )
        cases.append_event(
            case_id,
            actor=Actor.CALLE,
            stage=Stage.CALLING,
            level=Level.ERROR,
            message=f"call to {supplier.supplier_name} could not be placed: {exc}",
            payload={"supplier_ref": supplier_ref, "task_id": task.task_id},
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "case_id": case_id,
        "supplier_ref": supplier_ref,
        "task_id": task.task_id,
        "provider": receipt.provider,
        "live": live,
        "note": "poll /flow/collect until the claim appears",
    }


@router.post("/collect", summary="File whatever the calls returned, then decide again")
def post_collect(
    case_id: str,
    today: date = Query(default=TODAY),
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
) -> dict[str, object]:
    """Bridges the call transport to the case file.

    Live and fake calls both land their result in the in-process quote buffer;
    the decision only reads claims from the case directory. This moves them
    across, adding the judgement fields, and re-prices the case.
    """
    incident = resolve_incident(case_id, records, cases)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"no incident {case_id}")
    part = records.get_part(incident.part_id)

    known = {(c.supplier_ref, c.task_id) for c in cases.read_claims(case_id)}
    filed: list[str] = []
    for quote in OUTREACH_BUFFER.quotes_for(case_id):
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

    return {
        "case_id": case_id,
        "filed": filed,
        "claims": len(cases.read_claims(case_id)),
        "decision": _strategy_view(case_id, cases),
    }


@router.get("/state", summary="Where the run has got to")
def get_state(
    case_id: str,
    cases: CaseStore = Depends(store),
) -> dict[str, object]:
    events = cases.read_events(case_id)
    if not events:
        raise HTTPException(status_code=404, detail=f"no events for {case_id}")
    last = events[-1]
    return {
        "case_id": case_id,
        "stage": last.stage.value,
        "message": last.message,
        "at": last.ts.isoformat(),
        "events": len(events),
        "candidates": len(cases.read_candidates(case_id)),
        "claims": [c.supplier_ref for c in cases.read_claims(case_id)],
        "decision": _strategy_view(case_id, cases),
    }

"""The Devin tool endpoints. Boring, fast, documented, stable.

Devin burns ACUs while it waits, so every handler here is an in-memory lookup
over data parsed once at startup. Nothing in this module does I/O per request,
and nothing here returns a raw phone number.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.outreach.provider import get_provider
from backend.record.dialling import LiveCallRefused, destination_for
from backend.store import STORE

from backend.api.deps import erp, settings, store
from packages.contracts.enums import Actor, Level, Stage
from packages.contracts.models import (
    Channel,
    Quote,
    Candidate,
    Claim,
    Event,
    Incident,
    OpenPurchaseOrder,
    OutreachBrief,
    OutreachTask,
    Part,
    StockLevel,
    SupplierPriceRecord,
    SupplierRecord,
)
from packages.contracts.safe import claim_from_result
from backend.record.ports import SystemOfRecord
from backend.casestore.case_store import CaseStore

def _provider_complaint(response) -> str:
    """What the carrier actually objected to, in its own words.

    CALL-E answers a rejected request with
    `{"error": {"code", "message", "details": {"reason": ...}}}`. The reason is
    the sentence that names the offending field, so it is the one part worth
    reading -- "the telephony provider returned 400" sent us hunting through the
    whole payload once already. Falls back to the raw body for any other shape.
    """
    try:
        error = response.json().get("error", {})
    except ValueError:
        return response.text[:200]
    parts = [error.get("message"), (error.get("details") or {}).get("reason")]
    return " ".join(str(p) for p in parts if p) or response.text[:200]


def _carrier_error(exc: Exception) -> str:
    """A sentence an operator can act on, without leaking the credential."""
    import httpx

    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        if code in (401, 403):
            return (
                "the telephony provider rejected our credentials — check "
                "CALLE_API_KEY (a value wrapped in quotes is a common cause)"
            )
        if code == 429:
            return "the telephony provider is rate limiting us — wait and retry"
        if 400 <= code < 500:
            return (
                f"the telephony provider rejected the request "
                f"({code}): {_provider_complaint(exc.response)}"
            )
        return f"the telephony provider returned {code}"
    if isinstance(exc, httpx.TimeoutException):
        return "the telephony provider did not respond in time"
    if isinstance(exc, httpx.RequestError):
        return f"could not reach the telephony provider: {exc.__class__.__name__}"
    return str(exc)[:300] or exc.__class__.__name__


def call_mode() -> str:
    """Test mode unless Slice C's FAKE_CALLS switch is explicitly turned off.

    Read per request rather than captured at import, so restarting the API is
    enough to change modes and a stale module constant can never disagree with
    what the provider actually does.
    """
    import os

    return "live" if os.environ.get("FAKE_CALLS", "1").strip() == "0" else "test"


router = APIRouter(prefix="/tools", tags=["devin-tools"])


class OutreachDispatch(BaseModel):
    """What the cockpit gets back the instant it presses "call the suppliers"."""

    case_id: str
    provider: str = Field(description='"fake" in rehearsal, the CALL-E provider when live')
    mode: str = Field(description='"test" or "live"')
    tasks: list[OutreachTask]


@router.get("/part/{part_id}", response_model=Part, summary="One part, with its spec, weight and HS code")
def get_part(part_id: str, records: SystemOfRecord = Depends(erp)) -> Part:
    part = records.get_part(part_id)
    if part is None:
        raise HTTPException(status_code=404, detail=f"no part {part_id}")
    return part


@router.get("/parts", response_model=list[Part], summary="The whole item master")
def list_parts(records: SystemOfRecord = Depends(erp)) -> list[Part]:
    return records.list_parts()


@router.get("/stock", response_model=list[StockLevel], summary="On-hand, reserved, reorder point and take rate")
def get_stock(
    part_id: str = Query(...),
    plant_id: str | None = Query(default=None),
    records: SystemOfRecord = Depends(erp),
) -> list[StockLevel]:
    return records.get_stock(part_id, plant_id)


@router.get("/suppliers", response_model=list[SupplierRecord], summary="Approved suppliers for a part, in call order")
def get_suppliers(
    part_id: str = Query(...),
    approved_only: bool = Query(default=True),
    records: SystemOfRecord = Depends(erp),
) -> list[SupplierRecord]:
    """Deterministic order: preferred first, then cheapest contract price, then id.

    Who gets called first is a business decision, never a sampling artefact.
    Phone numbers come back masked; there is no field here for a raw one.
    """
    if approved_only:
        return records.get_suppliers_for_part(part_id)
    return [s for s in records.list_suppliers() if part_id in s.part_ids]


@router.get("/price_history", response_model=list[SupplierPriceRecord], summary="What we actually paid, by quarter")
def get_price_history(
    part_id: str = Query(...),
    supplier_id: str | None = Query(default=None),
    records: SystemOfRecord = Depends(erp),
) -> list[SupplierPriceRecord]:
    return records.get_price_history(part_id, supplier_id)


@router.get("/alternates", response_model=list[Part], summary="Same class, same primary dimension, different part")
def get_alternates(part_id: str = Query(...), records: SystemOfRecord = Depends(erp)) -> list[Part]:
    return records.get_alternates(part_id)


@router.get("/open_pos", response_model=list[OpenPurchaseOrder], summary="Open POs, including slipped ones")
def get_open_pos(part_id: str | None = Query(default=None), records: SystemOfRecord = Depends(erp)) -> list[OpenPurchaseOrder]:
    return records.get_open_pos(part_id)


@router.get("/incident/{case_id}", response_model=Incident, summary="The shortage, as our own records see it")
def get_incident(case_id: str, records: SystemOfRecord = Depends(erp)) -> Incident:
    incident = records.get_incident(case_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"no incident {case_id}")
    return incident


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


@router.post("/candidates", response_model=list[Candidate], summary="File the candidate list for a case")
def post_candidates(
    case_id: str,
    candidates: list[Candidate],
    cases: CaseStore = Depends(store),
) -> list[Candidate]:
    cases.write_candidates(case_id, candidates)
    rejected = [c for c in candidates if not c.compliance.passed]
    cases.append_event(
        case_id,
        actor=Actor.DEVIN,
        stage=Stage.RESEARCHING,
        message=(
            f"{len(candidates)} supplier{'' if len(candidates) == 1 else 's'} assessed, "
            f"{len(rejected)} did not meet procurement policy"
        ),
        payload={
            "rejected": [
                {"supplier_ref": c.supplier_ref, "rules": [r.value for r in c.compliance.failed_rules]}
                for c in rejected
            ]
        },
    )
    return candidates


@router.post("/outreach", response_model=OutreachDispatch, summary="Brief the suppliers and start outreach")
def post_outreach(
    case_id: str,
    supplier_ids: list[str],
    qty: int,
    records: SystemOfRecord = Depends(erp),
    cases: CaseStore = Depends(store),
    config=Depends(settings),
) -> OutreachDispatch:
    """Build briefs from the system of record, then hand them to Slice C.

    Slice B knows the part, the quantity and which suppliers exist; Slice C knows
    how to reach them. So this builds the `OutreachTask`s and dispatches them
    through Slice C's `OutreachProvider` seam -- the same call whether that seam
    is the rehearsal provider or a real CALL-E line. Nothing here places a call
    itself.

    Dispatch is asynchronous by design: it returns a receipt immediately and the
    claims land later, because that is the shape a real phone call has.

    The channel is chosen by geography, not preference: CALL-E has no CN region,
    so a Chinese supplier routes to email rather than voice.
    """
    incident = records.get_incident(case_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"no incident {case_id}")
    part = records.get_part(incident.part_id)

    # Fail before briefing anyone. A live run with no configured destination is
    # a mistake, and the only safe response to it is to not dial.
    if call_mode() == "live":
        try:
            destination_for(supplier_ids[0] if supplier_ids else "", live=True)
        except LiveCallRefused as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from None

    tasks: list[OutreachTask] = []
    for supplier_id in supplier_ids:
        supplier = records.get_supplier(supplier_id)
        if supplier is None:
            raise HTTPException(status_code=404, detail=f"no supplier {supplier_id}")
        channel = Channel.VOICE if Channel.VOICE in supplier.channels else (
            Channel.EMAIL if Channel.EMAIL in supplier.channels else Channel.MARKETPLACE
        )
        tasks.append(
            OutreachTask(
                task_id=f"OUT-{case_id}-{supplier_id}-{uuid.uuid4().hex[:6]}",
                case_id=case_id,
                supplier_ref=supplier_id,
                channel=channel,
                brief=OutreachBrief(
                    part_spec=f"{part.item_code} — {part.description}" if part else incident.part_id,
                    qty=qty,
                    needed_by=incident.needed_by,
                    target_price=supplier.contract_unit_price,
                    floor_price=None,
                ),
            )
        )

    cases.write_outreach_tasks(case_id, tasks)

    provider = get_provider()
    try:
        receipt = provider.dispatch(tasks)
    except Exception as exc:  # noqa: BLE001 - the reason must reach the operator
        # An unhandled exception here returns a 500 with no CORS headers, which
        # the browser reports as "NetworkError" -- the least useful sentence
        # available when the real cause is a rejected key or an unreachable
        # carrier. Surface what actually happened instead.
        detail = _carrier_error(exc)
        cases.append_event(
            case_id,
            actor=Actor.SYSTEM,
            stage=Stage.CALLING,
            level=Level.ERROR,
            message=f"Could not reach suppliers: {detail}",
            payload={"suppliers": supplier_ids},
        )
        raise HTTPException(status_code=502, detail=detail) from None

    cases.append_event(
        case_id,
        actor=Actor.SYSTEM,
        stage=Stage.CALLING,
        message=(
            f"Contacting {len(tasks)} supplier"
            f"{'' if len(tasks) == 1 else 's'} about {part.item_code if part else incident.part_id}"
            f" — {qty:,} pcs needed by {incident.needed_by}"
        ),
        payload={
            "mode": call_mode(),
            "provider": provider.name,
            "channels": [t.channel.value for t in tasks],
            "task_ids": receipt.task_ids,
        },
    )
    return OutreachDispatch(
        case_id=case_id,
        provider=provider.name,
        mode=call_mode(),
        tasks=tasks,
    )


@router.post("/claims", response_model=Claim, summary="File what a supplier said. Never raises.")
def post_claim(
    case_id: str,
    task_id: str,
    supplier_ref: str,
    result: dict | None = None,
    call_id: str | None = None,
    round_: int = 1,
    cases: CaseStore = Depends(store),
) -> Claim:
    """Accepts whatever the call returned, however garbled.

    A truncated or nonsense result becomes a confidence-0 claim with its fields
    defaulted to unknown, not a 422. One bad call must not kill a five-supplier
    case mid-run.
    """
    claim = claim_from_result(
        result, task_id=task_id, case_id=case_id, supplier_ref=supplier_ref,
        call_id=call_id, round_=round_,
    )
    cases.write_claim(claim)
    cases.append_event(
        case_id,
        actor=Actor.CALLE,
        stage=Stage.CALLING,
        level=Level.WARN if claim.confidence < 0.4 else Level.INFO,
        message=(
            f"{supplier_ref} responded: {claim.stock_status.value.replace('_', ' ')}, "
            f"{claim.qty_offered:,} pcs offered"
        ),
        payload={"supplier_ref": supplier_ref, "stock_status": claim.stock_status.value},
    )
    return claim


@router.post("/events", response_model=Event, summary="Narrate progress into the case log")
def post_event(
    case_id: str,
    stage: Stage,
    message: str,
    actor: Actor = Actor.DEVIN,
    level: Level = Level.INFO,
    payload: dict | None = None,
    cases: CaseStore = Depends(store),
) -> Event:
    return cases.append_event(
        case_id, actor=actor, stage=stage, message=message, level=level, payload=payload
    )


@router.get("/quotes", response_model=list[Quote], summary="What the calls have returned so far")
def get_quotes(case_id: str = Query(...)) -> list[Quote]:
    """Reads Slice C's live working set.

    Dispatch is asynchronous, so the cockpit polls this while calls are in
    flight. Empty is a normal answer, not an error.
    """
    return STORE.quotes_for(case_id)

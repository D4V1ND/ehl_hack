"""CALL-E result -> Quote. This function is never allowed to raise.

A missing, partial, or garbled call result becomes a valid Quote with
fields defaulted to unknown and confidence 0.0. A later phase distrusts
any claim below a confidence threshold, so a broken call flows naturally
into "we couldn't verify this one" rather than halting the run.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from packages.contracts.models import (
    Currency,
    ExpediteOption,
    PriceBreak,
    Quote,
    TranscriptTurn,
)


def _decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _currency(value: Any) -> Currency:
    try:
        return Currency(str(value).upper())
    except (ValueError, AttributeError):
        return Currency.UNKNOWN


def _price_breaks(value: Any) -> list[PriceBreak]:
    if not isinstance(value, list):
        return []
    out: list[PriceBreak] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        qty = _int(item.get("min_qty"))
        price = _decimal(item.get("unit_price"))
        if qty is not None and price is not None:
            out.append(PriceBreak(min_qty=qty, unit_price=price))
    return out


def _expedite(value: Any) -> ExpediteOption | None:
    if not isinstance(value, dict):
        return None
    days = _int(value.get("days"))
    surcharge = _decimal(value.get("surcharge"))
    if days is None or surcharge is None:
        return None
    return ExpediteOption(days=days, surcharge=surcharge)


def _transcript(value: Any) -> list[TranscriptTurn]:
    if not isinstance(value, list):
        return []
    turns: list[TranscriptTurn] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        text = item.get("text")
        speaker = item.get("speaker")
        turns.append(
            TranscriptTurn(
                offset_seconds=_int(item.get("offset_seconds")) or 0,
                speaker=speaker if isinstance(speaker, str) else "unknown",
                text=text if isinstance(text, str) else "",
            )
        )
    return turns


def _confidence(value: Any) -> float:
    # CALL-E sends {"score": 0.82, "label": "high"}, not a bare float.
    if isinstance(value, dict):
        value = value.get("score")
    try:
        return max(0.0, min(1.0, float(value)))
    except (ValueError, TypeError):
        return 0.0


def normalize_result(
    task_id: str,
    case_id: str,
    supplier_ref: str,
    payload: dict,
) -> Quote:
    result: dict = {}
    if isinstance(payload, dict) and isinstance(payload.get("structured_result"), dict):
        result = payload["structured_result"]

    certs = result.get("certs_claimed")
    if not isinstance(certs, list):
        certs = []

    # CALL-E's prose summary is often the only place a partial call's findings
    # survive, so keep it rather than dropping it on the floor.
    notes = payload.get("summary") if isinstance(payload, dict) else None
    if not isinstance(notes, str):
        notes = ""

    return Quote(
        task_id=task_id,
        case_id=case_id,
        supplier_ref=supplier_ref,
        available=bool(result.get("available", False)),
        qty_offered=_int(result.get("qty_offered")) or 0,
        unit_price=_decimal(result.get("unit_price")),
        price_breaks=_price_breaks(result.get("price_breaks")),
        currency=_currency(result.get("currency")),
        moq=_int(result.get("moq")),
        lead_time_days=_int(result.get("lead_time_days")),
        expedite_option=_expedite(result.get("expedite_option")),
        incoterm=result.get("incoterm") if isinstance(result.get("incoterm"), str) else None,
        certs_claimed=[str(c) for c in certs],
        payment_terms=(
            result.get("payment_terms")
            if isinstance(result.get("payment_terms"), str)
            else None
        ),
        notes=notes,
        summary=notes,
        transcript=_transcript(
            payload.get("transcript_turns") if isinstance(payload, dict) else None
        ),
        transcript_url=payload.get("transcript_url") if isinstance(payload, dict) else None,
        recording_url=payload.get("recording_url") if isinstance(payload, dict) else None,
        confidence=_confidence(payload.get("completion_confidence") if isinstance(payload, dict) else 0.0),
        raw=payload if isinstance(payload, dict) else {},
    )

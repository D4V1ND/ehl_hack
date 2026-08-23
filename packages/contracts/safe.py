"""Building a claim from an untrusted payload, without ever raising.

The rule from the foundation spec: a garbled, truncated or nonsense call result
becomes a claim with its fields defaulted to "unknown"/zero and confidence 0 —
not an exception. One bad call must not kill a five-supplier case mid-run, and
by the time Devin is orchestrating, an exception here costs a whole session.

So this module reads defensively, field by field, and discards anything it
cannot understand into `raw` where a human can still go and look at it.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from packages.contracts.enums import Answer, StockStatus
from packages.contracts.models import Currency
from packages.contracts.models import Claim, ExpediteOption, PriceBreak
from packages.contracts.money import to_decimal


def _answer(value: Any) -> Answer:
    if isinstance(value, Answer):
        return value
    if isinstance(value, bool):
        return Answer.YES if value else Answer.NO
    if isinstance(value, str):
        text = value.strip().lower()
        if text in ("yes", "y", "true", "confirmed"):
            return Answer.YES
        if text in ("no", "n", "false", "denied"):
            return Answer.NO
    return Answer.UNKNOWN


def _stock_status(value: Any) -> StockStatus:
    if isinstance(value, StockStatus):
        return value
    if isinstance(value, str):
        try:
            return StockStatus(value.strip().lower())
        except ValueError:
            pass
    return StockStatus.UNCLEAR


def _int(value: Any, default: int | None = None) -> int | None:
    try:
        if value is None or isinstance(value, bool):
            return default
        return int(float(str(value).strip().replace(",", "")))
    except (TypeError, ValueError):
        return default


def _money(value: Any):
    try:
        if value is None or isinstance(value, bool):
            return None
        parsed = to_decimal(value)
    except (TypeError, ValueError, ArithmeticError):
        return None
    # NaN and Infinity are parseable Decimals and poisonous money: they would
    # propagate silently through the cost model. Treat them as "not quoted".
    if not parsed.is_finite():
        return None
    return parsed


def _currency(value: Any) -> Currency:
    """An unrecognised currency is `unknown`, not a crash and not a guessed EUR."""
    if isinstance(value, Currency):
        return value
    if isinstance(value, str):
        try:
            return Currency(value.strip().upper())
        except ValueError:
            return Currency.UNKNOWN
    return Currency.UNKNOWN


def _confidence(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if number != number:  # NaN
        return 0.0
    return max(0.0, min(1.0, number))


def _price_breaks(value: Any) -> list[PriceBreak]:
    if not isinstance(value, list):
        return []
    breaks: list[PriceBreak] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        qty = _int(entry.get("min_qty"))
        price = _money(entry.get("unit_price"))
        if qty is None or qty < 1 or price is None:
            continue
        breaks.append(PriceBreak(min_qty=qty, unit_price=price))
    return sorted(breaks, key=lambda b: b.min_qty)


def _expedite(value: Any) -> ExpediteOption | None:
    if not isinstance(value, dict):
        return None
    days = _int(value.get("days"))
    surcharge = _money(value.get("surcharge"))
    if days is None or surcharge is None:
        return None
    return ExpediteOption(days=days, surcharge=surcharge)


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    return []


def _text(value: Any, default: str = "") -> str:
    return value.strip() if isinstance(value, str) else default


UNAVAILABLE_STATUSES = (StockStatus.UNAVAILABLE, StockStatus.UNCLEAR)


def _available(value: Any, *, stock_status: StockStatus, qty_offered: int) -> bool:
    """Whether they can supply at all — the field the rest of the system spends.

    An explicit answer wins. When the result is silent, availability follows the
    stock status and the quantity actually offered, because a claim that says
    "free in stock, 6,300 pcs" and `available=False` is a contradiction that
    silently zeroes the supplier out of every plan.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        answer = value.strip().lower()
        if answer in ("true", "yes", "y", "1"):
            return True
        if answer in ("false", "no", "n", "0"):
            return False
    return qty_offered > 0 and stock_status not in UNAVAILABLE_STATUSES


def claim_from_result(
    result: Any,
    *,
    task_id: str,
    case_id: str,
    supplier_ref: str,
    call_id: str | None = None,
    round_: int = 1,
) -> Claim:
    """Build a `Claim` from whatever a call returned. Never raises.

    `result` is treated as entirely untrusted: `None`, a string, a list, or a
    dict with wrong types in every field all produce a valid confidence-0 claim
    rather than an error.
    """
    payload: dict[str, Any] = result if isinstance(result, dict) else {}
    unparsed = {} if isinstance(result, dict) else {"unparsed_result": repr(result)[:2000]}

    stock_status = _stock_status(payload.get("stock_status"))
    qty_offered = _int(payload.get("qty_offered"), 0) or 0

    return Claim(
        task_id=task_id,
        case_id=case_id,
        supplier_ref=supplier_ref,
        round=round_,
        call_id=call_id,
        available=_available(
            payload.get("available"), stock_status=stock_status, qty_offered=qty_offered
        ),
        qty_offered=qty_offered,
        earliest_ready_text=_text(payload.get("earliest_ready_text")),
        stock_status=stock_status,
        lead_time_days=_int(payload.get("lead_time_days")),
        price_quoted=_answer(payload.get("price_quoted")),
        unit_price=_money(payload.get("unit_price")),
        price_breaks=_price_breaks(payload.get("price_breaks")),
        moq=_int(payload.get("moq")),
        currency=_currency(payload.get("currency")),
        expedite_option=_expedite(payload.get("expedite_option")),
        incoterm=_text(payload.get("incoterm")) or None,
        payment_terms=_text(payload.get("payment_terms")) or None,
        part_number_confirmed=_answer(payload.get("part_number_confirmed")),
        certification_current=_answer(payload.get("certification_current")),
        certs_claimed=_strings(payload.get("certs_claimed")),
        notes=_text(payload.get("notes")),
        summary=_text(payload.get("summary")),
        transcript_url=_text(payload.get("transcript_url")) or None,
        recording_url=_text(payload.get("recording_url")) or None,
        confidence=_confidence(payload.get("confidence")),
        evidence=_strings(payload.get("evidence")),
        raw={**payload, **unparsed},
        received_at=datetime.now(timezone.utc),
    )

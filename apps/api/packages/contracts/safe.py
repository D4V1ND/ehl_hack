"""Building a claim from an untrusted payload, without ever raising.

The rule from the foundation spec: a garbled, truncated or nonsense call result
becomes a claim with its fields defaulted to "unknown"/zero and confidence 0 —
not an exception. One bad call must not kill a five-supplier case mid-run, and
by the time Devin is orchestrating, an exception here costs a whole session.

So this module reads defensively, field by field, and discards anything it
cannot understand into `raw` where a human can still go and look at it.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from math import isfinite
from typing import Any

from packages.contracts.enums import Answer, StockStatus
from packages.contracts.models import (
    CaseSnapshot,
    CaseSummary,
    Claim,
    CompanyProfile,
    Currency,
    Decision,
    Event,
    ExpediteOption,
    PriceBreak,
    PublicCaseSnapshot,
    PublicCaseSummary,
    PublicClaim,
    PublicDecision,
    PublicEvent,
    PublicProfileSummary,
    PublicSupplierRecord,
    SupplierRecord,
    TranscriptTurn,
)
from packages.contracts.money import to_decimal
from packages.contracts.phone import mask


_E164_IN_TEXT = re.compile(r"\+[1-9]\d{7,14}")
_EMAIL_IN_TEXT = re.compile(r"(?<![\w.+-])[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])")
_BEARER_IN_TEXT = re.compile(r"(?i)\bBearer\s+[^\s,;]+")
_SECRET_ASSIGNMENT = re.compile(
    r"(?i)\b(api[_-]?key|password|secret|token)=([^\s&]+)"
)
_SECRET_KEY = re.compile(
    r"(?i)(authorization|cookie|headers?|password|secret|token|api[_-]?key|"
    r"request_body|raw|phone|email)"
)

PUBLIC_EVENT_PAYLOAD_KEYS = frozenset(
    {
        "part_id",
        "item_name",
        "part_class",
        "criticality",
        "plant_id",
        "production_line",
        "qty_required",
        "qty_on_hand",
        "needed_by",
        "line_stop_at",
        "line_stop_cost_per_hour",
        "incumbent_supplier_id",
        "candidate_count",
        "rejected_count",
        "supplier_ref",
        "task_id",
        "channel",
        "round",
        "status",
        "stock_status",
        "confidence",
        "strategy_id",
        "total_cost",
        "policy_passed",
        "cost_model_passed",
        "decision_revision",
        "approved_by",
        "failed_rules",
        "devin_session_url",
    }
)


def scrub_public_text(value: str) -> str:
    """Remove contact and credential data from public free text."""

    scrubbed = _E164_IN_TEXT.sub(lambda match: mask(match.group(0)), value)
    scrubbed = _EMAIL_IN_TEXT.sub("[redacted-email]", scrubbed)
    scrubbed = _BEARER_IN_TEXT.sub("Bearer [redacted]", scrubbed)
    return _SECRET_ASSIGNMENT.sub(lambda match: f"{match.group(1)}=[redacted]", scrubbed)


def _public_mapping_key(key: Any) -> str:
    return str(key.value if isinstance(key, Enum) else key)


def scrub_public_value(value: Any) -> Any:
    """Recursively scrub a value before it enters a strict public DTO."""

    if isinstance(value, str):
        return scrub_public_text(value)
    if isinstance(value, Enum):
        return value
    if isinstance(value, (datetime, Decimal, int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [scrub_public_value(item) for item in value]
    if isinstance(value, tuple):
        return [scrub_public_value(item) for item in value]
    if isinstance(value, Mapping):
        return {
            _public_mapping_key(key): scrub_public_value(item)
            for key, item in value.items()
            if _public_mapping_key(key) == "phone_masked"
            or not _SECRET_KEY.search(_public_mapping_key(key))
        }
    return scrub_public_text(str(value))


def _public_fields(model: type) -> set[str]:
    return set(model.model_fields)


def project_public_supplier_record(record: SupplierRecord) -> PublicSupplierRecord:
    payload = record.model_dump(include=_public_fields(PublicSupplierRecord))
    return PublicSupplierRecord.model_validate(scrub_public_value(payload))


def project_public_claim(claim: Claim) -> PublicClaim:
    payload = claim.model_dump(include=_public_fields(PublicClaim))
    return PublicClaim.model_validate(scrub_public_value(payload))


def project_public_decision(decision: Decision) -> PublicDecision:
    payload = decision.model_dump(include=_public_fields(PublicDecision))
    return PublicDecision.model_validate(scrub_public_value(payload))


def _public_event_value(value: Any) -> Any:
    """Keep safe scalar/list metadata; arbitrary nested provider objects stay private."""

    if isinstance(value, Mapping):
        return None
    if isinstance(value, list):
        return [_public_event_value(item) for item in value if not isinstance(item, Mapping)]
    return scrub_public_value(value)


def project_public_event(event: Event) -> PublicEvent:
    payload = {
        key: _public_event_value(value)
        for key, value in event.payload.items()
        if key in PUBLIC_EVENT_PAYLOAD_KEYS and not isinstance(value, Mapping)
    }
    return PublicEvent(
        seq=event.seq,
        case_id=event.case_id,
        ts=event.ts,
        actor=event.actor,
        stage=event.stage,
        level=event.level,
        message=scrub_public_text(event.message),
        payload=payload,
    )


def project_public_case_summary(summary: CaseSummary) -> PublicCaseSummary:
    payload = summary.model_dump(include=_public_fields(PublicCaseSummary))
    return PublicCaseSummary.model_validate(scrub_public_value(payload))


def project_public_profile_summary(
    profile: CompanyProfile | PublicProfileSummary | Mapping[str, Any],
    *,
    target_currency: Currency = Currency.EUR,
) -> PublicProfileSummary:
    if isinstance(profile, PublicProfileSummary):
        return PublicProfileSummary.model_validate(scrub_public_value(profile.model_dump()))
    if isinstance(profile, CompanyProfile):
        constraints = [
            *(f"blocked_origin:{country}" for country in profile.blocked_origin_countries),
            *(f"required_certification:{cert}" for certs in profile.required_certifications.values() for cert in certs),
        ]
        return PublicProfileSummary(
            company_name=scrub_public_text(profile.legal_entity),
            home_country=profile.country,
            target_currency=target_currency,
            policy_labels=[
                "blocked_origin_country",
                "missing_required_certification",
                "audit_required_and_not_audited",
                "lead_time_after_line_stop",
            ],
            sourcing_constraints=constraints,
        )

    raw = dict(profile)
    return PublicProfileSummary(
        company_name=scrub_public_text(
            str(raw.get("company_name") or raw.get("legal_entity") or "")
        ),
        home_country=str(raw.get("home_country") or raw.get("country") or ""),
        target_currency=raw.get("target_currency", target_currency),
        policy_labels=scrub_public_value(raw.get("policy_labels", [])),
        sourcing_constraints=scrub_public_value(raw.get("sourcing_constraints", [])),
    )


def project_public_case_snapshot(
    snapshot: CaseSnapshot,
    *,
    profile_summary: PublicProfileSummary | None = None,
) -> PublicCaseSnapshot:
    return PublicCaseSnapshot(
        case_id=snapshot.case_id,
        stage=snapshot.stage,
        incident=type(snapshot.incident).model_validate(
            scrub_public_value(snapshot.incident.model_dump())
        ),
        part=type(snapshot.part).model_validate(scrub_public_value(snapshot.part.model_dump())),
        profile_summary=profile_summary
        or project_public_profile_summary(
            snapshot.profile_summary,
            target_currency=snapshot.incident.currency,
        ),
        candidates=[
            type(candidate).model_validate(scrub_public_value(candidate.model_dump()))
            for candidate in snapshot.candidates
        ],
        supplier_records=[
            project_public_supplier_record(record) for record in snapshot.supplier_records
        ],
        outreach_tasks=[
            type(task).model_validate(scrub_public_value(task.model_dump()))
            for task in snapshot.outreach_tasks
        ],
        claims=[project_public_claim(claim) for claim in snapshot.claims],
        decision=project_public_decision(snapshot.decision) if snapshot.decision else None,
        devin_session_url=(
            scrub_public_text(snapshot.devin_session_url)
            if snapshot.devin_session_url
            else None
        ),
        last_event_seq=snapshot.last_event_seq,
    )


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


def _boolean(value: Any, default: bool = False) -> bool:
    """Read an explicit provider boolean without treating arbitrary values as true."""

    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes"}:
            return True
        if normalized in {"false", "no"}:
            return False
    return default


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
    except (TypeError, ValueError, OverflowError):
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
    if not isfinite(number):
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


def _transcript(value: Any) -> list[TranscriptTurn]:
    if not isinstance(value, list):
        return []
    turns: list[TranscriptTurn] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        turns.append(
            TranscriptTurn(
                offset_seconds=max(_int(item.get("offset_seconds"), 0) or 0, 0),
                speaker=_text(item.get("speaker"), "unknown") or "unknown",
                text=_text(item.get("text")),
            )
        )
    return turns


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

    return Claim(
        task_id=task_id,
        case_id=case_id,
        supplier_ref=supplier_ref,
        round=round_,
        call_id=call_id,
        available=_boolean(payload.get("available")),
        qty_offered=_int(payload.get("qty_offered"), 0) or 0,
        earliest_ready_text=_text(payload.get("earliest_ready_text")),
        stock_status=_stock_status(payload.get("stock_status")),
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
        transcript=_transcript(payload.get("transcript")),
        summary=_text(payload.get("summary")),
        transcript_url=_text(payload.get("transcript_url")) or None,
        recording_url=_text(payload.get("recording_url")) or None,
        confidence=_confidence(payload.get("confidence")),
        evidence=_strings(payload.get("evidence")),
        raw={**payload, **unparsed},
        received_at=datetime.now(timezone.utc),
    )

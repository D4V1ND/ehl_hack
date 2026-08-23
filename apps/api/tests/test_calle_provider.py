from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from calle.errors import CalleAPIError

from packages.contracts.models import Channel, OutreachBrief, OutreachTask
from supplyos_api.outreach import calle
from supplyos_api.outreach.buffer import OUTREACH_BUFFER
from supplyos_api.outreach.calle import (
    CalleOutreachProvider,
    InvalidPhoneNumber,
    LiveCallBudgetSpent,
    build_calle_payload,
    mask,
)

def _task(
    task_id: str = "T-001",
    supplier: str = "SUP-ATLAS",
    case_id: str = "CASE-001",
) -> OutreachTask:
    return OutreachTask(
        task_id=task_id,
        case_id=case_id,
        supplier_ref=supplier,
        channel=Channel.VOICE,
        brief=OutreachBrief(
            part_spec="Deep groove ball bearing 6204-2RS",
            qty=5000,
            needed_by=date(2026, 9, 3),
            target_price=Decimal("1.85"),
            floor_price=Decimal("2.40"),
        ),
    )


def setup_function():
    OUTREACH_BUFFER.reset()
    with calle._placed_lock:
        calle._placed.clear()


def test_payload_carries_the_answer_sheet_and_the_case_id():
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["result_schema"]["additionalProperties"] is False
    assert "part_available" in payload["result_schema"]["required"]
    assert "recipient_result_schema" not in payload
    assert payload["metadata"]["case_id"] == "CASE-001"
    first = payload["task"].split("\n")[0]
    assert "AI" in first
    assert "Meridian Motors" in first
    assert '"' in first


def test_the_raw_number_appears_only_in_the_recipient():
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["recipient"]["phones"] == ["+447700900123"]
    assert "+447700900123" not in payload["task"]


def test_the_payload_matches_the_sdk_create_signature():
    """An unsupported key would fail only on a real, billed call."""
    import inspect

    from calle.calls import CalleCalls

    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    allowed = set(inspect.signature(CalleCalls.create).parameters) - {"self"}
    assert set(payload) <= allowed, f"SDK rejects: {set(payload) - allowed}"


def test_the_call_is_placed_in_english():
    """Locale/region made CALL-E fail its planner; language lives in the task."""
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert "locale" not in payload["recipient"]
    assert "region" not in payload["recipient"]
    assert "English" in payload["task"]


def test_a_malformed_number_is_refused_not_dialled():
    with pytest.raises(InvalidPhoneNumber):
        build_calle_payload(
            [_task()],
            phones_by_supplier={"SUP-ATLAS": "0770 090 0123"},
            buyer_name="Meridian Motors",
        )


def test_mask_hides_the_middle():
    assert mask("+447700900123") == "+4*******0123"


def test_one_call_carries_one_recipient():
    payload = build_calle_payload(
        [_task("T-001", "SUP-A"), _task("T-002", "SUP-B")],
        phones_by_supplier={"SUP-A": "+447700900123", "SUP-B": "+447700900124"},
        buyer_name="Meridian Motors",
    )
    assert "recipients" not in payload
    assert payload["recipient"]["phones"] == ["+447700900123"]
    assert payload["metadata"]["task_id"] == "T-001"


def test_budget_is_per_case_and_spent_only_after_acceptance(monkeypatch):
    accepted = SimpleNamespace(calls=SimpleNamespace(create=lambda **_kwargs: {"id": None}))
    monkeypatch.setattr(calle.settings, "CALLE_API_KEY", "test-key")
    monkeypatch.setattr(calle, "MAX_LIVE_CALLS", 1)
    monkeypatch.setattr(calle, "_client", lambda: accepted)
    monkeypatch.setattr(
        calle,
        "_load_supplier_phones",
        lambda refs: {ref: "+447700900123" for ref in refs},
    )

    provider = CalleOutreachProvider()
    provider.dispatch([_task()])
    assert calle.live_calls_placed("CASE-001") == 1
    with pytest.raises(LiveCallBudgetSpent):
        provider.dispatch([_task("T-002", "SUP-B")])

    provider.dispatch([_task("T-003", "SUP-C", "CASE-002")])
    assert calle.live_calls_placed("CASE-002") == 1


def test_rejected_call_does_not_spend_the_budget(monkeypatch):
    def reject(**_kwargs):
        raise CalleAPIError(
            code="invalid_request",
            message="rejected",
            status_code=422,
        )

    rejected = SimpleNamespace(calls=SimpleNamespace(create=reject))
    monkeypatch.setattr(calle.settings, "CALLE_API_KEY", "test-key")
    monkeypatch.setattr(calle, "MAX_LIVE_CALLS", 1)
    monkeypatch.setattr(calle, "_client", lambda: rejected)
    monkeypatch.setattr(
        calle,
        "_load_supplier_phones",
        lambda refs: {ref: "+447700900123" for ref in refs},
    )

    with pytest.raises(RuntimeError, match="invalid_request"):
        CalleOutreachProvider().dispatch([_task()])
    assert calle.live_calls_placed("CASE-001") == 0

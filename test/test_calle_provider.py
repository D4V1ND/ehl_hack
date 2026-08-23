from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.outreach.calle import InvalidPhoneNumber, build_calle_payload, mask
from backend.store import STORE
from packages.contracts.models import Channel, OutreachBrief, OutreachTask

client = TestClient(app)


def _task(task_id="T-001", supplier="SUP-ATLAS") -> OutreachTask:
    return OutreachTask(
        task_id=task_id,
        case_id="CASE-001",
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
    STORE.reset()


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
    """dispatch calls client.calls.create(**payload). A key the SDK does not
    accept would raise TypeError only on a real, billed call."""
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
    """Region/locale on the recipient made CALL-E 503 the plan compiler.
    English is in the task text instead."""
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
    """CALL-E takes a singular `recipient`.

    A `recipients` array is refused with provider_unavailable/503, which reads
    like an outage rather than the schema mismatch it is. Correlation rides in
    the top-level metadata anyway, which names a single task, so dispatch sends
    one request per supplier and the extra tasks here are not batched in.
    """
    payload = build_calle_payload(
        [_task("T-001", "SUP-A"), _task("T-002", "SUP-B")],
        phones_by_supplier={"SUP-A": "+447700900123", "SUP-B": "+447700900124"},
        buyer_name="Meridian Motors",
    )
    assert "recipients" not in payload
    assert payload["recipient"]["phones"] == ["+447700900123"]
    assert payload["metadata"]["task_id"] == "T-001"


def test_webhook_turns_a_result_into_a_stored_quote():
    r = client.post(
        "/calle/webhook",
        json={
            "metadata": {"case_id": "CASE-001", "task_id": "T-001",
                         "supplier_ref": "SUP-ATLAS"},
            "structured_result": {"available": True, "qty_offered": 5000,
                                  "unit_price": "2.15", "currency": "EUR",
                                  "lead_time_days": 14},
            "completion_confidence": 0.9,
        },
    )
    assert r.status_code == 200
    quotes = STORE.quotes_for("CASE-001")
    assert len(quotes) == 1
    assert quotes[0].unit_price == Decimal("2.15")


def test_webhook_accepts_garbage_without_500ing():
    r = client.post("/calle/webhook", json={"metadata": {"case_id": "CASE-001",
                                                         "task_id": "T-002",
                                                         "supplier_ref": "SUP-X"}})
    assert r.status_code == 200
    assert STORE.quotes_for("CASE-001")[0].confidence == 0.0

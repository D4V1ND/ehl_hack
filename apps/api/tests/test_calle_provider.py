from datetime import date
from decimal import Decimal

import pytest

from supplyos_api.outreach.calle import InvalidPhoneNumber, build_calle_payload, mask
from packages.contracts.models import Channel, OutreachBrief, OutreachTask


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


def test_payload_carries_the_answer_sheet_and_the_case_id():
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["recipient_result_schema"]["additionalProperties"] is False
    assert payload["metadata"]["case_id"] == "CASE-001"
    assert payload["task"].split("\n")[0].startswith("You are an AI")


def test_the_raw_number_appears_only_in_the_recipient():
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["recipient"]["phones"] == ["+447700900123"]
    assert "recipients" not in payload
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
    """The locale drives the spoken language: a de-DE call came back fully
    in German despite an English task text."""
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["recipient"]["locale"].startswith("en")


def test_a_malformed_number_is_refused_not_dialled():
    with pytest.raises(InvalidPhoneNumber):
        build_calle_payload(
            [_task()],
            phones_by_supplier={"SUP-ATLAS": "0770 090 0123"},
            buyer_name="Meridian Motors",
        )


def test_mask_hides_the_middle():
    assert mask("+447700900123") == "+4*******0123"


def test_each_payload_is_for_exactly_one_supplier():
    with pytest.raises(ValueError, match="one task"):
        build_calle_payload(
            [_task("T-001", "SUP-A"), _task("T-002", "SUP-B")],
            phones_by_supplier={"SUP-A": "+447700900123", "SUP-B": "+447700900124"},
            buyer_name="Meridian Motors",
        )

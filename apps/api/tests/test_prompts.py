from datetime import date
from decimal import Decimal

from supplyos_api.outreach.prompts import build_task_text
from packages.contracts.models import Channel, OutreachBrief, OutreachTask


def _task(**overrides) -> OutreachTask:
    brief = OutreachBrief(
        part_spec="Deep groove ball bearing 6204-2RS (DIN 625)",
        qty=5000,
        needed_by=date(2026, 9, 3),
        target_price=Decimal("1.85"),
        floor_price=Decimal("2.40"),
        **overrides,
    )
    return OutreachTask(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        channel=Channel.VOICE,
        brief=brief,
    )


def test_disclosure_is_the_first_thing_said():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    first = text.split("\n")[0]
    assert "AI" in first
    assert "Meridian Motors" in first
    assert '"I am an AI assistant calling on behalf of Meridian Motors.' in first


def test_the_call_is_conducted_in_english():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "English" in text
    # A supplier answering in their own language must not switch the call.
    assert "even if" in text.lower()


def test_the_part_number_is_said_slowly():
    text = build_task_text(_task(), buyer_name="Meridian Motors").lower()
    assert "slowly" in text
    assert "part number" in text


def test_recording_is_disclosed():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "recorded" in text.lower()


def test_it_offers_a_human_and_stops_when_asked():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "human" in text.lower()
    assert "end the call" in text.lower()


def test_every_must_ask_item_appears():
    text = build_task_text(_task(), buyer_name="Meridian Motors").lower()
    assert "available" in text
    assert "unit price" in text
    assert "minimum order" in text
    assert "lead time" in text
    assert "incoterm" in text
    assert "certif" in text
    assert "payment terms" in text


def test_the_floor_price_is_never_spoken_to_the_supplier():
    """Our walk-away number is ours. Saying it destroys the negotiation."""
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "2.40" not in text


def test_the_target_price_guides_the_negotiation():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "1.85" in text


def test_a_missing_target_price_is_allowed():
    task = _task()
    task.brief.target_price = None
    text = build_task_text(task, buyer_name="Meridian Motors")
    assert "AI" in text.split("\n")[0]


def test_the_suppliers_phone_number_never_appears_in_the_script():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "+" not in text

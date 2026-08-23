from decimal import Decimal

from supplyos_api.outreach.normalize import normalize_result
from packages.contracts.models import Currency


def _norm(payload: dict):
    return normalize_result("T-001", "CASE-001", "SUP-ATLAS", payload)


def test_a_clean_result_maps_across():
    q = _norm(
        {
            "structured_result": {
                "available": True,
                "qty_offered": 5000,
                "unit_price": "2.15",
                "currency": "EUR",
                "moq": 500,
                "lead_time_days": 14,
                "incoterm": "DAP",
                "certs_claimed": ["ISO 9001"],
                "price_breaks": [{"min_qty": 1000, "unit_price": "2.30"}],
            },
            "completion_confidence": 0.91,
        }
    )
    assert q.available is True
    assert q.unit_price == Decimal("2.15")
    assert q.currency is Currency.EUR
    assert q.confidence == 0.91
    assert q.price_breaks[0].min_qty == 1000


def test_an_empty_payload_gives_an_unknown_quote_with_zero_confidence():
    q = _norm({})
    assert q.available is False
    assert q.unit_price is None
    assert q.currency is Currency.UNKNOWN
    assert q.confidence == 0.0


def test_garbage_types_do_not_raise():
    q = _norm({"structured_result": {"qty_offered": "not a number",
                                     "lead_time_days": None,
                                     "unit_price": "banana"}})
    assert q.qty_offered == 0
    assert q.lead_time_days is None
    assert q.unit_price is None
    assert q.confidence == 0.0


def test_an_unknown_currency_becomes_unknown_not_an_error():
    q = _norm({"structured_result": {"currency": "XYZ"}})
    assert q.currency is Currency.UNKNOWN


def test_the_transcript_comes_back_as_typed_turns():
    q = _norm(
        {
            "transcript_turns": [
                {"offset_seconds": 0, "speaker": "bot", "text": "Good morning"},
                {"offset_seconds": 4, "speaker": "user", "text": "Five euro each"},
            ]
        }
    )
    assert [t.text for t in q.transcript] == ["Good morning", "Five euro each"]
    assert q.transcript[1].speaker == "user"
    assert q.transcript[1].offset_seconds == 4


def test_a_garbled_transcript_turn_does_not_lose_the_whole_transcript():
    q = _norm(
        {
            "transcript_turns": [
                "not a dict",
                {"speaker": None, "text": None, "offset_seconds": "x"},
                {"speaker": "bot", "text": "still here"},
            ]
        }
    )
    assert len(q.transcript) == 2
    assert q.transcript[0].speaker == "unknown"
    assert q.transcript[0].text == ""
    assert q.transcript[-1].text == "still here"


def test_no_transcript_is_an_empty_list_not_a_crash():
    assert _norm({}).transcript == []


def test_the_raw_payload_is_always_kept():
    payload = {"structured_result": {"available": True}, "anything": "else"}
    assert _norm(payload).raw == payload

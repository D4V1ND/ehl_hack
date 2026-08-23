"""Filing a claim must never raise, however garbled the input.

The rule from the foundation spec, and it matters more once a session is
orchestrating five suppliers at once: one unintelligible call must degrade to a
confidence-0 claim, not take down the case.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from packages.contracts.enums import Answer, StockStatus
from packages.contracts.safe import claim_from_result

KW = {"task_id": "T-1", "case_id": "CASE-001", "supplier_ref": "SUP-KBY"}

GARBAGE = [
    None,
    "",
    "the line went dead",
    [1, 2, 3],
    0,
    False,
    {"qty_offered": "twelve thousand"},
    {"unit_price": "one euro fifty"},
    {"unit_price": float("nan")},
    {"price_breaks": "not a list"},
    {"price_breaks": [{"min_qty": 0, "unit_price": "x"}, None, 7]},
    {"confidence": "very high"},
    {"confidence": float("inf")},
    {"stock_status": "probably?"},
    {"expedite_option": {"days": "soon"}},
    {"certs_claimed": 9001},
    {"qty_offered": None, "unit_price": None, "stock_status": None},
]


@pytest.mark.parametrize("payload", GARBAGE, ids=lambda p: repr(p)[:32])
def test_garbage_becomes_a_confidence_zero_claim(payload):
    claim = claim_from_result(payload, **KW)
    assert claim.case_id == "CASE-001"
    assert 0.0 <= claim.confidence <= 1.0
    assert claim.stock_status in set(StockStatus)
    assert claim.price_quoted in set(Answer)


def test_nothing_understandable_means_unknown_everywhere():
    claim = claim_from_result("total nonsense", **KW)
    assert claim.confidence == 0.0
    assert claim.stock_status is StockStatus.UNCLEAR
    assert claim.price_quoted is Answer.UNKNOWN
    assert claim.certification_current is Answer.UNKNOWN
    assert claim.part_number_confirmed is Answer.UNKNOWN
    assert claim.qty_offered == 0
    assert claim.unit_price is None


def test_a_good_result_survives_intact_and_money_stays_exact():
    claim = claim_from_result(
        {
            "qty_offered": "12,000",
            "unit_price": 1.55,
            "stock_status": "in_stock_allocated",
            "price_quoted": True,
            "confidence": 0.93,
            "price_breaks": [
                {"min_qty": "10000", "unit_price": "1.88"},
                {"min_qty": 1000, "unit_price": 2.1},
            ],
        },
        **KW,
    )
    assert claim.qty_offered == 12000
    # 1.55 arrives as a float and must not become 1.5500000000000000444...
    assert claim.unit_price == Decimal("1.55")
    assert claim.stock_status is StockStatus.IN_STOCK_ALLOCATED
    assert claim.price_quoted is Answer.YES
    assert [b.min_qty for b in claim.price_breaks] == [1000, 10000]


def test_a_stated_yes_survives_into_the_claim():
    """`available` is the field every plan hangs on: dropping it zeroes the
    supplier's deliverable quantity and the case decides "no plan"."""
    claim = claim_from_result(
        {"available": True, "qty_offered": 6300, "unit_price": "1.58", "lead_time_days": 10},
        **KW,
    )
    assert claim.available is True
    assert claim.qty_offered == 6300


def test_a_stated_no_is_still_a_no():
    claim = claim_from_result({"available": False, "qty_offered": 6300}, **KW)
    assert claim.available is False


def test_stock_and_quantity_stand_in_for_an_unasked_availability():
    assert claim_from_result(
        {"stock_status": "free_in_stock", "qty_offered": 6300}, **KW
    ).available is True
    assert claim_from_result({"stock_status": "unavailable", "qty_offered": 6300}, **KW).available is False
    assert claim_from_result({"qty_offered": 6300}, **KW).available is False


def test_unparseable_input_is_kept_for_a_human():
    claim = claim_from_result("caller hung up mid-sentence", **KW)
    assert "unparsed_result" in claim.raw

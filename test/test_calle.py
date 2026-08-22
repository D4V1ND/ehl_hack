"""Smoke test for the CALL-E integration.

This is a standalone script, independent of the (not-yet-built) supplyguard
package — it talks to CALL-E's REST API directly, using the request contract
documented in docs/specs/supplyguard-plan-1-foundation-spec.md /
the original Plan 1 doc (POST /v1/calls with a task, a result_schema, and a
recipient). If CALL-E's real OpenAPI contract differs, this is the file to
adjust.

The scenario: an automotive company, Meridian Motors, is short on a brake
caliper part and calls one supplier, Atlas Auto Parts, to ask about
availability, price, stock status, and certification.

Three tests always run and never touch the network:
  - the request payload is built correctly
  - the AI disclosure is always the first thing said
  - a destination number that isn't valid E.164 is refused, never dialed

One test places a real phone call and is SKIPPED BY DEFAULT. It only runs when
all three of these are true, on purpose, so a real call can never happen by
accident:
  1. CALLE_API_KEY is set
  2. TEST_CALL_DESTINATION_NUMBER is set to a number you actually control
  3. CALLE_LIVE_TEST_CONFIRM is set to exactly "yes-call-my-phone"

Run just the safe tests:      pytest test/test_calle.py -v -m "not live"
Run everything (real call):   pytest test/test_calle.py -v
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import httpx
import pytest

# ---------------------------------------------------------------------------
# .env loading (no extra dependency — just enough to read KEY=VALUE lines)
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(REPO_ROOT / ".env")

# ---------------------------------------------------------------------------
# Phone number safety (mirrors the rules in Plan 1: validate on the way in,
# mask on the way out, raw number only ever inside the outbound request body)
# ---------------------------------------------------------------------------

_E164 = re.compile(r"^\+[1-9]\d{1,14}$")


class InvalidPhoneNumber(ValueError):
    pass


def validate_e164(number: str) -> str:
    if not _E164.match(number):
        raise InvalidPhoneNumber(f"not a valid E.164 phone number: {number!r}")
    return number


def mask(number: str) -> str:
    digits = number.lstrip("+")
    if len(digits) <= 4:
        return "+" + "*" * len(digits)
    return "+" + digits[0] + "*" * (len(digits) - 5) + digits[-4:]


# ---------------------------------------------------------------------------
# The scenario: Meridian Motors is short on brake calipers, calling Atlas
# Auto Parts to check availability, price, stock status, and certification.
# ---------------------------------------------------------------------------

BUYER_NAME = "Meridian Motors"
SUPPLIER_NAME = "Atlas Auto Parts"
PART_NUMBER = "BC-118"
SHORTFALL_UNITS = 6
SUPPLIER_REGION = "US"
SUPPLIER_LOCALE = "en-US"

DISCLOSURE = (
    "You are an AI procurement assistant calling on behalf of {buyer_name}. "
    "State clearly at the start of the call that you are an AI assistant and "
    "say who you are calling for. If the person asks to speak to a human, or "
    "asks you to stop, thank them and end the call without pursuing the "
    "request. Do not agree to any price, quantity, delivery commitment, or "
    "contract change on this call; you are gathering information only, and a "
    "human buyer makes every decision."
)

RESULT_SCHEMA: dict = {
    "type": "object",
    "required": [
        "available_quantity",
        "earliest_availability",
        "price_quoted",
        "unit_price_quoted",
        "currency",
        "certification_current",
        "part_number_confirmed",
        "stock_status",
    ],
    "properties": {
        "available_quantity": {"type": "integer"},
        "earliest_availability": {"type": "string"},
        "price_quoted": {"type": "string", "enum": ["yes", "no", "unknown"]},
        "unit_price_quoted": {"type": "number"},
        "currency": {"type": "string", "enum": ["EUR", "USD", "GBP", "unknown"]},
        "certification_current": {
            "type": "string",
            "enum": ["yes", "no", "unknown"],
        },
        "part_number_confirmed": {
            "type": "string",
            "enum": ["yes", "no", "unknown"],
        },
        "stock_status": {
            "type": "string",
            "enum": [
                "free_in_stock",
                "in_stock_allocated",
                "to_be_made",
                "unavailable",
                "unclear",
            ],
        },
    },
    "additionalProperties": False,
}


def sourcing_task_text() -> str:
    disclosure = DISCLOSURE.format(buyer_name=BUYER_NAME)
    body = (
        f"Call {SUPPLIER_NAME} about part number {PART_NUMBER} (automotive "
        f"brake caliper). We need {SHORTFALL_UNITS} units. "
        f"Ask how many units they can supply, the earliest they could be "
        f"collected or shipped, and the price per unit. "
        f"Ask them to confirm the exact part number back to you. "
        f"Ask whether their quality certification for this part is currently "
        f"valid. "
        f"Most importantly, ask whether any units they mention are physically "
        f"in stock and free, or already reserved for another customer or "
        f"order - this distinction matters more than the quantity itself."
    )
    return disclosure + "\n\n" + body


def build_request_payload(destination_number: str) -> dict:
    """Build the CALL-E request body. `destination_number` must already be
    validated E.164 — this function does not re-check it."""
    return {
        "task": sourcing_task_text(),
        "recipients": [
            {
                "phones": [destination_number],
                "region": SUPPLIER_REGION,
                "locale": SUPPLIER_LOCALE,
            }
        ],
        "result_schema": RESULT_SCHEMA,
        "metadata": {
            "buyer_name": BUYER_NAME,
            "supplier_name": SUPPLIER_NAME,
            "part_number": PART_NUMBER,
            "scenario": "test_calle.py smoke test",
        },
    }


# ---------------------------------------------------------------------------
# Tests that never touch the network
# ---------------------------------------------------------------------------


def test_disclosure_is_always_the_first_thing_said():
    text = sourcing_task_text()
    assert text.startswith("You are an AI procurement assistant")
    assert BUYER_NAME in text


def test_disclosure_says_no_commitments_and_offers_a_human():
    text = sourcing_task_text()
    assert "Do not agree to any price, quantity, delivery commitment" in text
    assert "asks you to stop" in text


def test_request_payload_is_shaped_correctly():
    payload = build_request_payload("+12125550199")
    assert payload["recipients"][0]["phones"] == ["+12125550199"]
    assert payload["recipients"][0]["region"] == SUPPLIER_REGION
    assert payload["result_schema"]["additionalProperties"] is False
    assert payload["result_schema"]["properties"]["stock_status"]["enum"] == [
        "free_in_stock",
        "in_stock_allocated",
        "to_be_made",
        "unavailable",
        "unclear",
    ]
    assert set(payload["result_schema"]["required"]) == {
        "available_quantity",
        "earliest_availability",
        "price_quoted",
        "unit_price_quoted",
        "currency",
        "certification_current",
        "part_number_confirmed",
        "stock_status",
    }
    assert payload["metadata"]["part_number"] == PART_NUMBER


def test_a_malformed_destination_is_refused_not_dialed():
    with pytest.raises(InvalidPhoneNumber):
        validate_e164("0812 3456 789")


def test_mask_never_exposes_the_full_destination_number():
    assert mask("+12125550199") == "+1******0199"


# ---------------------------------------------------------------------------
# The one test that can actually ring a phone. Skipped unless every guard is
# explicitly satisfied — see the module docstring.
# ---------------------------------------------------------------------------

_api_key = os.environ.get("CALLE_API_KEY")
_destination_raw = os.environ.get("TEST_CALL_DESTINATION_NUMBER")
_confirmed = os.environ.get("CALLE_LIVE_TEST_CONFIRM") == "yes-call-my-phone"

_skip_reason = None
if not _api_key:
    _skip_reason = "CALLE_API_KEY not set in .env"
elif not _destination_raw:
    _skip_reason = "TEST_CALL_DESTINATION_NUMBER not set in .env"
elif not _confirmed:
    _skip_reason = (
        "CALLE_LIVE_TEST_CONFIRM not set to 'yes-call-my-phone' in .env "
        "— this is the explicit opt-in required before a real call is placed"
    )


@pytest.mark.live
@pytest.mark.skipif(_skip_reason is not None, reason=str(_skip_reason))
def test_place_one_real_call_and_get_a_structured_result():
    destination = validate_e164(_destination_raw)
    base_url = os.environ.get("CALLE_BASE_URL", "https://api.heycall-e.com")

    print("\nLIVE CALL ABOUT TO BE PLACED — this spends one CALL-E credit.")
    print(f"  dialling: {mask(destination)}")
    print(f"  scenario: {BUYER_NAME} -> {SUPPLIER_NAME} about {PART_NUMBER}")

    response = httpx.post(
        f"{base_url}/v1/calls",
        headers={
            "Authorization": f"Bearer {_api_key}",
            "Idempotency-Key": f"test-calle-smoke:{PART_NUMBER}:1",
            "Content-Type": "application/json",
        },
        json=build_request_payload(destination),
        timeout=300.0,
    )
    response.raise_for_status()
    result = response.json()

    assert "id" in result
    print(f"  call id:  {result['id']}")
    print(f"  status:   {result.get('status')}")
    print(f"  result:   {result.get('structured_result')}")

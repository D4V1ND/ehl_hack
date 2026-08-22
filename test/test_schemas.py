"""The answer sheet handed to CALL-E, held to the subset CALL-E accepts.

The live API rejects a schema it cannot read with

    400 recipient_result_schema_invalid
        unsupported JSON Schema keyword at $.properties.unit_price: anyOf

and a rejected schema means the call is never placed. That failure is only
visible with a network round trip, so these tests encode the rule instead: the
supported keyword subset, and the field names that keep the sheet aligned with
the models the answers are parsed into.
"""

from __future__ import annotations

from decimal import Decimal

from backend.outreach.normalize import normalize_result
from packages.contracts.models import Claim, Quote
from packages.contracts.schemas import quote_result_schema

# Everything CALL-E's structured-result engine understands. Anything else is a
# 400, so this list is the contract -- not a style preference.
ALLOWED_KEYWORDS = {
    "type",
    "properties",
    "required",
    "additionalProperties",
    "description",
    "enum",
    "items",
}


def _walk(node, path="$"):
    """Every (path, keyword) pair in the schema."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield path, key
            if key == "properties" and isinstance(value, dict):
                for name, spec in value.items():
                    yield from _walk(spec, f"{path}.properties.{name}")
            elif key == "items":
                yield from _walk(value, f"{path}.items")
    elif isinstance(node, list):
        for index, item in enumerate(node):
            yield from _walk(item, f"{path}[{index}]")


def test_only_keywords_calle_understands_are_used():
    offenders = [
        f"{path}: {keyword}"
        for path, keyword in _walk(quote_result_schema())
        if keyword not in ALLOWED_KEYWORDS
    ]
    assert not offenders, (
        "CALL-E rejects the whole schema -- and never places the call -- on any "
        f"keyword outside {sorted(ALLOWED_KEYWORDS)}: {offenders}"
    )


def test_no_pydantic_shapes_leak_in():
    """The regression this file exists for: a generated schema pasted back in."""
    text = str(quote_result_schema())
    for shape in ("anyOf", "$ref", "$defs", "allOf", "oneOf", "'null'"):
        assert shape not in text, f"{shape} makes CALL-E reject the call"


def test_every_question_maps_to_a_field_we_store():
    """A question nobody can file the answer to is a question not worth asking."""
    known = set(Quote.model_fields) | set(Claim.model_fields)
    unknown = sorted(set(quote_result_schema()["properties"]) - known)
    assert not unknown, f"nothing reads these answers: {unknown}"


def test_unknown_is_always_an_available_answer():
    properties = quote_result_schema()["properties"]
    for field in ("price_quoted", "certification_current", "part_number_confirmed"):
        assert "unknown" in properties[field]["enum"]
    assert "unknown" in properties["stock_status"]["enum"]
    assert "unknown" in properties["currency"]["enum"]


def test_nothing_is_required_so_a_partial_call_still_returns_something():
    """CALL-E returns no structured_result AT ALL when it cannot fill a
    required field, discarding everything it did capture. Confirmed live:
    a call that got price and MOQ but never heard availability came back
    with structured_result: null.

    So an omitted key, not a required one: a lead time nobody stated stays
    absent rather than becoming a 0 that reads as "ships today".
    """
    assert quote_result_schema()["required"] == []


def test_money_survives_the_round_trip_as_decimal():
    """Prices travel as text, so a float never exists to lose precision in."""
    assert quote_result_schema()["properties"]["unit_price"]["type"] == "string"

    quote = normalize_result(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-KBY",
        payload={
            "structured_result": {
                "available": True,
                "qty_offered": 36000,
                "unit_price": "1.85",
                "currency": "EUR",
                "price_breaks": [{"min_qty": 50000, "unit_price": "1.79"}],
                "lead_time_days": 21,
            }
        },
    )
    assert quote.unit_price == Decimal("1.85")
    assert isinstance(quote.unit_price, Decimal)
    assert quote.price_breaks[0].unit_price == Decimal("1.79")
    assert quote.qty_offered == 36000


def test_a_supplier_who_answered_nothing_still_produces_a_quote():
    quote = normalize_result(
        task_id="T-002",
        case_id="CASE-001",
        supplier_ref="SUP-SKF",
        payload={"structured_result": {"available": False, "qty_offered": 0}},
    )
    assert quote.available is False
    assert quote.unit_price is None
    assert quote.lead_time_days is None


def test_schema_forbids_unexpected_fields():
    schema = quote_result_schema()
    assert schema["additionalProperties"] is False


def test_schema_describes_the_fields_the_call_must_collect():
    props = quote_result_schema()["properties"]
    for field in (
        "available",
        "qty_offered",
        "unit_price",
        "price_breaks",
        "currency",
        "moq",
        "lead_time_days",
        "incoterm",
        "certs_claimed",
    ):
        assert field in props, f"{field} missing from the answer sheet"


def test_schema_omits_fields_the_supplier_cannot_know():
    """task_id/case_id are ours, not theirs. Never ask the phone for them."""
    props = quote_result_schema()["properties"]
    for field in ("task_id", "case_id", "supplier_ref", "raw", "confidence"):
        assert field not in props

from supplyos_api.outreach.calle_schema import call_result_schema


def test_schema_forbids_unexpected_fields():
    schema = call_result_schema()
    assert schema["additionalProperties"] is False


def test_schema_describes_the_fields_the_call_must_collect():
    props = call_result_schema()["properties"]
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


def test_nothing_is_required_so_a_partial_call_still_returns_something():
    """CALL-E returns no structured_result AT ALL when it cannot fill a
    required field, discarding everything it did capture. Confirmed live:
    a call that got price and MOQ but never heard availability came back
    with structured_result: null."""
    assert call_result_schema()["required"] == []


def test_schema_omits_fields_the_supplier_cannot_know():
    """task_id/case_id are ours, not theirs. Never ask the phone for them."""
    props = call_result_schema()["properties"]
    for field in ("task_id", "case_id", "supplier_ref", "raw", "confidence"):
        assert field not in props

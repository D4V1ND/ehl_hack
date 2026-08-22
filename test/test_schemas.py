from packages.contracts.schemas import quote_result_schema


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

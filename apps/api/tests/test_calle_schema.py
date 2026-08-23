from supplyos_api.outreach.calle_schema import call_result_schema, call_task_schema


def test_schema_forbids_unexpected_fields():
    schema = call_result_schema()
    assert schema["additionalProperties"] is False


def test_schema_describes_the_fields_the_call_must_collect():
    props = call_result_schema()["properties"]
    for field in (
        "part_available",
        "qty_offered",
        "unit_price",
        "currency",
        "moq",
        "lead_time_days",
        "incoterm",
        "certs_claimed",
        "payment_terms",
    ):
        assert field in props, f"{field} missing from the answer sheet"


def test_schema_stays_flat_so_calle_can_compile_a_plan():
    """Nested objects made CALL-E reject create with a planner error."""
    props = call_result_schema()["properties"]
    for field in ("price_breaks", "expedite_option"):
        assert field not in props
    for spec in props.values():
        assert spec.get("type") != "object"
        if spec.get("type") == "array":
            assert spec["items"].get("type") != "object"


def test_required_fields_include_unknown_so_a_partial_call_still_returns_something():
    schema = call_result_schema()
    assert "part_available" in schema["required"]
    assert "unknown" in schema["properties"]["part_available"]["enum"]


def test_task_schema_avoids_reserved_names():
    props = call_task_schema()["properties"]
    for field in ("summary", "status", "transcript", "call_id"):
        assert field not in props
    assert "sourcing_complete" in props


def test_schema_omits_fields_the_supplier_cannot_know():
    """Task and case identifiers are ours, not the supplier's."""
    props = call_result_schema()["properties"]
    for field in ("task_id", "case_id", "supplier_ref", "raw", "confidence"):
        assert field not in props

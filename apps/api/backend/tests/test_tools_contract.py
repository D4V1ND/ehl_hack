"""The tool endpoints are a contract Devin depends on: schema-valid and fast.

Slice D points a session at these. A 500 or a shape change costs ACUs while the
session sits there working out what happened, so they are checked on every run.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.outreach.calle import build_calle_payload
from packages.contracts.models import (
    Incident,
    OpenPurchaseOrder,
    OutreachBrief,
    OutreachTask,
    Part,
    StockLevel,
    SupplierPriceRecord,
    SupplierRecord,
)
from packages.contracts.schemas import quote_result_schema


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_healthz_reports_test_mode_by_default(client):
    """Live calling is never the default and never a fallback."""
    body = client.get("/healthz").json()
    assert body["ok"] is True
    assert body["call_mode"] == "test"


@pytest.mark.parametrize(
    "path,model",
    [
        ("/tools/part/PRT-6204", Part),
        ("/tools/incident/CASE-001", Incident),
    ],
)
def test_single_object_endpoints_validate(client, path, model):
    model(**client.get(path).json())


@pytest.mark.parametrize(
    "path,model",
    [
        ("/tools/parts", Part),
        ("/tools/stock?part_id=PRT-6204", StockLevel),
        ("/tools/suppliers?part_id=PRT-6204", SupplierRecord),
        ("/tools/price_history?part_id=PRT-6204", SupplierPriceRecord),
        ("/tools/alternates?part_id=PRT-6204", Part),
        ("/tools/open_pos", OpenPurchaseOrder),
    ],
)
def test_list_endpoints_validate(client, path, model):
    rows = client.get(path).json()
    assert isinstance(rows, list) and rows, f"{path} returned nothing to validate"
    for row in rows:
        model(**row)


def test_unknown_ids_are_404_not_500(client):
    assert client.get("/tools/part/PRT-DOES-NOT-EXIST").status_code == 404
    assert client.get("/tools/incident/CASE-999").status_code == 404
    assert client.get("/schema/NotAModel").status_code == 404


def test_supplier_call_order_is_deterministic(client):
    """Who gets called first is a business decision, never a sampling artefact."""
    orders = [
        [s["supplier_id"] for s in client.get("/tools/suppliers?part_id=PRT-6204").json()]
        for _ in range(5)
    ]
    assert len(set(map(tuple, orders))) == 1, "supplier order is not stable across calls"
    assert orders[0] == ["SUP-SKF", "SUP-FAG", "SUP-NSK", "SUP-SHZ", "SUP-MUN"]


def test_claim_validation_schema_is_exportable_for_clients(client):
    """The full Claim schema remains available for validation and generation."""
    schema = client.get("/schema/Claim").json()
    properties = schema["properties"]
    for field in ("stock_status", "price_breaks", "unit_price", "confidence", "certs_claimed"):
        assert field in properties, f"the answer sheet is missing {field}"
    # "unknown" must be a legal answer, not something a caller has to guess around.
    assert "unknown" in str(schema)


def test_calle_answer_sheet_uses_the_accepted_stock_status_vocabulary():
    stock_status = quote_result_schema()["properties"]["stock_status"]
    assert stock_status["enum"] == [
        "free_in_stock",
        "in_stock_allocated",
        "to_be_made",
        "unavailable",
        "unclear",
    ]


def test_calle_payload_sends_the_exact_recipient_result_schema():
    task = OutreachTask(
        task_id="OUT-1",
        case_id="CASE-001",
        supplier_ref="SUP-SKF",
        channel="voice",
        brief=OutreachBrief(
            part_spec="6204-2RS DIN 625",
            qty=32_000,
            needed_by=date(2026, 9, 4),
        ),
    )

    payload = build_calle_payload(
        [task], {"SUP-SKF": "+4930231250142"}, buyer_name="SupplyOS"
    )
    schema = payload["recipient_result_schema"]

    assert schema == quote_result_schema()
    assert schema["type"] == "object"
    assert schema["required"] == []
    assert schema["additionalProperties"] is False
    assert {
        name: definition["type"] for name, definition in schema["properties"].items()
    } == {
        "available": "boolean",
        "qty_offered": "integer",
        "stock_status": "string",
        "earliest_ready_text": "string",
        "price_quoted": "string",
        "unit_price": "string",
        "currency": "string",
        "price_breaks": "array",
        "moq": "integer",
        "lead_time_days": "integer",
        "expedite_option": "object",
        "incoterm": "string",
        "payment_terms": "string",
        "certification_current": "string",
        "certs_claimed": "array",
        "part_number_confirmed": "string",
    }
    assert schema["properties"]["currency"]["enum"] == [
        "EUR",
        "USD",
        "GBP",
        "unknown",
    ]
    for answer in (
        "price_quoted",
        "certification_current",
        "part_number_confirmed",
    ):
        assert schema["properties"][answer]["enum"] == ["yes", "no", "unknown"]
    assert schema["properties"]["price_breaks"]["items"]["required"] == [
        "min_qty",
        "unit_price",
    ]
    assert schema["properties"]["expedite_option"]["required"] == [
        "days",
        "surcharge",
    ]

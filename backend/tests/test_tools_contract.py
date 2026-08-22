"""The tool endpoints are a contract Devin depends on: schema-valid and fast.

Slice D points a session at these. A 500 or a shape change costs ACUs while the
session sits there working out what happened, so they are checked on every run.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from packages.contracts.models import (
    Incident,
    OpenPurchaseOrder,
    Part,
    StockLevel,
    SupplierPriceRecord,
    SupplierRecord,
)


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
    assert orders[0][0] == "SUP-KBY", "the preferred incumbent should be called first"


def test_claim_schema_is_exportable_for_calle(client):
    """`GET /schema/Claim` is what Slice C hands CALL-E as recipient_result_schema."""
    schema = client.get("/schema/Claim").json()
    properties = schema["properties"]
    for field in ("stock_status", "price_breaks", "unit_price", "confidence", "certs_claimed"):
        assert field in properties, f"the answer sheet is missing {field}"
    # "unknown" must be a legal answer, not something a caller has to guess around.
    assert "unknown" in str(schema)

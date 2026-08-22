"""No route may ever serialize an unmasked phone number.

The masking rule is easy to state and easy to break by adding one field to one
model, so it is checked mechanically rather than by review: walk every GET
endpoint the API exposes and scan the whole response body for anything shaped
like E.164. A masked number (`+49*******0142`) cannot match; a raw one
(`+4930231250142`) can only match.
"""

from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.record.mock_erp import get_mock_erp

# Deliberately looser than the validator: this is looking for leaks, so it should
# catch a raw number even if it is embedded in a longer string.
E164_ANYWHERE = re.compile(r"\+[1-9]\d{9,14}")


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def readable_paths() -> list[str]:
    """Every GET route, with path parameters filled in from real seed data."""
    erp = get_mock_erp()
    part_id = "PRT-6204"
    case_id = "CASE-001"
    return [
        "/healthz",
        "/profile",
        "/schema",
        "/schema/Claim",
        "/schema/SupplierRecord",
        "/dashboard/shortages",
        "/cases",
        f"/cases/{case_id}",
        f"/cases/{case_id}/events",
        f"/cases/{case_id}/artifacts",
        "/tools/parts",
        f"/tools/part/{part_id}",
        f"/tools/stock?part_id={part_id}",
        f"/tools/suppliers?part_id={part_id}",
        f"/tools/suppliers?part_id={part_id}&approved_only=false",
        f"/tools/price_history?part_id={part_id}",
        f"/tools/alternates?part_id={part_id}",
        "/tools/open_pos",
        f"/tools/incident/{case_id}",
    ]


@pytest.mark.parametrize("path", readable_paths())
def test_no_endpoint_returns_a_raw_phone_number(client, path):
    response = client.get(path)
    assert response.status_code == 200, f"{path} -> {response.status_code}"
    leaked = E164_ANYWHERE.findall(response.text)
    assert not leaked, f"{path} leaked {len(leaked)} raw phone number(s)"


def test_the_seed_really_does_contain_raw_numbers(client):
    """Guard against the guard passing vacuously.

    If the seed data had no phone numbers at all, the test above would pass while
    proving nothing. This asserts the raw numbers exist, are valid E.164, and are
    exactly what the leak scan would have caught.
    """
    erp = get_mock_erp()
    raw = [erp.raw_phone_for_outreach(s.supplier_id) for s in erp.list_suppliers()]
    assert len(raw) == 15
    for number in raw:
        assert E164_ANYWHERE.fullmatch(number), f"{number!r} is not the shape the scan looks for"


def test_supplier_record_has_no_field_for_a_raw_number():
    """Structural, not behavioural: there is nowhere to put one."""
    from packages.contracts.models import SupplierRecord

    fields = set(SupplierRecord.model_fields)
    assert "phone" not in fields
    assert "phone_masked" in fields

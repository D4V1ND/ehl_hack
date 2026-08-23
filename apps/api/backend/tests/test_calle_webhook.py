"""Where a finished call lands.

Dispatch returns in milliseconds; the answers arrive minutes later at
`POST /calle/webhook`. Until this endpoint existed, the URL we handed CALL-E on
every batch was a 404 -- the call went out and the answer had nowhere to go.

Everything here is offline: the payloads are what the provider posts to us.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.store import STORE

CASE = "CASE-001"


@pytest.fixture
def client():
    STORE.reset()
    yield TestClient(app)
    STORE.reset()


def result(index: int, **fields) -> dict:
    """One recipient's result, shaped the way CALL-E delivers it."""
    return {
        "id": f"call_{index}",
        "recipient_index": index,
        "structured_result": {"available": True, "qty_offered": 36000, **fields},
        "completion_confidence": 0.9,
        "metadata": {
            "case_id": CASE,
            "task_ids": ["OUT-1", "OUT-2"],
            "supplier_refs": ["SUP-KBY", "SUP-SKF"],
        },
    }


def test_an_answer_becomes_a_quote_the_cockpit_can_poll(client):
    assert client.post("/calle/webhook", json=result(0, unit_price="1.85", currency="EUR")).json() == {
        "ok": True,
        "stored": True,
    }

    quotes = client.get("/tools/quotes", params={"case_id": CASE}).json()
    assert len(quotes) == 1
    assert quotes[0]["supplier_ref"] == "SUP-KBY"
    assert Decimal(quotes[0]["unit_price"]) == Decimal("1.85")
    assert quotes[0]["confidence"] == 0.9


def test_which_supplier_answered_comes_from_our_own_metadata(client):
    """Recipients all share one demo number, so position is the only correlation."""
    client.post("/calle/webhook", json=result(1, unit_price="2.10"))

    quotes = client.get("/tools/quotes", params={"case_id": CASE}).json()
    assert [q["supplier_ref"] for q in quotes] == ["SUP-SKF"]
    assert [q["task_id"] for q in quotes] == ["OUT-2"]


def test_a_garbled_result_is_filed_not_rejected(client):
    """A confidence-0 quote is a usable answer; a retry storm is not."""
    payload = result(0)
    payload["structured_result"] = {"qty_offered": "not a number"}
    payload["completion_confidence"] = "?"

    assert client.post("/calle/webhook", json=payload).status_code == 200

    quotes = client.get("/tools/quotes", params={"case_id": CASE}).json()
    assert len(quotes) == 1
    assert quotes[0]["qty_offered"] == 0
    assert quotes[0]["confidence"] == 0.0


def test_an_unreadable_delivery_is_acknowledged_and_dropped(client):
    """Answering 4xx here buys an endless redelivery loop, mid-demo."""
    for body in (b"not json at all", b"[]", b'{"no": "metadata"}'):
        response = client.post(
            "/calle/webhook", content=body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        assert response.json()["stored"] is False

    assert client.get("/tools/quotes", params={"case_id": CASE}).json() == []


def test_a_webhook_cannot_create_a_public_case_or_event_fallback(client):
    """Legacy CALL-E state stays internal until a Case runner persists it."""

    cases_before = client.get("/cases").json()
    response = client.post("/calle/webhook", json=result(0, unit_price="1.85"))
    assert response.json() == {"ok": True, "stored": True}

    missing_events = client.get(f"/cases/{CASE}/events")
    assert missing_events.status_code == 404
    assert client.get("/cases").json() == cases_before

    quotes = client.get("/tools/quotes", params={"case_id": CASE}).json()
    assert [quote["task_id"] for quote in quotes] == ["OUT-1"]

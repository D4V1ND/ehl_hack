import time
from datetime import date

from fastapi.testclient import TestClient

from backend.main import app
from backend.store import STORE

client = TestClient(app)


def _payload(n: int = 3) -> dict:
    return {
        "tasks": [
            {
                "task_id": f"T-{i:03d}",
                "case_id": "CASE-001",
                "supplier_ref": f"SUP-{i:03d}",
                "channel": "voice",
                "brief": {
                    "part_spec": "Deep groove ball bearing 6204-2RS",
                    "qty": 5000,
                    "needed_by": str(date(2026, 9, 3)),
                    "target_price": "1.85",
                    "floor_price": "2.40",
                },
            }
            for i in range(n)
        ]
    }


def setup_function():
    STORE.reset()


def test_dispatch_returns_immediately_with_a_receipt():
    r = client.post("/tools/outreach", json=_payload(3))
    assert r.status_code == 200
    body = r.json()
    assert body["task_ids"] == ["T-000", "T-001", "T-002"]
    assert body["provider"] == "fake"


def test_quotes_are_not_ready_instantly():
    """Async by design. If this ever passes instantly, the seam is wrong."""
    client.post("/tools/outreach", json=_payload(3))
    immediate = client.get("/tools/quotes", params={"case_id": "CASE-001"})
    assert len(immediate.json()["quotes"]) < 3


def test_all_quotes_arrive_eventually():
    client.post("/tools/outreach", json=_payload(3))
    for _ in range(100):
        got = client.get("/tools/quotes", params={"case_id": "CASE-001"}).json()
        if len(got["quotes"]) == 3:
            break
        time.sleep(0.1)
    assert len(got["quotes"]) == 3
    assert {q["task_id"] for q in got["quotes"]} == {"T-000", "T-001", "T-002"}


def test_dispatch_writes_events():
    client.post("/tools/outreach", json=_payload(2))
    events = client.get("/cases/CASE-001/events").json()["events"]
    assert any(e["stage"] == "outreach_dispatched" for e in events)


def test_unknown_case_returns_empty_not_an_error():
    r = client.get("/tools/quotes", params={"case_id": "CASE-NOPE"})
    assert r.status_code == 200
    assert r.json()["quotes"] == []

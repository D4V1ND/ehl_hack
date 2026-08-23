"""The cockpit's "call the suppliers" button, end to end.

Slice B knows the part, the quantity and which suppliers exist; Slice C knows how
to reach them. This covers the seam between the two: briefs built from the system
of record, dispatched through Slice C's provider, answers polled back, and the
whole thing visible in one event feed.

Nothing here touches the network -- the default provider is the rehearsal one.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.deps import case_module, store
from backend.casestore.case_store import CaseStore
from backend.cases.module import CaseModule
from backend.record.mock_erp import MockERP
from backend.store import STORE

CASE = "CASE-001"


@pytest.fixture
def client(monkeypatch, tmp_path):
    """An isolated run against the rehearsal provider.

    The provider delivers on daemon timers into a process-global store, so a test
    that simply resets on the way in still leaves timers running that land inside
    whatever runs next -- including Slice C's own tests. Two things prevent that:
    the fake delays are shortened so deliveries complete inside the test, and the
    store is drained and reset again on the way out.
    """
    from backend.outreach import provider as provider_module

    monkeypatch.setattr(provider_module.settings, "FAKE_MIN_DELAY", 0.01, raising=False)
    monkeypatch.setattr(provider_module.settings, "FAKE_MAX_DELAY", 0.05, raising=False)

    STORE.reset()
    artifact_store = CaseStore(tmp_path / "artifacts")
    module = CaseModule(
        records=MockERP(),
        database_path=tmp_path / "cases.db",
        clock=lambda: datetime(2026, 8, 22, 9, 0, tzinfo=timezone.utc),
        id_generator=lambda: CASE,
    )
    app.dependency_overrides[case_module] = lambda: module
    app.dependency_overrides[store] = lambda: artifact_store
    with TestClient(app) as test_client:
        yield test_client
    time.sleep(0.15)  # let any straggler timer land before we clear
    STORE.reset()
    app.dependency_overrides.pop(case_module)
    app.dependency_overrides.pop(store)


def dispatch(client, refs=("SUP-KBY", "SUP-SKF", "SUP-RUL"), qty=36000):
    return client.post(
        "/tools/outreach", params={"case_id": CASE, "qty": qty}, json=list(refs)
    )


def test_no_call_is_placed_unless_live_is_chosen(client):
    """Live calling is an explicit opt-in, never what you get by not choosing."""
    body = dispatch(client).json()
    assert body["mode"] == "test"
    assert client.get("/healthz").json()["call_mode"] == "test"


def test_briefs_are_built_from_the_system_of_record(client):
    """The cockpit sends supplier ids and a quantity; everything else is looked up."""
    tasks = dispatch(client).json()["tasks"]
    assert len(tasks) == 3
    for task in tasks:
        assert task["brief"]["qty"] == 36000
        assert task["brief"]["needed_by"] == "2026-09-03"
        assert "6204-2RS" in task["brief"]["part_spec"]
        # The must-ask list is what makes the call worth placing.
        assert "price_breaks" in task["brief"]["must_ask"]


def test_channel_is_chosen_by_geography_not_preference(client):
    """CALL-E has no CN region, so a Chinese supplier routes to email."""
    tasks = dispatch(client, refs=["SUP-KBY", "SUP-NPB"]).json()["tasks"]
    channels = {t["supplier_ref"]: t["channel"] for t in tasks}
    assert channels["SUP-KBY"] == "voice"
    assert channels["SUP-NPB"] == "email"


def await_quotes(client, refs: set[str], timeout: float = 12.0) -> list[dict]:
    """Poll until every supplier we briefed has answered.

    Asserts on the refs we dispatched rather than on the size of the store: the
    rehearsal provider delivers on daemon timers, so an earlier test's calls can
    still land here. That is a property of a shared in-memory store, not a fault
    in the flow under test.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        quotes = client.get("/tools/quotes", params={"case_id": CASE}).json()
        mine = [q for q in quotes if q["supplier_ref"] in refs]
        if len(mine) == len(refs):
            return mine
        time.sleep(0.2)
    pytest.fail(f"only {len(mine)} of {len(refs)} answers arrived within {timeout}s")


def test_answers_arrive_asynchronously(client):
    """Dispatch returns a receipt, not results -- the shape a real call has."""
    refs = {"SUP-KBY", "SUP-SKF", "SUP-RUL"}
    body = dispatch(client, refs=sorted(refs)).json()
    assert set(body["tasks"][0]) >= {"task_id", "brief"}

    quotes = await_quotes(client, refs)
    assert {q["supplier_ref"] for q in quotes} == refs


def test_public_event_feed_never_merges_process_local_provider_events(client):
    assert client.post(
        "/cases", json={"part_id": "PRT-6204", "case_id": CASE}
    ).status_code == 201
    committed = client.get(f"/cases/{CASE}/events").json()
    refs = {"SUP-KBY", "SUP-SKF", "SUP-RUL"}
    dispatch(client, refs=sorted(refs))
    await_quotes(client, refs)

    events = client.get(f"/cases/{CASE}/events").json()
    seqs = [e["seq"] for e in events]
    assert seqs == sorted(seqs) == list(range(1, len(events) + 1))
    assert events == committed
    later = client.get(f"/cases/{CASE}/events", params={"since": len(events)}).json()
    assert later == []


def test_no_endpoint_in_the_call_flow_returns_a_raw_phone_number(client):
    """The number is dialled inside the provider and never reaches the browser."""
    import re

    e164 = re.compile(r"\+[1-9]\d{9,14}")
    assert not e164.findall(dispatch(client).text)
    assert not e164.findall(client.get("/tools/quotes", params={"case_id": CASE}).text)
    assert not e164.findall(client.get(f"/cases/{CASE}/events").text)


def test_unknown_supplier_is_a_404_not_a_silent_no_op(client):
    assert dispatch(client, refs=["SUP-NOPE"]).status_code == 404

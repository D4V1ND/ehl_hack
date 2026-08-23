"""Opening a case for any part in the item master.

The demo's claim is "this works for any part we stock, not for one bearing", so
what is asserted here is that the shortage is *derived* from the records — bin,
take rate, the line that consumes it, the incumbent, the purchase order that
slipped — and that the case survives the trip through the case store into the
rest of the procedure. Plus the two things that must never break a demo: an
unknown part is a 404, and a missing Devin key is a stub, not a failure.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.api.deps import settings, store
from backend.api.main import app
from backend.api.settings import get_settings
from backend.casestore.case_store import CaseStore
from backend.launch.devin import session_prompt, start_session
from backend.launch.incident import case_id_for, incident_for_part
from backend.launch.resolve import resolve_incident
from backend.outreach.calle import InvalidPhoneNumber, _load_supplier_phones
from backend.policy.rules import deliverable_qty
from backend.record.mock_erp import get_mock_erp

TODAY = date(2026, 8, 22)
DRAMA_NUMBER = "+4915228817300"  # BNetzA Mitteilung 148/2021 fictional range


@pytest.fixture
def records():
    return get_mock_erp()


@pytest.fixture
def cases(tmp_path) -> CaseStore:
    return CaseStore(tmp_path / "cases")


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Keep the key present-but-empty: get_settings() reloads .env values that
    # are absent, and a launch test must never create a paid Devin session.
    monkeypatch.setenv("DEVIN_API_KEY", "")
    store_ = CaseStore(tmp_path / "cases")
    app.dependency_overrides[store] = lambda: store_
    app.dependency_overrides[settings] = lambda: replace(
        get_settings(), github_token=None, github_repo=None
    )
    with TestClient(app, headers={"origin": "http://localhost:3000"}) as test_client:
        yield test_client, store_
    app.dependency_overrides.pop(store)
    app.dependency_overrides.pop(settings)


def test_the_shortage_is_derived_from_the_records(records):
    incident = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)

    stock = records.get_stock("PRT-6204")[0]
    assert incident.qty_on_hand == stock.available_qty
    assert incident.production_line == "ASSY-3"  # the BOM that consumes it
    assert incident.plant_id == "PLANT-MUC"
    assert incident.incumbent_supplier_id == "SUP-KBY"
    assert incident.qty_required > incident.qty_on_hand
    assert incident.needed_by >= TODAY


def test_a_slipped_purchase_order_becomes_the_reason(records):
    incident = incident_for_part(records=records, part_id="PRT-M8X40", today=TODAY)

    slipped = [po for po in records.get_open_pos("PRT-M8X40") if po.is_delayed]
    assert slipped, "the seed is supposed to have a delayed PO on this part"
    assert slipped[0].po_id in incident.reason
    assert "slipped" in incident.reason


def test_a_part_no_line_consumes_is_still_triggerable(records):
    """Stocked but not on a BOM: a case can still be opened, and the hourly cost
    of standing still falls back to what the part's criticality is worth."""
    unassigned = next(
        part
        for part in records.list_parts()
        if records.get_bom_for_part(part.part_id) is None
    )
    incident = incident_for_part(records=records, part_id=unassigned.part_id, today=TODAY)

    assert incident.production_line == "UNASSIGNED"
    assert incident.line_stop_cost_per_hour > Decimal("0")
    assert incident.plant_id  # taken from the bin it sits in


def test_a_known_line_keeps_the_cost_the_seeded_case_uses(records):
    seeded = records.get_incident("CASE-001")
    derived = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)

    assert derived.line_stop_cost_per_hour == seeded.line_stop_cost_per_hour


def test_the_requested_quantity_and_date_win(records):
    incident = incident_for_part(
        records=records,
        part_id="PRT-6204",
        qty_required=12_000,
        needed_by=date(2026, 10, 1),
        today=TODAY,
    )
    assert incident.qty_required == 12_000
    assert incident.needed_by == date(2026, 10, 1)
    assert incident.line_stop_at.date() == date(2026, 10, 1)


def test_an_unknown_part_cannot_open_a_case(records):
    with pytest.raises(LookupError):
        incident_for_part(records=records, part_id="PRT-NOPE", today=TODAY)


def test_case_ids_say_what_they_are_and_do_not_collide(records):
    part = records.get_part("PRT-6204")
    assert case_id_for(part, set()) == "CASE-6204-2RS"
    assert case_id_for(part, {"CASE-6204-2RS"}) == "CASE-6204-2RS-2"
    assert case_id_for(part, {"CASE-6204-2RS", "CASE-6204-2RS-2"}) == "CASE-6204-2RS-3"


def test_a_derived_case_is_read_back_from_the_case_store(records, cases):
    incident = incident_for_part(records=records, part_id="PRT-62052RS", today=TODAY)
    cases.write_incident(incident)

    assert cases.read_incident(incident.case_id) == incident
    # the rest of the procedure looks a case up through here, not in the ERP
    assert resolve_incident(incident.case_id, records, cases) == incident
    assert records.get_incident(incident.case_id) is None
    # seeded cases still come from the ERP
    assert resolve_incident("CASE-001", records, cases).case_id == "CASE-001"


def test_the_session_prompt_sends_devin_to_the_erp_first(records):
    incident = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)
    part = records.get_part("PRT-6204")

    prompt = session_prompt(incident, part, "https://demo.example.com")

    assert "https://demo.example.com/tools/part/PRT-6204" in prompt
    assert prompt.index("/tools/part/") < prompt.index("/tools/suppliers")
    assert incident.case_id in prompt
    assert "do not place" in prompt.lower() or "not order" in prompt.lower()


def test_every_endpoint_the_prompt_names_exists(records):
    """A prompt that sends the session to a 404 wastes the whole run."""
    incident = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)
    prompt = session_prompt(incident, records.get_part("PRT-6204"), "http://api")

    known = set(app.openapi()["paths"])
    named = {
        token.split("?")[0].removeprefix("http://api")
        for token in prompt.replace(",", " ").split()
        if token.startswith(("/tools/", "http://api/tools/"))
    }
    assert named, "the prompt is supposed to name endpoints"
    for path in named:
        templated = path.replace(incident.part_id, "{part_id}")
        assert templated in known, f"{path} is not a route"


def test_agent_openapi_does_not_expose_recursive_case_launch():
    """A sourcing agent must not discover the human-only session launcher."""
    case_operations = app.openapi()["paths"]["/cases"]

    assert "get" in case_operations
    assert "post" not in case_operations


def test_agent_cannot_call_the_human_case_launcher(client):
    test_client, store_ = client

    response = test_client.post(
        "/cases",
        json={"part_id": "PRT-62052RS"},
        headers={"origin": ""},
    )

    assert response.status_code == 403
    assert store_.list_case_ids() == []


def test_the_prompt_keeps_the_session_inside_the_case(records):
    """A sourcing session that starts editing code or opening PRs is a loose agent."""
    incident = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)
    prompt = session_prompt(incident, records.get_part("PRT-6204"), "http://api").lower()

    assert "not a coding task" in prompt
    assert "never call post http://api/cases" in prompt
    assert "launches another devin" in prompt
    assert "pull request" in prompt  # named, so it can be forbidden
    assert "do not dial anyone yourself" in prompt
    assert "unknown" in prompt
    # It has to keep the checklist current, per supplier -- that is the cockpit.
    assert "/tools/events" in prompt
    assert "/tools/plan/step" in prompt
    assert "erp:part" in prompt and "review:package" in prompt
    assert "outreach:<supplier_ref>" in prompt  # dynamic per-supplier lines
    assert "status=active" in prompt and "status=done" in prompt


def test_the_session_starts_with_no_secrets_and_a_cap(records, monkeypatch):
    """Least privilege: a case needs no credential and no knowledge base."""
    sent: dict[str, object] = {}

    class _Response:
        status_code = 200

        @staticmethod
        def json() -> dict[str, str]:
            return {"session_id": "devin-1", "url": "https://app.devin.ai/sessions/devin-1"}

    def _post(url, headers=None, json=None, timeout=None):  # noqa: A002 - httpx's name
        sent.update(json or {})
        return _Response()

    monkeypatch.setenv("DEVIN_API_KEY", "apk_test")
    monkeypatch.setenv("DEVIN_MAX_ACU", "7")
    monkeypatch.setattr("backend.launch.devin.httpx.post", _post)
    incident = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)

    session = start_session(incident, records.get_part("PRT-6204"), "http://api")

    assert session.stubbed is False
    assert sent["secret_ids"] == []
    assert sent["knowledge_ids"] == []
    assert sent["max_acu_limit"] == 7


def test_one_demo_number_takes_every_supplier_call(monkeypatch):
    """So a live call on stage reaches the room, not a real supplier."""
    monkeypatch.setenv("DEMO_CALL_DESTINATION", DRAMA_NUMBER)
    phones = _load_supplier_phones(["SUP-KBY", "SUP-RUL", "SUP-ATLAS"])

    assert set(phones) == {"SUP-KBY", "SUP-RUL", "SUP-ATLAS"}
    assert len(set(phones.values())) == 1

    monkeypatch.setenv("DEMO_CALL_DESTINATION", "0151 22 888 173")
    with pytest.raises(InvalidPhoneNumber):  # refused before anything can dial
        _load_supplier_phones(["SUP-KBY"])


def test_no_devin_key_is_a_stub_not_a_failure(records, monkeypatch):
    monkeypatch.delenv("DEVIN_API_KEY", raising=False)
    incident = incident_for_part(records=records, part_id="PRT-6204", today=TODAY)

    session = start_session(incident, records.get_part("PRT-6204"), "http://localhost:8010")

    assert session.stubbed is True
    assert session.session_id and session.session_url


def test_the_inventory_lists_every_part_worst_cover_first(client):
    test_client, _ = client
    rows = test_client.get("/inventory").json()

    assert len(rows) == len(get_mock_erp().list_parts())
    covers = [r["days_of_cover"] for r in rows if r["days_of_cover"] is not None]
    assert covers == sorted(covers)
    m8 = next(r for r in rows if r["part_id"] == "PRT-M8X40")
    assert m8["below_reorder"] is True
    assert m8["delayed_po"] == "PO-2311"
    assert m8["open_case_id"] == "CASE-002"  # already has a seeded case
    assert m8["suppliers"] >= 1


def test_the_browser_can_open_a_case_and_get_a_session(client):
    test_client, store_ = client
    response = test_client.post("/cases", json={"part_id": "PRT-62052RS"})

    assert response.status_code == 201
    body = response.json()
    assert body["stubbed"] is True  # no key in the test environment
    assert body["session_url"]

    case_id = body["case_id"]
    assert store_.read_incident(case_id) is not None
    stages = [e["stage"] for e in test_client.get(f"/cases/{case_id}/events").json()]
    assert stages == ["detected", "researching"]

    # and the case page can render it, same as a seeded one
    snapshot = test_client.get(f"/cases/{case_id}")
    assert snapshot.status_code == 200
    assert snapshot.json()["incident"]["part_id"] == "PRT-62052RS"


def test_opening_the_same_part_twice_does_not_overwrite_the_first_case(client):
    test_client, _ = client
    first = test_client.post("/cases", json={"part_id": "PRT-62052RS"}).json()["case_id"]
    second = test_client.post("/cases", json={"part_id": "PRT-62052RS"}).json()["case_id"]

    assert first != second


def test_opening_a_case_for_an_unknown_part_is_a_404(client):
    test_client, _ = client
    assert test_client.post("/cases", json={"part_id": "PRT-NOPE"}).status_code == 404


def test_a_derived_case_runs_the_whole_procedure(client):
    """The point of the trigger: whatever it opens can be worked end to end."""
    test_client, _ = client
    case_id = test_client.post("/cases", json={"part_id": "PRT-63052RS"}).json()["case_id"]

    run = test_client.post("/flow/run", params={"case_id": case_id})
    assert run.status_code == 200, run.text
    body = run.json()
    assert body["claims"], "a derived case must still get answers"
    # ranked plans, not one opaque answer: the buyer picks
    assert len(body["decision"]["options"]) > 1
    assert [e["stage"] for e in test_client.get(f"/cases/{case_id}/events").json()][-1] == (
        "decided"
    )


def test_the_tools_the_session_calls_by_hand_work_too(client):
    """The session drives /tools/* one endpoint at a time, not only /flow/run:
    a NameError in one of them cost a whole live run."""
    test_client, _ = client
    case_id = test_client.post("/cases", json={"part_id": "PRT-62052RS"}).json()["case_id"]

    screened = test_client.post("/tools/screen", params={"case_id": case_id})
    assert screened.status_code == 200, screened.text
    compliant = [c["supplier_ref"] for c in screened.json() if c["compliance"]["passed"]]
    assert compliant

    tasks = test_client.post(
        "/tools/outreach",
        params={"case_id": case_id, "qty": 24000},
        json=compliant,
    )
    assert tasks.status_code == 200, tasks.text
    assert len(tasks.json()) == len(compliant)


def test_the_ui_on_the_fallback_dev_port_is_allowed_by_default():
    """`npm run dev` silently moves to :3001 when :3000 is taken, and the browser
    trigger dies on CORS if only :3000 is trusted."""
    from backend.api.settings import cors_origins_from_env

    assert "http://localhost:3001" in cors_origins_from_env(None)
    assert cors_origins_from_env("") == cors_origins_from_env(None)


def test_allowed_origins_stay_an_allowlist():
    from backend.api.settings import cors_origins_from_env

    origins = cors_origins_from_env("https://demo.example , http://localhost:3001")
    assert "https://demo.example" in origins
    assert "http://localhost:3000" in origins
    assert "*" not in origins


def test_a_filed_claim_keeps_the_supplier_in_the_plans():
    """`available` was never read from the call result, so every claim filed
    through POST /tools/claims zeroed its supplier out of every strategy."""
    from packages.contracts.safe import claim_from_result

    claim = claim_from_result(
        {"stock_status": "free_in_stock", "qty_offered": 6300, "unit_price": "3.50"},
        task_id="OUT-1",
        case_id="CASE-6204-2RS",
        supplier_ref="SUP-KBY",
    )
    assert claim.available
    supplier = get_mock_erp().get_supplier("SUP-KBY")
    assert supplier is not None
    assert deliverable_qty(supplier, claim) == 6300


def test_an_explicit_no_still_wins_over_the_offered_quantity():
    from packages.contracts.safe import claim_from_result

    claim = claim_from_result(
        {"available": False, "stock_status": "free_in_stock", "qty_offered": 6300},
        task_id="OUT-1",
        case_id="CASE-6204-2RS",
        supplier_ref="SUP-KBY",
    )
    assert not claim.available


def test_a_silent_result_is_still_unavailable():
    from packages.contracts.safe import claim_from_result

    claim = claim_from_result(None, task_id="OUT-1", case_id="C", supplier_ref="SUP-KBY")
    assert not claim.available
    assert claim.confidence == 0.0

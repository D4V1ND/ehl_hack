"""The installed API CLI maps commands to the canonical FastAPI service.

These tests replace the HTTP helpers, so they prove command routing and safety
defaults without opening a socket or placing a call.
"""

from __future__ import annotations

import json

import httpx
import pytest

from supplyos_api import cli


@pytest.mark.parametrize(
    ("argv", "method", "path", "params", "timeout"),
    [
        (
            ["run", "--case", "CASE-001", "--hold-for", "SUP-KBY"],
            "post",
            "/flow/run",
            {"case_id": "CASE-001", "hold_for": "SUP-KBY"},
            300.0,
        ),
        (
            ["call", "--case", "CASE-001", "--supplier", "SUP-KBY"],
            "post",
            "/flow/call",
            {"case_id": "CASE-001", "supplier_ref": "SUP-KBY", "live": False},
            60.0,
        ),
        (
            ["collect", "--case", "CASE-001"],
            "post",
            "/flow/collect",
            {"case_id": "CASE-001"},
            120.0,
        ),
        (
            ["state", "--case", "CASE-001"],
            "get",
            "/flow/state",
            {"case_id": "CASE-001"},
            30.0,
        ),
        (
            ["publish", "--case", "CASE-001"],
            "post",
            "/tools/publish_pr",
            {"case_id": "CASE-001"},
            120.0,
        ),
    ],
)
def test_command_routes_to_the_api_without_network(
    monkeypatch, capsys, argv, method, path, params, timeout
):
    calls: list[tuple[str, str, dict[str, object], float]] = []

    def fake_post(api, route, query, request_timeout):
        calls.append(("post", route, query, request_timeout))
        return {"ok": True, "api": api}

    def fake_get(api, route, query, request_timeout):
        calls.append(("get", route, query, request_timeout))
        return {"ok": True, "api": api}

    monkeypatch.setattr(cli, "_post", fake_post)
    monkeypatch.setattr(cli, "_get", fake_get)

    assert cli.main(argv) == 0
    assert calls == [(method, path, params, timeout)]
    assert json.loads(capsys.readouterr().out) == {
        "ok": True,
        "api": "http://localhost:8010",
    }


def test_live_call_is_opt_in(monkeypatch):
    seen: dict[str, object] = {}

    def fake_post(_api, _path, params, _timeout):
        seen.update(params)
        return {"ok": True}

    monkeypatch.setattr(cli, "_post", fake_post)

    assert cli.main(
        ["call", "--case", "CASE-001", "--supplier", "SUP-KBY", "--live"]
    ) == 0
    assert seen["live"] is True


def test_call_requires_a_supplier():
    with pytest.raises(SystemExit) as error:
        cli.main(["call", "--case", "CASE-001"])

    assert error.value.code == 2


def test_http_failure_is_reported_without_a_traceback(monkeypatch, capsys):
    request = httpx.Request("POST", "http://localhost:8010/flow/run")
    response = httpx.Response(409, request=request, text="live calling is off")

    def fail(*_args, **_kwargs):
        raise httpx.HTTPStatusError("rejected", request=request, response=response)

    monkeypatch.setattr(cli, "_post", fail)

    assert cli.main(["run", "--case", "CASE-001"]) == 1
    assert "409 live calling is off" in capsys.readouterr().err

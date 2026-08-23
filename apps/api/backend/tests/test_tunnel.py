"""The public front door, tested without opening one.

`start()` is a subprocess and a network handshake, so what is testable offline is
the part that actually goes wrong: reading the hostname Cloudflare assigns out of
a log that also contains banners, retries and ASCII art, and failing loudly
rather than silently handing back an address nothing can reach.
"""

from __future__ import annotations

import subprocess

import pytest

from backend import settings, tunnel

REAL_LOG = """\
2026-08-22T22:10:41Z INF Thank you for trying Cloudflare Tunnel.
2026-08-22T22:10:44Z INF +------------------------------------------------+
2026-08-22T22:10:44Z INF |  Your quick Tunnel has been created! Visit it:  |
2026-08-22T22:10:44Z INF |  https://authentication-christopher-donated.trycloudflare.com  |
2026-08-22T22:10:44Z INF +------------------------------------------------+
2026-08-22T22:10:45Z INF Registered tunnel connection connIndex=0
"""


class _Alive:
    def poll(self):
        return None


def test_the_assigned_hostname_is_read_out_of_the_banner(tmp_path):
    log = tmp_path / "tunnel.log"
    log.write_text(REAL_LOG)
    assert (
        tunnel._await_url(_Alive(), log)
        == "https://authentication-christopher-donated.trycloudflare.com"
    )


def test_a_tunnel_that_died_is_not_waited_out(tmp_path):
    """No point burning the timeout on a process that has already exited."""
    log = tmp_path / "tunnel.log"
    log.write_text("2026-08-22T22:10:41Z ERR failed to connect\n")

    class Dead:
        def poll(self):
            return 1

    assert tunnel._await_url(Dead(), log) is None


def test_a_missing_url_is_a_refusal_not_a_bad_address(tmp_path, monkeypatch):
    """Returning localhost here would send CALL-E an address it cannot reach."""
    monkeypatch.setattr(tunnel, "ensure_binary", lambda: "/bin/true")
    monkeypatch.setattr(tunnel, "_await_url", lambda process, log: None)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **k: _Alive())
    monkeypatch.setattr(_Alive, "terminate", lambda self: None, raising=False)

    with pytest.raises(tunnel.TunnelUnavailable):
        tunnel.start(8010, log_path=tmp_path / "tunnel.log")


def test_the_webhook_address_is_read_when_the_call_is_placed(monkeypatch):
    """A tunnel opened after import must still be the one we hand the provider."""
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    monkeypatch.setenv("API_PORT", "8010")
    assert settings.public_base_url() == "http://localhost:8010"

    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.trycloudflare.com")
    assert settings.public_base_url() == "https://example.trycloudflare.com"

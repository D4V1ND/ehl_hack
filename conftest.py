"""Two safety rails that apply to the whole suite, before any test is collected.

`.env` is a *runtime* file: on a machine set up for the live demo it holds
`FAKE_CALLS=0` and a real `DEMO_CALL_NUMBER`, and `backend/settings.py` reads it
at import. Without this file, `pytest` on that machine dispatches the cockpit
tests through the real CALL-E provider and rings somebody's phone — several
times, out of a pool of twenty calls, for a test that only ever asserted it was
in rehearsal.

So:

1. **Rehearsal is pinned on** for the whole session, whatever `.env` says. The
   environment variable is set here, before `backend.settings` is first
   imported, so the module constant is already correct by the time anything
   reads it.
2. **The network is unplugged** for every test that is not explicitly marked
   `live`. Belt and braces: if a future code path finds another way to the
   carrier, it fails with a sentence naming the rule rather than with a phone
   call. `TestClient` is untouched — it speaks ASGI in-process and never goes
   through an HTTP transport.
"""

from __future__ import annotations

import os

# Before any `import backend...` below or in a test module.
os.environ["FAKE_CALLS"] = "1"

import httpx  # noqa: E402
import pytest  # noqa: E402

from backend import settings  # noqa: E402

settings.FAKE_CALLS = True

_REFUSED = (
    "a test tried to reach the network. Tests run in rehearsal and never dial: "
    "mark it `live` if it is genuinely meant to place a real call."
)


@pytest.fixture(autouse=True)
def _no_network(request, monkeypatch):
    if request.node.get_closest_marker("live"):
        return

    def refuse(*args, **kwargs):
        raise RuntimeError(_REFUSED)

    for name in ("request", "stream", "get", "post", "put", "patch", "delete", "head", "options"):
        monkeypatch.setattr(httpx, name, refuse, raising=False)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", refuse)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", refuse)

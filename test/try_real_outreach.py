"""Manual smoke script for the REAL CALL-E outreach flow.

Not a pytest test — a script you run by hand against a locally running
server to place one real, billed phone call and watch the typed Quote
come back.

No tunnel required. The result is pulled with GET /v1/calls/{id} (an
outbound request), not pushed to a webhook, so ngrok / PUBLIC_BASE_URL
play no part in this flow.

Requires, in .env:
    FAKE_CALLS=0
    CALLE_API_KEY=<your key>

And a real phone number mapped in backend/fixtures/supplier_phones.json
under the SUPPLIER_REF used below.

Start the server first:
    python -m uvicorn backend.main:app --port 8000

Then run this:
    python test/try_real_outreach.py
"""

from __future__ import annotations

import json
import sys
import time
import uuid

import httpx

BASE_URL = "http://localhost:8000"
SUPPLIER_REF = "SUP-ATLAS"
POLL_INTERVAL = 5.0
TIMEOUT_SECONDS = 900  # a real call sits queued, then runs for a few minutes

# The fields the supplier actually answers for. Everything else on a Quote
# (task_id, confidence, raw, ...) is ours, not theirs.
_QUOTE_FIELDS = (
    "available",
    "qty_offered",
    "unit_price",
    "price_breaks",
    "currency",
    "moq",
    "lead_time_days",
    "expedite_option",
    "incoterm",
    "certs_claimed",
    "payment_terms",
)


def build_task(case_id: str) -> dict:
    return {
        "task_id": f"{case_id}-task-1",
        "case_id": case_id,
        "supplier_ref": SUPPLIER_REF,
        "channel": "voice",
        "brief": {
            "part_spec": "6203-2RS deep groove ball bearing",
            "qty": 100,
            "needed_by": "2026-09-15",
            "target_price": "3.20",
            "floor_price": "2.50",
        },
    }


def print_quote(quote: dict) -> None:
    print("\n" + "=" * 60)
    print("QUOTE")
    print("=" * 60)
    for field in _QUOTE_FIELDS:
        print(f"  {field:<16} {quote.get(field)}")
    print(f"  {'confidence':<16} {quote.get('confidence')}")
    if quote.get("notes"):
        print(f"\n  notes: {quote['notes']}")


def print_transcript(quote: dict) -> None:
    """The transcript is the evidence behind every field above."""
    raw = quote.get("raw") or {}
    recipients = raw.get("recipients") or []
    attempts = (recipients[0].get("attempts") if recipients else []) or []
    turns = (attempts[0].get("transcript_turns") if attempts else []) or []
    if not turns:
        return

    print("\n" + "=" * 60)
    print("TRANSCRIPT")
    print("=" * 60)
    for turn in turns:
        who = turn.get("speaker", "?")
        print(f"  [{turn.get('offset_seconds', 0):>3}s] {who:<5} {turn.get('text', '')}")


def report_where_saved(client: httpx.Client, case_id: str) -> None:
    """The server writes each quote to disk; surface where it landed."""
    try:
        events = client.get(f"/cases/{case_id}/events").json()["events"]
    except (httpx.HTTPError, KeyError, ValueError):
        return
    for event in events:
        saved_to = (event.get("payload") or {}).get("saved_to")
        if saved_to:
            print(f"\nsaved to: {saved_to}")
            return
    print("\nsaved to: (no path recorded — check the server log)")


def main() -> None:
    case_id = f"case-real-{uuid.uuid4().hex[:8]}"
    task = build_task(case_id)

    # POST /tools/outreach blocks while CALL-E accepts the call, which is
    # well over the httpx default.
    with httpx.Client(base_url=BASE_URL, timeout=90.0) as client:
        health = client.get("/health").json()
        print(f"health: {health}")
        if health.get("fake_calls"):
            print("FAKE_CALLS is on — this would not place a real call. Aborting.")
            sys.exit(1)

        print(f"\nLIVE CALL ABOUT TO BE PLACED to supplier '{SUPPLIER_REF}'.")
        print("dispatching outreach task...")
        receipt = client.post("/tools/outreach", json={"tasks": [task]}).json()
        print(f"receipt: {receipt}")
        print(f"\nwaiting for the call to finish (up to {TIMEOUT_SECONDS}s)...")

        deadline = time.monotonic() + TIMEOUT_SECONDS
        waited = 0
        while True:
            if time.monotonic() > deadline:
                print(f"\nTIMEOUT after {TIMEOUT_SECONDS}s waiting for a quote.")
                sys.exit(1)

            quotes = client.get(
                "/tools/quotes", params={"case_id": case_id}
            ).json()["quotes"]
            if quotes:
                quote = quotes[0]
                print_quote(quote)
                print_transcript(quote)
                report_where_saved(client, case_id)
                return

            time.sleep(POLL_INTERVAL)
            waited += POLL_INTERVAL
            print(f"  ...{int(waited)}s", end="\r", flush=True)


if __name__ == "__main__":
    main()

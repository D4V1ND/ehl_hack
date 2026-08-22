"""Place ONE real CALL-E call and print what came back.

Not a pytest test — a script you run by hand. It costs money and rings a
real phone.

    1. python -m uvicorn backend.main:app --port 8000     (in another terminal)
    2. python test/try_real_outreach.py

Needs FAKE_CALLS=0 and CALLE_API_KEY in .env, and the supplier below
mapped to a number in backend/fixtures/supplier_phones.json.

No tunnel needed: the result is fetched with GET /v1/calls/{id}, not
pushed to a webhook, so ngrok and PUBLIC_BASE_URL play no part here.

Edit REQUEST to change what gets asked on the call.
"""

from __future__ import annotations

import json
import sys
import time
import uuid

import httpx

BASE_URL = "http://localhost:8000"

# The request body sent to POST /tools/outreach. Edit freely.
# case_id and task_id get a unique suffix at runtime (see freshen_ids) so
# each run is its own case — without that, a re-run would find the previous
# run's quote already in the store and print it without ever calling.
REQUEST = {
    "tasks": [
        {
            "task_id": "task-1",
            "case_id": "case",
            "supplier_ref": "SUP-ATLAS",
            "channel": "voice",
            "brief": {
                "part_spec": "6203-2RS deep groove ball bearing",
                "qty": 100,
                "needed_by": "2026-09-15",
                "target_price": "3.20",
                "floor_price": "2.50",
            },
        }
    ]
}

POLL_INTERVAL = 5.0
TIMEOUT_SECONDS = 900  # a call sits queued, then runs for a few minutes

# What the supplier actually answers for. The rest of a Quote (task_id,
# raw, confidence, ...) is ours, not theirs.
QUOTE_FIELDS = (
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


def freshen_ids(request: dict) -> str:
    """Give this run its own case_id/task_id. Returns the case_id."""
    run = uuid.uuid4().hex[:8]
    case_id = f"{request['tasks'][0]['case_id']}-{run}"
    for index, task in enumerate(request["tasks"], start=1):
        task["case_id"] = case_id
        task["task_id"] = f"{case_id}-task-{index}"
    return case_id


def print_quote(quote: dict) -> None:
    print("\n" + "=" * 64)
    print("QUOTE")
    print("=" * 64)
    for field in QUOTE_FIELDS:
        print(f"  {field:<16} {quote.get(field)}")
    print(f"  {'confidence':<16} {quote.get('confidence')}")

    if quote.get("summary"):
        print("\n  summary:")
        print(f"    {quote['summary']}")


def print_transcript(quote: dict) -> None:
    """The evidence behind every field above."""
    turns = quote.get("transcript") or []
    if not turns:
        print("\n(no transcript returned)")
        return

    print("\n" + "=" * 64)
    print(f"TRANSCRIPT ({len(turns)} turns)")
    print("=" * 64)
    for turn in turns:
        print(
            f"  [{turn.get('offset_seconds', 0):>3}s] "
            f"{turn.get('speaker', '?'):<5} {turn.get('text', '')}"
        )


def print_saved_path(client: httpx.Client, case_id: str) -> None:
    """The server writes each quote to disk; say where it landed."""
    try:
        events = client.get(f"/cases/{case_id}/events").json()["events"]
    except (httpx.HTTPError, KeyError, ValueError):
        return
    for event in events:
        saved_to = (event.get("payload") or {}).get("saved_to")
        if saved_to:
            print(f"\nsaved to: {saved_to}")
            return
    print("\nsaved to: (nothing recorded — check the server log)")


def main() -> None:
    case_id = freshen_ids(REQUEST)

    # POST /tools/outreach blocks while CALL-E accepts the call, which is
    # well past the httpx default timeout.
    with httpx.Client(base_url=BASE_URL, timeout=90.0) as client:
        try:
            health = client.get("/health").json()
        except httpx.HTTPError:
            sys.exit(f"No server at {BASE_URL} — start uvicorn first.")

        print(f"health: {health}")
        if health.get("fake_calls"):
            sys.exit("FAKE_CALLS is on — this would not place a real call.")

        print(f"\ncase: {case_id}")
        print("request:")
        print(json.dumps(REQUEST, indent=2))

        print("\nplacing a REAL call...")
        receipt = client.post("/tools/outreach", json=REQUEST).json()
        print(f"receipt: {receipt}")

        print(f"\nwaiting for the call to finish (up to {TIMEOUT_SECONDS}s)...")
        deadline = time.monotonic() + TIMEOUT_SECONDS
        waited = 0

        while True:
            quotes = client.get(
                "/tools/quotes", params={"case_id": case_id}
            ).json()["quotes"]

            if quotes:
                print()  # end the progress line
                for quote in quotes:
                    print_quote(quote)
                    print_transcript(quote)
                print_saved_path(client, case_id)
                return

            if time.monotonic() > deadline:
                print(f"\n\nTIMED OUT after {TIMEOUT_SECONDS}s with no quote.")
                print(f"Check: curl {BASE_URL}/cases/{case_id}/events")
                sys.exit(1)

            time.sleep(POLL_INTERVAL)
            waited += POLL_INTERVAL
            print(f"  ...{int(waited)}s", end="\r", flush=True)


if __name__ == "__main__":
    main()

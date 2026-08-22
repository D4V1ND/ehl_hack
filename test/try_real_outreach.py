"""Manual smoke script for the REAL CALL-E outreach flow.

Not a pytest test — a script you run by hand against a locally running
server to place one real, billed phone call and watch the result land via
the /calle/webhook callback.

Requires, in .env:
    FAKE_CALLS=0
    CALLE_API_KEY=<your key>
    PUBLIC_BASE_URL=<a public https URL that tunnels to this machine, e.g. ngrok>

And a real phone number mapped in backend/fixtures/supplier_phones.json
under the SUPPLIER_REF used below.

Start the server first (after PUBLIC_BASE_URL is set, so it's picked up):
    python -m uvicorn backend.main:app --reload --port 8000

Then run this:
    python test/try_real_outreach.py
"""

from __future__ import annotations

import sys
import time
import uuid

import httpx

BASE_URL = "http://localhost:8000"
SUPPLIER_REF = "SUP-ATLAS"
POLL_INTERVAL = 1.0
TIMEOUT_SECONDS = 900  # a real call sits queued, then runs for a few minutes


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


def main() -> None:
    case_id = f"case-real-{uuid.uuid4().hex[:8]}"
    task = build_task(case_id)

    # Generous: POST /tools/outreach blocks while CALL-E accepts the call,
    # which is well over the httpx 5s/10s defaults.
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

        deadline = time.monotonic() + TIMEOUT_SECONDS
        while True:
            if time.monotonic() > deadline:
                print(f"\nTIMEOUT after {TIMEOUT_SECONDS}s waiting for a quote.")
                sys.exit(1)

            resp = client.get("/tools/quotes", params={"case_id": case_id})
            quotes = resp.json()["quotes"]
            if quotes:
                print("\nquote received:")
                for key, value in quotes[0].items():
                    print(f"  {key}: {value}")
                return

            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

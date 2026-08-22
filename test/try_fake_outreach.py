"""Manual smoke script for the fake outreach flow.

Not a pytest test — a script you run by hand against a locally running
server to watch the fake CALL-E flow end to end: dispatch outreach, poll
GET /tools/quotes until every task has resolved, print the Quotes.

Start the server first:
    python -m uvicorn backend.main:app --reload --port 8000

Then run this:
    python test/try_fake_outreach.py
"""

from __future__ import annotations

import sys
import time
import uuid

import httpx

BASE_URL = "http://localhost:8000"
POLL_INTERVAL = 0.5
TIMEOUT_SECONDS = 30


def build_tasks(case_id: str) -> list[dict]:
    return [
        {
            "task_id": f"{case_id}-task-1",
            "case_id": case_id,
            "supplier_ref": "supplier-acme",
            "channel": "voice",
            "brief": {
                "part_spec": "6203-2RS deep groove ball bearing",
                "qty": 5000,
                "needed_by": "2026-09-15",
                "target_price": "3.20",
                "floor_price": "2.50",
            },
        },
        {
            "task_id": f"{case_id}-task-2",
            "case_id": case_id,
            "supplier_ref": "supplier-globex",
            "channel": "voice",
            "brief": {
                "part_spec": "6203-2RS deep groove ball bearing",
                "qty": 5000,
                "needed_by": "2026-09-15",
                "target_price": "3.20",
                "floor_price": "2.50",
            },
        },
    ]


def main() -> None:
    case_id = f"case-{uuid.uuid4().hex[:8]}"
    tasks = build_tasks(case_id)

    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        health = client.get("/health").json()
        print(f"health: {health}")

        print(f"dispatching {len(tasks)} task(s) for case {case_id}...")
        receipt = client.post("/tools/outreach", json={"tasks": tasks}).json()
        print(f"receipt: {receipt}")

        expected_task_ids = set(receipt["task_ids"])
        seen_task_ids: set[str] = set()
        deadline = time.monotonic() + TIMEOUT_SECONDS

        while seen_task_ids != expected_task_ids:
            if time.monotonic() > deadline:
                print(
                    f"\nTIMEOUT after {TIMEOUT_SECONDS}s — "
                    f"missing: {expected_task_ids - seen_task_ids}"
                )
                sys.exit(1)

            resp = client.get("/tools/quotes", params={"case_id": case_id})
            quotes = resp.json()["quotes"]

            for quote in quotes:
                if quote["task_id"] not in seen_task_ids:
                    seen_task_ids.add(quote["task_id"])
                    print(f"\nquote received for {quote['task_id']}:")
                    for key, value in quote.items():
                        print(f"  {key}: {value}")

            if seen_task_ids != expected_task_ids:
                time.sleep(POLL_INTERVAL)

        print(f"\nall {len(expected_task_ids)} quote(s) received.")


if __name__ == "__main__":
    main()

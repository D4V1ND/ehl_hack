"""Place ONE real CALL-E call through our own provider and print the result.

Not a pytest test — a script you run by hand. It costs money and rings a
real phone.

    python test/try_real_outreach.py

No server needed. This drives backend/outreach/calle.py directly, so it
exercises the whole SDK path in one process:

    build_calle_payload  ->  client.calls.create        (calle SDK)
                         ->  client.calls.wait_for_result
                         ->  normalize_result           (-> Quote)
                         ->  save_quote                 (-> disk)

Needs FAKE_CALLS=0 and CALLE_API_KEY in .env, and the supplier below
mapped to a number in backend/fixtures/supplier_phones.json.

Edit TASK to change what gets asked on the call.
"""

from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

# Run as a plain script, `backend` is not importable: only the test/
# directory lands on sys.path, not the repo root. pytest adds the root for
# its own runs, so this only bites here.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend import settings  # noqa: E402
from backend.outreach.calle import CalleOutreachProvider  # noqa: E402
from backend.store import STORE  # noqa: E402
from packages.contracts.models import OutreachTask  # noqa: E402

# What to ask, and who to ask. Edit freely.
# task_id/case_id are filled in per run, so each run is its own case.
TASK = {
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


def build_task() -> OutreachTask:
    run = uuid.uuid4().hex[:8]
    case_id = f"case-{run}"
    return OutreachTask(
        task_id=f"{case_id}-task-1",
        case_id=case_id,
        **TASK,
    )


def print_quote(quote) -> None:
    print("\n" + "=" * 64)
    print("QUOTE")
    print("=" * 64)
    data = quote.model_dump(mode="json")
    for field in QUOTE_FIELDS:
        print(f"  {field:<16} {data.get(field)}")
    print(f"  {'confidence':<16} {data.get('confidence')}")

    if quote.summary:
        print("\n  summary:")
        print(f"    {quote.summary}")


def print_transcript(quote) -> None:
    """The evidence behind every field above."""
    if not quote.transcript:
        print("\n(no transcript returned)")
        return

    print("\n" + "=" * 64)
    print(f"TRANSCRIPT ({len(quote.transcript)} turns)")
    print("=" * 64)
    for turn in quote.transcript:
        print(f"  [{turn.offset_seconds:>3}s] {turn.speaker:<5} {turn.text}")


def print_events(case_id: str) -> None:
    print("\n" + "=" * 64)
    print("EVENTS")
    print("=" * 64)
    for event in STORE.events_for(case_id):
        print(f"  {event['ts']}  {event['stage']:<22} {event['message']}")
        saved_to = (event.get("payload") or {}).get("saved_to")
        if saved_to:
            print(f"\nsaved to: {saved_to}")


def main() -> None:
    if settings.FAKE_CALLS:
        sys.exit("FAKE_CALLS is on — set FAKE_CALLS=0 in .env to place a real call.")
    if not settings.CALLE_API_KEY:
        sys.exit("CALLE_API_KEY is not set in .env.")

    task = build_task()
    print(f"case:   {task.case_id}")
    print(f"locale: {settings.CALLE_LOCALE}  region: {settings.CALLE_REGION}")
    print("task:")
    print(json.dumps(task.model_dump(mode="json"), indent=2))

    print("\nplacing a REAL call via the calle SDK...")
    receipt = CalleOutreachProvider().dispatch([task])
    print(f"receipt: {receipt.model_dump(mode='json')}")

    # dispatch returns as soon as CALL-E accepts; a daemon thread is now
    # waiting on the result and will drop the Quote into STORE.
    print(f"\nwaiting for the call to finish (up to {TIMEOUT_SECONDS}s)...")
    deadline = time.monotonic() + TIMEOUT_SECONDS
    waited = 0

    while True:
        quotes = STORE.quotes_for(task.case_id)
        if quotes:
            print()  # end the progress line
            for quote in quotes:
                print_quote(quote)
                print_transcript(quote)
            print_events(task.case_id)
            return

        if time.monotonic() > deadline:
            print(f"\n\nTIMED OUT after {TIMEOUT_SECONDS}s with no quote.")
            print_events(task.case_id)
            sys.exit(1)

        time.sleep(POLL_INTERVAL)
        waited += POLL_INTERVAL
        print(f"  ...{int(waited)}s", end="\r", flush=True)


if __name__ == "__main__":
    main()

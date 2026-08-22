"""One structured input, through the API, back out as printed quotes.

Not a pytest test — a by-hand script. Unlike try_fake_outreach.py it needs
no running server: it drives the FastAPI app in-process via TestClient, so
dispatch, the provider's background delivery, and the STORE that holds the
result all live in this one process.

    python test/try_outreach_roundtrip.py            # rehearse
    python test/try_outreach_roundtrip.py --live     # place a real call
    python test/try_outreach_roundtrip.py --live --run-id 143022   # replay one

Rehearsal only by default. FAKE_CALLS=0 alone will NOT dial from here —
pass --live as well, because a script you run to eyeball output should
never place a billed call by accident.

Each run gets a fresh run id, stamped onto every task_id. That matters:
CalleOutreachProvider sends `case_id:task_id` as CALL-E's idempotency key,
so re-running with a task_id CALL-E has already seen returns that finished
call instead of dialling — same transcript, no phone ringing, and deleting
the local data/quotes/ file changes nothing because the record lives at
CALL-E. Pass --run-id to pin an old one on purpose and pull its result down
again.

Edit REQUEST below and run it again.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Run as a plain script, python puts test/ on the path, not the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from backend import settings  # noqa: E402
from backend.main import app  # noqa: E402

# ---------------------------------------------------------------- the input
# The literal request body. Same shape the Devin tool endpoint receives.
REQUEST: dict = {
    "tasks": [
        {
            "task_id": "TRY-001",
            "case_id": "CASE-TRY",
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
        # One task = one call. Add another only when you mean to pay for a
        # second one — every supplier_ref in the fixture is the same number.
    ]
}

POLL_INTERVAL = 0.25
# How often to say "still here" while waiting. Between call_accepted and the
# result there are minutes of pure silence on a live call, and silence is
# what makes you kill the script.
HEARTBEAT_SECONDS = 15


def _stamp_run_id(request: dict, run_id: str) -> None:
    """Make every task_id unique to this run — see the module docstring on
    CALL-E's idempotency key. Mutates REQUEST so what is dispatched is
    exactly what gets printed."""
    for task in request["tasks"]:
        task["task_id"] = f"{task['task_id']}-{run_id}"


def main() -> int:
    live = "--live" in sys.argv

    if "--run-id" in sys.argv:
        run_id = sys.argv[sys.argv.index("--run-id") + 1]
    else:
        run_id = time.strftime("%H%M%S")
    _stamp_run_id(REQUEST, run_id)

    if not settings.FAKE_CALLS and not live:
        print(
            "FAKE_CALLS=0 is set, so dispatching here would place real, billed "
            "calls.\nRe-run with --live if that is what you want, or set "
            "FAKE_CALLS=1 to rehearse."
        )
        return 1
    if live and settings.FAKE_CALLS:
        print("--live passed but FAKE_CALLS=1 — rehearsing anyway, nothing is dialled.")

    case_id = REQUEST["tasks"][0]["case_id"]
    # A live call sits queued and then talks for minutes; the fake resolves
    # in under three seconds.
    deadline = time.monotonic() + (settings.CALLE_POLL_TIMEOUT + 60 if live else 30)

    with TestClient(app) as client:
        print(f"health:  {client.get('/health').json()}")
        print(f"run id:  {run_id}  (tasks: {[t['task_id'] for t in REQUEST['tasks']]})")

        receipt = client.post("/tools/outreach", json=REQUEST)
        receipt.raise_for_status()
        receipt = receipt.json()
        print(f"receipt: {receipt}")
        if not settings.FAKE_CALLS:
            print(
                "\nThe calls are placed now, but CALL-E dials them out of a queue,\n"
                "so the phone rings a while after this line. Ctrl+C does NOT cancel\n"
                "them — the call still happens and still bills, you just lose the\n"
                "result, because the thread collecting it dies with this process."
            )
        print()

        expected = set(receipt["task_ids"])
        seen: set[str] = set()
        events_shown = 0
        started = time.monotonic()
        next_heartbeat = started + HEARTBEAT_SECONDS

        try:
            while seen != expected:
                events_shown = _drain_events(client, case_id, events_shown)

                quotes = client.get(
                    "/tools/quotes", params={"case_id": case_id}
                ).json()["quotes"]
                for quote in quotes:
                    if quote["task_id"] not in seen:
                        seen.add(quote["task_id"])
                        _print_quote(quote)

                if seen != expected:
                    now = time.monotonic()
                    if now > deadline:
                        print(
                            f"TIMED OUT after {_elapsed(started)} — never heard back "
                            f"for: {sorted(expected - seen)}"
                        )
                        _drain_events(client, case_id, events_shown)
                        return 1
                    if now >= next_heartbeat:
                        waiting = ", ".join(sorted(expected - seen))
                        print(f"  … {_elapsed(started)} elapsed, waiting on {waiting}")
                        next_heartbeat = now + HEARTBEAT_SECONDS
                    time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print(f"\ninterrupted after {_elapsed(started)}.")
            if not settings.FAKE_CALLS:
                print(
                    f"{len(expected - seen)} call(s) are still running at CALL-E and "
                    "will complete\nwithout being collected. Nothing will be written "
                    "to data/quotes/ for them."
                )
            return 130

        _drain_events(client, case_id, events_shown)
        print(f"all {len(expected)} quote(s) received in {_elapsed(started)}.")
    return 0


def _drain_events(client: TestClient, case_id: str, already_shown: int) -> int:
    """Print event-log entries that appeared since the last call. The log is
    append-only, so an index is enough to know what is new."""
    events = client.get(f"/cases/{case_id}/events").json()["events"]
    for event in events[already_shown:]:
        marker = "!" if event["level"] == "error" else "·"
        print(f"  {marker} [{event['stage']}] {event['message']}")
    return len(events)


def _elapsed(started: float) -> str:
    seconds = int(time.monotonic() - started)
    return f"{seconds // 60}m{seconds % 60:02d}s"


def _print_quote(quote: dict) -> None:
    print(f"--- quote {quote['task_id']} ({quote['supplier_ref']}) ---")
    if not quote["available"]:
        print(f"  unavailable: {quote['notes'] or '(no reason given)'}")
    else:
        print(f"  qty offered:  {quote['qty_offered']}")
        print(f"  unit price:   {quote['unit_price']} {quote['currency']}")
        print(f"  moq:          {quote['moq']}")
        print(f"  lead time:    {quote['lead_time_days']} days")
        print(f"  incoterm:     {quote['incoterm']}")
        print(f"  certs:        {', '.join(quote['certs_claimed']) or 'none claimed'}")
        print(f"  payment:      {quote['payment_terms']}")
        print(f"  price breaks: {json.dumps(quote['price_breaks'])}")
    print(f"  confidence:   {quote['confidence']}")
    if quote["summary"]:
        print(f"  summary:      {quote['summary']}")
    for turn in quote["transcript"]:
        print(f"    [{turn['offset_seconds']:>4}s] {turn['speaker']}: {turn['text']}")
    print()


if __name__ == "__main__":
    raise SystemExit(main())

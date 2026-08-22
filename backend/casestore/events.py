"""The append-only event log. One file per case, one JSON object per line.

JSONL rather than a JSON array on purpose: an append is a single write with no
read-modify-write, so Devin, the CALL-E webhook and the API can all append
concurrently without corrupting the file, and `tail -f` works while debugging.

`seq` is monotonic within a case, which is what lets the UI poll with `?since=`
and get exactly the events it has not seen -- the same read path a replay uses,
so the offline demo is not a separate code path that can rot.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from packages.contracts.enums import Actor, Level, Stage
from packages.contracts.models import Event

_LOCKS: dict[Path, threading.Lock] = {}
_LOCKS_GUARD = threading.Lock()


def _lock_for(path: Path) -> threading.Lock:
    with _LOCKS_GUARD:
        return _LOCKS.setdefault(path, threading.Lock())


def read_events(events_path: Path, since: int = 0) -> list[Event]:
    """Every event after `since`. A malformed line is skipped, never fatal.

    The log is the debugging surface; a half-written line from a crashed writer
    must not take down the endpoint that would show you what crashed.
    """
    if not events_path.exists():
        return []

    events: list[Event] = []
    with events_path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                event = Event(**json.loads(line))
            except (json.JSONDecodeError, ValueError, TypeError):
                continue
            if event.seq > since:
                events.append(event)
    return events


def last_seq(events_path: Path) -> int:
    events = read_events(events_path)
    return events[-1].seq if events else 0


def append_event(
    events_path: Path,
    *,
    case_id: str,
    actor: Actor,
    stage: Stage,
    message: str,
    level: Level = Level.INFO,
    payload: dict | None = None,
) -> Event:
    """Append one event and return it with its assigned `seq`."""
    events_path.parent.mkdir(parents=True, exist_ok=True)
    with _lock_for(events_path):
        event = Event(
            seq=last_seq(events_path) + 1,
            case_id=case_id,
            ts=datetime.now(timezone.utc),
            actor=actor,
            stage=stage,
            level=level,
            message=message,
            payload=payload or {},
        )
        with events_path.open("a", encoding="utf-8") as fh:
            fh.write(event.model_dump_json() + "\n")
            fh.flush()
            os.fsync(fh.fileno())
    return event

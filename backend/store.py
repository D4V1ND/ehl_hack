"""In-memory quote store and append-only event log.

v3 deletes the database: the case files in git are the real datastore.
This is the live working set for one process, and what the cockpit UI
polls to feel alive.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

from packages.contracts.models import Quote


class Store:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._quotes: dict[str, dict[str, Quote]] = {}
        self._events: dict[str, list[dict[str, Any]]] = {}
        self._pending_calls: dict[str, dict[str, dict[str, Any]]] = {}

    def add_quote(self, quote: Quote) -> None:
        with self._lock:
            self._quotes.setdefault(quote.case_id, {})[quote.task_id] = quote
            self._pending_calls.get(quote.case_id, {}).pop(quote.task_id, None)

    def mark_call_pending(self, case_id: str, task_id: str, supplier_ref: str) -> None:
        with self._lock:
            self._pending_calls.setdefault(case_id, {})[task_id] = {
                "task_id": task_id,
                "supplier_ref": supplier_ref,
                "started_at": time.monotonic(),
            }

    def resolve_call(self, case_id: str, task_id: str, reason: str) -> dict[str, Any] | None:
        with self._lock:
            entry = self._pending_calls.get(case_id, {}).pop(task_id, None)
            if entry is not None:
                entry["reason"] = reason
            return entry

    def pending_calls(self, case_id: str, max_wait: float) -> list[dict[str, Any]]:
        now = time.monotonic()
        with self._lock:
            entries = self._pending_calls.get(case_id, {})
            expired = [
                task_id
                for task_id, entry in entries.items()
                if now - entry["started_at"] > max_wait
            ]
            for task_id in expired:
                entries.pop(task_id, None)
            if not entries:
                self._pending_calls.pop(case_id, None)
            return [dict(entry) for entry in entries.values()]

    def clear_quotes(self, case_id: str) -> None:
        """Drop a case's quote buffer. A re-run asks again; last run's answers
        must not be filed a second time as if they were fresh."""
        with self._lock:
            self._quotes.pop(case_id, None)
            self._pending_calls.pop(case_id, None)

    def quotes_for(self, case_id: str) -> list[Quote]:
        with self._lock:
            return list(self._quotes.get(case_id, {}).values())

    def append_event(
        self,
        case_id: str,
        actor: str,
        stage: str,
        message: str,
        level: str = "info",
        payload: dict | None = None,
    ) -> None:
        event = {
            "case_id": case_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "stage": stage,
            "level": level,
            "message": message,
            "payload": payload or {},
        }
        with self._lock:
            self._events.setdefault(case_id, []).append(event)

    def events_for(self, case_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._events.get(case_id, []))

    def reset(self) -> None:
        with self._lock:
            self._quotes.clear()
            self._events.clear()
            self._pending_calls.clear()


STORE = Store()

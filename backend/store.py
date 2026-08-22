"""In-memory quote store and append-only event log.

v3 deletes the database: the case files in git are the real datastore.
This is the live working set for one process, and what the cockpit UI
polls to feel alive.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from packages.contracts.models import Quote


class Store:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._quotes: dict[str, dict[str, Quote]] = {}
        self._events: dict[str, list[dict[str, Any]]] = {}
        self._calls: dict[str, tuple[str, str, str]] = {}

    def remember_call(self, call_id: str, case_id: str, task_id: str, supplier_ref: str) -> None:
        """Which task a provider call id belongs to.

        Every recipient in the demo shares one destination number, so nothing in
        a result identifies the supplier by itself. The call id does, and it is
        the only correlation that survives results arriving out of order.
        """
        with self._lock:
            self._calls[call_id] = (case_id, task_id, supplier_ref)

    def call_route(self, call_id: str) -> tuple[str, str, str] | None:
        with self._lock:
            return self._calls.get(call_id)

    def add_quote(self, quote: Quote) -> None:
        with self._lock:
            self._quotes.setdefault(quote.case_id, {})[quote.task_id] = quote

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
            self._calls.clear()


STORE = Store()

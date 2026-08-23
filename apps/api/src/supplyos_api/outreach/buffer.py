"""Transient outreach results and transport events for one API process.

This buffer is deliberately not the case store. Quotes and transport events
live here only while calls are in flight; durable case files remain owned by
``casestore.case_store``. Completed live quotes are also written through
``outreach.persistence`` so paid-call evidence survives a process restart.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from packages.contracts.models import Quote


class OutreachBuffer:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._quotes: dict[str, dict[str, Quote]] = {}
        self._events: dict[str, list[dict[str, Any]]] = {}

    def add_quote(self, quote: Quote) -> None:
        with self._lock:
            self._quotes.setdefault(quote.case_id, {})[quote.task_id] = quote

    def clear_quotes(self, case_id: str) -> None:
        """Drop a case's quote buffer. A re-run asks again; last run's answers
        must not be filed a second time as if they were fresh."""
        with self._lock:
            self._quotes.pop(case_id, None)

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


OUTREACH_BUFFER = OutreachBuffer()

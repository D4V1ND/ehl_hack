"""The seam between fake and real outreach.

Both implementations are ASYNCHRONOUS: dispatch() returns a receipt, and
quotes land later in the store. Consumers poll GET /tools/quotes.

This is the whole point of the slice. A real phone call takes minutes, so
if the fake returned quotes synchronously, every consumer would be built
against a shape that has to be rewritten the moment live calling lands.
Swapping fake for real changes one environment variable, not any consumer.
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel

from packages.contracts.models import OutreachTask


class DispatchReceipt(BaseModel):
    case_id: str
    task_ids: list[str]
    provider: str


class OutreachProvider(Protocol):
    name: str

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        """Start outreach. Returns immediately. Quotes arrive later."""
        ...

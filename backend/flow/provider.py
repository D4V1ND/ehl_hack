"""A rehearsal provider that answers the way the supplier's file says it would.

`FakeOutreachProvider` proves the asynchronous shape of a call with deliberately
arbitrary numbers, which is right for testing the transport and wrong for
rehearsing a decision: a supplier contradicting its own record turns a rehearsal
into a coin toss. This provider keeps the same asynchronous shape -- dispatch
returns, the quote lands later -- but answers from the record.

It never touches the network.
"""

from __future__ import annotations

import random
import threading

from backend import settings
from backend.flow.rehearsal import rehearsed_quote
from backend.outreach.protocol import DispatchReceipt
from backend.record.ports import SystemOfRecord
from backend.store import STORE
from packages.contracts.models import OutreachTask


class RehearsalOutreachProvider:
    name = "rehearsal"

    def __init__(self, records: SystemOfRecord) -> None:
        self._records = records

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        case_id = tasks[0].case_id if tasks else ""
        for task in tasks:
            rng = random.Random(task.task_id)
            delay = rng.uniform(settings.FAKE_MIN_DELAY, settings.FAKE_MAX_DELAY)
            timer = threading.Timer(delay, self._deliver, args=(task,))
            timer.daemon = True
            timer.start()
        return DispatchReceipt(
            case_id=case_id,
            task_ids=[t.task_id for t in tasks],
            provider=self.name,
        )

    def _deliver(self, task: OutreachTask) -> None:
        supplier = self._records.get_supplier(task.supplier_ref)
        incident = self._records.get_incident(task.case_id)
        if supplier is None or incident is None:
            return  # nothing to rehearse from; the case log already says who was called
        quote = rehearsed_quote(
            task,
            supplier=supplier,
            incident=incident,
            part=self._records.get_part(incident.part_id),
        )
        STORE.add_quote(quote)
        STORE.append_event(
            task.case_id,
            actor="calle",
            stage="quote_received",
            message=f"{task.supplier_ref}: {'quoted' if quote.available else 'cannot supply'} (rehearsal)",
            payload={"task_id": task.task_id, "available": quote.available},
        )

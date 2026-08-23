"""FakeOutreachProvider + provider selection."""

from __future__ import annotations

import random
import threading

from supplyos_api import settings
from supplyos_api.outreach.fake import make_fake_quote
from supplyos_api.outreach.protocol import DispatchReceipt, OutreachProvider
from supplyos_api.outreach.buffer import OUTREACH_BUFFER
from packages.contracts.models import OutreachTask


class FakeOutreachProvider:
    """Delivers each quote after a short random delay, exactly the way a
    real call does — just faster. Never touches the network."""

    name = "fake"

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        case_id = tasks[0].case_id if tasks else ""
        OUTREACH_BUFFER.append_event(
            case_id,
            actor="system",
            stage="outreach_dispatched",
            message=f"Dispatched {len(tasks)} outreach task(s) via fake provider",
            payload={"task_ids": [t.task_id for t in tasks]},
        )
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

    @staticmethod
    def _deliver(task: OutreachTask) -> None:
        quote = make_fake_quote(task)
        OUTREACH_BUFFER.add_quote(quote)
        OUTREACH_BUFFER.append_event(
            task.case_id,
            actor="calle",
            stage="quote_received",
            message=(
                f"{task.supplier_ref}: "
                + ("quoted" if quote.available else "cannot supply")
            ),
            payload={"task_id": task.task_id, "available": quote.available},
        )


def get_provider() -> OutreachProvider:
    """Rehearsal is the default. Live calling is an explicit opt-in."""
    if settings.FAKE_CALLS:
        return FakeOutreachProvider()

    from supplyos_api.outreach.calle import CalleOutreachProvider

    return CalleOutreachProvider()

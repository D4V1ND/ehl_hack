"""The one FastAPI process.

Slice C owns the routes below. Other slices add their own routers to this
same app — one process serves the Devin tool endpoints and the UI read API.

Run it:  python -m uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from backend import settings
from backend.outreach.protocol import DispatchReceipt
from backend.outreach.provider import get_provider
from backend.store import STORE
from packages.contracts.models import OutreachTask, Quote

app = FastAPI(title="Autonomous Sourcing Agent")


class OutreachRequest(BaseModel):
    tasks: list[OutreachTask]


class QuotesResponse(BaseModel):
    quotes: list[Quote]


@app.post("/tools/outreach", response_model=DispatchReceipt)
def dispatch_outreach(request: OutreachRequest) -> DispatchReceipt:
    """Start contacting suppliers.

    Returns immediately with a receipt. Quotes arrive later — poll
    GET /tools/quotes until you have what you need.
    """
    return get_provider().dispatch(request.tasks)


@app.get("/tools/quotes", response_model=QuotesResponse)
def get_quotes(case_id: str) -> QuotesResponse:
    """Quotes collected so far. An unknown case is an empty list, not an error."""
    return QuotesResponse(quotes=STORE.quotes_for(case_id))


@app.get("/cases/{case_id}/events")
def get_events(case_id: str) -> dict:
    """Append-only event log. The cockpit polls this every 2 seconds."""
    return {"events": STORE.events_for(case_id)}


@app.get("/health")
def health() -> dict:
    return {"ok": True, "fake_calls": settings.FAKE_CALLS}

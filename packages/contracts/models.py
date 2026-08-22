"""Shared data shapes. Frozen in hour 1 — see test/sourcing_agent_plan_v3.md §4.

Adding a NEW model to this file is fine. Editing an existing one needs a
group ping, because every slice builds against these.

Slice C owns: Currency, Channel, PriceBreak, ExpediteOption, OutreachBrief,
OutreachTask, Quote. Other slices append Part, Shortage, Supplier,
Candidate, LandedCost, OrderLine, Strategy, Decision, Event.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class Currency(str, Enum):
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"
    UNKNOWN = "unknown"


class Channel(str, Enum):
    VOICE = "voice"
    EMAIL = "email"
    MARKETPLACE = "marketplace"


class PriceBreak(BaseModel):
    """Buy at least `min_qty` and each unit costs `unit_price`."""

    min_qty: int
    unit_price: Decimal


class ExpediteOption(BaseModel):
    """Pay `surcharge` total to pull delivery in by `days`."""

    days: int
    surcharge: Decimal


class OutreachBrief(BaseModel):
    part_spec: str 
    qty: int
    needed_by: date
    target_price: Decimal | None = None
    floor_price: Decimal | None = None
    must_ask: list[str] = Field(
        default_factory=lambda: [
            "price_breaks",
            "moq",
            "lead_time",
            "incoterm",
            "cert",
        ]
    )


class OutreachTask(BaseModel):
    task_id: str
    case_id: str
    supplier_ref: str
    channel: Channel
    brief: OutreachBrief


class TranscriptTurn(BaseModel):
    """One thing said on the call, in order.

    `speaker` is CALL-E's label — "bot", "user", or "unknown" — kept as a
    plain string rather than an enum so an unfamiliar label is recorded
    rather than rejected.
    """

    offset_seconds: int = 0
    speaker: str = "unknown"
    text: str = ""


class Quote(BaseModel):
    """What one supplier said. Every judgement field may be unknown.

    A garbled or missing call result becomes a Quote with these defaults
    and confidence 0.0 — never an exception.
    """

    task_id: str
    case_id: str
    supplier_ref: str

    available: bool = False
    qty_offered: int = 0
    unit_price: Decimal | None = None
    price_breaks: list[PriceBreak] = Field(default_factory=list)
    currency: Currency = Currency.UNKNOWN
    moq: int | None = None
    lead_time_days: int | None = None
    expedite_option: ExpediteOption | None = None
    incoterm: str | None = None
    certs_claimed: list[str] = Field(default_factory=list)
    payment_terms: str | None = None
    notes: str = ""

    # What was actually said, in order. The typed fields above are an
    # extraction model's reading of this, so it is the evidence behind them
    # — surfaced here rather than left buried inside `raw`.
    transcript: list[TranscriptTurn] = Field(default_factory=list)
    summary: str = ""

    transcript_url: str | None = None
    recording_url: str | None = None
    confidence: float = 0.0
    raw: dict = Field(default_factory=dict)

    @field_validator("price_breaks")
    @classmethod
    def _sorted_by_qty(cls, v: list[PriceBreak]) -> list[PriceBreak]:
        return sorted(v, key=lambda pb: pb.min_qty)

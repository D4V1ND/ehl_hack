"""Shared data shapes. Frozen in hour 1 — see test/sourcing_agent_plan_v3.md §4.

Adding a NEW model to this file is fine. Editing an existing one needs a
group ping, because every slice builds against these.

Slice C owns: Currency, Channel, PriceBreak, ExpediteOption, OutreachBrief,
OutreachTask, Quote. Other slices append Part, Shortage, Supplier,
Candidate, LandedCost, OrderLine, Strategy, Decision, Event.

Slice B appended everything below the divider: the system-of-record shapes
(Part, StockLevel, OpenPurchaseOrder, SupplierPriceRecord, SupplierRecord,
Incident, CompanyProfile), the decision shapes (ComplianceResult, Candidate,
LandedCost, OrderLine, Strategy, Decision), the Event log, and the read models
the cockpit fetches. Nothing above the divider was edited.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from packages.contracts.enums import (
    Actor,
    Answer,
    AuditStatus,
    Criticality,
    DecisionStatus,
    FreightMode,
    Level,
    OutreachStatus,
    PartClass,
    PolicyRule,
    Stage,
    StockStatus,
)
from packages.contracts.money import Money


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

    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    min_qty: int
    unit_price: Money


class ExpediteOption(BaseModel):
    """Pay `surcharge` total to pull delivery in by `days`."""

    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    days: int
    surcharge: Money


class OutreachBrief(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    part_spec: str
    qty: int
    needed_by: date
    target_price: Money | None = None
    floor_price: Money | None = None
    must_ask: list[str] = Field(
        default_factory=lambda: [
            "price_breaks",
            "moq",
            "lead_time",
            "incoterm",
            "cert",
            "stock_status",
        ]
    )


class OutreachTask(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    task_id: str
    case_id: str
    supplier_ref: str
    channel: Channel
    brief: OutreachBrief
    round: int = Field(default=1, ge=1)
    status: OutreachStatus = OutreachStatus.PENDING
    started_at: datetime | None = None
    completed_at: datetime | None = None


class TranscriptTurn(BaseModel):
    """One thing said on the call, in order."""

    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    offset_seconds: int = 0
    speaker: str = "unknown"
    text: str = ""


class Quote(BaseModel):
    """What one supplier said. Every judgement field may be unknown.

    A garbled or missing call result becomes a Quote with these defaults
    and confidence 0.0 — never an exception.
    """

    model_config = ConfigDict(extra="forbid", use_enum_values=False)

    task_id: str
    case_id: str
    supplier_ref: str

    available: bool = False
    qty_offered: int = 0
    unit_price: Money | None = None
    price_breaks: list[PriceBreak] = Field(default_factory=list)
    currency: Currency = Currency.UNKNOWN
    moq: int | None = None
    lead_time_days: int | None = None
    expedite_option: ExpediteOption | None = None
    incoterm: str | None = None
    certs_claimed: list[str] = Field(default_factory=list)
    payment_terms: str | None = None
    notes: str = ""

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


# ===========================================================================
# Slice B appends from here down. Nothing above this line was edited.
# ===========================================================================


class Contract(BaseModel):
    """Base for the models below: unknown fields are a bug, not a shrug."""

    model_config = ConfigDict(extra="forbid", use_enum_values=False)


class Claim(Quote):
    """A Quote, plus what the call could and could not establish.

    `Quote` is what a supplier offered. A `Claim` is the same offer carrying the
    foundation spec's answer sheet: whether stock is actually free or already
    promised elsewhere, whether the certification and part number were confirmed
    or merely asserted, and the evidence for each. Every added judgement field
    admits `unknown`, and building one never raises -- a garbled call becomes a
    confidence-0 claim, because one bad call must not kill a five-supplier case.

    Subclassing rather than duplicating on purpose: a Claim *is* a Quote, so
    anything Slice C hands back fits wherever a Quote is expected, and the shared
    fields cannot drift apart.
    """

    round: int = 1
    call_id: str | None = None
    earliest_ready_text: str = ""

    # The sharpest field we have: "yes, we have some" frequently means
    # "yes, but it is already promised to someone else".
    stock_status: StockStatus = StockStatus.UNCLEAR

    price_quoted: Answer = Answer.UNKNOWN
    part_number_confirmed: Answer = Answer.UNKNOWN
    certification_current: Answer = Answer.UNKNOWN

    evidence: list[str] = Field(default_factory=list)
    received_at: datetime | None = None


# ---------------------------------------------------------------------------
# System of record -- what our own files say. ERPNext-shaped field names, so
# "swap in a real ERPNext" is one adapter class and not a rename of everything.
# ---------------------------------------------------------------------------


class Part(Contract):
    part_id: str
    item_code: str = Field(description="ERPNext `item_code`")
    item_name: str
    description: str
    spec: dict[str, str] = Field(default_factory=dict, description="Free-form technical spec, e.g. bore/OD/width/seal")
    stock_uom: str = "Nos"
    criticality: Criticality = Criticality.MEDIUM
    part_class: PartClass
    weight_kg: float = Field(gt=0, description="Per piece. Drives freight cost.")
    hs_code: str = Field(description="Customs tariff code. Drives duty by origin.")
    standard_cost: Money


class StockLevel(Contract):
    """ERPNext `Bin`: what is physically in a warehouse right now."""

    part_id: str
    warehouse: str
    plant_id: str
    actual_qty: int
    reserved_qty: int = 0
    reorder_level: int
    daily_consumption: int = Field(ge=0, description="Line take rate, used to date the line stop")

    @property
    def available_qty(self) -> int:
        return max(self.actual_qty - self.reserved_qty, 0)


class OpenPurchaseOrder(Contract):
    po_id: str
    part_id: str
    supplier_id: str
    qty: int
    promised_date: date
    revised_date: date | None = Field(default=None, description="Set when the supplier slips. The delay that fires the detector.")
    status: str = "open"

    @property
    def is_delayed(self) -> bool:
        return self.revised_date is not None and self.revised_date > self.promised_date


class SupplierPriceRecord(Contract):
    """Historical price paid, from our own purchase history."""

    supplier_id: str
    part_id: str
    as_of: date
    unit_price: Money
    qty: int
    currency: Currency = Currency.EUR


class SupplierRecord(Contract):
    """What our files say about a supplier. The baseline a claim is checked against.

    `phone_masked` is the only phone field that exists. There is deliberately no
    place to put a raw number.
    """

    supplier_id: str
    supplier_name: str = Field(description="ERPNext `supplier_name`")
    country: str = Field(min_length=2, max_length=2, description="ISO 3166-1 alpha-2")
    locale: str = "en-GB"
    phone_masked: str = Field(description="Never the raw number. See contracts.phone.")
    email: str | None = None
    marketplace_url: str | None = None
    channels: list[Channel] = Field(default_factory=list)
    part_ids: list[str] = Field(default_factory=list)
    approved: bool = False
    preferred: bool = False
    incumbent: bool = False
    contract_unit_price: Money | None = None
    standard_lead_days: int | None = Field(default=None, description="Door-to-door days on the contracted mode, not ex-works")
    certifications: list[str] = Field(default_factory=list)
    certification_expires_at: date | None = None
    audit_status: AuditStatus = AuditStatus.NEVER_AUDITED
    known_allocations: int = Field(default=0, description="Units our records show already promised elsewhere")
    max_historical_fill: int = Field(default=0, description="Largest order they have actually delivered for us")
    price_breaks: list[PriceBreak] = Field(default_factory=list)


class IncidentPlant(Contract):
    plant_id: str
    name: str
    production_line: str


class Incident(Contract):
    """A shortage, as our own records see it. Claims are not involved yet."""

    case_id: str
    part_id: str
    plant_id: str
    production_line: str
    qty_required: int
    qty_on_hand: int
    needed_by: date
    line_stop_at: datetime
    line_stop_cost_per_hour: Money
    currency: Currency = Currency.EUR
    incumbent_supplier_id: str | None = None
    reason: str = ""
    plants: list[IncidentPlant] = Field(default_factory=list)

    @property
    def shortfall(self) -> int:
        return max(self.qty_required - self.qty_on_hand, 0)


class CompanyProfile(Contract):
    """The rules of the house. Every policy rule reads exactly one field here."""

    legal_entity: str
    country: str
    blocked_origin_countries: list[str] = Field(default_factory=list)
    required_certifications: dict[PartClass, list[str]] = Field(default_factory=dict)
    audit_required_above_criticality: Criticality = Criticality.HIGH
    single_po_budget_eur: Money
    requires_second_quote_above_eur: Money
    wacc: float = Field(description="Weighted average cost of capital, for carrying cost")
    warehousing_eur_per_pallet_month: Money
    pieces_per_pallet: int
    duty_rates: dict[str, float] = Field(default_factory=dict, description="origin country -> ad valorem rate")
    freight_eur_per_kg: dict[FreightMode, Money] = Field(default_factory=dict)
    transit_days: dict[FreightMode, int] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# The decision
# ---------------------------------------------------------------------------


class ComplianceResult(Contract):
    passed: bool
    failed_rules: list[PolicyRule] = Field(default_factory=list)
    explanations: dict[PolicyRule, str] = Field(
        default_factory=dict,
        description="Rule -> one plain sentence. What the UI prints next to the rule name.",
    )


class Candidate(Contract):
    case_id: str
    supplier_ref: str
    supplier_name: str
    country: str
    confidence: float = Field(ge=0, le=1)
    why_matched: str
    channel: Channel
    source: str = Field(default="erp", description='"erp" for an approved supplier, "web" for one researched online')
    compliance: ComplianceResult


class LandedCost(Contract):
    supplier_ref: str
    qty: int
    mode: FreightMode
    goods_cost: Money
    freight: Money
    duty: Money
    tooling: Money = Decimal("0")
    carrying_cost: Money
    expedite_surcharge: Money
    total: Money
    unit_effective: Money
    breakdown_md: str = ""


class OrderLine(Contract):
    supplier_ref: str
    supplier_name: str
    qty: int
    mode: FreightMode
    eta: date
    landed: LandedCost


class Strategy(Contract):
    strategy_id: str
    label: str = Field(description='Human name, e.g. "Split: fast bridge + cheap bulk"')
    lines: list[OrderLine]
    total_cost: Money
    unit_effective: Money
    coverage_date: date = Field(description="When the full quantity is on site")
    meets_line_stop: bool
    risk_score: float = Field(ge=0, le=1)
    rationale: str = ""


class DecisionChecks(Contract):
    policy_passed: bool
    cost_model_passed: bool


class Decision(Contract):
    case_id: str
    strategies: list[Strategy] = Field(default_factory=list)
    recommended_strategy_id: str | None = None
    runner_up_ids: list[str] = Field(default_factory=list)
    rationale_md: str = ""
    policy_report_url: str | None = None
    cost_report_url: str | None = None
    pr_url: str | None = None
    devin_session_url: str | None = None
    decided_at: datetime | None = None
    revision: int = Field(default=1, ge=1)
    status: DecisionStatus = DecisionStatus.READY
    checks: DecisionChecks = Field(
        default_factory=lambda: DecisionChecks(
            policy_passed=False,
            cost_model_passed=False,
        )
    )
    approved_at: datetime | None = None
    approved_by: str | None = None


# ---------------------------------------------------------------------------
# The event log -- what makes the UI feel alive and debugging possible
# ---------------------------------------------------------------------------


class Event(Contract):
    seq: int = Field(default=0, description="Monotonic within a case. The UI polls with ?since=")
    case_id: str
    ts: datetime
    actor: Actor
    stage: Stage
    level: Level = Level.INFO
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Read models the cockpit fetches, assembled server-side so the frontend never
# has to join anything.
# ---------------------------------------------------------------------------


class ShortageAlert(Contract):
    """One row on the shortage dashboard."""

    part_id: str
    item_code: str
    item_name: str
    plant_id: str
    qty_on_hand: int
    reorder_level: int
    qty_required: int
    days_to_line_stop: float
    line_stop_at: datetime
    line_stop_cost_per_hour: Money
    criticality: Criticality
    case_id: str | None = Field(default=None, description="Set once a sourcing case exists for it")
    delayed_po_id: str | None = None


class InventoryRow(Contract):
    """A row on the inventory screen: one part, and whether it can be triggered."""

    part_id: str
    item_code: str
    item_name: str
    part_class: str
    criticality: str
    plant_id: str
    on_hand: int
    reorder_level: int
    daily_consumption: int
    days_of_cover: float | None
    below_reorder: bool
    delayed_po: str | None
    suppliers: int
    open_case_id: str | None


class CaseSummary(Contract):
    case_id: str
    part_id: str
    item_name: str
    stage: Stage
    qty_required: int
    line_stop_at: datetime
    opened_at: datetime
    pr_url: str | None = None


class CaseSnapshot(Contract):
    """Everything the case page needs, in one response."""

    case_id: str
    stage: Stage
    incident: Incident
    part: Part
    profile_summary: dict[str, Any] = Field(default_factory=dict)
    candidates: list[Candidate] = Field(default_factory=list)
    supplier_records: list[SupplierRecord] = Field(default_factory=list)
    outreach_tasks: list[OutreachTask] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    decision: Decision | None = None
    devin_session_url: str | None = None
    last_event_seq: int = 0


class PublicProfileSummary(Contract):
    company_name: str
    home_country: str
    target_currency: Currency
    policy_labels: list[str] = Field(default_factory=list)
    sourcing_constraints: list[str] = Field(default_factory=list)


class PublicSupplierRecord(Contract):
    supplier_id: str
    supplier_name: str
    country: str = Field(min_length=2, max_length=2)
    locale: str = "en-GB"
    phone_masked: str
    channels: list[Channel] = Field(default_factory=list)
    part_ids: list[str] = Field(default_factory=list)
    approved: bool = False
    preferred: bool = False
    incumbent: bool = False
    contract_unit_price: Money | None = None
    standard_lead_days: int | None = None
    certifications: list[str] = Field(default_factory=list)
    certification_expires_at: date | None = None
    audit_status: AuditStatus = AuditStatus.NEVER_AUDITED
    known_allocations: int = 0
    max_historical_fill: int = 0
    price_breaks: list[PriceBreak] = Field(default_factory=list)


class PublicClaim(Contract):
    task_id: str
    case_id: str
    supplier_ref: str
    available: bool = False
    qty_offered: int = 0
    unit_price: Money | None = None
    price_breaks: list[PriceBreak] = Field(default_factory=list)
    currency: Currency = Currency.UNKNOWN
    moq: int | None = None
    lead_time_days: int | None = None
    expedite_option: ExpediteOption | None = None
    incoterm: str | None = None
    certs_claimed: list[str] = Field(default_factory=list)
    payment_terms: str | None = None
    transcript: list[TranscriptTurn] = Field(default_factory=list)
    summary: str = ""
    confidence: float = 0.0
    round: int = 1
    earliest_ready_text: str = ""
    stock_status: StockStatus = StockStatus.UNCLEAR
    price_quoted: Answer = Answer.UNKNOWN
    part_number_confirmed: Answer = Answer.UNKNOWN
    certification_current: Answer = Answer.UNKNOWN
    evidence: list[str] = Field(default_factory=list)
    received_at: datetime | None = None


class PublicDecision(Contract):
    case_id: str
    strategies: list[Strategy] = Field(default_factory=list)
    recommended_strategy_id: str | None = None
    runner_up_ids: list[str] = Field(default_factory=list)
    rationale_md: str = ""
    policy_report_url: str | None = None
    cost_report_url: str | None = None
    devin_session_url: str | None = None
    decided_at: datetime | None = None
    revision: int = Field(ge=1)
    status: DecisionStatus
    checks: DecisionChecks
    approved_at: datetime | None = None
    approved_by: str | None = None


class PublicEvent(Contract):
    seq: int = Field(default=0, ge=0)
    case_id: str
    ts: datetime
    actor: Actor
    stage: Stage
    level: Level = Level.INFO
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)


class PublicCaseSummary(Contract):
    case_id: str
    part_id: str
    item_name: str
    stage: Stage
    qty_required: int
    line_stop_at: datetime
    opened_at: datetime


class PublicCaseSnapshot(Contract):
    case_id: str
    stage: Stage
    incident: Incident
    part: Part
    profile_summary: PublicProfileSummary
    candidates: list[Candidate] = Field(default_factory=list)
    supplier_records: list[PublicSupplierRecord] = Field(default_factory=list)
    outreach_tasks: list[OutreachTask] = Field(default_factory=list)
    claims: list[PublicClaim] = Field(default_factory=list)
    decision: PublicDecision | None = None
    devin_session_url: str | None = None
    last_event_seq: int = Field(default=0, ge=0)


class OpenCaseRequest(Contract):
    part_id: str = Field(min_length=1, max_length=120)
    qty_required: int | None = Field(default=None, gt=0)
    needed_by: date | None = None
    case_id: str | None = Field(default=None, min_length=1, max_length=120)


class OpenCaseResponse(Contract):
    case_id: str
    incident: Incident
    session_id: str
    session_url: str
    stubbed: bool
    session_error: str | None = None


class OpenedCase(OpenCaseResponse):
    """PR 22 TypeScript compatibility name for an opened Case response."""


class ApproveDecisionRequest(Contract):
    decision_revision: int = Field(ge=1)
    approved_by: str = Field(min_length=1, max_length=200)

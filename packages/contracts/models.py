"""Every model in the system. One file, reviewed once, then frozen.

Two conventions worth knowing before you read:

* **Claim vs. record.** A `SupplierRecord` is what *our* files say — the trusted
  baseline. A `Claim` is what a supplier *said* on a phone call. They are never
  merged. Everything downstream depends on being able to tell them apart.
* **No raw phone numbers.** `SupplierRecord` carries `phone_masked` and there is
  no field anywhere for an unmasked one. The raw number lives inside the system
  of record and is handed only to the code that literally places the call.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from packages.contracts.enums import (
    Actor,
    Answer,
    AuditStatus,
    Channel,
    Criticality,
    FreightMode,
    Level,
    PartClass,
    PolicyRule,
    Stage,
    StockStatus,
)
from packages.contracts.money import Money


class Contract(BaseModel):
    """Base for every contract model: unknown fields are a bug, not a shrug."""

    model_config = ConfigDict(extra="forbid", use_enum_values=False)


# ---------------------------------------------------------------------------
# System of record — what our own files say. ERPNext-shaped field names, so
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


class PriceBreak(Contract):
    """A quantity tier. The step function the cost engine integrates over."""

    min_qty: int = Field(ge=1)
    unit_price: Money


class SupplierPriceRecord(Contract):
    """Historical price paid, from our own purchase history."""

    supplier_id: str
    part_id: str
    as_of: date
    unit_price: Money
    qty: int
    currency: str = "EUR"


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
    currency: str = "EUR"
    incumbent_supplier_id: str | None = None
    reason: str = ""

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
# The sourcing run
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
    supplier_id: str
    supplier_name: str
    country: str
    confidence: float = Field(ge=0, le=1)
    why_matched: str
    channel: Channel
    source: str = Field(default="erp", description='"erp" for an approved supplier, "web" for one Devin researched')
    compliance: ComplianceResult


class OutreachBrief(Contract):
    """What the caller must accomplish. The must-ask list is not optional."""

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
            "certification",
            "stock_status",
        ]
    )


class OutreachTask(Contract):
    task_id: str
    case_id: str
    supplier_id: str
    channel: Channel
    brief: OutreachBrief
    created_at: datetime


class ExpediteOption(Contract):
    days: int
    surcharge: Money


class Claim(Contract):
    """What a supplier said. Never a fact.

    This model is also CALL-E's `recipient_result_schema` — the same definition,
    exported as JSON Schema, so the answer sheet and our type cannot drift apart.

    Every judgement field admits `unknown`, and building one of these must never
    raise: a garbled call becomes a confidence-0 claim with fields defaulted,
    because one bad call must not kill a five-supplier case mid-run.
    """

    task_id: str
    case_id: str
    supplier_id: str
    round: int = 1
    call_id: str | None = None

    # Availability, as claimed
    qty_offered: int = 0
    earliest_ready_text: str = ""
    stock_status: StockStatus = StockStatus.UNCLEAR
    lead_time_days: int | None = None

    # Commercials, as claimed
    price_quoted: Answer = Answer.UNKNOWN
    unit_price: Money | None = None
    price_breaks: list[PriceBreak] = Field(default_factory=list)
    moq: int | None = None
    currency: str = "EUR"
    expedite_option: ExpediteOption | None = None
    incoterm: str | None = None
    payment_terms: str | None = None

    # Conformance, as claimed
    part_number_confirmed: Answer = Answer.UNKNOWN
    certification_current: Answer = Answer.UNKNOWN
    certs_claimed: list[str] = Field(default_factory=list)

    # Provenance
    notes: str = ""
    transcript_url: str | None = None
    recording_url: str | None = None
    confidence: float = Field(default=0.0, ge=0, le=1)
    evidence: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)
    received_at: datetime | None = None


# ---------------------------------------------------------------------------
# The decision
# ---------------------------------------------------------------------------


class LandedCost(Contract):
    supplier_id: str
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
    supplier_id: str
    supplier_name: str
    qty: int
    mode: FreightMode
    eta: date
    landed: LandedCost


class Strategy(Contract):
    strategy_id: str
    label: str = Field(description='Human name, e.g. "Split: SKF air + Rulmenti road"')
    lines: list[OrderLine]
    total_cost: Money
    unit_effective: Money
    coverage_date: date = Field(description="When the full quantity is on site")
    meets_line_stop: bool
    risk_score: float = Field(ge=0, le=1)
    rationale: str = ""


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


# ---------------------------------------------------------------------------
# The event log — what makes the UI feel alive and debugging possible
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
# UI read models — shapes the cockpit fetches, assembled server-side so the
# frontend never has to join anything.
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

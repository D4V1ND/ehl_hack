"""The frozen contract. One source of truth, three consumers.

The Pydantic models here are compiled to TypeScript for the cockpit UI, so a
model change reaches the UI's types automatically. The one export they do NOT
drive is the CALL-E answer sheet: its structured-result engine accepts only a
small JSON Schema subset and rejects the `anyOf`/`$ref` shapes Pydantic emits,
so `packages/contracts/schemas.py` writes that one by hand and a test keeps its
field names aligned with `Quote` and `Claim`.

Later changes need a group ping.
"""

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
from packages.contracts.models import (
    Candidate,
    ApproveDecisionRequest,
    Channel,
    Currency,
    Quote,
    CaseSnapshot,
    CaseSummary,
    ComplianceResult,
    CompanyProfile,
    Decision,
    DecisionChecks,
    Event,
    ExpediteOption,
    Incident,
    IncidentPlant,
    InventoryRow,
    LandedCost,
    OpenPurchaseOrder,
    OpenCaseRequest,
    OpenCaseResponse,
    OpenedCase,
    OrderLine,
    OutreachBrief,
    OutreachTask,
    Part,
    PriceBreak,
    PublicCaseSnapshot,
    PublicCaseSummary,
    PublicClaim,
    PublicDecision,
    PublicEvent,
    PublicProfileSummary,
    PublicSupplierRecord,
    Claim,
    ShortageAlert,
    StockLevel,
    Strategy,
    SupplierPriceRecord,
    SupplierRecord,
    TranscriptTurn,
)
from packages.contracts.money import Money, quantize_total, quantize_unit, to_decimal
from packages.contracts.phone import InvalidPhoneNumber, is_e164, mask, validate_e164
from packages.contracts.safe import (
    PUBLIC_EVENT_PAYLOAD_KEYS,
    project_public_case_snapshot,
    project_public_case_summary,
    project_public_claim,
    project_public_decision,
    project_public_event,
    project_public_profile_summary,
    project_public_supplier_record,
    scrub_public_text,
    scrub_public_value,
)

__all__ = [
    "Actor", "Answer", "AuditStatus", "Channel", "Criticality", "Currency", "DecisionStatus",
    "FreightMode", "Level", "OutreachStatus", "PartClass", "PolicyRule", "Stage", "StockStatus",
    "ApproveDecisionRequest", "Candidate", "CaseSnapshot", "CaseSummary", "Claim", "CompanyProfile",
    "ComplianceResult", "Decision", "DecisionChecks", "Event", "ExpediteOption", "Incident",
    "IncidentPlant", "InventoryRow", "LandedCost", "OpenCaseRequest", "OpenCaseResponse", "OpenedCase", "OpenPurchaseOrder",
    "OrderLine", "OutreachBrief", "OutreachTask", "Part", "PriceBreak", "PublicCaseSnapshot",
    "PublicCaseSummary", "PublicClaim", "PublicDecision", "PublicEvent", "PublicProfileSummary",
    "PublicSupplierRecord", "ShortageAlert", "StockLevel", "Quote", "Strategy",
    "SupplierPriceRecord", "SupplierRecord", "TranscriptTurn",
    "Money", "quantize_total", "quantize_unit", "to_decimal",
    "InvalidPhoneNumber", "is_e164", "mask", "validate_e164",
    "PUBLIC_EVENT_PAYLOAD_KEYS", "project_public_case_snapshot", "project_public_case_summary",
    "project_public_claim", "project_public_decision", "project_public_event",
    "project_public_profile_summary", "project_public_supplier_record", "scrub_public_text",
    "scrub_public_value",
]

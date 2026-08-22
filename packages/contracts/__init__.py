"""The frozen contract. One source of truth, three consumers.

The Pydantic models here are exported as JSON Schema for two other slices:
`Claim` is handed to CALL-E as its `recipient_result_schema`, and the whole set
is compiled to TypeScript for the cockpit UI. Changing a model changes all three
at once, which is the point — contract drift is structurally impossible.

Later changes need a group ping.
"""

from packages.contracts.enums import (
    Actor,
    Answer,
    AuditStatus,
    Criticality,
    FreightMode,
    Level,
    PartClass,
    PolicyRule,
    Stage,
    StockStatus,
)
from packages.contracts.models import (
    Candidate,
    Channel,
    Currency,
    Quote,
    CaseSnapshot,
    CaseSummary,
    ComplianceResult,
    CompanyProfile,
    Decision,
    Event,
    ExpediteOption,
    Incident,
    LandedCost,
    OpenPurchaseOrder,
    OrderLine,
    OutreachBrief,
    OutreachTask,
    Part,
    PriceBreak,
    Claim,
    ShortageAlert,
    StockLevel,
    Strategy,
    SupplierPriceRecord,
    SupplierRecord,
)
from packages.contracts.money import Money, quantize_total, quantize_unit, to_decimal
from packages.contracts.phone import InvalidPhoneNumber, is_e164, mask, validate_e164

__all__ = [
    "Actor", "Answer", "AuditStatus", "Channel", "Criticality", "Currency", "FreightMode",
    "Level", "PartClass", "PolicyRule", "Stage", "StockStatus",
    "Candidate", "CaseSnapshot", "CaseSummary", "Claim", "CompanyProfile",
    "ComplianceResult", "Decision", "Event", "ExpediteOption", "Incident",
    "LandedCost", "OpenPurchaseOrder", "OrderLine", "OutreachBrief",
    "OutreachTask", "Part", "PriceBreak", "ShortageAlert", "StockLevel",
    "Quote", "Strategy", "SupplierPriceRecord", "SupplierRecord",
    "Money", "quantize_total", "quantize_unit", "to_decimal",
    "InvalidPhoneNumber", "is_e164", "mask", "validate_e164",
]

"""Canonical SupplyOS domain and wire contracts.

The Pydantic models are exported as JSON Schema and as one generated TypeScript
module consumed by ERP and SupplyOS. Provider-specific transport schemas stay
inside the API package and normalize into these domain models.
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

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

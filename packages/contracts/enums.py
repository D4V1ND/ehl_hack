"""The shared vocabulary. Every string that has a fixed set of legal values lives here.

Rule from the foundation spec: "unknown" is a first-class answer. A supplier who
does not answer a question produces `unknown`, never a guessed yes or no.
"""

from __future__ import annotations

from enum import Enum


class Answer(str, Enum):
    """A three-state answer. `UNKNOWN` is legal everywhere `YES`/`NO` are."""

    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"


class StockStatus(str, Enum):
    """What the supplier says about the stock they hold.

    `IN_STOCK_ALLOCATED` is the whole point of asking: "yes, we have some"
    frequently means "yes, but it is already promised to someone else."
    """

    FREE_IN_STOCK = "free_in_stock"
    IN_STOCK_ALLOCATED = "in_stock_allocated"
    TO_BE_MADE = "to_be_made"
    UNAVAILABLE = "unavailable"
    UNCLEAR = "unclear"


# Channel and Currency are Slice C's and live in models.py alongside Quote.
# Importing them from there keeps one definition rather than two that drift.


class FreightMode(str, Enum):
    AIR = "air"
    SEA = "sea"
    ROAD = "road"


class Criticality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PartClass(str, Enum):
    """Selects which policy rules and cost parameters apply.

    This is the seam that keeps the system from being bearing-specific: adding a
    part class means adding a row to the company profile, not changing code.
    """

    ROLLING_BEARING = "rolling_bearing"
    FASTENER = "fastener"
    SEAL = "seal"
    ELECTRONIC_COMPONENT = "electronic_component"


class AuditStatus(str, Enum):
    AUDITED = "audited"
    AUDIT_EXPIRED = "audit_expired"
    NEVER_AUDITED = "never_audited"


class Actor(str, Enum):
    DEVIN = "devin"
    CALLE = "calle"
    SYSTEM = "system"


class Stage(str, Enum):
    """The five stages of a case. One stage, one colour, everywhere in the UI."""

    DETECTED = "detected"
    RESEARCHING = "researching"
    CALLING = "calling"
    COSTING = "costing"
    DECIDED = "decided"


class Level(str, Enum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


class StepStatus(str, Enum):
    """Where a checklist step is. `ACTIVE` is what the cockpit animates."""

    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class PlanGroup(str, Enum):
    """The rigid headers of the checklist.

    These never change and never depend on the part, so the frontend can lay the
    screen out before a case exists. Everything variable — which suppliers get
    researched, who gets called — is a step *inside* one of these.
    """

    INTAKE = "intake"
    ERP = "erp"
    SUPPLIERS = "suppliers"
    SCREENING = "screening"
    OUTREACH = "outreach"
    CLAIMS = "claims"
    COSTING = "costing"
    REVIEW = "review"


class PolicyRule(str, Enum):
    """The four rules. A rejection always cites one of these by name."""

    BLOCKED_ORIGIN_COUNTRY = "blocked_origin_country"
    MISSING_REQUIRED_CERTIFICATION = "missing_required_certification"
    AUDIT_REQUIRED_AND_NOT_AUDITED = "audit_required_and_not_audited"
    LEAD_TIME_AFTER_LINE_STOP = "lead_time_after_line_stop"

"""The four policy rules. Pure functions over the contracts, no I/O.

Each rule reads exactly one field of the `CompanyProfile`, so adding a part
class or blocking a country is a data change. A rejection always cites the rule
by name, because "the agent said no" is not reviewable and
"missing_required_certification: ISO_9001 lapsed 2026-03-31" is.

Two of the rules are about the supplier and one is about the order:

* `blocked_origin_country`, `missing_required_certification` and
  `audit_required_and_not_audited` disqualify a supplier outright. They are what
  `evaluate_supplier` returns, and what fills `Candidate.compliance`.
* `lead_time_after_line_stop` cannot be decided per supplier, because a supplier
  that arrives after the line stops is still a perfectly good bulk source behind
  a faster bridge order. It is therefore a property of a *strategy*, checked by
  `check_lead_time` on a single-source plan and by the day-by-day simulation in
  `supplyos_api.cost.strategy` on a split. Rejecting slow suppliers up front would
  throw away the cheapest source on the board and, on CASE-001, the only
  feasible answer with it.

Unknowns never become a silent yes. A supplier with no lead time on record and
no lead time claimed does not "probably" make it; `check_lead_time` says it
cannot be shown to make it, and says which of the two it is.
"""

from __future__ import annotations

from datetime import date

from packages.contracts.enums import Answer, AuditStatus, Criticality, PolicyRule
from packages.contracts.models import (
    Claim,
    CompanyProfile,
    ComplianceResult,
    Incident,
    Part,
    SupplierRecord,
)

# Ascending, so "at or above the threshold" is an index comparison.
CRITICALITY_ORDER: tuple[Criticality, ...] = (
    Criticality.LOW,
    Criticality.MEDIUM,
    Criticality.HIGH,
    Criticality.CRITICAL,
)


def at_or_above(level: Criticality, threshold: Criticality) -> bool:
    return CRITICALITY_ORDER.index(level) >= CRITICALITY_ORDER.index(threshold)


def evaluate_supplier(
    *,
    supplier: SupplierRecord,
    part: Part,
    profile: CompanyProfile,
    today: date,
    claim: Claim | None = None,
) -> ComplianceResult:
    """The three supplier-level rules, evaluated against our own records.

    A claim can only ever make this stricter: a supplier who says on the phone
    that its certification is not current is rejected even though our file says
    it holds one, because the file is a year old and the sales engineer is not.
    A claim that says nothing changes nothing.
    """
    failed: list[PolicyRule] = []
    why: dict[PolicyRule, str] = {}

    if supplier.country in profile.blocked_origin_countries:
        failed.append(PolicyRule.BLOCKED_ORIGIN_COUNTRY)
        why[PolicyRule.BLOCKED_ORIGIN_COUNTRY] = (
            f"{supplier.country} is on the blocked-origin list "
            f"({', '.join(profile.blocked_origin_countries)})."
        )

    required = list(profile.required_certifications.get(part.part_class, []))
    missing = [cert for cert in required if cert not in supplier.certifications]
    expires = supplier.certification_expires_at
    lapsed = required and expires is not None and expires < today
    denied_on_call = claim is not None and claim.certification_current is Answer.NO

    if missing or lapsed or denied_on_call:
        failed.append(PolicyRule.MISSING_REQUIRED_CERTIFICATION)
        if missing:
            reason = f"does not hold {', '.join(missing)}"
        elif lapsed:
            reason = f"{', '.join(required)} lapsed on {expires.isoformat()}"
        else:
            reason = "told us on the call that certification is not current"
        why[PolicyRule.MISSING_REQUIRED_CERTIFICATION] = (
            f"{part.part_class.value} requires {', '.join(required)}; {supplier.supplier_id} {reason}."
        )

    if at_or_above(part.criticality, profile.audit_required_above_criticality):
        if supplier.audit_status is not AuditStatus.AUDITED:
            failed.append(PolicyRule.AUDIT_REQUIRED_AND_NOT_AUDITED)
            why[PolicyRule.AUDIT_REQUIRED_AND_NOT_AUDITED] = (
                f"{part.item_code} is {part.criticality.value} criticality, which requires an "
                f"on-site audit; {supplier.supplier_id} is {supplier.audit_status.value}."
            )

    return ComplianceResult(passed=not failed, failed_rules=failed, explanations=why)


def lead_days(supplier: SupplierRecord, claim: Claim | None = None) -> int | None:
    """Door-to-door days we are willing to plan on, or None if nobody has said.

    A claimed lead time wins over the contract one: it is newer and it is about
    this order. `None` means unknown, which is not the same as fast.
    """
    if claim is not None and claim.lead_time_days is not None:
        return claim.lead_time_days
    return supplier.standard_lead_days


def deliverable_qty(supplier: SupplierRecord, claim: Claim | None = None) -> int:
    """What we would trust them to actually ship.

    From our records: never more than they have ever delivered for us, less what
    our files show is already promised elsewhere. A claim overrides it with what
    they actually offered — including the case the whole system exists for, where
    "yes, we have 20 000" turns out to be `in_stock_allocated` and the offer is
    for far fewer.
    """
    if claim is not None and claim.available:
        return max(claim.qty_offered, 0)
    if claim is not None and not claim.available:
        return 0
    return max(supplier.max_historical_fill - supplier.known_allocations, 0)


def check_lead_time(
    *,
    supplier: SupplierRecord,
    incident: Incident,
    today: date,
    claim: Claim | None = None,
) -> ComplianceResult:
    """The order-level rule: can this supplier alone arrive before the line stops?

    Only meaningful for a single-source plan. A split is checked by simulating
    the arrivals against the take rate instead, because there the question is
    whether the line ever runs dry, not whether one shipment is early.
    """
    days_available = (incident.line_stop_at.date() - today).days
    days = lead_days(supplier, claim)

    if days is None:
        return ComplianceResult(
            passed=False,
            failed_rules=[PolicyRule.LEAD_TIME_AFTER_LINE_STOP],
            explanations={
                PolicyRule.LEAD_TIME_AFTER_LINE_STOP: (
                    f"no lead time on record for {supplier.supplier_id} and none claimed, so it "
                    f"cannot be shown to arrive before the line stops on "
                    f"{incident.line_stop_at.date().isoformat()}."
                )
            },
        )

    if days > days_available:
        return ComplianceResult(
            passed=False,
            failed_rules=[PolicyRule.LEAD_TIME_AFTER_LINE_STOP],
            explanations={
                PolicyRule.LEAD_TIME_AFTER_LINE_STOP: (
                    f"{supplier.supplier_id} needs {days} days, which is "
                    f"{days - days_available} past the line stop on "
                    f"{incident.line_stop_at.date().isoformat()} ({days_available} days out)."
                )
            },
        )

    return ComplianceResult(passed=True)

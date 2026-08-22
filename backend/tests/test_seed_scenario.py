"""The seed data has a job: make the naive answer wrong.

Runs twice -- once per system-of-record adapter.

If the cheapest quote is also the right answer there is nothing to demo, so the
CASE-001 numbers are load-bearing and these tests are their contract. They assert
properties of the *data*, not of anyone's algorithm -- the policy evaluation and
the cost arithmetic below are the test's own deliberately-simple reading of the
company profile, written out longhand so a reader can check them by eye.

If someone retunes a price on Saturday night and quietly kills the punchline,
this goes red instead of us finding out on stage.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from packages.contracts.enums import AuditStatus, Criticality, PolicyRule
CASE = "CASE-001"
PART = "PRT-6204"

# `erp` comes from conftest.py and is parametrized over both adapters, so every
# assertion below has to hold for the YAML reference implementation *and* the
# SQL one.


@pytest.fixture
def incident(erp):
    return erp.get_incident(CASE)


@pytest.fixture
def candidates(erp):
    return erp.get_suppliers_for_part(PART)


def failed_rules(erp, supplier, part, incident) -> list[PolicyRule]:
    """The test's own reading of the company profile. Slice D owns the real one."""
    profile = erp.get_company_profile()
    today = incident.line_stop_at.date()
    rules: list[PolicyRule] = []

    if supplier.country in profile.blocked_origin_countries:
        rules.append(PolicyRule.BLOCKED_ORIGIN_COUNTRY)

    required = set(profile.required_certifications.get(part.part_class, []))
    held = set(supplier.certifications)
    expired = (
        supplier.certification_expires_at is not None
        and supplier.certification_expires_at < date(2026, 8, 22)
    )
    if not required.issubset(held) or (required and expired):
        rules.append(PolicyRule.MISSING_REQUIRED_CERTIFICATION)

    order = [Criticality.LOW, Criticality.MEDIUM, Criticality.HIGH, Criticality.CRITICAL]
    if order.index(part.criticality) >= order.index(profile.audit_required_above_criticality):
        if supplier.audit_status is not AuditStatus.AUDITED:
            rules.append(PolicyRule.AUDIT_REQUIRED_AND_NOT_AUDITED)

    if supplier.standard_lead_days is not None:
        days_available = (today - date(2026, 8, 22)).days
        if supplier.standard_lead_days > days_available:
            rules.append(PolicyRule.LEAD_TIME_AFTER_LINE_STOP)

    return rules


def deliverable_qty(supplier) -> int:
    """What we would trust them to actually ship: never more than they ever have,
    less whatever our records show is already promised elsewhere."""
    return max(supplier.max_historical_fill - supplier.known_allocations, 0)


def goods_cost(supplier, qty: int) -> Decimal:
    """Step function over the price-break tiers."""
    applicable = [b for b in supplier.price_breaks if b.min_qty <= qty]
    if not applicable:
        return (supplier.contract_unit_price or Decimal("0")) * qty
    unit = max(applicable, key=lambda b: b.min_qty).unit_price
    return unit * qty


# ---------------------------------------------------------------------------


def test_six_candidates_exist(candidates):
    assert len(candidates) == 6, "CASE-001 is built on six candidate suppliers"


def test_exactly_three_candidates_fail_policy_one_per_rule(erp, candidates, incident):
    """Every one of the four policy rules is visible in a single case.

    Three suppliers are rejected outright, each by a *different* rule, so the
    supplier board shows three differently-worded rejections rather than three
    copies of the same one. The fourth rule fires against the cheapest supplier
    the moment anyone tries to single-source it (see the lead-time test below).
    """
    part = erp.get_part(PART)
    rejected = {
        s.supplier_id: failed_rules(erp, s, part, incident)
        for s in candidates
        if failed_rules(erp, s, part, incident)
    }

    hard_failures = {
        sid: rules for sid, rules in rejected.items()
        if set(rules) - {PolicyRule.LEAD_TIME_AFTER_LINE_STOP}
    }
    assert len(hard_failures) == 3, f"expected 3 hard rejections, got {hard_failures}"

    fired = {r for rules in hard_failures.values() for r in rules if r is not PolicyRule.LEAD_TIME_AFTER_LINE_STOP}
    assert fired == {
        PolicyRule.BLOCKED_ORIGIN_COUNTRY,
        PolicyRule.MISSING_REQUIRED_CERTIFICATION,
        PolicyRule.AUDIT_REQUIRED_AND_NOT_AUDITED,
    }, f"each rejection should cite a different rule, got {fired}"


def test_on_hand_cover_is_exactly_twelve_days(erp, incident):
    """The stock number and the line-stop date must agree, or the countdown lies."""
    stock = erp.get_stock(PART, incident.plant_id)[0]
    cover_days = stock.actual_qty / stock.daily_consumption
    assert cover_days == pytest.approx(12.0)
    assert (incident.line_stop_at.date() - date(2026, 8, 22)).days == 12


def test_the_shortage_is_triggered_by_a_real_po_slip(erp):
    """The detector has something true to detect."""
    delayed = [po for po in erp.get_open_pos(PART) if po.is_delayed]
    assert delayed, "CASE-001 needs a slipped PO to be the trigger"
    assert delayed[0].revised_date > date(2026, 9, 3), "the slip must land past the line stop"


def test_cheapest_compliant_supplier_cannot_beat_the_line_stop(erp, candidates, incident):
    """Invariant 1 -- the naive answer is provably wrong.

    Sorting by unit price and taking the top row is what a chatbot does. Here
    that row arrives nine days after the line has already stopped.
    """
    part = erp.get_part(PART)
    compliant = [
        s for s in candidates
        if not (set(failed_rules(erp, s, part, incident)) - {PolicyRule.LEAD_TIME_AFTER_LINE_STOP})
    ]
    cheapest = min(compliant, key=lambda s: goods_cost(s, incident.qty_required))
    days_available = (incident.line_stop_at.date() - date(2026, 8, 22)).days

    assert cheapest.standard_lead_days > days_available, (
        f"{cheapest.supplier_id} is the cheapest and also fast enough -- "
        "there is no trade-off left to demo"
    )
    downtime_hours = (cheapest.standard_lead_days - days_available) * 24
    downtime_cost = incident.line_stop_cost_per_hour * downtime_hours
    assert downtime_cost > Decimal("1000000"), (
        "the cost of getting this wrong should be obviously catastrophic on a slide"
    )


def test_no_single_supplier_can_both_cover_the_quantity_and_beat_the_date(erp, candidates, incident):
    """Invariant 2 -- a split is not merely cheaper, it is the only feasible answer.

    Each supplier fails on one axis or the other: the fast ones are capacity- or
    allocation-limited, and the one with the capacity arrives too late.
    """
    part = erp.get_part(PART)
    days_available = (incident.line_stop_at.date() - date(2026, 8, 22)).days

    for supplier in candidates:
        if set(failed_rules(erp, supplier, part, incident)) - {PolicyRule.LEAD_TIME_AFTER_LINE_STOP}:
            continue  # policy already rejected them
        covers_qty = deliverable_qty(supplier) >= incident.qty_required
        beats_date = (supplier.standard_lead_days or 999) <= days_available
        assert not (covers_qty and beats_date), (
            f"{supplier.supplier_id} single-sources the whole case -- the split beat is gone"
        )


def test_the_smart_split_beats_the_obvious_one_by_a_visible_margin(erp, incident):
    """Invariant 3 -- the comparison table has a punchline.

    The obvious split buys as much as possible from the fast suppliers. The smart
    one buys only enough fast stock to bridge the gap until the cheap shipment
    lands, and puts everything else on the cheap line. Same date met, materially
    less money.
    """
    kby, skf, rul = (erp.get_supplier(s) for s in ("SUP-KBY", "SUP-SKF", "SUP-RUL"))
    stock = erp.get_stock(PART, incident.plant_id)[0]
    qty = incident.qty_required

    # Bridge: cover consumption from the line-stop date until the cheap order lands.
    gap_days = rul.standard_lead_days - (incident.line_stop_at.date() - date(2026, 8, 22)).days
    bridge_qty = -(-gap_days * stock.daily_consumption // 1000) * 1000  # round up to a 1 000 lot
    smart = goods_cost(kby, bridge_qty) + goods_cost(rul, qty - bridge_qty)

    # Obvious: take everything the fast suppliers will give, cheap line covers the rest.
    fast_kby, fast_skf = deliverable_qty(kby), deliverable_qty(skf)
    obvious = (
        goods_cost(kby, fast_kby)
        + goods_cost(skf, fast_skf)
        + goods_cost(rul, qty - fast_kby - fast_skf)
    )

    saving = (obvious - smart) / obvious
    assert saving >= Decimal("0.08"), (
        f"smart split {smart} vs obvious split {obvious} is only {saving:.1%} better -- "
        "not enough of a punchline to put on a slide"
    )


def test_price_breaks_have_enough_spread_to_matter(erp, candidates):
    """A quantity break the cost engine cannot feel is decoration."""
    for supplier in candidates:
        if len(supplier.price_breaks) < 2:
            continue
        prices = [b.unit_price for b in supplier.price_breaks]
        spread = (max(prices) - min(prices)) / max(prices)
        assert spread >= Decimal("0.10"), (
            f"{supplier.supplier_id} price breaks span only {spread:.1%}"
        )


def test_every_seeded_phone_number_is_masked_on_the_record(erp):
    """The record model has no field for a raw number, and the masked one is masked."""
    for supplier in erp.list_suppliers():
        dumped = supplier.model_dump()
        assert "phone" not in dumped
        assert "*" in supplier.phone_masked

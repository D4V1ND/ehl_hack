"""Deterministic fake quotes.

Seeded from task_id, so the same task always produces the same quote and
`make demo` is reproducible across rehearsals. Tuned so the cheapest unit
price is NOT always the cheapest landed cost — the cost model in Slice D
needs a real problem to solve, not an obvious one.

No network. No delay. This is a pure function; the delay lives in the
provider so consumers are forced to build against the async shape.
"""

from __future__ import annotations

import random
from decimal import Decimal

from packages.contracts.models import (
    Currency,
    ExpediteOption,
    OutreachTask,
    PriceBreak,
    Quote,
)

_INCOTERMS = ["EXW", "FCA", "DAP", "DDP"]
_CERTS = ["ISO 9001", "IATF 16949", "DIN 625"]
_PAYMENT = ["30 days net", "60 days net", "prepayment"]


def make_fake_quote(task: OutreachTask) -> Quote:
    rng = random.Random(task.task_id)

    # 1 in 5 suppliers cannot help at all.
    if rng.random() < 0.20:
        return Quote(
            task_id=task.task_id,
            case_id=task.case_id,
            supplier_ref=task.supplier_ref,
            available=False,
            notes="Cannot supply this part in the requested window.",
            confidence=round(rng.uniform(0.80, 0.98), 2),
            raw={"source": "fake"},
        )

    qty = task.brief.qty
    floor = task.brief.floor_price or Decimal("2.50")

    # Base price spreads widely around the floor: OEM vs generic is ~10x in
    # the bearing market, so make the ranking genuinely non-obvious.
    multiplier = Decimal(str(round(rng.uniform(0.72, 1.45), 3)))
    base = (floor * multiplier).quantize(Decimal("0.01"))

    price_breaks = _make_breaks(rng, base, qty)

    # Some suppliers cannot cover the full requirement — this is what makes
    # a split order the right answer.
    qty_offered = qty if rng.random() < 0.65 else int(qty * rng.uniform(0.35, 0.85))

    lead_time = rng.choice([7, 10, 14, 18, 21, 28, 35, 45])

    expedite = None
    if rng.random() < 0.55:
        expedite = ExpediteOption(
            days=rng.choice([3, 5, 7]),
            surcharge=(base * qty_offered * Decimal("0.08")).quantize(Decimal("0.01")),
        )

    return Quote(
        task_id=task.task_id,
        case_id=task.case_id,
        supplier_ref=task.supplier_ref,
        available=True,
        qty_offered=qty_offered,
        unit_price=base,
        price_breaks=price_breaks,
        currency=Currency.EUR,
        moq=rng.choice([100, 250, 500, 1000, 2500]),
        lead_time_days=lead_time,
        expedite_option=expedite,
        incoterm=rng.choice(_INCOTERMS),
        certs_claimed=rng.sample(_CERTS, k=rng.randint(1, len(_CERTS))),
        payment_terms=rng.choice(_PAYMENT),
        notes="Fake quote. FAKE_CALLS=1.",
        confidence=round(rng.uniform(0.72, 0.97), 2),
        raw={"source": "fake", "seed": task.task_id},
    )


def _make_breaks(rng: random.Random, base: Decimal, qty: int) -> list[PriceBreak]:
    """Quantity breaks that straddle the requested qty, so buying MORE than
    needed can legitimately be cheaper — that's the trade-off the cost model
    has to resolve against carrying cost."""
    tiers = [1, max(100, qty // 10), max(500, qty // 2), qty, qty * 2]
    breaks: list[PriceBreak] = []
    discount = Decimal("1.00")
    for tier in sorted(set(tiers)):
        breaks.append(
            PriceBreak(
                min_qty=tier,
                unit_price=(base * discount).quantize(Decimal("0.001")),
            )
        )
        discount -= Decimal(str(round(rng.uniform(0.04, 0.11), 3)))
        discount = max(discount, Decimal("0.55"))
    return breaks

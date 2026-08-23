"""Rehearsal quotes anchored on the supplier record, not on a random draw.

`outreach.fake` exists to prove the async shape of a call and deliberately
invents wide, unrelated numbers. That is the wrong input for a rehearsal of a
*decision*: a supplier whose file says 10-day lead and EUR 1.42 must not answer
the phone quoting EUR 3.22 and refusing to supply, or the run stops being a
rehearsal of anything.

So a rehearsal quote is the record plus plausible drift, seeded by supplier id so
every run is identical:

- price drifts a little off the contract price (nobody quotes it exactly),
- lead time slips by a few days (nobody beats their own standard),
- the quantity offered is what they have actually filled before, minus what our
  records already show promised elsewhere.

The last line is where the interesting answer comes from: a supplier whose stock
is largely allocated offers less than we asked for, and `claim_from_quote` reads
that back as `in_stock_allocated`.
"""

from __future__ import annotations

import random
from decimal import Decimal

from packages.contracts.models import (
    Currency,
    ExpediteOption,
    Incident,
    OutreachTask,
    Part,
    PriceBreak,
    Quote,
    SupplierRecord,
)
from packages.contracts.money import quantize_unit


def rehearsed_quote(
    task: OutreachTask,
    *,
    supplier: SupplierRecord,
    incident: Incident,
    part: Part | None = None,
) -> Quote:
    rng = random.Random(f"{task.case_id}:{supplier.supplier_id}")

    base = supplier.contract_unit_price or Decimal("2.50")
    quoted = quantize_unit(base * Decimal(str(round(rng.uniform(0.98, 1.14), 4))))

    lead = (supplier.standard_lead_days or 21) + rng.choice([0, 1, 2, 3])

    capacity = supplier.max_historical_fill or incident.qty_required
    offered = max(capacity - supplier.known_allocations, 0)
    offered = min(offered, incident.qty_required)
    # A supplier with nothing free still answers the phone; they just answer no.
    available = offered > 0

    expedite: ExpediteOption | None = None
    if available and lead > 7 and rng.random() < 0.7:
        expedite = ExpediteOption(
            days=max(lead - rng.choice([3, 4, 5]), 2),
            surcharge=quantize_unit(quoted * Decimal(offered) * Decimal("0.06")),
        )

    breaks = [
        PriceBreak(min_qty=pb.min_qty, unit_price=quantize_unit(pb.unit_price * Decimal("1.02")))
        for pb in supplier.price_breaks
    ]

    item_code = part.item_code if part else incident.part_id
    notes = (
        f"Confirmed {item_code}; can ship {offered:,} pcs in {lead} days."
        if available
        else f"Confirmed {item_code}; nothing free before {incident.needed_by}."
    )

    return Quote(
        task_id=task.task_id,
        case_id=task.case_id,
        supplier_ref=supplier.supplier_id,
        available=available,
        qty_offered=offered,
        unit_price=quoted if available else None,
        price_breaks=breaks if available else [],
        currency=Currency.EUR,
        moq=1000,
        lead_time_days=lead if available else None,
        expedite_option=expedite,
        incoterm="DAP",
        certs_claimed=list(supplier.certifications),
        payment_terms="30 days net",
        notes=notes,
        confidence=round(rng.uniform(0.72, 0.94), 2),
        raw={"source": "rehearsal", "anchored_on": "supplier record"},
    )

"""What one order line actually costs, at the gate, in cash.

The unit price on the phone is not the cost of the part. This module adds the
four things that routinely reorder the ranking, and shows its work:

    goods    price-break tier that the ordered quantity actually reaches
    freight  shipped weight x per-kg rate for the mode
    duty     ad valorem on goods+freight, by origin country
    carrying capital tied up plus pallet-months, for stock we hold before use

Everything is `Decimal`, parsed from strings. There is no float in this file,
because a tenth of a cent on 36 000 pieces is real money and a float cent error
is invisible in a demo and fatal in a quarter-end reconciliation.

Freight modes: `standard_lead_days` on a supplier record is door-to-door on the
mode we normally use with them, so the arrival date for that mode needs no
transit addition. Upgrading to air pulls the arrival in by the difference in
transit days from the profile and swaps the per-kg rate — that is the only place
the `transit_days` table is used, and it is why air is sometimes worth it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from packages.contracts.enums import FreightMode
from packages.contracts.models import (
    Claim,
    CompanyProfile,
    LandedCost,
    Part,
    PriceBreak,
    SupplierRecord,
)
from packages.contracts.money import quantize_total, quantize_unit

DAYS_PER_YEAR = Decimal("365")
DAYS_PER_MONTH = Decimal("30")

# Suppliers we truck to. Everyone else ships by sea unless we pay for air.
ROAD_REACHABLE = frozenset(
    {
        "DE", "AT", "BE", "BG", "CH", "CZ", "DK", "EE", "ES", "FI", "FR", "GB",
        "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "NL", "NO", "PL", "PT",
        "RO", "RS", "SE", "SI", "SK", "TR", "UA",
    }
)


def default_mode(country: str) -> FreightMode:
    return FreightMode.ROAD if country in ROAD_REACHABLE else FreightMode.SEA


def available_modes(country: str) -> tuple[FreightMode, ...]:
    """The mode we normally use, plus air as the expensive way to buy days."""
    return (default_mode(country), FreightMode.AIR)


def unit_price(
    breaks: list[PriceBreak], qty: int, fallback: Decimal | None = None
) -> Decimal:
    """The tier the quantity actually reaches. A step function, not a curve.

    Below the smallest tier nobody has quoted a price, so the contract price is
    the honest answer; with neither, this is zero and the caller is pricing a
    supplier who has told us nothing.
    """
    applicable = [b for b in breaks if b.min_qty <= qty]
    if applicable:
        return max(applicable, key=lambda b: b.min_qty).unit_price
    return fallback if fallback is not None else Decimal("0")


def eta(
    *,
    supplier: SupplierRecord,
    profile: CompanyProfile,
    mode: FreightMode,
    today: date,
    claim: Claim | None = None,
    expedited: bool = False,
) -> date:
    """When the goods are on our dock.

    Claimed lead time beats the contract one. Air buys back the difference
    between its transit and the default mode's; an accepted expedite option buys
    back its own days on top.
    """
    days = supplier.standard_lead_days
    if claim is not None and claim.lead_time_days is not None:
        days = claim.lead_time_days
    if days is None:
        raise ValueError(f"no lead time for {supplier.supplier_id}; check policy first")

    base = default_mode(supplier.country)
    if mode is not base:
        saved = profile.transit_days.get(base, 0) - profile.transit_days.get(mode, 0)
        days = max(days - max(saved, 0), 1)

    if expedited and claim is not None and claim.expedite_option is not None:
        days = max(days - claim.expedite_option.days, 1)

    return today + timedelta(days=days)


@dataclass(frozen=True)
class Line:
    """The inputs to one priced order line, resolved from record plus claim."""

    supplier: SupplierRecord
    qty: int
    mode: FreightMode
    eta: date
    expedited: bool = False
    claim: Claim | None = None


def landed_cost(
    *,
    line: Line,
    part: Part,
    profile: CompanyProfile,
    needed_by: date,
    daily_consumption: int,
) -> LandedCost:
    """Price one line to the gate, with a markdown breakdown a buyer can audit."""
    supplier, qty, mode = line.supplier, line.qty, line.mode
    claim = line.claim

    breaks = claim.price_breaks if claim is not None and claim.price_breaks else supplier.price_breaks
    fallback = (
        claim.unit_price
        if claim is not None and claim.unit_price is not None
        else supplier.contract_unit_price
    )
    unit = unit_price(list(breaks), qty, fallback)
    goods = quantize_total(unit * qty)

    weight_kg = Decimal(str(part.weight_kg)) * qty
    freight_rate = profile.freight_eur_per_kg.get(mode, Decimal("0"))
    freight = quantize_total(weight_kg * freight_rate)

    duty_rate = Decimal(str(profile.duty_rates.get(supplier.country, 0.0)))
    duty = quantize_total((goods + freight) * duty_rate)

    # Carrying cost. Stock that lands before it is consumed ties up capital and
    # floor space; the average piece in a lot of `qty` waits half the time the
    # lot takes to burn down, which is what makes a big price break sometimes
    # not worth taking.
    burn_days = Decimal(qty) / Decimal(max(daily_consumption, 1))
    early_days = Decimal(max((needed_by - line.eta).days, 0))
    holding_days = early_days + burn_days / Decimal("2")
    capital = (goods + freight + duty) * Decimal(str(profile.wacc)) * holding_days / DAYS_PER_YEAR
    pallets = -(-qty // profile.pieces_per_pallet)  # ceil
    warehousing = (
        Decimal(pallets) * profile.warehousing_eur_per_pallet_month * holding_days / DAYS_PER_MONTH
    )
    carrying = quantize_total(capital + warehousing)

    surcharge = Decimal("0")
    if line.expedited and claim is not None and claim.expedite_option is not None:
        surcharge = claim.expedite_option.surcharge
    expedite = quantize_total(surcharge)

    total = quantize_total(goods + freight + duty + carrying + expedite)
    return LandedCost(
        supplier_ref=supplier.supplier_id,
        qty=qty,
        mode=mode,
        goods_cost=goods,
        freight=freight,
        duty=duty,
        tooling=Decimal("0"),
        carrying_cost=carrying,
        expedite_surcharge=expedite,
        total=total,
        unit_effective=quantize_unit(total / Decimal(qty)) if qty else Decimal("0"),
        breakdown_md=_breakdown_md(
            supplier=supplier,
            qty=qty,
            unit=unit,
            mode=mode,
            eta=line.eta,
            goods=goods,
            freight=freight,
            freight_rate=freight_rate,
            weight_kg=weight_kg,
            duty=duty,
            duty_rate=duty_rate,
            carrying=carrying,
            holding_days=holding_days,
            pallets=pallets,
            expedite=expedite,
            total=total,
        ),
    )


def _breakdown_md(
    *,
    supplier: SupplierRecord,
    qty: int,
    unit: Decimal,
    mode: FreightMode,
    eta: date,
    goods: Decimal,
    freight: Decimal,
    freight_rate: Decimal,
    weight_kg: Decimal,
    duty: Decimal,
    duty_rate: Decimal,
    carrying: Decimal,
    holding_days: Decimal,
    pallets: int,
    expedite: Decimal,
    total: Decimal,
) -> str:
    rows = [
        f"| goods | {qty:,} x EUR {unit} | {goods} |",
        f"| freight ({mode.value}) | {weight_kg:.1f} kg x EUR {freight_rate}/kg | {freight} |",
        f"| duty ({supplier.country}) | {duty_rate:.1%} of goods+freight | {duty} |",
        f"| carrying | {holding_days:.0f} days, {pallets} pallet(s) | {carrying} |",
    ]
    if expedite:
        rows.append(f"| expedite | accepted surcharge | {expedite} |")
    body = "\n".join(rows)
    return (
        f"**{supplier.supplier_name}** — {qty:,} pcs, {mode.value}, ETA {eta.isoformat()}\n\n"
        "| component | basis | EUR |\n| --- | --- | --- |\n"
        f"{body}\n| **landed total** | | **{total}** |\n"
    )

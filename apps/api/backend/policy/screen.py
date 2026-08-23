"""Turn the supplier list for a part into screened `Candidate`s.

Thin on purpose: `rules` decides, this walks the list and keeps the deterministic
order the system of record handed back, so the supplier board reads the same way
on every run.
"""

from __future__ import annotations

from datetime import date

from packages.contracts.models import (
    Candidate,
    Channel,
    Claim,
    CompanyProfile,
    Part,
    SupplierRecord,
)
from backend.policy.rules import evaluate_supplier


def preferred_channel(supplier: SupplierRecord) -> Channel:
    """Voice if we can call them, else email, else the marketplace.

    CALL-E has no CN region, so a Chinese supplier routes to email — the channel
    follows what is reachable, never what is convenient.
    """
    for channel in (Channel.VOICE, Channel.EMAIL, Channel.MARKETPLACE):
        if channel in supplier.channels:
            return channel
    return Channel.EMAIL


def why_matched(supplier: SupplierRecord, part: Part) -> str:
    bits = [f"approved for {part.item_code}"]
    if supplier.incumbent:
        bits.append("incumbent")
    if supplier.preferred:
        bits.append("preferred")
    if supplier.contract_unit_price is not None:
        bits.append(f"contract EUR {supplier.contract_unit_price}/pc")
    if supplier.standard_lead_days is not None:
        bits.append(f"{supplier.standard_lead_days}d door-to-door")
    return ", ".join(bits)


def screen(
    *,
    case_id: str,
    suppliers: list[SupplierRecord],
    part: Part,
    profile: CompanyProfile,
    today: date,
    claims: dict[str, Claim] | None = None,
) -> list[Candidate]:
    claims = claims or {}
    candidates: list[Candidate] = []
    for supplier in suppliers:
        claim = claims.get(supplier.supplier_id)
        compliance = evaluate_supplier(
            supplier=supplier, part=part, profile=profile, today=today, claim=claim
        )
        candidates.append(
            Candidate(
                case_id=case_id,
                supplier_ref=supplier.supplier_id,
                supplier_name=supplier.supplier_name,
                country=supplier.country,
                # Our own file, not a guess: a claim carries the call's own
                # confidence, and without one this is what the record is worth.
                confidence=claim.confidence if claim is not None else 0.9,
                why_matched=why_matched(supplier, part),
                channel=preferred_channel(supplier),
                source="erp",
                compliance=compliance,
            )
        )
    return candidates

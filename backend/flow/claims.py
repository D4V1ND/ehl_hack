"""A quote becomes a claim: what was offered, plus what the call established.

`Quote` is the offer. `Claim` adds the answer sheet -- is that stock actually free,
is the certification current, was the part number confirmed -- and those fields are
*derived*, never invented. Where a quote is silent the answer stays `unknown`,
because an unknown that reads as a yes is how a line stops twice.

The interesting derivation is stock status: a supplier who offers less than we
asked for, out of stock they say they hold, is describing stock that is already
promised to somebody else. That is `in_stock_allocated`, and it is the single fact
that most changes what we order.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from packages.contracts.enums import Answer, StockStatus
from packages.contracts.models import Claim, Part, Quote, SupplierRecord


def _certification_current(
    quote: Quote, supplier: SupplierRecord | None, today: date
) -> tuple[Answer, str]:
    """Only the supplier's own answer can confirm this; our file can only doubt it."""
    if supplier is None:
        return Answer.UNKNOWN, "no supplier record to check the certificate against"

    expires = supplier.certification_expires_at
    if expires is not None and expires < today:
        return Answer.NO, f"our file shows certification expired {expires}"
    if quote.certs_claimed:
        return Answer.YES, f"named on the call: {', '.join(quote.certs_claimed)}"
    return Answer.UNKNOWN, "certification was not discussed"


def _stock_status(quote: Quote, qty_requested: int) -> tuple[StockStatus, str]:
    if not quote.available:
        return StockStatus.UNAVAILABLE, "cannot supply in the requested window"
    if quote.lead_time_days is not None and quote.lead_time_days >= 21:
        return StockStatus.TO_BE_MADE, f"quoted a {quote.lead_time_days}-day lead time"
    if 0 < quote.qty_offered < qty_requested:
        return (
            StockStatus.IN_STOCK_ALLOCATED,
            f"offered {quote.qty_offered:,} of {qty_requested:,} — the rest is committed elsewhere",
        )
    return StockStatus.FREE_IN_STOCK, "offered the full quantity from stock"


def claim_from_quote(
    quote: Quote,
    *,
    qty_requested: int,
    part: Part | None = None,
    supplier: SupplierRecord | None = None,
    today: date | None = None,
    round_: int = 1,
    call_id: str | None = None,
) -> Claim:
    """Never raises. A silent quote becomes a claim full of `unknown`."""
    today = today or date.today()

    stock_status, stock_note = _stock_status(quote, qty_requested)
    certification, cert_note = _certification_current(quote, supplier, today)

    part_number_confirmed = Answer.UNKNOWN
    part_note = "part number was not read back"
    if part is not None and part.item_code.lower() in (quote.notes or "").lower():
        part_number_confirmed = Answer.YES
        part_note = f"read {part.item_code} back on the call"

    price_quoted = Answer.YES if quote.unit_price is not None else Answer.UNKNOWN

    return Claim(
        **quote.model_dump(),
        round=round_,
        call_id=call_id,
        stock_status=stock_status,
        price_quoted=price_quoted,
        part_number_confirmed=part_number_confirmed,
        certification_current=certification,
        earliest_ready_text=(
            f"{quote.lead_time_days} days" if quote.lead_time_days is not None else ""
        ),
        evidence=[stock_note, cert_note, part_note],
        received_at=datetime.now(timezone.utc),
    )

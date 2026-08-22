"""Money is exact decimal arithmetic, never float.

A float cent error is invisible in a demo and fatal in procurement. Every price,
surcharge and total in the contracts is a `Decimal`, parsed from a string, and
serialized back to a string in JSON so it survives the round trip through the UI
without ever touching a binary float.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Any

from pydantic import BeforeValidator, PlainSerializer

# Unit prices carry four places (a tenth of a cent matters at 36 000 pcs);
# totals settle at two.
UNIT_PLACES = Decimal("0.0001")
TOTAL_PLACES = Decimal("0.01")


def to_decimal(value: Any) -> Decimal:
    """Parse anything money-shaped into an exact Decimal.

    Floats are routed through `str()` first, so a value that arrives as 1.55 from
    JSON becomes Decimal("1.55") and not Decimal("1.5500000000000000444089...").
    """
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, (int, str)):
        return Decimal(str(value).strip())
    raise TypeError(f"cannot read {value!r} as money")


def quantize_unit(value: Decimal) -> Decimal:
    return to_decimal(value).quantize(UNIT_PLACES, rounding=ROUND_HALF_UP)


def quantize_total(value: Decimal) -> Decimal:
    return to_decimal(value).quantize(TOTAL_PLACES, rounding=ROUND_HALF_UP)


# `Money` is the type every price field uses: exact in, string out.
Money = Annotated[
    Decimal,
    BeforeValidator(to_decimal),
    PlainSerializer(lambda v: format(v, "f"), return_type=str, when_used="json"),
]

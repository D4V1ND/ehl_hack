"""The answer sheet handed to CALL-E as `recipient_result_schema`.

**Why this is written by hand instead of generated from `Quote`.**

`Quote.model_json_schema()` is a *validation* schema: Pydantic expresses an
optional Decimal as `anyOf: [number, string, null]` with a regex `pattern`, and
nested models as `$ref` into `$defs`. CALL-E's structured-result engine accepts
only a small JSON Schema subset and answers

    400 recipient_result_schema_invalid
        unsupported JSON Schema keyword at $.properties.unit_price: anyOf

so handing it the generated schema means the call is never placed. The
supported subset, confirmed against the live API, is: `type`, `properties`,
`required`, `additionalProperties`, `description`, `enum`, `items`, and nested
objects. No `anyOf`, no `$ref`/`$defs`, no `default`, no `pattern`, no `null`
type.

So this is the *question sheet a person on a phone can answer*, not a mirror of
our storage model. `test_schemas.py` keeps it honest: every property here must
be a real field of `Quote` or `Claim`, so the two cannot drift apart silently.

Two deliberate shapes:

* **Money travels as a string.** A JSON number would arrive as a float and
  Decimal-ise from a value that has already lost precision; a decimal written
  as text does not. `normalize.py` and `safe.py` parse it, and an empty string
  or "unknown" becomes `None` rather than a wrong number.
* **Nothing is required. Not one field.** Learned on a real call and merged from
  main: when CALL-E cannot satisfy `required` it returns no `structured_result`
  at all, throwing away every answer it *did* capture. An omitted key is how
  "unknown" stays a first-class answer, and `normalize.py` already reads a
  missing field as unknown rather than as a 0 that would say "ships today".
"""

from __future__ import annotations

_MONEY = "written as a plain decimal, e.g. 1.85 — empty string if not quoted"

_YES_NO_UNKNOWN = ["yes", "no", "unknown"]


def quote_result_schema() -> dict:
    """The JSON Schema CALL-E validates each call result against."""
    return {
        "type": "object",
        "properties": {
            "available": {
                "type": "boolean",
                "description": "true if they can supply any quantity of this part at all",
            },
            "qty_offered": {
                "type": "integer",
                "description": "how many units they can supply; 0 if none or not stated",
            },
            "stock_status": {
                "type": "string",
                "enum": [
                    "free_in_stock",
                    "in_stock_allocated",
                    "to_be_made",
                    "unavailable",
                    "unclear",
                ],
                "description": (
                    "the most important answer: physically in stock and free "
                    "(free_in_stock), in stock but already promised to "
                    "another customer (in_stock_allocated), still to be made "
                    "(to_be_made), cannot supply (unavailable), or they "
                    "did not say (unclear)"
                ),
            },
            "earliest_ready_text": {
                "type": "string",
                "description": "when they said it could ship or be collected, in their own words",
            },
            "price_quoted": {
                "type": "string",
                "enum": _YES_NO_UNKNOWN,
                "description": "did they actually name a price on this call",
            },
            "unit_price": {
                "type": "string",
                "description": f"price per unit at the quantity we asked for, {_MONEY}",
            },
            "currency": {
                "type": "string",
                "enum": ["EUR", "USD", "GBP", "unknown"],
                "description": "currency of the quoted price; unknown if they did not say",
            },
            "price_breaks": {
                "type": "array",
                "description": "quantity price breaks they named, one entry per break",
                "items": {
                    "type": "object",
                    "properties": {
                        "min_qty": {
                            "type": "integer",
                            "description": "buy at least this many units",
                        },
                        "unit_price": {
                            "type": "string",
                            "description": f"price per unit at that quantity, {_MONEY}",
                        },
                    },
                    "required": ["min_qty", "unit_price"],
                    "additionalProperties": False,
                },
            },
            "moq": {
                "type": "integer",
                "description": "minimum order quantity; omit if they did not state one",
            },
            "lead_time_days": {
                "type": "integer",
                "description": "lead time in days; omit if they did not state one",
            },
            "expedite_option": {
                "type": "object",
                "description": "only if they offered to pull the date in for a surcharge",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "how many days earlier delivery would be",
                    },
                    "surcharge": {
                        "type": "string",
                        "description": f"total surcharge for expediting, {_MONEY}",
                    },
                },
                "required": ["days", "surcharge"],
                "additionalProperties": False,
            },
            "incoterm": {
                "type": "string",
                "description": "incoterm such as EXW, FCA, DAP; empty string if not stated",
            },
            "payment_terms": {
                "type": "string",
                "description": "payment terms such as net 30; empty string if not stated",
            },
            "certification_current": {
                "type": "string",
                "enum": _YES_NO_UNKNOWN,
                "description": "is their quality certification for this part currently valid",
            },
            "certs_claimed": {
                "type": "array",
                "items": {"type": "string"},
                "description": "the certifications they named, e.g. ISO 9001, IATF 16949",
            },
            "part_number_confirmed": {
                "type": "string",
                "enum": _YES_NO_UNKNOWN,
                "description": "did they read the exact part number back to us",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

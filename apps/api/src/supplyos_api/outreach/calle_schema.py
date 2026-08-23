"""JSON Schema export for CALL-E's `recipient_result_schema`.

This provider DTO is intentionally separate from the canonical `Quote` domain
model: CALL-E's schema validator supports a restricted JSON Schema subset and
rejects `anyOf`. Pydantic renders every `X | None` and Decimal field as
`anyOf`, so that output cannot be reused as-is. Optional fields are omitted
from `required`; a supplier who does not know an answer leaves the key out,
which `normalize_result` already treats as unknown.
"""

from __future__ import annotations


def call_result_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "available": {"type": "boolean"},
            "qty_offered": {"type": "integer"},
            "unit_price": {"type": "number"},
            "price_breaks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "min_qty": {"type": "integer"},
                        "unit_price": {"type": "number"},
                    },
                    "required": ["min_qty", "unit_price"],
                },
            },
            "currency": {"type": "string", "enum": ["EUR", "USD", "GBP", "unknown"]},
            "moq": {"type": "integer"},
            "lead_time_days": {"type": "integer"},
            "expedite_option": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer"},
                    "surcharge": {"type": "number"},
                },
                "required": ["days", "surcharge"],
            },
            "incoterm": {"type": "string"},
            "certs_claimed": {"type": "array", "items": {"type": "string"}},
            "payment_terms": {"type": "string"},
        },
        # Nothing is required. A supplier who never states availability or a
        # lead time is normal, and CALL-E returns NO structured_result at all
        # when it cannot satisfy `required` — losing every field it did
        # capture. "Unknown is a first-class answer" (CLAUDE.md), and
        # normalize_result already defaults missing fields to unknown/zero
        # with confidence 0, so a partial answer is worth more than nothing.
        "required": [],
        "additionalProperties": False,
    }

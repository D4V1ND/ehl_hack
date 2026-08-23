"""Restricted JSON Schemas accepted by CALL-E's plan compiler.

Pydantic's full ``Quote`` schema contains ``anyOf`` and nested structures that
CALL-E rejects. The provider needs a small, flat answer sheet with explicit
unknown values and required fields; normalization then maps that transport DTO
into the richer domain model.
"""

from __future__ import annotations

_YES_NO = {"type": "string", "enum": ["yes", "no", "unknown"]}


def call_task_schema() -> dict:
    """Minimal task-level schema without CALL-E's reserved field names."""
    return {
        "type": "object",
        "required": ["sourcing_complete"],
        "properties": {
            "sourcing_complete": {
                **_YES_NO,
                "description": (
                    "yes if the recipient answered the sourcing questions, "
                    "no if they refused or the call did not connect, "
                    "unknown if the evidence is unclear."
                ),
            },
        },
        "additionalProperties": False,
    }


def call_result_schema() -> dict:
    """The flat supplier answer sheet sent as CALL-E's ``result_schema``."""
    return {
        "type": "object",
        "required": ["part_available", "qty_offered", "unit_price", "lead_time_days"],
        "properties": {
            "part_available": {
                **_YES_NO,
                "description": (
                    "Whether they have this part to sell. unknown if they did not say."
                ),
            },
            "qty_offered": {
                "type": "integer",
                "description": "Units offered. Use 0 if they did not state a quantity.",
            },
            "unit_price": {
                "type": "string",
                "description": (
                    "Unit price as stated, or an empty string if they did not quote a price."
                ),
            },
            "currency": {
                "type": "string",
                "enum": ["EUR", "USD", "GBP", "unknown"],
                "description": "Currency of the unit price. unknown if they did not say.",
            },
            "moq": {
                "type": "integer",
                "description": "Minimum order quantity. Use 0 if they did not state one.",
            },
            "lead_time_days": {
                "type": "integer",
                "description": "Lead time in days. Use 0 if they did not state one.",
            },
            "incoterm": {
                "type": "string",
                "description": "Incoterm they named, or an empty string if none.",
            },
            "certs_claimed": {
                "type": "string",
                "description": (
                    "Quality certifications they claimed, comma-separated, "
                    "or an empty string if none."
                ),
            },
            "payment_terms": {
                "type": "string",
                "description": "Payment terms they named, or an empty string if none.",
            },
        },
        "additionalProperties": False,
    }

"""JSON Schema export for CALL-E's `result_schema` and `recipient_result_schema`.

Field list is kept in sync with the Quote model by hand rather than by
calling Quote.model_json_schema() directly: CALL-E's schema validator
rejects `anyOf` (Pydantic renders every `X | None` and Decimal that way).

CALL-E's planner compiles the schema into a call plan. Their docs want a
small schema, string enums with `unknown`, and `required` fields the
workflow always expects. Nested objects and an empty `required` list made
the planner fail with "The call plan could not be prepared."

`normalize_result` still defaults missing Quote fields (price breaks,
expedite) to unknown / empty.
"""

from __future__ import annotations

_YES_NO = {"type": "string", "enum": ["yes", "no", "unknown"]}


def call_task_schema() -> dict:
    """Task-level schema. CALL-E's create examples always send this.
    Reserved names (summary, status, transcript, call_id) are avoided."""
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


def quote_result_schema() -> dict:
    return {
        "type": "object",
        "required": ["part_available", "qty_offered", "unit_price", "lead_time_days"],
        "properties": {
            "part_available": {
                **_YES_NO,
                "description": (
                    "Whether they have this part to sell. unknown if they "
                    "did not say."
                ),
            },
            "qty_offered": {
                "type": "integer",
                "description": "Units offered. Use 0 if they did not state a quantity.",
            },
            "unit_price": {
                "type": "string",
                "description": "Unit price as stated, or an empty string if they did not quote a price.",
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

"""JSON Schema export for CALL-E's `recipient_result_schema`.

One source of truth: the Quote model in models.py. We strip the fields
that belong to us rather than to the supplier, so the voice agent is only
ever asked for things a person on a phone could actually answer.
"""

from __future__ import annotations

from packages.contracts.models import Quote

# Fields we own. The supplier is never asked for these.
_OURS = {"task_id", "case_id", "supplier_ref", "raw", "confidence",
         "transcript_url", "recording_url", "notes"}


def quote_result_schema() -> dict:
    schema = Quote.model_json_schema()

    properties = {
        name: spec
        for name, spec in schema["properties"].items()
        if name not in _OURS
    }

    return {
        "type": "object",
        "properties": properties,
        "required": ["available", "qty_offered", "lead_time_days"],
        "additionalProperties": False,
        "$defs": schema.get("$defs", {}),
    }

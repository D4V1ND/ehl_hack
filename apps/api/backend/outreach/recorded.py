"""Versioned provider-result playback for offline deterministic rehearsal."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from packages.contracts.models import OutreachTask
from packages.contracts.schemas import quote_result_schema


_RESULT_SCHEMA = quote_result_schema()


def _matches_schema(value: Any, schema: dict[str, Any]) -> bool:
    """Validate the small JSON Schema subset accepted by CALL-E."""

    expected_type = schema.get("type")
    if expected_type == "object":
        if not isinstance(value, dict):
            return False
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False and not set(value) <= set(properties):
            return False
        if not set(schema.get("required", [])) <= set(value):
            return False
        return all(
            key not in value or _matches_schema(value[key], child_schema)
            for key, child_schema in properties.items()
        )
    if expected_type == "array":
        if not isinstance(value, list):
            return False
        item_schema = schema.get("items", {})
        return all(_matches_schema(item, item_schema) for item in value)
    if expected_type == "string" and not isinstance(value, str):
        return False
    if expected_type == "integer" and (
        not isinstance(value, int) or isinstance(value, bool)
    ):
        return False
    if expected_type == "boolean" and not isinstance(value, bool):
        return False
    return "enum" not in schema or value in schema["enum"]


@dataclass(frozen=True)
class ProviderResult:
    task_id: str
    case_id: str
    supplier_ref: str
    payload: dict[str, Any]


class OutreachAdapter(Protocol):
    def dispatch(self, tasks: list[OutreachTask]) -> list[ProviderResult]: ...


class RecordedOutreachAdapter:
    """Read committed result envelopes. It has no network dependency."""

    def __init__(self, fixtures_root: Path | None = None) -> None:
        self.fixtures_root = fixtures_root or Path(__file__).with_name("fixtures")

    def dispatch(self, tasks: list[OutreachTask]) -> list[ProviderResult]:
        results: list[ProviderResult] = []
        by_case: dict[str, dict[str, dict[str, Any]]] = {}
        for task in tasks:
            fixtures = by_case.setdefault(task.case_id, self._load_case(task.case_id))
            payload = fixtures.get(task.supplier_ref, {})
            results.append(
                ProviderResult(
                    task_id=task.task_id,
                    case_id=task.case_id,
                    supplier_ref=task.supplier_ref,
                    payload=payload,
                )
            )
        return results

    def _load_case(self, case_id: str) -> dict[str, dict[str, Any]]:
        directory = self.fixtures_root / case_id
        if not directory.is_dir():
            if not self.fixtures_root.is_dir():
                return {}
            scenarios = sorted(path for path in self.fixtures_root.iterdir() if path.is_dir())
            if len(scenarios) != 1:
                return {}
            directory = scenarios[0]
        fixtures: dict[str, dict[str, Any]] = {}
        for path in sorted(directory.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError):
                continue
            if not isinstance(payload, dict):
                continue
            supplier_ref = payload.get("supplier_ref")
            if not isinstance(supplier_ref, str) or not supplier_ref:
                continue
            if supplier_ref in fixtures:
                fixtures[supplier_ref] = {}
                continue
            structured_result = payload.get("structured_result")
            fixtures[supplier_ref] = (
                payload
                if isinstance(structured_result, dict)
                and _matches_schema(structured_result, _RESULT_SCHEMA)
                else {}
            )
        return fixtures

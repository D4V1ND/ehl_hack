"""The public Case contract is strict, safe, and generated from Pydantic."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from packages.contracts.enums import (
    Actor,
    DecisionStatus,
    OutreachStatus,
    PolicyRule,
    Stage,
)
from packages.contracts.models import (
    ApproveDecisionRequest,
    Claim,
    Currency,
    Decision,
    DecisionChecks,
    Event,
    Incident,
    IncidentPlant,
    OpenCaseRequest,
    OutreachBrief,
    OutreachTask,
    PriceBreak,
    PublicClaim,
    PublicDecision,
    PublicSupplierRecord,
    SupplierRecord,
    TranscriptTurn,
)
from packages.contracts.safe import (
    project_public_claim,
    project_public_decision,
    project_public_event,
    project_public_supplier_record,
    scrub_public_value,
)


def test_public_commands_and_extensions_are_strict_and_money_is_text():
    assert Actor.HUMAN.value == "human"
    assert [status.value for status in OutreachStatus] == [
        "pending",
        "in_progress",
        "completed",
        "failed",
    ]
    assert [status.value for status in DecisionStatus] == ["ready", "approved"]

    request = OpenCaseRequest(part_id="PRT-6204", qty_required=40_000)
    assert request.model_dump(exclude_none=True) == {
        "part_id": "PRT-6204",
        "qty_required": 40_000,
    }
    with pytest.raises(ValidationError):
        OpenCaseRequest(part_id="PRT-6204", qty_required=0)
    with pytest.raises(ValidationError):
        OpenCaseRequest(part_id="PRT-6204", surprise=True)

    approval = ApproveDecisionRequest(decision_revision=1, approved_by="buyer@example.invalid")
    assert approval.approved_by == "buyer@example.invalid"

    encoded = json.loads(
        PriceBreak(min_qty=1_000, unit_price="1.5500").model_dump_json()
    )
    assert encoded == {"min_qty": 1_000, "unit_price": "1.5500"}
    assert Currency.UNKNOWN.value == "unknown"


def test_public_projections_drop_provider_data_and_scrub_all_free_text():
    claim = Claim(
        task_id="TASK-1",
        case_id="CASE-001",
        supplier_ref="SUP-1",
        call_id="provider-call-secret",
        unit_price="1.5500",
        transcript_url="https://provider.invalid/transcript?token=secret",
        recording_url="https://provider.invalid/recording?token=secret",
        notes="Bearer secret-provider-token",
        transcript=[
            TranscriptTurn(
                speaker="user",
                text="Call me on +4930231250199 or buyer@example.invalid",
            )
        ],
        summary="Bearer secret-provider-token",
        evidence=["Confirmed from +4930231250199"],
        raw={"api_key": "secret", "request_body": {"phone": "+4930231250199"}},
    )

    public_claim = project_public_claim(claim)
    fields = public_claim.model_dump(mode="json")
    assert {"raw", "call_id", "transcript_url", "recording_url", "notes"}.isdisjoint(fields)
    assert fields["transcript"][0]["text"] == (
        "Call me on +49*******0199 or [redacted-email]"
    )
    assert fields["summary"] == "Bearer [redacted]"
    assert fields["evidence"] == ["Confirmed from +49*******0199"]

    event = Event(
        seq=1,
        case_id="CASE-001",
        ts=datetime(2026, 8, 23, tzinfo=timezone.utc),
        actor=Actor.SYSTEM,
        stage=Stage.CALLING,
        message="Dialled +4930231250199",
        payload={
            "supplier_ref": "SUP-1",
            "approved_by": "buyer@example.invalid",
            "raw": {"api_key": "secret"},
        },
    )
    public_event = project_public_event(event)
    assert public_event.message == "Dialled +49*******0199"
    assert public_event.payload == {
        "supplier_ref": "SUP-1",
        "approved_by": "[redacted-email]",
    }


def test_nested_public_models_are_strict_and_keep_only_safe_supplier_and_decision_fields():
    with pytest.raises(ValidationError):
        Claim(
            task_id="TASK-1",
            case_id="CASE-001",
            supplier_ref="SUP-1",
            provider_secret="nope",
        )
    with pytest.raises(ValidationError):
        PublicClaim(
            task_id="TASK-1",
            case_id="CASE-001",
            supplier_ref="SUP-1",
            provider_secret="nope",
        )

    supplier = SupplierRecord(
        supplier_id="SUP-1",
        supplier_name="Supplier One",
        country="DE",
        phone_masked="+49*******0199",
        email="buyer@example.invalid",
        marketplace_url="https://provider.invalid/private",
    )
    public_supplier = project_public_supplier_record(supplier)
    assert isinstance(public_supplier, PublicSupplierRecord)
    assert public_supplier.phone_masked == "+49*******0199"
    assert {"email", "marketplace_url"}.isdisjoint(type(public_supplier).model_fields)

    decision = Decision(
        case_id="CASE-001",
        revision=1,
        status=DecisionStatus.READY,
        checks=DecisionChecks(policy_passed=True, cost_model_passed=True),
        pr_url="https://github.invalid/obsolete",
    )
    public_decision = project_public_decision(decision)
    assert isinstance(public_decision, PublicDecision)
    assert "pr_url" not in type(public_decision).model_fields
    assert public_decision.checks.policy_passed is True

    task = OutreachTask(
        task_id="TASK-1",
        case_id="CASE-001",
        supplier_ref="SUP-1",
        channel="voice",
        brief=OutreachBrief(
            part_spec="6204-2RS DIN 625",
            qty=32_000,
            needed_by="2026-09-04",
        ),
    )
    assert task.round == 1
    assert task.status is OutreachStatus.PENDING
    assert "stock_status" in task.brief.must_ask

    incident = Incident(
        case_id="CASE-001",
        part_id="PRT-6204",
        plant_id="PLANT-MUC",
        production_line="ASSY-3",
        qty_required=40_000,
        qty_on_hand=8_000,
        needed_by="2026-09-04",
        line_stop_at="2026-09-04T06:00:00Z",
        line_stop_cost_per_hour="4000.00",
        plants=[
            IncidentPlant(
                plant_id="PLANT-MUC",
                name="Munich",
                production_line="ASSY-3",
            ),
            IncidentPlant(
                plant_id="PLANT-STR",
                name="Stuttgart",
                production_line="ASSY-4",
            ),
        ],
    )
    assert [plant.name for plant in incident.plants] == ["Munich", "Stuttgart"]


def test_public_projection_uses_wire_values_for_enum_mapping_keys():
    projected = scrub_public_value(
        {
            PolicyRule.BLOCKED_ORIGIN_COUNTRY: (
                "Supplier origin is blocked by policy."
            )
        }
    )
    assert projected == {
        "blocked_origin_country": "Supplier origin is blocked by policy."
    }

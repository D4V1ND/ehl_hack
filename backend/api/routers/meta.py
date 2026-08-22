"""Schema export and health. The `Claim` schema here is what CALL-E receives."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import erp, settings
from packages.contracts import models as contract_models
from packages.contracts.models import CompanyProfile
from backend.record.ports import SystemOfRecord

router = APIRouter(tags=["meta"])

EXPORTABLE = {
    name: obj
    for name, obj in vars(contract_models).items()
    if isinstance(obj, type)
    and issubclass(obj, contract_models.Contract)
    and obj is not contract_models.Contract
}


@router.get("/healthz", summary="Liveness, and which call mode we are in")
def healthz(records: SystemOfRecord = Depends(erp), config=Depends(settings)) -> dict:
    return {
        "ok": True,
        "call_mode": config.call_mode,
        "parts": len(records.list_parts()),
        "suppliers": len(records.list_suppliers()),
        "incidents": len(records.list_incidents()),
    }


@router.get("/schema", summary="Every model name available for export")
def list_schemas() -> dict:
    return {"models": sorted(EXPORTABLE)}


@router.get("/schema/{model}", summary="One model as JSON Schema")
def get_schema(model: str) -> dict:
    """`GET /schema/Claim` is what Slice C hands CALL-E as `recipient_result_schema`."""
    if model not in EXPORTABLE:
        raise HTTPException(status_code=404, detail=f"no model {model}; see GET /schema")
    return EXPORTABLE[model].model_json_schema()


@router.get("/profile", response_model=CompanyProfile, summary="The rules of the house")
def get_profile(records: SystemOfRecord = Depends(erp)) -> CompanyProfile:
    return records.get_company_profile()

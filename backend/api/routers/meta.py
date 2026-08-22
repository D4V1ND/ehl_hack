"""Schema export and health.

These are Pydantic *validation* schemas, for reading and for generating client
types. They are deliberately NOT what CALL-E receives: its structured-result
engine rejects the `anyOf`/`$ref` shapes Pydantic emits, so the call answer
sheet is hand-written in `packages/contracts/schemas.py`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import erp, settings
from backend.record.dialling import LiveCallRefused, demo_number_masked
from pydantic import BaseModel

from packages.contracts import models as contract_models
from packages.contracts.models import CompanyProfile
from backend.record.ports import SystemOfRecord

router = APIRouter(tags=["meta"])

EXPORTABLE = {
    name: obj
    for name, obj in vars(contract_models).items()
    if isinstance(obj, type)
    and issubclass(obj, BaseModel)
    and obj is not BaseModel
    and obj is not contract_models.Contract
    and obj.__module__ == contract_models.__name__
}


@router.get("/healthz", summary="Liveness, call mode, and where live calls would go")
def healthz(records: SystemOfRecord = Depends(erp), config=Depends(settings)) -> dict:
    """`call_target` is what makes the cockpit's live badge trustworthy.

    Masked, because this is an API response like any other. It is None when no
    demo number is configured, which is also when live dispatch refuses.
    """
    try:
        target = demo_number_masked()
    except LiveCallRefused:
        target = None
    return {
        "ok": True,
        "call_mode": config.call_mode,
        "call_target": target,
        "parts": len(records.list_parts()),
        "suppliers": len(records.list_suppliers()),
        "incidents": len(records.list_incidents()),
    }


@router.get("/schema", summary="Every model name available for export")
def list_schemas() -> dict:
    return {"models": sorted(EXPORTABLE)}


@router.get("/schema/{model}", summary="One model as JSON Schema")
def get_schema(model: str) -> dict:
    """One model as Pydantic emits it — a validation schema, not the call answer
    sheet. What CALL-E receives is `packages.contracts.schemas.quote_result_schema`.
    """
    if model not in EXPORTABLE:
        raise HTTPException(status_code=404, detail=f"no model {model}; see GET /schema")
    return EXPORTABLE[model].model_json_schema()


@router.get("/profile", response_model=CompanyProfile, summary="The rules of the house")
def get_profile(records: SystemOfRecord = Depends(erp)) -> CompanyProfile:
    return records.get_company_profile()

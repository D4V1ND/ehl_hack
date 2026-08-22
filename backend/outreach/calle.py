"""Real CALL-E calling. Only reachable when FAKE_CALLS=0.

CALL-E's batch endpoint takes a recipients[] array, so CALL-E IS the
parallel dispatcher — we do not build one.
"""

from __future__ import annotations

import json
import re

import httpx

from backend import settings
from backend.outreach.prompts import build_task_text
from backend.outreach.protocol import DispatchReceipt
from backend.store import STORE
from packages.contracts.models import OutreachTask
from packages.contracts.schemas import quote_result_schema

_E164 = re.compile(r"^\+[1-9]\d{1,14}$")


class InvalidPhoneNumber(ValueError):
    pass


def validate_e164(number: str) -> str:
    if not _E164.match(number):
        raise InvalidPhoneNumber(f"not a valid E.164 phone number: {number!r}")
    return number


def mask(number: str) -> str:
    digits = number.lstrip("+")
    if len(digits) <= 4:
        return "+" + "*" * len(digits)
    return "+" + digits[0] + "*" * (len(digits) - 5) + digits[-4:]


def build_calle_payload(
    tasks: list[OutreachTask],
    phones_by_supplier: dict[str, str],
    buyer_name: str,
) -> dict:
    """Pure. The ONLY place a raw phone number is allowed to appear.

    CALL-E's real API rejects a `metadata` field on recipient objects
    (confirmed: 422 "Extra inputs are not permitted" at
    recipients[0].metadata). There is no verified way to tell, from a
    webhook result, which recipient of a multi-recipient request it
    answers for — so correlation instead rides in the top-level
    `metadata`, which only unambiguously identifies one task. Callers
    that need per-recipient correlation (see CalleOutreachProvider)
    must pass a single-task list.
    """
    if not tasks:
        raise ValueError("no tasks to dispatch")

    recipients = []
    for task in tasks:
        raw = phones_by_supplier.get(task.supplier_ref)
        if raw is None:
            raise InvalidPhoneNumber(f"no phone number for {task.supplier_ref}")
        recipients.append(
            {
                "phones": [validate_e164(raw)],
                "region": "DE",
                "locale": "de-DE",
            }
        )

    first = tasks[0]
    return {
        "task": build_task_text(first, buyer_name=buyer_name),
        "recipients": recipients,
        "recipient_result_schema": quote_result_schema(),
        "webhook_url": f"{settings.PUBLIC_BASE_URL}/calle/webhook",
        "metadata": {
            "case_id": first.case_id,
            "task_id": first.task_id,
            "supplier_ref": first.supplier_ref,
        },
    }


class CalleOutreachProvider:
    name = "calle"

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        """One CALL-E request per task, not one batched request for all of
        them: correlating a webhook result back to its task relies on
        top-level `metadata`, which only names a single task_id/supplier_ref
        (see build_calle_payload). Batching would make results ambiguous."""
        if not settings.CALLE_API_KEY:
            raise RuntimeError(
                "live calling requested but CALLE_API_KEY is not set — "
                "refusing rather than falling back to rehearsal data"
            )

        case_id = tasks[0].case_id if tasks else ""
        phones = _load_supplier_phones([t.supplier_ref for t in tasks])

        for task in tasks:
            payload = build_calle_payload([task], phones, buyer_name=settings.BUYER_NAME)

            STORE.append_event(
                case_id,
                actor="calle",
                stage="outreach_dispatched",
                message=f"Dialling {mask(payload['recipients'][0]['phones'][0])}",
                payload={"task_id": task.task_id},
            )

            response = httpx.post(
                f"{settings.CALLE_BASE_URL}/v1/calls",
                headers={
                    "Authorization": f"Bearer {settings.CALLE_API_KEY}",
                    "Idempotency-Key": f"{case_id}:{task.task_id}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60.0,
            )
            response.raise_for_status()

        return DispatchReceipt(
            case_id=case_id,
            task_ids=[t.task_id for t in tasks],
            provider=self.name,
        )


def _load_supplier_phones(supplier_refs: list[str]) -> dict[str, str]:
    """Slice B owns supplier data. Until its adapter lands, read the demo
    fixture. Every number here is from a reserved fictional range."""
    fixture = settings.REPO_ROOT / "backend" / "fixtures" / "supplier_phones.json"
    if not fixture.exists():
        raise RuntimeError(f"no supplier phone fixture at {fixture}")

    data = json.loads(fixture.read_text(encoding="utf-8"))
    return {ref: data[ref] for ref in supplier_refs if ref in data}

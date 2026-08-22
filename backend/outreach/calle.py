"""Real CALL-E calling. Only reachable when FAKE_CALLS=0.

CALL-E's batch endpoint takes a recipients[] array, so CALL-E IS the
parallel dispatcher — we do not build one.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time

import httpx

from backend import settings
from backend.outreach.normalize import normalize_result
from backend.outreach.prompts import build_task_text
from backend.outreach.protocol import DispatchReceipt
from packages.contracts.phone import mask
from backend.store import STORE
from packages.contracts.models import OutreachTask
from packages.contracts.schemas import quote_result_schema

# CALL-E states that mean the call will not progress any further.
_TERMINAL = {"completed", "failed", "cancelled", "canceled", "expired"}

_E164 = re.compile(r"^\+[1-9]\d{1,14}$")


class InvalidPhoneNumber(ValueError):
    pass


def validate_e164(number: str) -> str:
    if not _E164.match(number):
        # masked: an invalid number is still a number, and must not reach a log
        raise InvalidPhoneNumber(f"not a valid E.164 phone number: {mask(number)}")
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
            if response.is_error:
                # CALL-E puts the reason in the body; raise_for_status alone
                # reports only the status code, which is not enough to fix
                # a rejected payload.
                STORE.append_event(
                    case_id,
                    actor="calle",
                    stage="outreach_failed",
                    level="error",
                    message=f"CALL-E rejected the call: {response.status_code}",
                    payload={"task_id": task.task_id, "body": response.text[:2000]},
                )
                raise RuntimeError(
                    f"CALL-E returned {response.status_code} for {task.task_id}: "
                    f"{response.text[:2000]}"
                )

            # Keep what CALL-E gives back: without the call id there is no way
            # to chase a call that never fires its webhook.
            try:
                accepted = response.json()
            except ValueError:
                accepted = {"unparseable_body": response.text[:2000]}

            call_id = accepted.get("id") if isinstance(accepted, dict) else None
            STORE.append_event(
                case_id,
                actor="calle",
                stage="call_accepted",
                message=f"CALL-E accepted the call for {task.supplier_ref}",
                payload={"task_id": task.task_id, "call_id": call_id},
            )

            if call_id:
                # CALL-E does not appear to honour webhook_url (no callback ever
                # arrives, and the field is not echoed back), so pull the result
                # instead of waiting to be pushed. The webhook route stays in
                # place in case delivery starts working.
                watcher = threading.Thread(
                    target=_watch_call,
                    args=(call_id, task),
                    daemon=True,
                )
                watcher.start()

        return DispatchReceipt(
            case_id=case_id,
            task_ids=[t.task_id for t in tasks],
            provider=self.name,
        )


def _watch_call(call_id: str, task: OutreachTask) -> None:
    """Poll one call to its end, then store the Quote. Never raises: this
    runs on a daemon thread where an exception would vanish silently and
    leave the case with no quote and no explanation."""
    deadline = time.monotonic() + settings.CALLE_POLL_TIMEOUT
    record: dict = {}

    try:
        while time.monotonic() < deadline:
            time.sleep(settings.CALLE_POLL_INTERVAL)
            try:
                response = httpx.get(
                    f"{settings.CALLE_BASE_URL}/v1/calls/{call_id}",
                    headers={"Authorization": f"Bearer {settings.CALLE_API_KEY}"},
                    timeout=30.0,
                )
            except httpx.HTTPError:
                continue  # transient; try again until the deadline
            if response.is_error:
                continue
            record = response.json()
            if str(record.get("status", "")).lower() in _TERMINAL:
                break
        else:
            STORE.append_event(
                task.case_id,
                actor="calle",
                stage="call_timeout",
                level="error",
                message=f"{task.supplier_ref}: gave up waiting for the call result",
                payload={"task_id": task.task_id, "call_id": call_id},
            )

        quote = normalize_result(
            task.task_id, task.case_id, task.supplier_ref, _flatten(record)
        )
        STORE.add_quote(quote)
        STORE.append_event(
            task.case_id,
            actor="calle",
            stage="quote_received",
            message=f"{task.supplier_ref}: "
            + ("quoted" if quote.available else "no quote"),
            payload={"task_id": task.task_id, "confidence": quote.confidence},
        )
    except Exception as exc:  # noqa: BLE001 - a dead thread must still say why
        STORE.append_event(
            task.case_id,
            actor="calle",
            stage="call_watch_failed",
            level="error",
            message=f"{task.supplier_ref}: watching the call failed: {exc}",
            payload={"task_id": task.task_id, "call_id": call_id},
        )


def _flatten(record: dict) -> dict:
    """Shape a CALL-E call record into what normalize_result reads.

    The typed answers can land on the recipient rather than the call, and
    the prose summary is often the only surviving trace of a partial call,
    so prefer the recipient's copy of each and fall back to the call's.
    """
    if not isinstance(record, dict):
        return {}

    recipients = record.get("recipients")
    recipient = recipients[0] if isinstance(recipients, list) and recipients else {}
    if not isinstance(recipient, dict):
        recipient = {}

    return {
        **record,
        "structured_result": (
            recipient.get("structured_result") or record.get("structured_result")
        ),
        "summary": recipient.get("summary") or record.get("summary"),
    }


def _load_supplier_phones(supplier_refs: list[str]) -> dict[str, str]:
    """Where the number to dial comes from.

    Committed numbers are all from reserved fictional ranges, so a live call
    needs a real one: either `DEMO_CALL_DESTINATION` for the whole demo, or the
    gitignored `.local.json` beside the fixture for a single supplier."""
    demo_destination = os.environ.get("DEMO_CALL_DESTINATION", "").strip()
    if demo_destination:
        # One number for the whole demo: every supplier call reaches the phone on
        # stage, so a live run cannot dial a real supplier by accident. Set on the
        # demo machine only, never committed.
        return {ref: validate_e164(demo_destination) for ref in supplier_refs}

    fixtures = settings.REPO_ROOT / "backend" / "fixtures"
    fixture = fixtures / "supplier_phones.json"
    if not fixture.exists():
        raise RuntimeError(f"no supplier phone fixture at {fixture}")

    data: dict[str, str] = json.loads(fixture.read_text(encoding="utf-8"))
    override = fixtures / "supplier_phones.local.json"
    if override.exists():
        data.update(json.loads(override.read_text(encoding="utf-8")))
    return {ref: data[ref] for ref in supplier_refs if ref in data}

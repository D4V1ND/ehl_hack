"""Real CALL-E calling. Only reachable when FAKE_CALLS=0.

**One request per task, not one batch.** CALL-E's endpoint does take a
`recipients[]` array, but nothing in a result identifies *which* recipient it
answers for, and the API rejects a `metadata` object on a recipient (422, "Extra
inputs are not permitted" at `recipients[0].metadata`). Correlation therefore
rides in the top-level `metadata`, which can only name one task — so batching
would make every answer ambiguous. One call, one task, one unmistakable answer.

**Results are pulled, not pushed.** `webhook_url` is still sent and
`POST /calle/webhook` is still mounted, but no callback has ever been observed
arriving, so each accepted call gets a watcher thread that polls
`GET /v1/calls/{id}` to a terminal state. The webhook stays wired up — with a
public tunnel in front of it (see `backend/tunnel.py`) — so that if delivery
does start working it lands in the same place the poller writes to.
"""

from __future__ import annotations

import re
import threading
import time

import httpx

from backend import settings
from backend.outreach.normalize import normalize_result
from backend.outreach.prompts import build_task_text
from backend.outreach.protocol import DispatchReceipt
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

    Takes a list for the caller's convenience, but only the first task is named
    in the metadata — pass one, for the reason in the module docstring.
    """
    if not tasks:
        raise ValueError("no tasks to dispatch")

    recipients = []
    for task in tasks:
        raw = phones_by_supplier.get(task.supplier_ref)
        if raw is None:
            raise InvalidPhoneNumber(f"no phone number for {task.supplier_ref}")
        # A recipient accepts phones, region and locale and nothing else
        # (`additionalProperties: false`), so correlation cannot travel here.
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
        "webhook_url": f"{settings.public_base_url()}/calle/webhook",
        "metadata": {
            "case_id": first.case_id,
            "task_id": first.task_id,
            "supplier_ref": first.supplier_ref,
        },
    }


class CalleOutreachProvider:
    name = "calle"

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
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
                # The body names the offending field; the status code alone sent
                # us hunting through a whole payload once already. File it, then
                # raise the status error so the API layer can quote the reason
                # back to the operator.
                STORE.append_event(
                    case_id,
                    actor="calle",
                    stage="outreach_failed",
                    level="error",
                    message=f"CALL-E rejected the call: {response.status_code}",
                    payload={"task_id": task.task_id, "body": response.text[:2000]},
                )
                response.raise_for_status()

            # Keep what CALL-E gives back: without the call id there is no way
            # to chase a call that never fires its webhook.
            try:
                accepted = response.json()
            except ValueError:
                accepted = {}

            call_id = accepted.get("id") if isinstance(accepted, dict) else None
            if call_id:
                # Also the correlation the webhook route reads, for the day
                # delivery starts working.
                STORE.remember_call(call_id, case_id, task.task_id, task.supplier_ref)

            STORE.append_event(
                case_id,
                actor="calle",
                stage="call_accepted",
                message=f"CALL-E accepted the call for {task.supplier_ref}",
                payload={"task_id": task.task_id, "call_id": call_id},
            )

            if call_id:
                watcher = threading.Thread(
                    target=_watch_call, args=(call_id, task), daemon=True
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
    """Where a live call is allowed to land — Slice B's adapter, now that it exists.

    This replaces the phone fixture the provider read before that adapter landed.
    Every recipient resolves to the one number in DEMO_CALL_NUMBER -- a phone
    somebody on the team is holding -- and the supplier identity travels as call
    metadata instead. Two reasons:

    * the seeded supplier numbers are from reserved fictional ranges, so dialling
      them either fails or, worse, reaches somebody who never agreed to be in a
      demo;
    * a demo that dials real distributors is not a demo, it is cold-calling.

    With no DEMO_CALL_NUMBER set this raises rather than falling back to anything,
    which is the only safe behaviour when the alternative is an unintended call.
    """
    from backend.record.dialling import LiveCallRefused, destination_for

    try:
        destination = destination_for(supplier_refs[0] if supplier_refs else "", live=True)
    except LiveCallRefused as exc:
        raise RuntimeError(str(exc)) from None

    return {ref: destination for ref in supplier_refs}

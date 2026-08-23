"""Real CALL-E calling. Only reachable when FAKE_CALLS=0.

Uses the official `calle` SDK: client.calls.create() to place a call and
client.calls.wait_for_result() to collect it. Both are plain outbound
requests, so this flow needs no public URL and no tunnel.

Each request carries one recipient. The provider dispatches one request per
task so the returned result can always be correlated to one supplier.
"""

from __future__ import annotations

import json
import os
import re
import threading

from calle import CalleClient
from calle.errors import (
    CalleAPIError,
    CalleConnectionError,
    CalleTimeoutError,
)

from supplyos_api import settings
from supplyos_api.outreach.normalize import normalize_result
from supplyos_api.outreach.calle_schema import call_result_schema
from supplyos_api.outreach.prompts import build_task_text
from supplyos_api.outreach.protocol import DispatchReceipt
from supplyos_api.outreach.buffer import OUTREACH_BUFFER
from supplyos_api.outreach.persistence import save_quote
from packages.contracts.models import OutreachTask

# The SDK raises a different class per failure mode with no shared base, so
# catching "anything CALL-E threw" needs them named together.
CalleError = (CalleAPIError, CalleConnectionError, CalleTimeoutError)

_CLIENT: CalleClient | None = None
_CLIENT_LOCK = threading.Lock()


def _client() -> CalleClient:
    """One client for the process. It holds an httpx.Client, so building a
    fresh one per call would leak a connection pool every time."""
    global _CLIENT
    with _CLIENT_LOCK:
        if _CLIENT is None:
            _CLIENT = CalleClient(
                api_key=settings.CALLE_API_KEY or "",
                base_url=settings.CALLE_BASE_URL,
                timeout=60.0,
            )
        return _CLIENT

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

    if len(tasks) != 1:
        raise ValueError("CALL-E payloads require exactly one task per recipient")

    first = tasks[0]
    raw = phones_by_supplier.get(first.supplier_ref)
    if raw is None:
        raise InvalidPhoneNumber(f"no phone number for {first.supplier_ref}")
    return {
        "task": build_task_text(first, buyer_name=buyer_name),
        "recipient": {
            "phones": [validate_e164(raw)],
            "region": settings.CALLE_REGION,
            "locale": settings.CALLE_LOCALE,
        },
        "recipient_result_schema": call_result_schema(),
        # No webhook_url on purpose. Results are pulled via GET /v1/calls/{id}
        # (see _watch_call), which is an outbound request and so needs no
        # public URL and no tunnel. The result can be collected through the
        # provider API, so exposing a webhook would add a second ingestion path.
        "metadata": {
            "case_id": first.case_id,
            "task_id": first.task_id,
            "supplier_ref": first.supplier_ref,
        },
    }


def _record_calle_failure(case_id: str, task: OutreachTask, exc: CalleAPIError) -> None:
    OUTREACH_BUFFER.append_event(
        case_id,
        actor="calle",
        stage="outreach_failed",
        level="error",
        message=f"CALL-E rejected the call: {exc}",
        payload={
            "task_id": task.task_id,
            "calle_code": exc.code,
            "calle_status": exc.status_code,
            "calle_details": exc.details,
        },
    )


def _create_with_minimal_schema(payload: dict, case_id: str, task: OutreachTask) -> dict:
    """Second try: the shape CALL-E's own docs use for a one-recipient call."""
    phone = payload["recipient"]["phones"][0]
    minimal = {
        "task": payload["task"],
        "recipient": {
            "phones": [phone],
            "region": settings.CALLE_REGION,
            "locale": settings.CALLE_LOCALE,
        },
        "result_schema": {
            "type": "object",
            "required": ["part_available"],
            "properties": {
                "part_available": {
                    "type": "string",
                    "enum": ["yes", "no", "unknown"],
                },
            },
            "additionalProperties": False,
        },
    }
    try:
        return _client().calls.create(
            **minimal,
            idempotency_key=f"{case_id}:{task.task_id}:min",
        )
    except CalleAPIError as exc:
        _record_calle_failure(case_id, task, exc)
        raise RuntimeError(
            f"{exc} (code={exc.code} status={exc.status_code} details={exc.details})"
        ) from exc


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
            _check_call_budget(task)
            payload = build_calle_payload([task], phones, buyer_name=settings.BUYER_NAME)

            OUTREACH_BUFFER.append_event(
                case_id,
                actor="calle",
                stage="outreach_dispatched",
                message=f"Dialling {mask(payload['recipient']['phones'][0])}",
                payload={"task_id": task.task_id},
            )

            try:
                accepted = _client().calls.create(
                    **payload,
                    idempotency_key=f"{case_id}:{task.task_id}",
                )
            except CalleAPIError as exc:
                # The SDK has already parsed CALL-E's error body, which is
                # where the reason for a rejected payload lives — the status
                # code alone is not enough to fix one.
                OUTREACH_BUFFER.append_event(
                    case_id,
                    actor="calle",
                    stage="outreach_failed",
                    level="error",
                    message=f"CALL-E rejected the call: {exc}",
                    payload={"task_id": task.task_id},
                )
                raise

            _record_call_placed()

            call_id = accepted.get("id")
            OUTREACH_BUFFER.append_event(
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
    record: dict = {}

    try:
        try:
            record = _client().calls.wait_for_result(
                call_id,
                interval_seconds=settings.CALLE_POLL_INTERVAL,
                timeout_seconds=settings.CALLE_POLL_TIMEOUT,
            )
        except CalleTimeoutError:
            # Still worth one last look: a call that ran long may hold partial
            # answers, and a quote with confidence 0 beats no quote at all.
            OUTREACH_BUFFER.append_event(
                task.case_id,
                actor="calle",
                stage="call_timeout",
                level="error",
                message=f"{task.supplier_ref}: gave up waiting for the call result",
                payload={"task_id": task.task_id, "call_id": call_id},
            )
            try:
                record = _client().calls.get(call_id)
            except CalleError:
                record = {}

        quote = normalize_result(
            task.task_id, task.case_id, task.supplier_ref, _flatten(record)
        )
        OUTREACH_BUFFER.add_quote(quote)

        # Save before announcing: a quote the cockpit can see but that never
        # reached disk would be lost on the next restart.
        saved_to = None
        try:
            saved_to = str(save_quote(quote))
        except OSError as exc:
            OUTREACH_BUFFER.append_event(
                task.case_id,
                actor="calle",
                stage="quote_not_saved",
                level="error",
                message=f"{task.supplier_ref}: quote could not be written to disk: {exc}",
                payload={"task_id": task.task_id},
            )

        OUTREACH_BUFFER.append_event(
            task.case_id,
            actor="calle",
            stage="quote_received",
            message=f"{task.supplier_ref}: "
            + ("quoted" if quote.available else "no quote"),
            payload={
                "task_id": task.task_id,
                "confidence": quote.confidence,
                "saved_to": saved_to,
            },
        )
    except Exception as exc:  # noqa: BLE001 - a dead thread must still say why
        OUTREACH_BUFFER.append_event(
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

    recipient = record.get("recipient")
    if not isinstance(recipient, dict):
        recipients = record.get("recipients")
        recipient = recipients[0] if isinstance(recipients, list) and recipients else {}
    if not isinstance(recipient, dict):
        recipient = {}

    # The transcript sits two levels down, on the attempt that connected.
    # A redialled number has several attempts; the last one is the one that
    # produced the answers.
    attempts = recipient.get("attempts")
    attempts = [a for a in attempts if isinstance(a, dict)] if isinstance(attempts, list) else []
    transcript_turns = next(
        (a.get("transcript_turns") for a in reversed(attempts) if a.get("transcript_turns")),
        [],
    )

    return {
        **record,
        "structured_result": (
            recipient.get("structured_result") or record.get("structured_result")
        ),
        "summary": recipient.get("summary") or record.get("summary"),
        "transcript_turns": transcript_turns,
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

    fixtures = settings.PACKAGE_ROOT / "fixtures"
    fixture = fixtures / "supplier_phones.json"
    if not fixture.exists():
        raise RuntimeError(f"no supplier phone fixture at {fixture}")

    data: dict[str, str] = json.loads(fixture.read_text(encoding="utf-8"))
    override = fixtures / "supplier_phones.local.json"
    if override.exists():
        data.update(json.loads(override.read_text(encoding="utf-8")))
    return {ref: data[ref] for ref in supplier_refs if ref in data}

"""Real CALL-E calling. Only reachable when FAKE_CALLS=0.

CALL-E's batch endpoint takes a recipients[] array, so CALL-E IS the
parallel dispatcher — we do not build one.
"""

from __future__ import annotations

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
    """Pure. The ONLY place a raw phone number is allowed to appear."""
    if not tasks:
        raise ValueError("no tasks to dispatch")

    recipients = []
    for task in tasks:
        raw = phones_by_supplier.get(task.supplier_ref)
        if raw is None:
            raise InvalidPhoneNumber(f"no phone number for {task.supplier_ref}")
        # CALL-E's request-side recipient accepts phones, region and locale and
        # nothing else (`additionalProperties: false`), so the task correlation
        # travels in the call-level metadata below rather than per recipient.
        recipients.append(
            {
                "phones": [validate_e164(raw)],
                "region": "DE",
                "locale": "de-DE",
            }
        )

    return {
        "task": build_task_text(tasks[0], buyer_name=buyer_name),
        "recipients": recipients,
        "recipient_result_schema": quote_result_schema(),
        "webhook_url": f"{settings.public_base_url()}/calle/webhook",
        # Recipients come back in the order they were sent, so this maps each
        # position to the task it belongs to -- which is how a result is matched
        # to a supplier once every recipient shares one destination number.
        "metadata": {
            "case_id": tasks[0].case_id,
            "task_ids": [t.task_id for t in tasks],
            "supplier_refs": [t.supplier_ref for t in tasks],
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

        case_id = tasks[0].case_id
        phones = _load_supplier_phones([t.supplier_ref for t in tasks])
        payload = build_calle_payload(tasks, phones, buyer_name=settings.BUYER_NAME)

        STORE.append_event(
            case_id,
            actor="calle",
            stage="outreach_dispatched",
            message="Dialling "
            + ", ".join(mask(r["phones"][0]) for r in payload["recipients"]),
            payload={"task_ids": [t.task_id for t in tasks]},
        )

        response = httpx.post(
            f"{settings.CALLE_BASE_URL}/v1/calls",
            headers={
                "Authorization": f"Bearer {settings.CALLE_API_KEY}",
                "Idempotency-Key": f"{case_id}:{'-'.join(t.task_id for t in tasks)}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )
        response.raise_for_status()

        _record_accepted(case_id, tasks, response)

        return DispatchReceipt(
            case_id=case_id,
            task_ids=[t.task_id for t in tasks],
            provider=self.name,
        )


def _call_ids(body: object) -> list[str]:
    """Whatever CALL-E called the calls it just accepted.

    The id is how a result is matched back to a task later, and it is the only
    proof in our own log that the phone actually rang. Read defensively: an
    unexpected response shape must not turn a placed call into an exception.
    """
    if isinstance(body, dict):
        for key in ("id", "call_id", "batch_id"):
            if isinstance(body.get(key), str):
                return [body[key]]
        for key in ("calls", "recipients", "results", "data"):
            items = body.get(key)
            if isinstance(items, list):
                return [
                    item[k]
                    for item in items
                    if isinstance(item, dict)
                    for k in ("id", "call_id")
                    if isinstance(item.get(k), str)
                ]
    return []


def _record_accepted(case_id: str, tasks: list[OutreachTask], response) -> None:
    try:
        body = response.json()
    except ValueError:
        body = None

    ids = _call_ids(body)
    # Only a per-recipient id list can be matched to tasks; a single batch id
    # cannot, and guessing would file one supplier's answer under another.
    if len(ids) == len(tasks):
        for call_id, task in zip(ids, tasks):
            STORE.remember_call(call_id, case_id, task.task_id, task.supplier_ref)

    STORE.append_event(
        case_id,
        actor="calle",
        stage="outreach_accepted",
        message=(
            f"{len(tasks)} call{'' if len(tasks) == 1 else 's'} accepted by the "
            "telephony provider"
        ),
        payload={"task_ids": [t.task_id for t in tasks], "call_ids": ids},
    )

    # A result can only come back to a URL the provider can actually reach.
    # Saying so at dispatch time is the difference between "the demo is still
    # running" and twenty minutes of wondering why no quote ever appeared.
    base = settings.public_base_url()
    if not base.startswith("https://"):
        STORE.append_event(
            case_id,
            actor="system",
            stage="outreach_accepted",
            level="warn",
            message=(
                "The call is placed, but results have nowhere to land: the "
                f"webhook address is {base}, which the telephony provider "
                "cannot reach. Start the run with `python run.py` so the public "
                "tunnel is opened, or set PUBLIC_BASE_URL yourself."
            ),
            payload={"webhook_url": f"{base}/calle/webhook"},
        )


def _load_supplier_phones(supplier_refs: list[str]) -> dict[str, str]:
    """Where a live call is allowed to land. Slice B's adapter, as invited above.

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

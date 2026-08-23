"""Where a finished call comes back.

Dispatch returns a receipt in milliseconds; the answers arrive minutes later,
when the supplier has actually hung up. CALL-E delivers them by POSTing here --
the URL we hand it as `webhook_url` on every batch.

Three rules shape this handler:

* **It never rejects.** A webhook that answers 4xx or 5xx gets retried until the
  provider gives up, and a redelivery loop during a demo is worse than a missing
  quote. Anything unparseable is logged and acknowledged.
* **It never raises.** `normalize_result` is written to turn a garbled result
  into a confidence-0 quote rather than an exception, which is exactly the
  contract this endpoint needs.
* **Correlation comes from our own metadata**, not from anything the voice agent
  said. We sent `task_ids` and `supplier_refs` in call order; the result names
  its position, and that is what maps an answer back to a supplier.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from backend.outreach.normalize import normalize_result
from backend.store import STORE

router = APIRouter(tags=["calle"])


def _metadata(body: dict) -> dict:
    for holder in (body, body.get("call"), body.get("data")):
        if isinstance(holder, dict) and isinstance(holder.get("metadata"), dict):
            return holder["metadata"]
    return {}


def _index(body: dict) -> int:
    """Which recipient of the batch this result belongs to."""
    for key in ("recipient_index", "index", "position"):
        value = body.get(key)
        if isinstance(value, int) and value >= 0:
            return value
    return 0


def _at(values: Any, index: int) -> str | None:
    if isinstance(values, list) and 0 <= index < len(values):
        return str(values[index])
    return None


def _call_id(body: dict) -> str:
    for key in ("id", "call_id"):
        value = body.get(key)
        if isinstance(value, str):
            return value
    for holder in (body.get("call"), body.get("data")):
        if isinstance(holder, dict):
            for key in ("id", "call_id"):
                if isinstance(holder.get(key), str):
                    return holder[key]
    return ""


def _route(body: dict) -> tuple[str, str, str]:
    """Which task this result answers: (case_id, task_id, supplier_ref).

    The call id is asked first because it is ours — recorded against the task at
    dispatch, from the provider's own acceptance response — and it holds however
    the results are ordered or batched. The metadata we sent along with the batch
    is the fallback, read by position, for a delivery whose id we never saw (a
    restarted process, or a redelivery of a call placed by an earlier run).
    """
    remembered = STORE.call_route(_call_id(body))
    if remembered:
        return remembered

    metadata = _metadata(body)
    index = _index(body)
    return (
        str(metadata.get("case_id") or ""),
        _at(metadata.get("task_ids"), index) or str(metadata.get("task_id") or ""),
        _at(metadata.get("supplier_refs"), index) or str(metadata.get("supplier_ref") or ""),
    )


@router.post("/calle/webhook", summary="A finished call, delivered by the telephony provider")
async def calle_webhook(request: Request) -> dict:
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 - a malformed body is data, not a failure
        body = None

    if not isinstance(body, dict):
        STORE.append_event(
            "",
            actor="calle",
            stage="quote_received",
            level="warn",
            message="A call result arrived that we could not read; ignoring it.",
        )
        return {"ok": True, "stored": False}

    case_id, task_id, supplier_ref = _route(body)

    if not case_id or not task_id:
        STORE.append_event(
            case_id,
            actor="calle",
            stage="quote_received",
            level="warn",
            message="A call result arrived with no case it belongs to; ignoring it.",
            payload={"metadata": _metadata(body)},
        )
        return {"ok": True, "stored": False}

    quote = normalize_result(
        task_id=task_id, case_id=case_id, supplier_ref=supplier_ref, payload=body
    )
    STORE.add_quote(quote)
    STORE.append_event(
        case_id,
        actor="calle",
        stage="quote_received",
        level="warn" if quote.confidence < 0.4 else "info",
        message=(
            f"{supplier_ref or 'a supplier'}: "
            + (
                f"{quote.qty_offered:,} pcs offered"
                if quote.available
                else "cannot supply"
            )
        ),
        payload={"task_id": task_id, "available": quote.available},
    )
    return {"ok": True, "stored": True}

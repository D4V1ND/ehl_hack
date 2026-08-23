"""Start the Devin session that works the case.

The session gets the case id and the base URL of this API, and is told to read
the part out of the ERP before it looks at suppliers — that order is the story:
specs first, then who can make them.

Without `DEVIN_API_KEY` this returns a stub session and says so. A missing key
must never be the reason a demo stops, and it must never be mistaken for a real
run either, which is why `stubbed` is on the response and in the event payload.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from packages.contracts.models import Incident, Part

DEFAULT_API_BASE = "https://api.devin.ai"


@dataclass(frozen=True)
class DevinSession:
    session_id: str
    session_url: str
    stubbed: bool
    error: str | None = None


def session_prompt(incident: Incident, part: Part, base_url: str) -> str:
    """What the session is told. Explicit, ordered, and no human to ask."""
    base = base_url.rstrip("/")
    return "\n".join(
        [
            f"You are sourcing case {incident.case_id} for Meridian Motors. Work it to the end;"
            " there is nobody to ask.",
            "",
            f"Shortage: part {incident.part_id} ({part.item_code}, {part.item_name}) at"
            f" {incident.plant_id}/{incident.production_line}. {incident.qty_required:,} needed by"
            f" {incident.needed_by}, {incident.qty_on_hand:,} on hand, so short"
            f" {incident.shortfall:,}. Line stops {incident.line_stop_at.isoformat()} at"
            f" EUR {incident.line_stop_cost_per_hour}/hour.",
            f"Why: {incident.reason}" if incident.reason else "",
            "",
            f"The ERP and the case live behind {base}. In this order:",
            f"1. GET {base}/tools/part/{incident.part_id} — the full spec, weight, HS code and"
            " criticality. Also GET /tools/stock, /tools/open_pos and /tools/price_history for it.",
            f"2. GET {base}/tools/suppliers?part_id={incident.part_id} — the approved suppliers.",
            f"3. POST {base}/tools/screen?case_id={incident.case_id} — screen them against company"
            " policy. Rejections cite the rule; do not argue with them.",
            f"4. POST {base}/tools/outreach?case_id={incident.case_id} — ask the compliant ones."
            f" Then POST {base}/tools/claims to file what each one said. Unknown stays unknown.",
            f"5. POST {base}/tools/decide?case_id={incident.case_id} — price every single-source and"
            " split plan, then POST /tools/publish_pr to file the review package.",
            "",
            f"Narrate every step with POST {base}/tools/events (case_id, stage, message): a human is"
            " watching the cockpit and needs to see where you are.",
            "You do not place the order and you do not pick the winner — you present the ranked"
            " options with landed cost and arrival date so a buyer decides.",
            "Do not dial anyone yourself. Calling is the backend's job and is rehearsed unless live"
            " calling is switched on there.",
        ]
    ).replace("\n\n\n", "\n\n")


def _stub(incident: Incident, error: str | None = None) -> DevinSession:
    stamp = int(datetime.now(tz=timezone.utc).timestamp())
    session_id = f"devin-stub-{incident.case_id.lower()}-{stamp}"
    return DevinSession(
        session_id=session_id,
        session_url=f"https://app.devin.ai/sessions/{session_id}",
        stubbed=True,
        error=error,
    )


def start_session(incident: Incident, part: Part, base_url: str) -> DevinSession:
    """POST a session to the Devin API, or return a stub if we cannot."""
    api_key = os.environ.get("DEVIN_API_KEY", "").strip()
    if not api_key:
        return _stub(incident)

    api_base = os.environ.get("DEVIN_API_BASE_URL", DEFAULT_API_BASE).rstrip("/")
    try:
        response = httpx.post(
            f"{api_base}/v1/sessions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "prompt": session_prompt(incident, part, base_url),
                "title": f"Sourcing {incident.case_id} ({part.item_code})",
                "tags": ["supplyguard", incident.case_id],
            },
            timeout=30.0,
        )
    except httpx.HTTPError as error:
        return _stub(incident, f"could not reach {api_base}: {error}")

    if response.status_code >= 400:
        return _stub(incident, f"Devin API {response.status_code}: {response.text[:200]}")

    body = response.json()
    session_id = str(body.get("session_id", "")) or "unknown"
    return DevinSession(
        session_id=session_id,
        session_url=str(body.get("url") or f"https://app.devin.ai/sessions/{session_id}"),
        stubbed=False,
    )

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

# A sourcing case is a dozen HTTP calls, not an engineering task. The cap is the
# only hard stop on a session that decides to go exploring, so it is low on
# purpose and overridable for a longer run.
DEFAULT_MAX_ACU = 20


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
            "",
            "The cockpit shows a checklist, and a step nobody ticks reads as you being stuck"
            " there. Keep it current — this is not optional narration, it is the only thing the"
            " human watching can see:",
            f"- POST {base}/tools/plan/step?case_id={incident.case_id}&step_id=...&status=active"
            " before you start a step, and the same call with status=done (or failed) after it,"
            " optionally with &detail=<one short human sentence>.",
            "- The steps that already exist, in order: intake:incident, erp:part, erp:stock,"
            " erp:open_pos, erp:price_history, suppliers:list, screening:policy, outreach:brief,"
            " claims:normalise, costing:landed, review:package. Use those ids exactly.",
            "- How many suppliers you research and call is your decision, so those steps do not"
            " exist yet: create one per supplier with step_id=screening:<SUPPLIER_REF> or"
            " outreach:<SUPPLIER_REF>, group=screening or outreach, label=\"Screening Kugellager"
            " Bayern\" / \"Calling Rulmenti\" (the supplier's real name, it is on screen), and"
            " supplier_ref=<SUPPLIER_REF>.",
            f"- Calling several suppliers at once: POST {base}/tools/plan/steps?case_id="
            f"{incident.case_id} with a JSON list of those objects, so they appear together.",
            "- Repeating a step_id updates that line; it never creates a second one.",
            f"- Anything worth saying that is not a step transition goes to POST {base}/tools/events"
            " (case_id, stage, message). One line, no internal detail.",
            "",
            "Bounds, all of them hard:",
            "- This is a procurement case. It is not a coding task: do not read, write or refactor"
            " repository source code, do not run test suites, do not open a GitHub pull request"
            f" yourself \u2014 the review package is filed only by POST {base}/tools/publish_pr, and by"
            " nothing else",
            "- Use only the endpoints named above. No other tool, host, browser or shell.",
            "- Do not dial anyone yourself. Calling is the backend's job and is rehearsed unless live"
            " calling is switched on there.",
            "- You do not place the order and you do not pick the winner — present the ranked options"
            " with landed cost and arrival date so a buyer decides.",
            "- Never invent a supplier answer. A field a call did not establish stays unknown.",
            "- If an endpoint fails twice, post the failure as an event and carry on with the rest of"
            " the case. Do not debug the backend.",
            f"- Stop when {base}/cases/{incident.case_id} shows the ranked options and the review"
            " package. Do not wait for a human.",
        ]
    ).replace("\n\n\n", "\n\n")


def _max_acu() -> int:
    raw = os.environ.get("DEVIN_MAX_ACU", "").strip()
    try:
        return max(1, int(raw)) if raw else DEFAULT_MAX_ACU
    except ValueError:
        return DEFAULT_MAX_ACU


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
                "tags": ["supplyos", incident.case_id],
                # Nothing in a sourcing case needs a credential or an
                # organisation's knowledge base, so it gets neither: the smallest
                # blast radius a session can be started with.
                "secret_ids": [],
                "knowledge_ids": [],
                "max_acu_limit": _max_acu(),
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

"""Builds the CALL-E `task` text — what the voice agent says out loud.

The disclosure is not a parameter. There is no way to call this function
and get a script without it: AI disclosure, who it's calling for, that
it won't commit to price/quantity/delivery, and that it ends the call if
asked for a human or to stop (required by German §201 StGB + EU AI Act).

Quoted sentences are spoken verbatim by CALL-E. Unquoted text is rewritten
by the planner, so the legal opener stays inside quotes. The task stays
short: CALL-E's planner 503s on a long compile.

The supplier's phone number never appears here — it travels separately
in the recipients[] array of the CALL-E request body.
"""

from __future__ import annotations

from packages.contracts.models import OutreachTask

_DISCLOSURE = (
    'Say this in your first two sentences, word for word: '
    '"I am an AI assistant calling on behalf of {buyer_name}. '
    'This call is recorded."'
)

_RULES = (
    "Speak English for the whole call, even if the other person answers "
    "in another language. If they ask to speak to a human, or ask you to "
    "stop, thank them and end the call. Do not agree to any price, "
    "quantity, delivery, or contract change. A human buyer decides."
)

_MUST_ASK = (
    "Ask: whether the part is available and how many units; unit price and "
    "currency; minimum order quantity; lead time in days; incoterm; "
    "certifications; payment terms. Say the part number slowly, digit by "
    "digit, and confirm the numbers before you hang up."
)


def build_task_text(task: OutreachTask, buyer_name: str) -> str:
    brief = task.brief

    lines = [
        _DISCLOSURE.format(buyer_name=buyer_name),
        _RULES,
        f"You are sourcing: {brief.part_spec}.",
        f"Quantity required: {brief.qty} units. Needed by: {brief.needed_by.isoformat()}.",
        _MUST_ASK,
    ]

    if brief.target_price is not None:
        lines.append(
            f"If they quote above {brief.target_price} per unit, ask what "
            "volume would bring the price down. Never state our contract price."
        )

    return "\n".join(lines)

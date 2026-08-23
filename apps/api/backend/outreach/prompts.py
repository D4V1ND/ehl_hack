"""Builds the CALL-E `task` text — what the voice agent says out loud.

The disclosure is not a parameter. There is no way to call this function
and get a script without it: AI disclosure, who it's calling for, that
it won't commit to price/quantity/delivery, and that it ends the call if
asked for a human or to stop (required by German §201 StGB + EU AI Act).

The supplier's phone number never appears here — it travels separately
in the recipients[] array of the CALL-E request body.
"""

from __future__ import annotations

from packages.contracts.models import OutreachTask

_DISCLOSURE = (
    "You are an AI procurement assistant calling on behalf of {buyer_name}. "
    "Say this clearly in your first two sentences: that you are an AI "
    "assistant, who you are calling for, and that this call is recorded. "
    "If the person asks to speak to a human, or asks you to stop, thank "
    "them and end the call without pursuing the request. Do not agree to "
    "any price, quantity, delivery commitment, or contract change on this "
    "call — you are gathering information only, and a human buyer makes "
    "every decision."
)

_MUST_ASK = (
    "Ask for all of the following, and confirm the numbers back to them "
    "before you hang up:\n"
    "  - the unit price for this quantity\n"
    "  - quantity price breaks (what the unit price becomes at higher "
    "volumes, and at which quantities the price changes)\n"
    "  - the minimum order quantity\n"
    "  - the lead time in days\n"
    "  - the incoterm (who pays freight and insurance)\n"
    "  - whether their quality certification for this part is currently "
    "valid, and which certification it is\n"
    "  - whether any units they mention are physically in stock and free, "
    "or already promised to another customer"
)


def build_task_text(task: OutreachTask, buyer_name: str) -> str:
    brief = task.brief

    lines = [
        _DISCLOSURE.format(buyer_name=buyer_name),
        "",
        f"You are sourcing: {brief.part_spec}.",
        f"Quantity required: {brief.qty} units.",
        f"Needed by: {brief.needed_by.isoformat()}.",
        "",
        _MUST_ASK,
    ]

    if brief.target_price is not None:
        lines += [
            "",
            f"Negotiate toward {brief.target_price} per unit. If they open "
            "higher, ask what volume would bring the price down. Never state "
            "our own contract price or our walk-away price. If they cannot "
            "reach the target, record their best offer and move on politely.",
        ]

    return "\n".join(lines)

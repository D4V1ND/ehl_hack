"""Deciding which number a live call is actually allowed to reach.

Slice B owns supplier data, so it owns this. Two rules, and both exist because a
phone call cannot be taken back:

1. **A live call may only reach the demo number.** `DEMO_CALL_NUMBER` is set in
   `.env` (gitignored) to a phone somebody on the team is holding. Without it,
   live dispatch is refused rather than falling back to whatever is on record --
   the seeded numbers are fictional and would either fail or, worse, reach a
   stranger who never agreed to be part of a demo.
2. **Rehearsal never resolves a number at all.** Nothing is dialled, so there is
   nothing to look up.

This is the plan's C6 -- rehearsal personas answer on a teammate's own phone,
supplied from their environment and never committed.
"""

from __future__ import annotations

import os

from packages.contracts.phone import InvalidPhoneNumber, mask, validate_e164

ENV_VAR = "DEMO_CALL_NUMBER"


class LiveCallRefused(RuntimeError):
    """Raised instead of dialling something we are not certain about."""


def demo_number() -> str | None:
    """The one number live calls may reach, or None if the team has not set one."""
    raw = os.environ.get(ENV_VAR, "").strip()
    if not raw:
        return None
    try:
        return validate_e164(raw)
    except InvalidPhoneNumber as exc:
        raise LiveCallRefused(
            f"{ENV_VAR} is set but is not a valid E.164 number ({exc}). "
            "Refusing to dial rather than guessing."
        ) from None


def demo_number_masked() -> str | None:
    number = demo_number()
    return mask(number) if number else None


def destination_for(supplier_id: str, *, live: bool, records=None) -> str:
    """The number to dial for a supplier, or a refusal.

    In live mode this ignores the supplier's number on record entirely: every
    call in the demo goes to the phone the team is holding, and the supplier
    identity travels as call metadata instead. That is what makes it safe to
    press the button in front of an audience.
    """
    if not live:
        raise LiveCallRefused(
            "test mode resolves no phone numbers — no call is placed"
        )

    number = demo_number()
    if number is None:
        raise LiveCallRefused(
            f"live calling needs {ENV_VAR} set to a phone you control "
            "(E.164, e.g. +49...). Refusing to dial a supplier on record."
        )
    return number

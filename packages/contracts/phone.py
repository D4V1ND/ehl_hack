"""Phone number safety.

The non-negotiable rule: a raw, unmasked phone number may exist in exactly one
place — inside the literal outbound request body used to place a call. Anywhere
it could otherwise surface (an API response, a log line, a report, a fixture) it
must already be masked.

This module is therefore the only place in the package that handles raw numbers.
No model in `contracts.models` carries a raw phone field at all; the public
`SupplierRecord` has `phone_masked` and nothing else, so there is no field for a
raw number to leak through even by accident.
"""

from __future__ import annotations

import re

# E.164: a leading +, a non-zero country-code digit, then 7-14 more digits.
E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")

# Country codes we actually seed. Used only to decide how much of the prefix a
# masked number keeps, so the mask reads as "+49******5142" rather than hiding
# the country too. An unknown code falls back to keeping two digits.
_KNOWN_COUNTRY_CODES = (
    "352", "353", "358", "359", "370", "371", "372", "385", "386", "420", "421",
    "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46",
    "47", "48", "49", "81", "82", "86", "90", "91",
    "1",
)

MASK_CHAR = "*"


class InvalidPhoneNumber(ValueError):
    """Raised the moment a number that is not valid E.164 enters the system."""


def validate_e164(number: str) -> str:
    """Return `number` unchanged if it is valid E.164, else raise.

    Called at the boundary — when a number is read from seed data or arrives in a
    request — so an invalid number is refused before anything can try to dial it.
    The error message carries the *masked* form, never the raw one.
    """
    if not isinstance(number, str):
        raise InvalidPhoneNumber(f"phone number must be a string, got {type(number).__name__}")

    candidate = number.strip()
    if not E164_PATTERN.match(candidate):
        raise InvalidPhoneNumber(
            f"not a valid E.164 phone number: {mask(candidate)!r} "
            "(expected a leading '+', a country code, and 8-15 digits in total)"
        )
    return candidate


def is_e164(number: str) -> bool:
    return isinstance(number, str) and bool(E164_PATTERN.match(number.strip()))


def _country_code(digits: str) -> str:
    for code in _KNOWN_COUNTRY_CODES:
        if digits.startswith(code):
            return code
    return digits[:2]


def mask(number: str) -> str:
    """Mask a phone number for display, logging, storage and every API response.

    Keeps the country code and the last four digits; everything between becomes
    asterisks — `+493023125142` -> `+49******5142`.

    Deliberately never raises. Masking is called on error paths and in log
    formatters, so a malformed number must still come back masked rather than
    blowing up and printing the original in a traceback.
    """
    if not isinstance(number, str):
        return MASK_CHAR * 8

    candidate = number.strip()
    if not candidate:
        return MASK_CHAR * 8

    plus, digits = ("+", candidate[1:]) if candidate.startswith("+") else ("", candidate)
    digits = re.sub(r"\D", "", digits)

    if len(digits) <= 4:
        return f"{plus}{MASK_CHAR * len(digits)}" if digits else MASK_CHAR * 8

    code = _country_code(digits)
    if len(digits) - len(code) <= 4:
        code = ""

    tail = digits[-4:]
    hidden = len(digits) - len(code) - 4
    return f"{plus}{code}{MASK_CHAR * hidden}{tail}"

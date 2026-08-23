"""Which channel reaches which supplier.

CALL-E supports a fixed set of regions. China is not among them, so the
China leg goes by marketplace message. Anything else unsupported falls
back to email — never to voice, because dialling an unsupported region
fails at CALL-E and burns a credit.
"""

from __future__ import annotations

from packages.contracts.models import Channel

CALLE_REGIONS: frozenset[str] = frozenset({"DE", "AT", "CH", "GB", "US", "IE", "NL"})

MARKETPLACE_REGIONS: frozenset[str] = frozenset({"CN", "HK", "TW"})


def route_channel(country_code: str) -> Channel:
    code = (country_code or "").upper()
    if code in CALLE_REGIONS:
        return Channel.VOICE
    if code in MARKETPLACE_REGIONS:
        return Channel.MARKETPLACE
    return Channel.EMAIL

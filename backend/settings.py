"""Environment configuration. Rehearsal is the default everywhere."""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(REPO_ROOT / ".env")

# Rehearsal is the default. Live calling is an explicit opt-in, never a
# fallback and never triggered by a merely-unset variable.
FAKE_CALLS: bool = os.environ.get("FAKE_CALLS", "1") == "1"

CALLE_API_KEY: str | None = os.environ.get("CALLE_API_KEY")
CALLE_BASE_URL: str = os.environ.get("CALLE_BASE_URL", "https://api.heycall-e.com")
PUBLIC_BASE_URL: str = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").strip().rstrip("/")

BUYER_NAME: str = os.environ.get("BUYER_NAME", "Meridian Motors")

# Seconds. The fake waits this long before delivering each quote, so
# consumers are forced to build against the async shape a real call has.
FAKE_MIN_DELAY: float = float(os.environ.get("FAKE_MIN_DELAY", "0.4"))
FAKE_MAX_DELAY: float = float(os.environ.get("FAKE_MAX_DELAY", "2.5"))

# Seconds. A real call sits queued and then runs for a few minutes, so the
# live provider polls CALL-E for the result rather than waiting on a webhook.
# Polling is an outbound request, so it needs no public URL and no tunnel.
CALLE_POLL_INTERVAL: float = float(os.environ.get("CALLE_POLL_INTERVAL", "10"))
CALLE_POLL_TIMEOUT: float = float(os.environ.get("CALLE_POLL_TIMEOUT", "900"))

# Where finished quotes are written. STORE only lives as long as the
# process, so without this a completed call leaves nothing behind.
QUOTES_DIR: Path = Path(os.environ.get("QUOTES_DIR", str(REPO_ROOT / "data" / "quotes")))

# The language the agent speaks. This drives the call, not the script: a
# de-DE locale produced a fully German call even though the task text was
# written in English, so keep it in step with the prompt's language rule.
CALLE_LOCALE: str = os.environ.get("CALLE_LOCALE", "en-US")
# Where the number being dialled lives — a routing detail, not a language.
CALLE_REGION: str = os.environ.get("CALLE_REGION", "DE")

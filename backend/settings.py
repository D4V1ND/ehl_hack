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
        # Quoted values are ordinary in a .env file and every real dotenv library
        # unwraps them. Without this the quote characters travel inside the secret
        # and into the Authorization header, and the API answers 401.
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(REPO_ROOT / ".env")

# Rehearsal is the default. Live calling is an explicit opt-in, never a
# fallback and never triggered by a merely-unset variable.
FAKE_CALLS: bool = os.environ.get("FAKE_CALLS", "1") == "1"

CALLE_API_KEY: str | None = os.environ.get("CALLE_API_KEY")
CALLE_BASE_URL: str = os.environ.get("CALLE_BASE_URL", "https://api.heycall-e.com")
# Where CALL-E posts a finished call. It has to be a URL reachable from the
# public internet -- an HTTPS tunnel to this API -- or the calls go out and the
# answers never come back. The localhost default is honest about that: it is the
# API's real port, and dispatch says out loud when results have nowhere to land.
def public_base_url() -> str:
    """Read per call, never captured at import.

    `run.py` opens the tunnel and hands the URL to the API process, but a tunnel
    can also be opened by hand mid-run (`python run.py tunnel`) and exported into
    an already-running shell. A module constant would freeze whichever value
    happened to exist at import and quietly dial with the stale one.
    """
    return os.environ.get("PUBLIC_BASE_URL") or (
        f"http://localhost:{os.environ.get('API_PORT', '8010')}"
    )

BUYER_NAME: str = os.environ.get("BUYER_NAME", "Meridian Motors")

# Seconds. The fake waits this long before delivering each quote, so
# consumers are forced to build against the async shape a real call has.
FAKE_MIN_DELAY: float = float(os.environ.get("FAKE_MIN_DELAY", "0.4"))
FAKE_MAX_DELAY: float = float(os.environ.get("FAKE_MAX_DELAY", "2.5"))

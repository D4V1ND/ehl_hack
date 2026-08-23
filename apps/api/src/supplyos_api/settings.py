"""Runtime settings. Rehearsal is the default; live calling is an explicit opt-in.

The rule from the foundation spec, restated as code: live calling is never a
fallback and is never triggered by a setting merely being unset. `LIVE_CALLS`
must be set to exactly "yes-place-real-calls" -- a value nobody types by
accident -- and anything else, including an empty value, means rehearsal.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

LIVE_CALLS_CONFIRMATION = "yes-place-real-calls"

# This package uses a src layout: apps/api/src/supplyos_api/settings.py.
# Keep repository-relative paths here so storage and fixture code do not each
# have to know how deeply the package is nested.
PACKAGE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = Path(__file__).resolve().parents[4]

# The dev UI moves to :3001 whenever :3000 is taken, and a demo laptop cannot
# afford a CORS surprise. Both local ports are trusted by default; anything else
# is opt-in through CASES_ALLOWED_ORIGINS. Never "*": these routes start Devin
# sessions and place calls.
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
]


def cors_origins_from_env(raw: str | None) -> list[str]:
    extra = [origin.strip() for origin in (raw or "").split(",") if origin.strip()]
    return list(dict.fromkeys([*DEFAULT_CORS_ORIGINS, *extra]))


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

# Transport settings are module constants for backwards compatibility with
# the provider adapters and their tests. They now live beside Settings rather
# than in a second, competing settings module.
FAKE_CALLS: bool = os.environ.get("FAKE_CALLS", "1") == "1"
CALLE_API_KEY: str | None = os.environ.get("CALLE_API_KEY")
CALLE_BASE_URL: str = os.environ.get("CALLE_BASE_URL", "https://api.heycall-e.com")
PUBLIC_BASE_URL: str = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").strip().rstrip("/")
BUYER_NAME: str = os.environ.get("BUYER_NAME", "Meridian Motors")
FAKE_MIN_DELAY: float = float(os.environ.get("FAKE_MIN_DELAY", "0.4"))
FAKE_MAX_DELAY: float = float(os.environ.get("FAKE_MAX_DELAY", "2.5"))
CALLE_POLL_INTERVAL: float = float(os.environ.get("CALLE_POLL_INTERVAL", "10"))
CALLE_POLL_TIMEOUT: float = float(os.environ.get("CALLE_POLL_TIMEOUT", "900"))
QUOTES_DIR: Path = Path(os.environ.get("QUOTES_DIR", str(REPO_ROOT / "data" / "quotes")))
CALLE_LOCALE: str = os.environ.get("CALLE_LOCALE", "en-US")
CALLE_REGION: str = os.environ.get("CALLE_REGION", "DE")


@dataclass(frozen=True)
class Settings:
    repo_root: Path
    live_calls_enabled: bool
    # Which system-of-record adapter to serve from. Both implement the same
    # `SystemOfRecord` interface and pass the same tests; "sqlite" is the default
    # and "yaml" is the reference implementation, kept because having two proves
    # the adapter seam is real rather than decorative.
    record_backend: str = "sqlite"
    # Publishing the decision as a pull request. Unset means rehearsal: the
    # publish endpoint reports the branch and files it would have pushed.
    github_token: str | None = None
    github_repo: str | None = None
    github_base_branch: str = "main"
    cors_origins: list[str] = field(default_factory=lambda: DEFAULT_CORS_ORIGINS.copy())

    @property
    def call_mode(self) -> str:
        return "live" if self.live_calls_enabled else "rehearsal"


def get_settings() -> Settings:
    backend = os.environ.get("RECORD_BACKEND", "sqlite").strip().lower()
    if backend not in ("sqlite", "yaml"):
        raise ValueError(f'RECORD_BACKEND must be "sqlite" or "yaml", got {backend!r}')
    return Settings(
        repo_root=REPO_ROOT,
        live_calls_enabled=os.environ.get("LIVE_CALLS", "").strip() == LIVE_CALLS_CONFIRMATION,
        record_backend=backend,
        github_token=os.environ.get("GITHUB_TOKEN", "").strip() or None,
        github_repo=os.environ.get("GITHUB_REPO", "").strip() or None,
        github_base_branch=os.environ.get("GITHUB_BASE_BRANCH", "main").strip() or "main",
        cors_origins=cors_origins_from_env(os.environ.get("CASES_ALLOWED_ORIGINS")),
    )

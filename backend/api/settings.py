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
        os.environ.setdefault(key.strip(), value.strip())


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
    repo_root = Path(__file__).resolve().parents[2]
    _load_dotenv(repo_root / ".env")
    backend = os.environ.get("RECORD_BACKEND", "sqlite").strip().lower()
    if backend not in ("sqlite", "yaml"):
        raise ValueError(f'RECORD_BACKEND must be "sqlite" or "yaml", got {backend!r}')
    return Settings(
        repo_root=repo_root,
        live_calls_enabled=os.environ.get("LIVE_CALLS", "").strip() == LIVE_CALLS_CONFIRMATION,
        record_backend=backend,
        github_token=os.environ.get("GITHUB_TOKEN", "").strip() or None,
        github_repo=os.environ.get("GITHUB_REPO", "").strip() or None,
        github_base_branch=os.environ.get("GITHUB_BASE_BRANCH", "main").strip() or "main",
        cors_origins=cors_origins_from_env(os.environ.get("CASES_ALLOWED_ORIGINS")),
    )

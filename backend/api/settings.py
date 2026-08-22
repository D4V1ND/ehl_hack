"""Runtime settings.

Rehearsal is the default and live calling is an explicit opt-in -- the rule from
the foundation spec, restated as code.

**One switch, not two.** Slice C's `FAKE_CALLS` in `backend/settings.py` is what
actually selects the provider, so this module reads that rather than defining a
competing flag. Having `/healthz` report one switch while dispatch obeyed another
is exactly the confusion that ends with somebody believing they are in rehearsal
while a phone rings.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

LIVE_CALLS_CONFIRMATION = "yes-place-real-calls"  # legacy; FAKE_CALLS is authoritative


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        # Quoted values are ordinary in .env; unwrap them or the quotes end up
        # inside secrets and every authenticated call fails with a 401.
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    repo_root: Path
    live_calls_enabled: bool
    # Which system-of-record adapter to serve from. Both implement the same
    # `SystemOfRecord` interface and pass the same tests; "sqlite" is the default
    # and "yaml" is the reference implementation, kept because having two proves
    # the adapter seam is real rather than decorative.
    record_backend: str = "sqlite"
    # Local development origins. A regex rather than a list because the cockpit
    # is reached on localhost, on 127.0.0.1, and -- under WSL -- on the VM's own
    # IP, and the port drifts when one is already taken.
    cors_origin_regex: str = r"http://(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+):\d+"

    @property
    def call_mode(self) -> str:
        return "live" if self.live_calls_enabled else "test"


def get_settings() -> Settings:
    repo_root = Path(__file__).resolve().parents[2]
    _load_dotenv(repo_root / ".env")
    backend = os.environ.get("RECORD_BACKEND", "sqlite").strip().lower()
    if backend not in ("sqlite", "yaml"):
        raise ValueError(f'RECORD_BACKEND must be "sqlite" or "yaml", got {backend!r}')
    return Settings(
        repo_root=repo_root,
        # Authoritative: Slice C's provider selection. FAKE_CALLS defaults to "1",
        # so live requires deliberately setting it to "0".
        live_calls_enabled=os.environ.get("FAKE_CALLS", "1").strip() == "0",
        record_backend=backend,
    )

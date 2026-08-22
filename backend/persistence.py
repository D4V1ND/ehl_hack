"""Write finished quotes to disk.

STORE is an in-memory working set that dies with the process, so a call
that cost real money and real time leaves no trace after a restart. Every
quote that arrives is also written here as JSON, including the full `raw`
CALL-E record — transcript turns included — because the transcript is the
evidence behind the typed fields and is worth more than the fields alone.

One file per task: data/quotes/<case_id>/<task_id>.json. Re-running the
same task overwrites its file, so a retried call replaces its own result
rather than accumulating duplicates.
"""

from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

from backend import settings
from packages.contracts.models import Quote

# case_id/task_id reach us from callers and end up in a path, so keep them
# to characters that cannot escape the quotes directory.
_UNSAFE = re.compile(r"[^A-Za-z0-9._-]")


def _safe(name: str) -> str:
    cleaned = _UNSAFE.sub("_", name or "")
    return cleaned or "UNKNOWN"


def quote_path(case_id: str, task_id: str) -> Path:
    return settings.QUOTES_DIR / _safe(case_id) / f"{_safe(task_id)}.json"


def save_quote(quote: Quote) -> Path:
    """Write one quote to disk and return where it landed."""
    path = quote_path(quote.case_id, quote.task_id)
    path.parent.mkdir(parents=True, exist_ok=True)

    payload = json.dumps(quote.model_dump(mode="json"), indent=2, ensure_ascii=False)

    # Write via a temp file in the same directory, then replace: a crash
    # mid-write leaves the previous good file intact rather than a truncated
    # one that no longer parses.
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=path.parent,
        prefix=path.name,
        suffix=".tmp",
        delete=False,
    ) as handle:
        handle.write(payload)
        temp_path = Path(handle.name)

    temp_path.replace(path)
    return path

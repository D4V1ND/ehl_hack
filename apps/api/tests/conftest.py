"""Every system-of-record test runs against both adapters.

The claim "swapping in a real ERPNext is one adapter class" is only worth making
if it is enforced, so the `erp` fixture is parametrized: the YAML reference
implementation and the SQLite one both have to satisfy every assertion. A change
that quietly makes a test depend on one backend's behaviour fails immediately.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


def _live_run_requested() -> bool:
    """Return whether pytest explicitly selected the live marker."""
    for index, argument in enumerate(sys.argv):
        if argument == "-m" and index + 1 < len(sys.argv):
            expression = sys.argv[index + 1]
        elif argument.startswith("-m") and len(argument) > 2:
            expression = argument[2:]
        else:
            continue
        if "live" in expression and "not live" not in expression:
            return True
    return False


# A developer's armed .env must never make the ordinary suite dial CALL-E or
# launch a real Devin session. Explicit `pytest -m live` remains the opt-in.
if not _live_run_requested():
    os.environ.update(
        FAKE_CALLS="1",
        LIVE_CALLS="",
        MAX_LIVE_CALLS="0",
        DEVIN_API_KEY="",
    )

# Keep the tests runnable directly from a clean checkout without requiring an
# editable install first. The API uses a src layout, while contracts remain a
# repository-level shared package.
API_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(API_ROOT / "src"))
sys.path.insert(0, str(REPOSITORY_ROOT))

from supplyos_api.record.mock_erp import MockERP
from supplyos_api.record.seed_db import build as build_db
from supplyos_api.record.sqlite_erp import SqliteERP


@pytest.fixture(scope="session")
def yaml_erp() -> MockERP:
    return MockERP()


@pytest.fixture(scope="session")
def sqlite_erp(tmp_path_factory, yaml_erp) -> SqliteERP:
    """Built fresh from the same YAML, in a temp directory.

    Deliberately not the generated `erp.db`: the test should prove the
    seed compiles correctly, not that someone's local database happens to be
    up to date.
    """
    db_path = tmp_path_factory.mktemp("record") / "erp.db"
    build_db(db_path=db_path, records=yaml_erp)
    return SqliteERP(db_path)


@pytest.fixture(scope="session", params=["yaml", "sqlite"])
def erp(request, yaml_erp, sqlite_erp):
    return yaml_erp if request.param == "yaml" else sqlite_erp

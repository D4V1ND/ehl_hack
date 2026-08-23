"""Every system-of-record test runs against both adapters.

The claim "swapping in a real ERPNext is one adapter class" is only worth making
if it is enforced, so the `erp` fixture is parametrized: the YAML reference
implementation and the SQLite one both have to satisfy every assertion. A change
that quietly makes a test depend on one backend's behaviour fails immediately.
"""

from __future__ import annotations

import pytest

from backend.record.mock_erp import MockERP
from backend.record.seed_db import build as build_db
from backend.record.sqlite_erp import SqliteERP


@pytest.fixture(scope="session")
def yaml_erp() -> MockERP:
    return MockERP()


@pytest.fixture(scope="session")
def sqlite_erp(tmp_path_factory, yaml_erp) -> SqliteERP:
    """Built fresh from the same YAML, in a temp directory.

    Deliberately not the checked-out `supplyguard.db`: the test should prove the
    seed compiles correctly, not that someone's local database happens to be
    up to date.
    """
    db_path = tmp_path_factory.mktemp("record") / "supplyguard.db"
    build_db(db_path=db_path, records=yaml_erp)
    return SqliteERP(db_path)


@pytest.fixture(scope="session", params=["yaml", "sqlite"])
def erp(request, yaml_erp, sqlite_erp):
    return yaml_erp if request.param == "yaml" else sqlite_erp

"""Shared singletons. Seed data is parsed once, at startup, and never again."""

from __future__ import annotations

from backend.api.settings import Settings, get_settings
from backend.record.ports import SystemOfRecord
from backend.casestore.case_store import CaseStore, get_case_store


def erp() -> SystemOfRecord:
    """The system of record, chosen by `RECORD_BACKEND`.

    Both adapters satisfy the same Protocol and are covered by the same tests, so
    every caller downstream is written against the interface and not against
    either implementation.

    The SQLite file is a build artifact derived from the committed seed YAML, so
    if it is missing it is built rather than raising -- there is nothing in it a
    rebuild could lose.
    """
    config = get_settings()
    if config.record_backend == "yaml":
        from backend.record.mock_erp import get_mock_erp

        return get_mock_erp()

    from backend.record.sqlite_erp import DB_PATH, get_sqlite_erp

    if not DB_PATH.exists():
        from backend.record.seed_db import build

        build()
    return get_sqlite_erp()


def store() -> CaseStore:
    return get_case_store()


def settings() -> Settings:
    return get_settings()

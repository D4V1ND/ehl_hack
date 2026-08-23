"""Incident plants survive the trusted-record SQLite boundary."""

from __future__ import annotations

import sqlite3

from backend.record.mock_erp import MockERP
from backend.record.seed_db import build
from backend.record.sqlite_erp import SqliteERP


def test_incident_plants_round_trip_through_seeded_sqlite(tmp_path):
    records = MockERP()
    expected = records.get_incident("CASE-001")
    assert expected is not None and expected.plants

    database = build(tmp_path / "records.db", records)
    sqlite_records = SqliteERP(database)
    try:
        actual = sqlite_records.get_incident("CASE-001")
    finally:
        sqlite_records.conn.close()

    assert actual is not None
    assert actual.plants == expected.plants


def test_incident_reader_accepts_an_existing_database_without_plants(tmp_path):
    database = tmp_path / "legacy-records.db"
    connection = sqlite3.connect(database)
    try:
        connection.executescript(
            """
            CREATE TABLE tabIncident (
                case_id TEXT PRIMARY KEY,
                part_id TEXT NOT NULL,
                plant_id TEXT NOT NULL,
                production_line TEXT NOT NULL,
                qty_required INTEGER NOT NULL,
                qty_on_hand INTEGER NOT NULL,
                needed_by TEXT NOT NULL,
                line_stop_at TEXT NOT NULL,
                line_stop_cost_per_hour TEXT NOT NULL,
                currency TEXT NOT NULL,
                incumbent_supplier_id TEXT,
                reason TEXT NOT NULL
            );
            INSERT INTO tabIncident VALUES (
                'CASE-LEGACY', 'PRT-6204', 'PLANT-MUC', 'ASSY-3',
                40000, 8000, '2026-09-04', '2026-09-04T06:00:00+00:00',
                '4000.00', 'EUR', NULL, 'Legacy row'
            );
            """
        )
        connection.commit()
    finally:
        connection.close()

    sqlite_records = SqliteERP(database)
    try:
        incident = sqlite_records.get_incident("CASE-LEGACY")
    finally:
        sqlite_records.conn.close()

    assert incident is not None
    assert incident.plants == []

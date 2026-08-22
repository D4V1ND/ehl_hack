"""The system of record, over SQL.

`SqliteERP` implements exactly the same `SystemOfRecord` interface as `MockERP`
and is checked by exactly the same tests. That is the point of it: the claim
"swapping in a real ERPNext is one adapter class" stops being a promise and
becomes something you can run -- two backends, one interface, one test suite.

**Raw phone numbers.** `tabSupplier` stores one, because something eventually has
to dial it. No SELECT in this module that builds a `SupplierRecord` reads that
column; the only query that touches it is `raw_phone_for_outreach`, which exists
for the code that constructs an outbound call and is named so its use is obvious
in a diff.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

from packages.contracts.models import (
    CompanyProfile,
    Incident,
    OpenPurchaseOrder,
    Part,
    PriceBreak,
    StockLevel,
    SupplierPriceRecord,
    SupplierRecord,
)

DB_PATH = Path(__file__).parent / "supplyguard.db"

# Everything a SupplierRecord needs, and `phone` deliberately absent. Always
# qualified with the `s` alias so the same list works inside a join.
SUPPLIER_COLUMNS = """
    s.supplier_id, s.supplier_name, s.country, s.locale, s.phone_masked, s.email,
    s.marketplace_url, s.channels, s.approved, s.preferred, s.incumbent,
    s.contract_unit_price, s.standard_lead_days, s.certifications,
    s.certification_expires_at, s.audit_status, s.known_allocations,
    s.max_historical_fill
"""


class DatabaseMissing(RuntimeError):
    pass


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


class SqliteERP:
    """A `SystemOfRecord` backed by SQLite."""

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or DB_PATH
        if not self.db_path.exists():
            raise DatabaseMissing(
                f"no database at {self.db_path}. Run `make db` "
                "(python -m backend.record.seed_db) to build it from the seed YAML."
            )
        # check_same_thread=False because uvicorn serves from a worker thread and
        # every query here is a read.
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")

    def _rows(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    def _row(self, sql: str, params: tuple = ()) -> sqlite3.Row | None:
        return self.conn.execute(sql, params).fetchone()

    # -- mapping ------------------------------------------------------------

    @staticmethod
    def _part(row: sqlite3.Row) -> Part:
        return Part(
            part_id=row["part_id"], item_code=row["item_code"], item_name=row["item_name"],
            description=row["description"], spec=json.loads(row["spec_json"]),
            stock_uom=row["stock_uom"], criticality=row["criticality"],
            part_class=row["part_class"], weight_kg=row["weight_kg"],
            hs_code=row["hs_code"], standard_cost=Decimal(row["standard_cost"]),
        )

    def _supplier(self, row: sqlite3.Row) -> SupplierRecord:
        supplier_id = row["supplier_id"]
        return SupplierRecord(
            supplier_id=supplier_id, supplier_name=row["supplier_name"],
            country=row["country"], locale=row["locale"],
            phone_masked=row["phone_masked"], email=row["email"],
            marketplace_url=row["marketplace_url"],
            channels=json.loads(row["channels"]),
            part_ids=[
                r["part_id"]
                for r in self._rows(
                    "SELECT part_id FROM tabSupplierItem WHERE supplier_id = ? ORDER BY part_id",
                    (supplier_id,),
                )
            ],
            approved=bool(row["approved"]), preferred=bool(row["preferred"]),
            incumbent=bool(row["incumbent"]),
            contract_unit_price=(
                Decimal(row["contract_unit_price"]) if row["contract_unit_price"] else None
            ),
            standard_lead_days=row["standard_lead_days"],
            certifications=json.loads(row["certifications"]),
            certification_expires_at=_date(row["certification_expires_at"]),
            audit_status=row["audit_status"],
            known_allocations=row["known_allocations"],
            max_historical_fill=row["max_historical_fill"],
            price_breaks=[
                PriceBreak(min_qty=r["min_qty"], unit_price=Decimal(r["unit_price"]))
                for r in self._rows(
                    "SELECT min_qty, unit_price FROM tabSupplierPriceBreak "
                    "WHERE supplier_id = ? ORDER BY min_qty",
                    (supplier_id,),
                )
            ],
        )

    @staticmethod
    def _stock(row: sqlite3.Row) -> StockLevel:
        return StockLevel(
            part_id=row["part_id"], warehouse=row["warehouse"], plant_id=row["plant_id"],
            actual_qty=row["actual_qty"], reserved_qty=row["reserved_qty"],
            reorder_level=row["reorder_level"], daily_consumption=row["daily_consumption"],
        )

    # -- the spec's two questions ------------------------------------------

    def get_suppliers_for_part(self, part_id: str) -> list[SupplierRecord]:
        """Deterministic call order, done in SQL: preferred, then cheapest, then id.

        `CAST(contract_unit_price AS REAL)` is for ORDER BY only -- the value
        itself is still carried through as text and parsed into Decimal.
        """
        rows = self._rows(
            f"""
            SELECT {SUPPLIER_COLUMNS}
              FROM tabSupplier s
              JOIN tabSupplierItem si ON si.supplier_id = s.supplier_id
             WHERE si.part_id = ? AND s.approved = 1
             ORDER BY s.preferred DESC,
                      CAST(COALESCE(s.contract_unit_price, '999999') AS REAL) ASC,
                      s.supplier_id ASC
            """,
            (part_id,),
        )
        return [self._supplier(row) for row in rows]

    def get_incident(self, case_id: str) -> Incident | None:
        row = self._row("SELECT * FROM tabIncident WHERE case_id = ?", (case_id,))
        return self._incident(row) if row else None

    @staticmethod
    def _incident(row: sqlite3.Row) -> Incident:
        return Incident(
            case_id=row["case_id"], part_id=row["part_id"], plant_id=row["plant_id"],
            production_line=row["production_line"], qty_required=row["qty_required"],
            qty_on_hand=row["qty_on_hand"], needed_by=_date(row["needed_by"]),
            line_stop_at=datetime.fromisoformat(row["line_stop_at"]),
            line_stop_cost_per_hour=Decimal(row["line_stop_cost_per_hour"]),
            currency=row["currency"], incumbent_supplier_id=row["incumbent_supplier_id"],
            reason=row["reason"],
        )

    # -- the rest -----------------------------------------------------------

    def get_part(self, part_id: str) -> Part | None:
        row = self._row("SELECT * FROM tabItem WHERE part_id = ?", (part_id,))
        return self._part(row) if row else None

    def list_parts(self) -> list[Part]:
        return [self._part(r) for r in self._rows("SELECT * FROM tabItem ORDER BY part_id")]

    def get_supplier(self, supplier_id: str) -> SupplierRecord | None:
        row = self._row(
            f"SELECT {SUPPLIER_COLUMNS} FROM tabSupplier s WHERE s.supplier_id = ?", (supplier_id,)
        )
        return self._supplier(row) if row else None

    def list_suppliers(self) -> list[SupplierRecord]:
        return [
            self._supplier(r)
            for r in self._rows(f"SELECT {SUPPLIER_COLUMNS} FROM tabSupplier s ORDER BY s.supplier_id")
        ]

    def get_stock(self, part_id: str, plant_id: str | None = None) -> list[StockLevel]:
        if plant_id is None:
            rows = self._rows("SELECT * FROM tabBin WHERE part_id = ?", (part_id,))
        else:
            rows = self._rows(
                "SELECT * FROM tabBin WHERE part_id = ? AND plant_id = ?", (part_id, plant_id)
            )
        return [self._stock(r) for r in rows]

    def list_stock(self) -> list[StockLevel]:
        return [self._stock(r) for r in self._rows("SELECT * FROM tabBin")]

    def get_open_pos(self, part_id: str | None = None) -> list[OpenPurchaseOrder]:
        sql = "SELECT * FROM tabPurchaseOrder"
        params: tuple = ()
        if part_id is not None:
            sql += " WHERE part_id = ?"
            params = (part_id,)
        return [
            OpenPurchaseOrder(
                po_id=r["po_id"], part_id=r["part_id"], supplier_id=r["supplier_id"],
                qty=r["qty"], promised_date=_date(r["promised_date"]),
                revised_date=_date(r["revised_date"]), status=r["status"],
            )
            for r in self._rows(sql + " ORDER BY po_id", params)
        ]

    def get_price_history(
        self, part_id: str, supplier_id: str | None = None
    ) -> list[SupplierPriceRecord]:
        sql = "SELECT * FROM tabItemPrice WHERE part_id = ?"
        params: tuple = (part_id,)
        if supplier_id is not None:
            sql += " AND supplier_id = ?"
            params = (part_id, supplier_id)
        return [
            SupplierPriceRecord(
                supplier_id=r["supplier_id"], part_id=r["part_id"], as_of=_date(r["as_of"]),
                unit_price=Decimal(r["unit_price"]), qty=r["qty"], currency=r["currency"],
            )
            for r in self._rows(sql + " ORDER BY supplier_id, as_of", params)
        ]

    def get_alternates(self, part_id: str) -> list[Part]:
        """Same class, same bore, different part. A starting point, not an answer."""
        part = self.get_part(part_id)
        if part is None:
            return []
        bore = part.spec.get("bore_mm")
        rows = self._rows(
            "SELECT * FROM tabItem WHERE part_class = ? AND part_id != ? ORDER BY part_id",
            (part.part_class.value, part_id),
        )
        candidates = [self._part(r) for r in rows]
        if bore is None:
            return candidates
        return [c for c in candidates if c.spec.get("bore_mm") == bore]

    def get_company_profile(self) -> CompanyProfile:
        row = self._row("SELECT profile_json FROM tabCompanyProfile WHERE id = 1")
        if row is None:
            raise DatabaseMissing("tabCompanyProfile is empty; rebuild with `make db`")
        return CompanyProfile(**json.loads(row["profile_json"]))

    def list_incidents(self) -> list[Incident]:
        return [self._incident(r) for r in self._rows("SELECT * FROM tabIncident ORDER BY case_id")]

    def get_bom_for_part(self, part_id: str) -> dict[str, Any] | None:
        row = self._row(
            """
            SELECT b.* FROM tabBOM b
              JOIN tabBOMItem bi ON bi.bom_id = b.bom_id
             WHERE bi.part_id = ? LIMIT 1
            """,
            (part_id,),
        )
        if row is None:
            return None
        return {
            "bom_id": row["bom_id"], "item_name": row["item_name"],
            "plant_id": row["plant_id"], "production_line": row["production_line"],
            "lines": [
                {"part_id": r["part_id"], "qty_per_unit": r["qty_per_unit"]}
                for r in self._rows(
                    "SELECT part_id, qty_per_unit FROM tabBOMItem WHERE bom_id = ? ORDER BY idx",
                    (row["bom_id"],),
                )
            ],
        }

    def parts_at_risk(self) -> list[sqlite3.Row]:
        """The `vw_parts_at_risk` view -- one query instead of re-deriving in Python."""
        return self._rows("SELECT * FROM vw_parts_at_risk")

    # -- the one raw-phone accessor ----------------------------------------

    def raw_phone_for_outreach(self, supplier_id: str) -> str:
        """The only SELECT in this module that reads `tabSupplier.phone`."""
        row = self._row("SELECT phone FROM tabSupplier WHERE supplier_id = ?", (supplier_id,))
        if row is None:
            raise KeyError(f"no phone number on record for supplier {supplier_id}")
        return row["phone"]


@lru_cache(maxsize=1)
def get_sqlite_erp() -> SqliteERP:
    return SqliteERP()

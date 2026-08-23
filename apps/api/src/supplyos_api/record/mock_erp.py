"""The seeded system of record.

Loads `demo_data/*.yaml` once at construction, validates every row against the
contracts, and serves it from memory. Every lookup is a dict access, because
Devin burns ACUs while it waits on us.

**Raw phone numbers.** A supplier's real number is validated to E.164 on the way
in and then kept in a private map that no public method returns. The
`SupplierRecord` handed to callers carries `phone_masked` and has no field for
an unmasked number, so nothing downstream can leak one even by mistake. The one
deliberate exception is `raw_phone_for_outreach`, which exists for the code that
literally builds the outbound call request and is named so that its use is
obvious in a diff.
"""

from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from packages.contracts.models import Channel
from packages.contracts.models import (
    CompanyProfile,
    Incident,
    OpenPurchaseOrder,
    Part,
    StockLevel,
    SupplierPriceRecord,
    SupplierRecord,
)
from packages.contracts.phone import mask, validate_e164

DEMO_DATA = Path(__file__).parent / "demo_data"


class SeedDataError(RuntimeError):
    """The seed data is internally inconsistent. Fail loudly at startup, not at demo time."""


def _load(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


class MockERP:
    """A `SystemOfRecord` backed by committed YAML."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or DEMO_DATA
        self._raw_phones: dict[str, str] = {}

        self.profile = CompanyProfile(**_load(self.data_dir / "company_profile.yaml"))
        self.warehouses: list[dict[str, Any]] = _load(self.data_dir / "warehouses.yaml")
        self.boms: list[dict[str, Any]] = _load(self.data_dir / "boms.yaml")

        self._parts = {p.part_id: p for p in (Part(**row) for row in _load(self.data_dir / "parts.yaml"))}
        self._suppliers = {s.supplier_id: s for s in self._load_suppliers()}
        self._stock = [StockLevel(**row) for row in _load(self.data_dir / "bins.yaml")]
        self._pos = [OpenPurchaseOrder(**row) for row in _load(self.data_dir / "purchase_orders.yaml")]
        self._prices = [SupplierPriceRecord(**row) for row in _load(self.data_dir / "item_supplier_prices.yaml")]
        self._incidents = {i.case_id: i for i in (Incident(**row) for row in _load(self.data_dir / "incidents.yaml"))}

        self._check_referential_integrity()

    # -- loading ------------------------------------------------------------

    def _load_suppliers(self) -> list[SupplierRecord]:
        records: list[SupplierRecord] = []
        for row in _load(self.data_dir / "suppliers.yaml"):
            row = dict(row)
            raw = validate_e164(row.pop("phone"))  # refuses a bad number before anything can dial it
            row["phone_masked"] = mask(raw)
            row.setdefault("channels", [Channel.VOICE, Channel.EMAIL])
            # Sorted, not file order: a SQL backend cannot preserve the order
            # someone happened to type these in, and the two must agree.
            row["part_ids"] = sorted(row.get("part_ids", []))
            record = SupplierRecord(**row)
            self._raw_phones[record.supplier_id] = raw
            records.append(record)
        return records

    def _check_referential_integrity(self) -> None:
        problems: list[str] = []
        parts, suppliers = set(self._parts), set(self._suppliers)

        for supplier in self._suppliers.values():
            for part_id in supplier.part_ids:
                if part_id not in parts:
                    problems.append(f"supplier {supplier.supplier_id} lists unknown part {part_id}")
        for bin_ in self._stock:
            if bin_.part_id not in parts:
                problems.append(f"stock row references unknown part {bin_.part_id}")
        for po in self._pos:
            if po.part_id not in parts:
                problems.append(f"{po.po_id} references unknown part {po.part_id}")
            if po.supplier_id not in suppliers:
                problems.append(f"{po.po_id} references unknown supplier {po.supplier_id}")
        for incident in self._incidents.values():
            if incident.part_id not in parts:
                problems.append(f"{incident.case_id} references unknown part {incident.part_id}")
        for price in self._prices:
            if price.part_id not in parts or price.supplier_id not in suppliers:
                problems.append(f"price history references unknown {price.supplier_id}/{price.part_id}")
        for bom in self.boms:
            for line in bom.get("lines", []):
                if line["part_id"] not in parts:
                    problems.append(f"{bom['bom_id']} references unknown part {line['part_id']}")

        if problems:
            raise SeedDataError(
                "seed data is inconsistent:\n  " + "\n  ".join(sorted(set(problems))[:20])
            )

    # -- the spec's two questions ------------------------------------------

    def get_suppliers_for_part(self, part_id: str) -> list[SupplierRecord]:
        matches = [s for s in self._suppliers.values() if part_id in s.part_ids and s.approved]
        # Deterministic call order: preferred, then cheapest contract price, then id.
        return sorted(
            matches,
            key=lambda s: (
                not s.preferred,
                s.contract_unit_price if s.contract_unit_price is not None else Decimal("999999"),
                s.supplier_id,
            ),
        )

    def get_incident(self, case_id: str) -> Incident | None:
        return self._incidents.get(case_id)

    # -- the rest -----------------------------------------------------------

    def get_part(self, part_id: str) -> Part | None:
        return self._parts.get(part_id)

    def list_parts(self) -> list[Part]:
        return sorted(self._parts.values(), key=lambda p: p.part_id)

    def get_supplier(self, supplier_id: str) -> SupplierRecord | None:
        return self._suppliers.get(supplier_id)

    def list_suppliers(self) -> list[SupplierRecord]:
        return sorted(self._suppliers.values(), key=lambda s: s.supplier_id)

    def get_stock(self, part_id: str, plant_id: str | None = None) -> list[StockLevel]:
        return [
            s for s in self._stock
            if s.part_id == part_id and (plant_id is None or s.plant_id == plant_id)
        ]

    def list_stock(self) -> list[StockLevel]:
        return list(self._stock)

    def get_open_pos(self, part_id: str | None = None) -> list[OpenPurchaseOrder]:
        rows = [p for p in self._pos if part_id is None or p.part_id == part_id]
        return sorted(rows, key=lambda p: p.po_id)

    def get_price_history(self, part_id: str, supplier_id: str | None = None) -> list[SupplierPriceRecord]:
        rows = [
            p for p in self._prices
            if p.part_id == part_id and (supplier_id is None or p.supplier_id == supplier_id)
        ]
        return sorted(rows, key=lambda p: (p.supplier_id, p.as_of))

    def get_alternates(self, part_id: str) -> list[Part]:
        """Other parts in the same class with a comparable primary dimension.

        Deliberately dumb -- same class, same bore, not the same part. It is a
        starting point for Devin's own research, not a substitute for it.
        """
        part = self._parts.get(part_id)
        if part is None:
            return []
        bore = part.spec.get("bore_mm")
        return sorted(
            (
                other for other in self._parts.values()
                if other.part_id != part_id
                and other.part_class == part.part_class
                and (bore is None or other.spec.get("bore_mm") == bore)
            ),
            key=lambda p: p.part_id,
        )

    def get_company_profile(self) -> CompanyProfile:
        return self.profile

    def list_incidents(self) -> list[Incident]:
        return sorted(self._incidents.values(), key=lambda i: i.case_id)

    def get_bom_for_part(self, part_id: str) -> dict[str, Any] | None:
        for bom in self.boms:
            if any(line["part_id"] == part_id for line in bom["lines"]):
                return bom
        return None

    # -- the one raw-phone accessor ----------------------------------------

    def raw_phone_for_outreach(self, supplier_id: str) -> str:
        """The unmasked number, for building an outbound call request and nothing else.

        Named this way on purpose: any other use of it is visible in a diff.
        """
        try:
            return self._raw_phones[supplier_id]
        except KeyError:
            raise KeyError(f"no phone number on record for supplier {supplier_id}") from None


@lru_cache(maxsize=1)
def get_mock_erp() -> MockERP:
    """Process-wide singleton. The YAML is parsed once, at startup."""
    return MockERP()

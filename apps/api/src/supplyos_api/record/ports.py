"""The system-of-record contract.

The foundation spec's plug-in point, stated as a Protocol. Anything that can
answer these questions correctly counts as a valid system of record, whether it
is the seeded YAML the demo runs on, a company's real ERPNext, or a JSON export
with no database behind it at all.

The first two methods are the spec's minimum -- "which approved suppliers can
make this part" and "what is this incident". The rest are what the sourcing run
needs on top, and each maps to a single ERPNext doctype so an `ERPNextAdapter`
is a mechanical translation rather than a redesign.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from packages.contracts.models import (
    CompanyProfile,
    Incident,
    OpenPurchaseOrder,
    Part,
    StockLevel,
    SupplierPriceRecord,
    SupplierRecord,
)


@runtime_checkable
class SystemOfRecord(Protocol):
    # --- the spec's two questions ---
    def get_suppliers_for_part(self, part_id: str) -> list[SupplierRecord]:
        """Approved suppliers for a part, in deterministic call order.

        Ordering is never left to a model: preferred first, then cheapest
        contract price, then supplier_id. Who gets called first is a business
        decision, not a sampling artefact.
        """
        ...

    def get_incident(self, case_id: str) -> Incident | None: ...

    # --- what a sourcing run needs on top ---
    def get_part(self, part_id: str) -> Part | None: ...
    def list_parts(self) -> list[Part]: ...
    def get_stock(self, part_id: str, plant_id: str | None = None) -> list[StockLevel]: ...
    def list_stock(self) -> list[StockLevel]: ...
    def get_bom_for_part(self, part_id: str) -> dict[str, Any] | None:
        """The assembly that consumes this part — which names the line that stops."""
        ...

    def get_open_pos(self, part_id: str | None = None) -> list[OpenPurchaseOrder]: ...
    def get_price_history(self, part_id: str, supplier_id: str | None = None) -> list[SupplierPriceRecord]: ...
    def get_alternates(self, part_id: str) -> list[Part]: ...
    def get_company_profile(self) -> CompanyProfile: ...
    def list_incidents(self) -> list[Incident]: ...

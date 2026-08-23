"""The two system-of-record adapters must be indistinguishable.

Slice C and Slice D are written against the `SystemOfRecord` interface, so if the
YAML and SQL backends ever disagree, whichever one happens to be configured
changes their behaviour. This walks every read and asserts the answers are byte
-for-byte identical -- including ordering, which the call sequence depends on.
"""

from __future__ import annotations

import pytest

from backend.record.ports import SystemOfRecord

PART = "PRT-6204"
CASE = "CASE-001"


def test_both_adapters_satisfy_the_protocol(yaml_erp, sqlite_erp):
    assert isinstance(yaml_erp, SystemOfRecord)
    assert isinstance(sqlite_erp, SystemOfRecord)


def dumps(models) -> list[str] | str:
    if isinstance(models, list):
        return [m.model_dump_json() for m in models]
    return models.model_dump_json()


@pytest.mark.parametrize(
    "call",
    [
        pytest.param(lambda e: dumps(e.list_parts()), id="list_parts"),
        pytest.param(lambda e: dumps(e.get_part(PART)), id="get_part"),
        pytest.param(lambda e: dumps(e.list_suppliers()), id="list_suppliers"),
        pytest.param(lambda e: dumps(e.get_suppliers_for_part(PART)), id="suppliers_for_part"),
        pytest.param(lambda e: dumps(e.get_stock(PART)), id="get_stock"),
        pytest.param(lambda e: dumps(e.get_open_pos()), id="open_pos"),
        pytest.param(lambda e: dumps(e.get_price_history(PART)), id="price_history"),
        pytest.param(lambda e: dumps(e.get_alternates(PART)), id="alternates"),
        pytest.param(lambda e: dumps(e.get_incident(CASE)), id="get_incident"),
        pytest.param(lambda e: dumps(e.list_incidents()), id="list_incidents"),
        pytest.param(lambda e: dumps(e.get_company_profile()), id="company_profile"),
        pytest.param(lambda e: e.get_bom_for_part(PART), id="bom_for_part"),
    ],
)
def test_reads_are_identical(yaml_erp, sqlite_erp, call):
    assert call(yaml_erp) == call(sqlite_erp)


def test_call_order_is_identical_and_deterministic(yaml_erp, sqlite_erp):
    """Preferred first, then cheapest contract price, then id -- in both backends.

    The SQL version does this in ORDER BY and the YAML version in `sorted()`;
    they have to agree, or who gets called first depends on configuration.
    """
    from_yaml = [s.supplier_id for s in yaml_erp.get_suppliers_for_part(PART)]
    from_sql = [s.supplier_id for s in sqlite_erp.get_suppliers_for_part(PART)]
    assert from_yaml == from_sql
    assert from_yaml == ["SUP-SKF", "SUP-FAG", "SUP-NSK", "SUP-SHZ", "SUP-MUN"]


def test_money_survives_both_round_trips_exactly(yaml_erp, sqlite_erp):
    """SQLite has no decimal type; prices are stored as TEXT for exactly this reason.

    A REAL column would turn 1.42 into 1.4199999999999999289457264239899814128875732421875
    somewhere between the seed and the cost model.
    """
    for supplier_id in ("SUP-SKF", "SUP-FAG", "SUP-NSK", "SUP-SHZ", "SUP-MUN"):
        left = yaml_erp.get_supplier(supplier_id)
        right = sqlite_erp.get_supplier(supplier_id)
        assert left.contract_unit_price == right.contract_unit_price
        assert [(b.min_qty, b.unit_price) for b in left.price_breaks] == [
            (b.min_qty, b.unit_price) for b in right.price_breaks
        ]


def test_neither_adapter_exposes_a_raw_number_but_both_can_produce_one(yaml_erp, sqlite_erp):
    for adapter in (yaml_erp, sqlite_erp):
        record = adapter.get_supplier("SUP-SKF")
        assert "phone" not in record.model_dump()
        assert "*" in record.phone_masked
    assert yaml_erp.raw_phone_for_outreach("SUP-SKF") == sqlite_erp.raw_phone_for_outreach("SUP-SKF")

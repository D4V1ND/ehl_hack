"""Two requests at once must not read each other's rows.

Uvicorn serves the sync endpoints from a threadpool, so `/inventory` — which
fans out to one supplier query per part — issues overlapping reads against the
same adapter. A single shared SQLite connection interleaves those cursors and
returns rows belonging to another query, which surfaces as garbage values
(`unit_price` of `None`) rather than an error.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from backend.record.sqlite_erp import SqliteERP


def _snapshot(erp: SqliteERP) -> list[tuple[str, list[tuple[int, str]]]]:
    return [
        (s.supplier_id, [(b.min_qty, str(b.unit_price)) for b in s.price_breaks])
        for s in erp.list_suppliers()
    ]


def test_parallel_reads_return_the_same_records(sqlite_erp: SqliteERP) -> None:
    expected = _snapshot(sqlite_erp)

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: _snapshot(sqlite_erp), range(32)))

    for result in results:
        assert result == expected

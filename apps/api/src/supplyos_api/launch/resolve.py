"""Where an incident comes from.

Two kinds of case exist and everything downstream must treat them identically:
the seeded ones the ERP knows by name, and the ones opened for any part in the
item master, which are derived and live in the case directory. The case file
wins — if a case has been opened, its own record of the shortage is the one that
was worked.
"""

from __future__ import annotations

from supplyos_api.casestore.case_store import CaseStore, get_case_store
from supplyos_api.record.ports import SystemOfRecord
from packages.contracts.models import Incident


def resolve_incident(
    case_id: str, records: SystemOfRecord, cases: CaseStore | None = None
) -> Incident | None:
    cases = cases or get_case_store()
    return cases.read_incident(case_id) or records.get_incident(case_id)

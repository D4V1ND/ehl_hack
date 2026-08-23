"""Opening a case: turn a part in the inventory into a shortage worth working,
and hand it to a Devin session that does the work unattended.

`incident` builds the `Incident` from the system of record — stock, take rate,
the line that consumes the part, the incumbent — so any of the forty parts can
be triggered, not just the two that ship as seeded cases. `devin` starts the
session and, without an API key, returns a stub rather than failing: a demo
must never die on a missing key.
"""

# backend — the one FastAPI process

Start it with `python run.py api`, which is `uvicorn backend.api.main:app --port 8010`. There is no second service: the Devin tool endpoints and the cockpit read API share this app. Root `AGENTS.md` holds the domain rules; this file is the layout.

- `api/` — routers only. `meta`, `tools`, `decide`, `flow`, `launch`, `cases`. A router validates, calls a module below, and serializes. Keep the logic out of it.
- `record/` — the system of record behind `ports.SystemOfRecord`. `mock_erp.py` reads the seed YAML, `sqlite_erp.py` reads the compiled `supplyguard.db`. Both are covered by the same tests, which is what makes "a real ERPNext is one adapter class" true. The `.db` is a build artifact: edit `record/demo_data/*.yaml`, then `python run.py db`.
- `casestore/` — the append-only event log and the case store. `cases/<id>/` on disk is the durable record.
- `detect/`, `policy/`, `cost/`, `decide/`, `flow/` — pure domain logic. No FastAPI imports, no I/O beyond the record port.
- `outreach/` — CALL-E. `provider.py` is the seam: the fake provider is the default and the real one needs both live guards.
- `tests/` — run with `python run.py test`. They never touch the network.

Rules that bite here:

- A raw phone number leaves this package only inside an outbound call body. `tests/test_no_raw_phones.py` scans every endpoint.
- `SqliteERP` opens one connection per thread. Uvicorn serves sync endpoints from a threadpool, and a shared connection interleaves cursors between concurrent requests.
- Money is `Decimal` in, string out.
- Response models come from `packages/contracts`. Do not redeclare a shape here.

# Stockout — autonomous sourcing agent

> Procurement is an engineering problem. Give it an engineer.

A shortage is filed with an agent. It reads the system of record, screens
suppliers against the company's own compliance rules, phones them through
CALL-E, costs every option including split orders, and ships the decision as a
pull request. EHL Game Jam Munich · Cognition "Devin for X" track.

Plan: [`sourcing_agent_plan_v3.md`](sourcing_agent_plan_v3.md) ·
[`docs/PLAN.md`](docs/PLAN.md) · spec:
[`docs/specs/supplyguard-plan-1-foundation-spec.md`](docs/specs/supplyguard-plan-1-foundation-spec.md)

## Repo layout

```
packages/contracts/   The frozen contract. Pydantic models + the JSON Schema and
                      TypeScript types generated from them. Shared by every
                      slice; changes need a group ping.
backend/              Slice B — the service.
  record/             system of record — two adapters behind one interface:
                      mock_erp.py (YAML) + sqlite_erp.py (SQL), schema.sql, seed data
  store/              case store and append-only event log (cases/ is the database)
  api/                one FastAPI process: Devin tool endpoints + cockpit read API
  detect/             shortage detector (the no-human-in-the-loop trigger)
  tests/              Slice B's tests
ui/                   Slice A — the cockpit (Next.js). Runs with no backend.
cases/                Runtime output. One directory per case; the artifact IS the datastore.
test/                 Slice C's CALL-E smoke test
docs/                 plans and specs
```

## Commands

```bash
./run.sh setup   # once per machine: venv deps, npm install, build the database
./run.sh         # the whole stack — API + cockpit. Ctrl-C stops both.
./run.sh ui      # cockpit only. Runs offline; this is the demo path.
./run.sh test    # 87 backend tests + UI typecheck. Never touches the network.
```

`./run.sh` picks free ports (API from 8010, cockpit from 3000), sources `nvm`
against `ui/.nvmrc`, and builds the database if it is missing.

The same pieces are available individually: `make api`, `make ui`, `make db`,
`make fixtures`, `make detect`, `make build`.

The cockpit defaults to `NEXT_PUBLIC_DATA_SOURCE=fixtures` and runs entirely
offline. `./run.sh` points it at the live API instead.

**Opening the database in a GUI on Windows:** run `./run.sh db-export`. DB
Browser for SQLite cannot open the file in place — the repo is on ext4 inside
WSL, and Windows reaches that over `\\wsl.localhost`, which has no POSIX file
locking, so SQLite reports *"database is locked"* regardless of what is running.
`db-export` writes a `VACUUM INTO` snapshot to your Windows Downloads folder and
prints the `C:\...` path to paste in.

## The system of record

`SystemOfRecord` (`backend/record/ports.py`) is the plug-in point the spec
describes. Two adapters implement it and **both are covered by the same test
suite**, which is what makes "swapping in a real ERPNext is one adapter class"
demonstrable rather than a claim:

| Adapter | Backing | Use |
|---|---|---|
| `SqliteERP` | `backend/record/supplyguard.db`, ERPNext-shaped tables | default |
| `MockERP` | `backend/record/demo_data/*.yaml` | reference implementation, and the seed source |

The YAML is what a human edits; `./run.sh db` compiles it into SQLite. The
database is a build artifact and is gitignored. Switch with `RECORD_BACKEND=yaml`
or `RECORD_BACKEND=sqlite`.

Money is stored as `TEXT`, never `REAL` — SQLite's `REAL` is a float, and a float
cent error is invisible in a demo and fatal in procurement.

Case artifacts deliberately do **not** live in SQL. `cases/<id>/` stays files in
Git, because the procurement-as-code thesis is that the artifact *is* the
datastore and a reviewer can walk it in a pull request.

## Ground rules

These hold for any code added to this repo:

- **Phone numbers** are validated to E.164 on entry and masked everywhere else.
  No API model has a field for a raw number; the one accessor that returns one is
  `raw_phone_for_outreach`, for building an outbound call and nothing else.
  `backend/tests/test_no_raw_phones.py` scans every endpoint for leaks.
- **Rehearsal is the default.** Live calling requires `LIVE_CALLS` set to exactly
  `yes-place-real-calls`. Never a fallback, never an unset variable.
- **"Unknown" is a first-class answer**, and building a claim never raises — a
  garbled call becomes a confidence-0 claim, not an exception.
- **Money is `Decimal`**, serialized as a string. No float arithmetic anywhere.
- **No real secrets or real phone numbers.** Seed numbers come from the German
  BNetzA drama range and are never dialed.

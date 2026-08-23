# SupplyOS — autonomous sourcing agent

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
                      ERP seed data (YAML) + SQLite, schema.sql, seed data
  store/              case store and append-only event log (cases/ is the database)
  api/                one FastAPI process: Devin tool endpoints + cockpit read API
  detect/             shortage detector (the no-human-in-the-loop trigger)
  tests/              Slice B's tests
ui/                   Slice A — the cockpit (Next.js). Runs with no backend.
  app/api/cases/      Slice 1 launch API as Route Handlers, so a case can be
                      started from a Vercel deployment with no Python process
orchestrator/         the CLI that launches a case
cases/                Runtime output. One directory per case; the artifact IS the datastore.
test/                 Slice C's CALL-E smoke test
docs/                 plans and specs
```

## Commands

Works the same on Windows, macOS and Linux:

```bash
python run.py setup   # once per machine: venv, npm install, build the database
python run.py         # the whole stack — API + cockpit. Ctrl-C stops both.
python run.py ui      # cockpit only. Runs offline; this is the demo path.
python run.py test    # backend tests + UI typecheck. Never touches the network.
```

| | |
|---|---|
| macOS / Linux | `python3 run.py …` — or `./run.sh …`, a thin wrapper |
| Windows | `python run.py …` — or `run …`, which uses the `py` launcher |

`run.py` bootstraps from a clean clone: it creates the virtualenv, installs
dependencies, builds the database if missing, and picks free ports (API from
8010, cockpit from 3000). Node >= 20.9 is the one thing it cannot install for
you; if you use nvm it will tell you which version you already have.

It is Python rather than a shell script because Python 3.11+ is already required
by the backend, so every machine has it — whereas Windows has no `bash` and
macOS ships bash 3.2.

Other commands: `db`, `db-export`, `fixtures`, `build`. The `Makefile` mirrors
them on Unix.

The cockpit defaults to `NEXT_PUBLIC_DATA_SOURCE=fixtures` and runs entirely
offline. `./run.sh` points it at the live API instead.

**Opening the database in a GUI on Windows:** run `python run.py db-export`. DB
Browser for SQLite cannot open the file in place — the repo is on ext4 inside
WSL, and Windows reaches that over `\\wsl.localhost`, which has no POSIX file
locking, so SQLite reports *"database is locked"* regardless of what is running.
`db-export` writes a `VACUUM INTO` snapshot to your Windows Downloads folder and
prints the `C:\...` path to paste in.

## Running SupplyOS end to end on main

Verified from a clean clone on 2026-08-23 with Ubuntu 22.04, Node 20.18.1 and
pyenv Python 3.12.8. The minimum versions are Python 3.11 and Node 20.9. If the
system `python3` is older, invoke `run.py` with a 3.11+ interpreter explicitly.

### 1. Set up once

```bash
git clone https://github.com/D4V1ND/ehl_hack.git
cd ehl_hack
python3.12 run.py setup
```

This creates `.venv`, installs the project and development dependencies,
installs the UI packages, and seeds the ERP. On main, `calle-ai` is in
`pyproject.toml`, so no separate `pip install -r requirements.txt` is needed.

### 2. Check the offline path

```bash
python3.12 run.py test
```

This ran 292 backend tests and the UI typecheck during the clean-clone
verification. It does not touch the network.

### 3. Bring up the stack

Start the API from the repository root:

```bash
.venv/bin/python -m uvicorn backend.api.main:app --port 8010
```

In a second terminal, start the cockpit against that API:

```bash
cd ui
NEXT_PUBLIC_DATA_SOURCE=live \
NEXT_PUBLIC_API_BASE=http://localhost:8010 \
npm run dev
```

Check the safety mode before continuing:

```bash
curl -s localhost:8010/healthz
```

The response should contain `"call_mode":"rehearsal"`. Rehearsal is the safe
default and does not dial anyone.

### 4. Walk the case

Open <http://localhost:3000/inventory> and choose **Source this part**, or drive
the same flow directly through the API:

```bash
curl -s localhost:8010/inventory | head
curl -s -X POST localhost:8010/cases \
  -H 'content-type: application/json' \
  -d '{"part_id":"PRT-6204"}'
# On a clean clone this returns CASE-6204-2RS and a stub Devin session.

curl -s -X POST \
  "localhost:8010/flow/run?case_id=CASE-6204-2RS&hold_for=SUP-KBY"
curl -s -X POST \
  "localhost:8010/flow/call?case_id=CASE-6204-2RS&supplier_ref=SUP-KBY"
curl -s -X POST \
  "localhost:8010/flow/collect?case_id=CASE-6204-2RS"
curl -s \
  "localhost:8010/flow/state?case_id=CASE-6204-2RS"
.venv/bin/python -m orchestrator.sourcing publish --case CASE-6204-2RS
```

If that case ID already exists, `POST /cases` adds a numeric suffix; use the
returned ID in the remaining commands. No `DEVIN_API_KEY` is needed for the
stub session.

In the verified rehearsal, the flow screened six suppliers and rejected three
on policy (blocked origin, missing certification, and missing audit). It asked
two suppliers, held `SUP-KBY` for the deliberate call, and recommended `STR-05`:
a 4,000 + 6,500 split with EUR 17,078.27 landed cost that meets the line stop.
Publishing produced a dry-run pull request containing six procurement
artifacts.

There is no `POST /flow/publish` route. Publishing uses either the CLI command
above or `POST /tools/publish_pr?case_id=CASE-6204-2RS`.

### 5. Enable live integrations only when needed

For a real call, start the API with all four settings below and add `--live` to
the CLI `call` command:

```bash
export CALLE_API_KEY=...
export DEMO_CALL_DESTINATION='<your phone in E.164 format>'
export LIVE_CALLS=yes-place-real-calls
export FAKE_CALLS=0

.venv/bin/python -m uvicorn backend.api.main:app --port 8010
```

Then place the call from another terminal:

```bash
.venv/bin/python -m orchestrator.sourcing call \
  --case CASE-6204-2RS --supplier SUP-KBY --live
```

`DEMO_CALL_DESTINATION` must be the E.164 number that should receive every demo
call. A call result can take roughly 18 minutes to arrive, so do not make the
post-call repricing the demo finale.

- Set `GITHUB_TOKEN` and `GITHUB_REPO` to make `publish` open a real pull request.
- Set `DEVIN_API_KEY` to create a real Devin session from `POST /cases`.
- Set `PUBLIC_BASE_URL` to the public `cloudflared` URL so that Devin can call
  the local API back.

## Opening a case for any part

`GET /inventory` is every part in the item master with what is in the bin, how
many days that covers, and whether a case is already open. `POST /cases
{"part_id": "PRT-6204"}` opens one for a part: the shortage is derived from the
records — bin, take rate, the BOM line that consumes it, the incumbent, a
purchase order that has slipped — and a Devin session is started to work it. No
`DEVIN_API_KEY` means a stub session and an open case, never a failed trigger.

```bash
python run.py api                                                        # :8010
curl -s localhost:8010/inventory | head
curl -s -X POST localhost:8010/cases -H 'content-type: application/json' \
     -d '{"part_id": "PRT-6204"}'
```

In the UI that is `/inventory`: one button per row, which opens the case and
follows it to `/cases/<id>`. Set `NEXT_PUBLIC_DATA_SOURCE=live` and
`NEXT_PUBLIC_API_BASE` first — fixtures mode has nothing to trigger. The session
is told to read the part, its stock, its open orders and its price history from
the ERP *before* it looks at suppliers, and it is told not to order anything.

`PUBLIC_BASE_URL` is what the session is given to call back on; at demo time
that is the `cloudflared` URL, because the request origin is localhost.

## Running a whole case

One command does the unattended part: read the shortage, read the part, screen
the approved suppliers, ask the ones that pass, price every plan and write the
review package. `--hold-for` leaves one supplier uncalled so that call can be
placed deliberately — that is the demo's live moment.

```bash
python run.py api                                                        # :8010
python -m orchestrator.sourcing run     --case CASE-001 --hold-for SUP-KBY
python -m orchestrator.sourcing call    --case CASE-001 --supplier SUP-KBY   # add --live to dial
python -m orchestrator.sourcing collect --case CASE-001                      # files the answer, re-prices
python -m orchestrator.sourcing state   --case CASE-001
python -m orchestrator.sourcing publish --case CASE-001
```

The same steps are `POST /flow/run`, `POST /flow/call`, `POST /flow/collect`,
`GET /flow/state`. Every stage appends an event, so the cockpit shows where the
run has got to rather than a spinner.

Calling is rehearsed unless live calling is switched on server-side
(`LIVE_CALLS=yes-place-real-calls` **and** `FAKE_CALLS=0`); `--live` without that
is refused with a `409` rather than silently rehearsing. `DEMO_CALL_DESTINATION`
points *every* supplier call at one number, so a live run on stage reaches the
phone in the room and cannot dial a real supplier by accident. Rehearsed answers are
derived from the supplier's own record — contract price, standard lead time,
historical fill minus known allocations — and are deterministic per case and
supplier, so the demo tells the same story twice.

`/flow/run` returns *every* costed plan, not just the winner: a buyer picks one.
Nothing is ordered by the agent, and `publish` opens a pull request for a human
to merge (rehearsed unless `GITHUB_TOKEN`/`GITHUB_REPO` are set).

## Slice 1 — launch a case from the CLI

The launch path that needs nothing but the Next app:

```bash
cd ui && npm install && npm run dev
python -m orchestrator.run --case CASE-001 --api http://localhost:3000
```

- `POST /api/cases` — `{ "case_id": "CASE-001" }`, or an inline `incident`. Loads
  the fixture, appends `created`, starts a Devin session, appends
  `session_started`, returns `201`.
- `GET /api/cases/CASE-001/events` — the append-only log.
- `/cases/CASE-001` — polls it every 2s.

Events live in a module-level map (`ui/lib/cases/store.ts`) because serverless has
no durable disk; the durable case store is `backend/casestore/`. Money is only
ever a decimal string. Without `DEVIN_API_KEY` the session is stubbed, so this
never fails on a missing key and never places a phone call. Cross-origin browser
access is opt-in via `CASES_ALLOWED_ORIGINS`.

```bash
cd ui && npm test   # route handlers, in-memory, no live Devin
```

## The system of record

`SystemOfRecord` (`backend/record/ports.py`) is the plug-in point the spec
describes. Two adapters implement it and **both are covered by the same test
suite**, which is what makes "swapping in a real ERPNext is one adapter class"
demonstrable rather than a claim:

| Adapter | Backing | Use |
|---|---|---|
| `SqliteERP` | `backend/record/supplyguard.db`, ERPNext-shaped tables | default |
| ERP | `backend/record/demo_data/*.yaml` | reference implementation, and the seed source |

The YAML is what a human edits; `python run.py db` compiles it into SQLite. The
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

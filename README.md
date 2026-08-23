# SupplyOS

> Procurement is an engineering problem. Give it an engineer.

SupplyOS turns a factory shortage into a reviewable sourcing case. The mock ERP
opens the incident, the API reads the system of record and works the sourcing
flow, and the SupplyOS app shows the evidence, candidate suppliers, costed
plans, and buyer handoff. Nothing is ordered automatically.

The canonical product decisions are in [`docs/PLAN.md`](docs/PLAN.md). Detailed
behavior lives in [`docs/specs/`](docs/specs/).

## Repository layout

```text
apps/
  api/                 FastAPI service; import package supplyos_api
    src/supplyos_api/  HTTP routes, workflow, records, outreach, policy, costing
    tests/             API, domain, adapter, and safety tests
  erp/                 Mock ERP: inventory, supplier records, incident trigger
  web/                 SupplyOS: sourcing case and buyer-facing experience
packages/
  contracts/           Shared Pydantic models and generated TypeScript contracts
cases/                 Seed cases and runtime procurement artifacts
docs/                  Canonical plan, behavioral specs, and operator docs
run.py                 Cross-platform repository entry point
```

`apps/api/` is the only backend application and `supplyos_api.main:app` is its
only FastAPI entry point.

## Requirements and setup

- Python 3.11+
- Node.js 20.9+

From the repository root:

```bash
python run.py setup
python run.py test
python run.py
```

`setup` creates `.venv`, installs `supplyos-contracts` and the API as editable
Python distributions, installs both Next applications with npm, and builds the
SQLite system of record from its YAML source. `test` is offline and runs the API
suite plus checks for ERP and SupplyOS.

Use `python3` or `./run.sh` on macOS/Linux. On Windows use `python` or
`run.cmd`. The shell and CMD files are thin delegates to `run.py`.

### Commands

| Command | Result |
| --- | --- |
| `python run.py` | Start API, ERP, and SupplyOS; Ctrl-C stops all three |
| `python run.py api` | Start FastAPI, beginning at port 8010 |
| `python run.py erp` | Start the mock ERP, beginning at port 3000 |
| `python run.py web` | Start SupplyOS, beginning at port 3001 |
| `python run.py test` | API tests, ERP tests/typecheck, SupplyOS typecheck |
| `python run.py build` | Production-build both Next apps |
| `python run.py db` | Rebuild the SQLite ERP from YAML |
| `python run.py db-export [path]` | Write a SQLite snapshot for a desktop viewer |
| `python run.py contracts` | Regenerate shared schemas and TypeScript contracts |

For a manual Python install, preserve the dependency order:

```bash
.venv/bin/python -m pip install -e .
.venv/bin/python -m pip install -e 'apps/api[dev]'
.venv/bin/python -m uvicorn supplyos_api.main:app --port 8010
```

## Product flow

1. Open ERP at <http://localhost:3000/inventory>.
2. Select **Source this part**. ERP asks the API to create an incident.
3. ERP sends the returned case ID to SupplyOS at
   `http://localhost:3001/chat?case=<case-id>`.
4. SupplyOS attaches to that case. The API reads ERP records, screens approved
   suppliers, gathers rehearsed or explicitly-live claims, costs every viable
   plan, and appends evidence to the case.
5. A buyer reviews the ranked result. Publishing prepares a pull request; it
   never creates a purchase order.

The API can be driven directly after it is running:

```bash
python -m supplyos_api.cli run     --case CASE-001 --hold-for SUP-KBY
python -m supplyos_api.cli call    --case CASE-001 --supplier SUP-KBY
python -m supplyos_api.cli collect --case CASE-001
python -m supplyos_api.cli state   --case CASE-001
python -m supplyos_api.cli publish --case CASE-001
```

The same flow is available through `POST /flow/run`, `POST /flow/call`,
`POST /flow/collect`, `GET /flow/state`, and `POST /tools/publish_pr`. API docs
are served at <http://localhost:8010/docs>.

## System of record and contracts

Editable ERP seed data lives in
`apps/api/src/supplyos_api/record/demo_data/`. `python run.py db` compiles it
into the gitignored `apps/api/data/erp.db`. `RECORD_BACKEND=sqlite` is the default;
`RECORD_BACKEND=yaml` exercises the reference adapter. Both implement the same
`SystemOfRecord` interface.

Runtime case artifacts stay under `cases/<case-id>/` because the procurement
case is designed to be reviewed as a Git diff. `CASE-001` and `CASE-002` are
canonical fixtures; generated runs should not accumulate on `main`.

`packages/contracts/` is shared infrastructure, not a voice-only package. It
defines incidents, supplier records, claims, candidates, decisions, events,
plans, and call results. Python imports the models directly; both Next apps use
`packages/contracts/generated/contracts.ts`. Change the source models once, run
`python run.py contracts`, and commit every generated change together.

## Safety and configuration

Copy `.env.example` to `.env`. Rehearsal is the default:

```env
FAKE_CALLS=1
LIVE_CALLS=
```

A real call requires all of the following:

- `FAKE_CALLS=0`
- `LIVE_CALLS=yes-place-real-calls`
- a valid `CALLE_API_KEY`
- an explicit `--live` request
- preferably `DEMO_CALL_DESTINATION` set to a phone controlled by the operator

Before any live demonstration, check `GET /healthz`; `call_mode` must match the
operator's intent. CALL-E results can take many minutes to settle, so the demo
must not depend on immediate post-call repricing.

Other optional integrations:

- `DEVIN_API_KEY` starts a real Devin session when an incident is opened.
- `PUBLIC_BASE_URL` gives that remote session a reachable API address.
- `GITHUB_TOKEN` and `GITHUB_REPO` enable real pull-request publishing.
- `CASES_ALLOWED_ORIGINS` adds deployed browser origins to the local defaults.

Across every mode, money uses `Decimal`, unknown answers remain unknown, phone
numbers are masked outside the outbound boundary, and secrets or real numbers
never enter the repository.

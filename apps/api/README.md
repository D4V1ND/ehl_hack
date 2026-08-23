# SupplyOS API

The Python service is an independently installable `src`-layout application.
Its import package is `supplyos_api`; shared Pydantic contracts remain in the
root `supplyos-contracts` distribution.

From the repository root, use the monorepo install order:

```bash
python run.py setup

# Or install the two Python distributions directly:
.venv/bin/python -m pip install -e .
.venv/bin/python -m pip install -e 'apps/api[dev]'
```

The app-local lockfile supports the same checkout with uv:

```bash
uv sync --project apps/api --extra dev
uv run --project apps/api uvicorn supplyos_api.main:app --port 8010
```

Run and test from the repository root:

```bash
python run.py api
python run.py test
python run.py db

# Direct pip/virtualenv entrypoint:
.venv/bin/python -m uvicorn supplyos_api.main:app --port 8010
```

The editable seed data lives in `src/supplyos_api/record/demo_data/`.
`python run.py db` compiles it into the gitignored `apps/api/data/erp.db`.
Runtime case artifacts live in the repository-root `cases/` directory.

Rehearsal is the default. Real calls require the explicit live-call settings
documented in the root README; tests and normal setup must never dial or use the
network.

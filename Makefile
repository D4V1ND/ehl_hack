# Slice B (backend + packages) and Slice A (ui). One entry point for both.
#
# `./run.sh` does all of this in one command; these targets are the pieces.
#
#   make install    once, per machine
#   make test       everything that does not touch the network
#   make api        the FastAPI process on :8010  (override with API_PORT=)
#   make ui         the cockpit on :3000
#   make fixtures   re-export schema, TypeScript types and the UI fixture bundle
#
# The ROS install on some machines registers pytest plugins that fail to import;
# PYTEST_DISABLE_PLUGIN_AUTOLOAD keeps the run reproducible everywhere.

PY := .venv/bin/python
# Override if the port is taken:  make api API_PORT=9000
API_PORT ?= 8010
PYTEST := PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH= $(PY) -m pytest

# Next 16 needs Node >= 20.9 and several machines here default to 18. Run every
# node command through nvm using .nvmrc, falling back to whatever node is on
# PATH if nvm is not installed.
NODE := bash -lc 'cd ui && { source "$$NVM_DIR/nvm.sh" 2>/dev/null && nvm use >/dev/null 2>&1; };

.PHONY: install api ui db fixtures test test-backend detect build clean

install:
	$(PY) -m pip install -e '.[dev]'
	$(NODE) npm install'

# Rebuild the SQL system of record from the seed YAML. The .db is a build
# artifact and is gitignored -- the YAML is the source.
db:
	PYTHONPATH= $(PY) -m backend.record.seed_db

api: db
	PYTHONPATH= $(PY) -m uvicorn backend.api.main:app --reload --port $(API_PORT)

ui:
	$(NODE) npm run dev'

# Regenerate the three consumers of the frozen contract. Run after any change to
# packages/contracts/models.py, and commit the output.
fixtures:
	PYTHONPATH= $(PY) -m packages.contracts.export

test: test-backend
	$(NODE) npx tsc --noEmit'

test-backend:
	$(PYTEST) backend/tests -q

# B4 -- scan the system of record and open a case for anything at risk.
detect:
	PYTHONPATH= $(PY) -m backend.detect.shortage_detector

build:
	$(NODE) npm run build'

clean:
	rm -rf ui/.next cases/CASE-00*/ backend/record/*.db
	find . -name __pycache__ -not -path './.venv/*' -exec rm -rf {} + 2>/dev/null || true

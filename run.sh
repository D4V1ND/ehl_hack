#!/usr/bin/env bash
#
# One command to run Slice B end to end.
#
#   ./run.sh            build the database, start the API and the cockpit, wait
#   ./run.sh ui         cockpit only (it runs offline; this is the demo path)
#   ./run.sh api        API only
#   ./run.sh test       every test, plus the UI typecheck. Touches no network.
#   ./run.sh db         rebuild the SQL system of record from the seed YAML
#   ./run.sh db-export  copy the database where a Windows GUI can open it
#   ./run.sh fixtures   re-export schema, TypeScript types and the UI fixtures
#   ./run.sh setup      install Python and Node dependencies
#
# Ctrl-C stops whatever it started.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

VENV=.venv
PY="$VENV/bin/python"
API_PORT_DEFAULT=8010
UI_PORT_DEFAULT=3000

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# --- node ------------------------------------------------------------------
# Next 16 needs >= 20.9 and several machines here default to 18. .nvmrc pins
# the version; fall back to whatever is on PATH if nvm is not installed.
use_node() {
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    # `nvm use` has to run in *this* shell to change PATH -- a subshell would
    # switch a node that dies with it. cd into ui first so it reads ui/.nvmrc.
    ( cd ui && nvm use >/dev/null 2>&1 ) && { cd ui; nvm use >/dev/null 2>&1; cd - >/dev/null; } || true
  fi
  local major
  major=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/') || true
  [ -z "${major:-}" ] && die "node not found. Install Node >= 20.9 (nvm install 22)."
  [ "$major" -lt 20 ] && die "node $(node -v) is too old for Next 16. Run: nvm install 22"
  return 0
}

# --- ports -----------------------------------------------------------------
port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

pick_port() {
  local port=$1
  for _ in $(seq 0 20); do
    port_free "$port" && { echo "$port"; return; }
    port=$((port + 1))
  done
  die "no free port near $1"
}

# --- setup -----------------------------------------------------------------
ensure_python() {
  [ -x "$PY" ] || die "no virtualenv at $VENV. Create one: python3 -m venv $VENV"
  "$PY" -c "import fastapi, pydantic, yaml, uvicorn" 2>/dev/null \
    || die "Python dependencies missing. Run: ./run.sh setup"
}

ensure_node_modules() {
  if [ ! -d ui/node_modules ]; then
    warn "ui/node_modules missing — installing (this takes a minute)"
    (cd ui && npm install --silent)
  fi
}

ensure_db() {
  if [ ! -f backend/record/supplyguard.db ]; then
    warn "no database yet — building it from the seed YAML"
    build_db
  fi
}

build_db() {
  PYTHONPATH= "$PY" -m backend.record.seed_db
}

# --- commands --------------------------------------------------------------
cmd_setup() {
  bold "Installing dependencies"
  [ -x "$PY" ] || python3 -m venv "$VENV"
  "$PY" -m pip install --quiet --upgrade pip
  "$PY" -m pip install --quiet -e '.[dev]'
  ok "python"
  use_node
  (cd ui && npm install --silent)
  ok "node $(node -v)"
  build_db
  ok "database"
}

cmd_db()       { ensure_python; build_db; }

# DB Browser for SQLite (or any Windows GUI) cannot open the database where it
# lives. The repo is on ext4 inside WSL and Windows reaches that over
# \\wsl.localhost, which does not implement POSIX file locking, so SQLite
# refuses with "database is locked" no matter what is or is not running.
#
# Hand the GUI a snapshot on the Windows filesystem instead. VACUUM INTO is the
# correct way to copy a SQLite file: a consistent snapshot rather than a byte
# copy that might catch a write half-finished.
cmd_db_export() {
  ensure_python
  ensure_db
  local dest="${1:-}"
  if [ -z "$dest" ]; then
    local winhome
    winhome=$(ls -d /mnt/c/Users/*/ 2>/dev/null \
      | grep -viE '/(All Users|Default|Default User|Public|CodexSandboxOffline)/$' \
      | head -1)
    [ -d "${winhome:-}" ] || die "could not find a Windows home. Pass a path: ./run.sh db-export /mnt/c/..."
    dest="${winhome}Downloads/supplyguard.db"
  fi
  rm -f "$dest"
  PYTHONPATH= "$PY" -c "
import sqlite3, sys
src = sqlite3.connect('backend/record/supplyguard.db')
src.execute('VACUUM INTO ?', (sys.argv[1],))
src.close()
" "$dest"
  ok "snapshot written ($(du -h "$dest" | cut -f1))"
  dim "  WSL      $dest"
  if command -v wslpath >/dev/null 2>&1; then
    dim "  Windows  $(wslpath -w "$dest" 2>/dev/null || echo '-')"
  fi
  printf '\n  Open that path in DB Browser. It is a copy: edits there do not reach\n'
  printf '  the repo, and `./run.sh db` rebuilds the real one from the seed YAML.\n\n'
}
cmd_fixtures() { ensure_python; PYTHONPATH= "$PY" -m packages.contracts.export; }

cmd_test() {
  ensure_python
  bold "Backend tests"
  PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH= "$PY" -m pytest backend/tests -q
  bold "UI typecheck"
  use_node
  ensure_node_modules
  ( cd ui && npx tsc --noEmit ) && ok "no type errors"
}

cmd_api() {
  ensure_python
  ensure_db
  local port; port=$(pick_port "${API_PORT:-$API_PORT_DEFAULT}")
  bold "API on http://localhost:$port  (docs at /docs)"
  PYTHONPATH= exec "$PY" -m uvicorn backend.api.main:app --reload --port "$port"
}

cmd_ui() {
  use_node
  ensure_node_modules
  local port; port=$(pick_port "${UI_PORT:-$UI_PORT_DEFAULT}")
  bold "Cockpit on http://localhost:$port/cockpit"
  cd ui && exec npx next dev --port "$port"
}

cmd_all() {
  ensure_python
  use_node
  ensure_node_modules
  ensure_db

  local api_port ui_port
  api_port=$(pick_port "${API_PORT:-$API_PORT_DEFAULT}")
  ui_port=$(pick_port "${UI_PORT:-$UI_PORT_DEFAULT}")

  local api_pid="" ui_pid=""
  cleanup() {
    printf '\n'
    dim "stopping…"
    [ -n "$ui_pid" ]  && kill "$ui_pid"  2>/dev/null || true
    [ -n "$api_pid" ] && kill "$api_pid" 2>/dev/null || true
    wait 2>/dev/null || true
  }
  trap cleanup INT TERM EXIT

  PYTHONPATH= "$PY" -m uvicorn backend.api.main:app --port "$api_port" \
    >/tmp/supplyguard-api.log 2>&1 &
  api_pid=$!

  # Point the cockpit at whichever port the API actually got.
  ( cd ui && NEXT_PUBLIC_API_BASE="http://localhost:$api_port" \
      npx next dev --port "$ui_port" >/tmp/supplyguard-ui.log 2>&1 ) &
  ui_pid=$!

  # Wait for the API rather than guessing with a sleep.
  local ready=""
  for _ in $(seq 1 40); do
    if curl -sf -m 1 "http://localhost:$api_port/healthz" >/dev/null 2>&1; then ready=1; break; fi
    kill -0 "$api_pid" 2>/dev/null || { cat /tmp/supplyguard-api.log; die "the API died on startup"; }
    sleep 0.5
  done
  [ -n "$ready" ] || { tail -20 /tmp/supplyguard-api.log; die "the API never became ready"; }

  local health; health=$(curl -s "http://localhost:$api_port/healthz")

  printf '\n'
  bold "Stockout — Slice B"
  ok "cockpit   http://localhost:$ui_port/cockpit"
  ok "API       http://localhost:$api_port/docs"
  ok "record    $(echo "$health" | sed 's/.*"parts":\([0-9]*\).*"suppliers":\([0-9]*\).*/\1 parts, \2 suppliers/')"
  ok "calls     $(echo "$health" | sed 's/.*"call_mode":"\([a-z]*\)".*/\1/') mode"
  dim "  logs      /tmp/supplyguard-api.log  /tmp/supplyguard-ui.log"
  dim "  Ctrl-C to stop both"
  printf '\n'

  wait
}

case "${1:-all}" in
  all|"")   cmd_all ;;
  ui)       cmd_ui ;;
  api)      cmd_api ;;
  test)     cmd_test ;;
  db)       cmd_db ;;
  db-export) shift || true; cmd_db_export "${1:-}" ;;
  fixtures) cmd_fixtures ;;
  setup)    cmd_setup ;;
  *)        die "unknown command '$1'. Try: all | ui | api | test | db | db-export | fixtures | setup" ;;
esac

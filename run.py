#!/usr/bin/env python3
"""One command to run Slice B, on Windows, macOS and Linux.

    python run.py            build the database, start the API and the cockpit
    python run.py ui         cockpit only (it runs offline; this is the demo path)
    python run.py api        API only
    python run.py test       every test, plus the UI typecheck. Touches no network.
    python run.py db         rebuild the SQL system of record from the seed YAML
    python run.py db-export  copy the database somewhere a GUI can open it
    python run.py setup      install Python and Node dependencies

Python rather than a shell script on purpose: Python 3.11+ is already a hard
dependency of the backend, so it is guaranteed present on every machine, whereas
`bash` is absent on Windows and stuck at 3.2 on macOS (no `local`, no reliable
`/dev/tcp`). This file replaces run.sh; run.sh now just calls it.

Ctrl-C stops whatever was started.
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui"
VENV = ROOT / ".venv"
WINDOWS = os.name == "nt"

API_PORT_DEFAULT = int(os.environ.get("API_PORT", 8010))
UI_PORT_DEFAULT = int(os.environ.get("UI_PORT", 3000))

MIN_NODE_MAJOR = 20  # Next 16 requires >= 20.9


# --- output ---------------------------------------------------------------
# Colour only when the terminal will render it. Windows consoles that predate
# virtual-terminal support would otherwise print raw escape codes.
_COLOUR = sys.stdout.isatty() and (not WINDOWS or os.environ.get("WT_SESSION") or os.environ.get("TERM"))


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOUR else text


def bold(msg: str) -> None:
    print(_c("1", msg))


def dim(msg: str) -> None:
    print(_c("2", msg))


def ok(msg: str) -> None:
    print(f"  {_c('32', 'OK')} {msg}")


def warn(msg: str) -> None:
    print(f"  {_c('33', '!')} {msg}")


def die(msg: str) -> None:
    print(f"  {_c('31', 'x')} {msg}", file=sys.stderr)
    raise SystemExit(1)


# --- python ---------------------------------------------------------------


def venv_python() -> Path:
    """The interpreter inside .venv. Windows puts it somewhere else entirely."""
    return VENV / ("Scripts/python.exe" if WINDOWS else "bin/python")


def ensure_python() -> Path:
    """Bootstrap from a clean clone: create the venv and install if missing.

    This is the situation for a teammate who has just cloned, for a judge
    reproducing the demo, and for a Devin session that checked the repo out into
    its own sandbox. Failing with an instruction would make `run.py` two commands.
    """
    # A cleared PYTHONPATH throughout: on a machine with ROS (or any other
    # sitewide install) on the path, pip resolves against packages that are not
    # in this virtualenv and prints conflicts that have nothing to do with us.
    clean = {**os.environ, "PYTHONPATH": ""}

    py = venv_python()
    if not py.exists():
        warn(f"no virtualenv yet — creating {VENV.name}")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], env=clean, check=True)
        py = venv_python()

    probe = subprocess.run(
        [str(py), "-c", "import fastapi, pydantic, yaml, uvicorn"],
        capture_output=True, env=clean,
    )
    if probe.returncode != 0:
        warn("installing Python dependencies")
        subprocess.run([str(py), "-m", "pip", "install", "--quiet", "--upgrade", "pip"],
                       env=clean, check=True)
        subprocess.run([str(py), "-m", "pip", "install", "--quiet", "-e", ".[dev]"],
                       cwd=ROOT, env=clean, check=True)
    return py


def run_module(py: Path, module: str, *args: str, **kw) -> subprocess.CompletedProcess:
    """Run a module with PYTHONPATH cleared.

    Some machines here have a ROS install on PYTHONPATH whose pytest plugins fail
    to import; clearing it keeps runs reproducible everywhere.
    """
    env = {**os.environ, "PYTHONPATH": ""}
    return subprocess.run([str(py), "-m", module, *args], cwd=ROOT, env=env, **kw)


# --- node -----------------------------------------------------------------


def node_cmd(name: str) -> str:
    """npm and npx are batch files on Windows; shutil.which finds the right one."""
    found = shutil.which(name) or (shutil.which(name + ".cmd") if WINDOWS else None)
    if not found:
        die(f"{name} not found on PATH. Install Node >= {MIN_NODE_MAJOR}.9 from https://nodejs.org")
    return found


def _nvm_hint() -> str:
    """If a new-enough node is already installed under nvm, say so.

    The common case on a dev machine is not "node is missing" but "nvm's default
    is old and this shell never ran `nvm use`". Pointing at the version they
    already have beats telling them to install one.
    """
    versions = Path.home() / ".nvm" / "versions" / "node"
    if not versions.is_dir():
        return ""
    usable = sorted(
        d.name for d in versions.iterdir()
        if d.name.startswith("v") and d.name[1:].split(".")[0].isdigit()
        and int(d.name[1:].split(".")[0]) >= MIN_NODE_MAJOR
    )
    if not usable:
        return ""
    return f"  You already have {usable[-1]} installed — run: nvm use {usable[-1].lstrip('v').split('.')[0]}"


def ensure_node() -> None:
    node = shutil.which("node")
    if not node:
        hint = _nvm_hint()
        die(f"node not found. Install Node >= {MIN_NODE_MAJOR}.9 from https://nodejs.org"
            + (f"\n{hint}" if hint else " (or `nvm install 22` if you use nvm)."))
    version = subprocess.run([node, "-v"], capture_output=True, text=True).stdout.strip()
    try:
        major = int(version.lstrip("v").split(".")[0])
    except ValueError:
        die(f"could not read the node version from {version!r}")
        return
    if major < MIN_NODE_MAJOR:
        hint = _nvm_hint() or f"  Install Node >= {MIN_NODE_MAJOR}.9 from https://nodejs.org"
        die(f"node {version} is too old for Next 16 (ui/.nvmrc pins 22).\n{hint}")


def ensure_node_modules() -> None:
    if not (UI / "node_modules").exists():
        warn("ui/node_modules missing — installing (this takes a minute)")
        subprocess.run([node_cmd("npm"), "install"], cwd=UI, check=True)


# --- ports ----------------------------------------------------------------


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) != 0


def pick_port(start: int) -> int:
    for port in range(start, start + 21):
        if port_free(port):
            return port
    die(f"no free port near {start}")
    return start


# --- commands -------------------------------------------------------------


def cmd_db(py: Path | None = None) -> None:
    run_module(py or ensure_python(), "backend.record.seed_db", check=True)


def ensure_db(py: Path) -> None:
    if not (ROOT / "backend/record/supplyguard.db").exists():
        warn("no database yet — building it from the seed YAML")
        cmd_db(py)


def cmd_fixtures() -> None:
    run_module(ensure_python(), "packages.contracts.export", check=True)


def cmd_setup() -> None:
    bold("Installing dependencies")
    py = ensure_python()
    ok(f"python ({py})")
    ensure_node()
    subprocess.run([node_cmd("npm"), "install"], cwd=UI, check=True)
    ok(f"node {subprocess.run([shutil.which('node'), '-v'], capture_output=True, text=True).stdout.strip()}")
    cmd_db(py)
    ok("database")


def cmd_test() -> None:
    py = ensure_python()
    bold("Backend tests")
    env = {**os.environ, "PYTHONPATH": "", "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"}
    result = subprocess.run(
        [str(py), "-m", "pytest", "-q", "-m", "not live"], cwd=ROOT, env=env
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    bold("UI typecheck")
    ensure_node()
    ensure_node_modules()
    if subprocess.run([node_cmd("npx"), "tsc", "--noEmit"], cwd=UI).returncode != 0:
        raise SystemExit(1)
    ok("no type errors")


def cmd_api() -> None:
    py = ensure_python()
    ensure_db(py)
    port = pick_port(API_PORT_DEFAULT)
    bold(f"API on http://localhost:{port}  (docs at /docs)")
    # Watch only the Python source. Watching the whole repo restarts the API
    # whenever npm touches a node_modules tree (some packages ship .py files).
    run_module(
        py, "uvicorn", "backend.api.main:app", "--reload",
        "--reload-dir", "backend", "--reload-dir", "packages",
        "--port", str(port),
    )


def cmd_ui() -> None:
    ensure_node()
    ensure_node_modules()
    port = pick_port(UI_PORT_DEFAULT)
    bold(f"Cockpit on http://localhost:{port}/cockpit")
    subprocess.run([node_cmd("npx"), "next", "dev", "--port", str(port)], cwd=UI)


def cmd_build() -> None:
    ensure_node()
    ensure_node_modules()
    subprocess.run([node_cmd("npm"), "run", "build"], cwd=UI, check=True)


def cmd_all() -> None:
    py = ensure_python()
    ensure_node()
    ensure_node_modules()
    ensure_db(py)

    api_port = pick_port(API_PORT_DEFAULT)
    ui_port = pick_port(UI_PORT_DEFAULT)
    logs = ROOT / ".logs"
    logs.mkdir(exist_ok=True)
    api_log = (logs / "api.log").open("w")
    ui_log = (logs / "ui.log").open("w")

    # A new process group on Windows so Ctrl-C reaches the children the same way
    # a POSIX signal would.
    flags = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WINDOWS else {}

    api = subprocess.Popen(
        [str(py), "-m", "uvicorn", "backend.api.main:app", "--port", str(api_port)],
        cwd=ROOT, env={**os.environ, "PYTHONPATH": ""},
        stdout=api_log, stderr=subprocess.STDOUT, **flags,
    )
    ui = subprocess.Popen(
        [node_cmd("npx"), "next", "dev", "--port", str(ui_port)],
        cwd=UI, env={**os.environ, "NEXT_PUBLIC_API_BASE": f"http://localhost:{api_port}"},
        stdout=ui_log, stderr=subprocess.STDOUT, **flags,
    )

    try:
        # Wait for the API rather than guessing with a sleep.
        ready = False
        for _ in range(60):
            if api.poll() is not None:
                print((logs / "api.log").read_text()[-2000:])
                die("the API died on startup")
            if not port_free(api_port):
                ready = True
                break
            time.sleep(0.5)
        if not ready:
            die("the API never became ready — see .logs/api.log")

        print()
        bold("Stockout — Slice B")
        ok(f"cockpit   http://localhost:{ui_port}/cockpit")
        ok(f"API       http://localhost:{api_port}/docs")
        dim(f"  logs      {logs / 'api.log'}  {logs / 'ui.log'}")
        dim("  Ctrl-C to stop both")
        print()

        while api.poll() is None and ui.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print()
        dim("stopping…")
    finally:
        for proc in (ui, api):
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    proc.kill()
        api_log.close()
        ui_log.close()


def cmd_db_export(dest: str | None) -> None:
    """Copy the database somewhere a desktop GUI can open it.

    A GUI cannot always open the file in place. Under WSL the repo is on ext4 and
    Windows reaches it over \\\\wsl.localhost, which has no POSIX file locking, so
    SQLite reports "database is locked" whatever is running. VACUUM INTO takes a
    consistent snapshot rather than a byte copy that could catch a half-write.
    """
    py = ensure_python()
    ensure_db(py)

    if dest:
        target = Path(dest)
    else:
        # Under WSL, land it on the Windows side where the GUI lives.
        windows_homes = sorted(Path("/mnt/c/Users").glob("*/Downloads")) if Path("/mnt/c/Users").is_dir() else []
        skip = {"All Users", "Default", "Default User", "Public"}
        windows_homes = [p for p in windows_homes if p.parent.name not in skip]
        target = windows_homes[0] / "supplyguard.db" if windows_homes else Path.home() / "supplyguard.db"

    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()
    code = (
        "import sqlite3, sys;"
        "c = sqlite3.connect('backend/record/supplyguard.db');"
        "c.execute('VACUUM INTO ?', (sys.argv[1],));"
        "c.close()"
    )
    subprocess.run([str(py), "-c", code, str(target)], cwd=ROOT, check=True)
    ok(f"snapshot written ({target.stat().st_size // 1024} KB)")
    dim(f"  {target}")
    if shutil.which("wslpath"):
        win = subprocess.run(["wslpath", "-w", str(target)], capture_output=True, text=True).stdout.strip()
        if win:
            dim(f"  Windows  {win}")
    print("\n  Open that path in your SQLite browser. It is a copy: edits there do not")
    print("  reach the repo, and `python run.py db` rebuilds the real one from the YAML.\n")


COMMANDS = {
    "all": lambda a: cmd_all(),
    "ui": lambda a: cmd_ui(),
    "api": lambda a: cmd_api(),
    "test": lambda a: cmd_test(),
    "db": lambda a: cmd_db(),
    "db-export": lambda a: cmd_db_export(a.dest),
    "fixtures": lambda a: cmd_fixtures(),
    "setup": lambda a: cmd_setup(),
    "build": lambda a: cmd_build(),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", nargs="?", default="all", choices=sorted(COMMANDS))
    parser.add_argument("dest", nargs="?", default=None, help="db-export: where to write the snapshot")
    args = parser.parse_args()
    if sys.version_info < (3, 11):
        die(f"Python 3.11+ required, this is {sys.version.split()[0]}")
    COMMANDS[args.command](args)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""One command to run Slice B, on Windows, macOS and Linux.

    python run.py            build the database, start the API, web app and ERP
    python run.py ui         the ERP inventory and legacy cockpit only
    python run.py web        the apps/web chat app only
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
import contextlib
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui"
WEB = ROOT / "apps" / "web"
VENV = ROOT / ".venv"
WINDOWS = os.name == "nt"


def _load_dotenv(path: Path) -> None:
    """Load the repo's simple KEY=value settings before choosing ports.

    The API already reads this file. Loading it in the parent process as well
    makes the same settings available to the two frontend processes started by
    ``run.py``.
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(ROOT / ".env")

API_PORT_DEFAULT = int(os.environ.get("API_PORT", 8010))
ERP_PORT_DEFAULT = int(os.environ.get("ERP_PORT", 3001))
UI_PORT_DEFAULT = int(os.environ.get("UI_PORT", 3000))

MIN_NODE_MAJOR = 20  # Next 16 requires >= 20.9


# --- output ---------------------------------------------------------------
# Colour only when the terminal will render it. Windows consoles that predate
# virtual-terminal support would otherwise print raw escape codes.
_COLOUR = sys.stdout.isatty() and (not WINDOWS or os.environ.get("WT_SESSION") or os.environ.get("TERM"))


def _safe(text: str) -> str:
    """Drop what the console cannot encode.

    Next logs box-drawing and arrow characters; a Windows console running
    cp1252 raises UnicodeEncodeError on them, which turned "a frontend
    stopped" from a warning into a crash that took the rest down with it.
    """
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    return text.encode(encoding, "replace").decode(encoding, "replace")


def _c(code: str, text: str) -> str:
    text = _safe(text)
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
        [str(py), "-c", "import calle, fastapi, pydantic, yaml, uvicorn"],
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


def ensure_node_modules(app: Path = UI) -> None:
    if not (app / "node_modules").exists():
        rel = app.relative_to(ROOT).as_posix()
        warn(f"{rel}/node_modules missing — installing (this takes a minute)")
        subprocess.run([node_cmd("npm"), "install"], cwd=app, check=True)


# --- ports ----------------------------------------------------------------


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) != 0


def pick_port(start: int, reserved: set[int] | None = None) -> int:
    reserved = reserved or set()
    for port in range(start, start + 21):
        if port not in reserved and port_free(port):
            return port
    die(f"no free port near {start}")
    return start


def next_dev_argv(app: Path, port: int) -> list[str]:
    """The command that starts Next for `app`, without the npx shim.

    `npx` is a batch file on Windows, so Popen starts cmd.exe and Next ends up a
    grandchild. terminate() then stops the wrapper while the dev server keeps the
    port, and the next run dies on Next's "another dev server is already running"
    check. Calling node with Next's own entry point keeps one process to signal.
    """
    entry = app / "node_modules" / "next" / "dist" / "bin" / "next"
    if not entry.is_file():
        die(f"next is not installed in {app.relative_to(ROOT).as_posix()} — run `python run.py setup`")
    node = shutil.which("node")
    if not node:
        die("node not found on PATH")
    return [node, str(entry), "dev", "--port", str(port)]


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
    if WEB.is_dir():
        subprocess.run([node_cmd("npm"), "install"], cwd=WEB, check=True)
    ok(f"node {subprocess.run([shutil.which('node'), '-v'], capture_output=True, text=True).stdout.strip()}")
    cmd_db(py)
    ok("database")


def cmd_test() -> None:
    py = ensure_python()
    bold("Backend tests")
    env = {
        **os.environ,
        "PYTHONPATH": "",
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
        # Tests are always rehearsal, even when the local demo .env enables
        # paid integrations. `python run.py test` must never touch the network.
        "FAKE_CALLS": "1",
        "LIVE_CALLS": "",
        "CALLE_API_KEY": "",
    }
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
    port = pick_port(ERP_PORT_DEFAULT)
    bold(f"ERP on http://localhost:{port}/inventory")
    subprocess.run(next_dev_argv(UI, port), cwd=UI)


def cmd_web() -> None:
    if not WEB.is_dir():
        die("apps/web is not in this checkout")
    ensure_node()
    ensure_node_modules(WEB)
    port = pick_port(UI_PORT_DEFAULT)
    bold(f"Web app on http://localhost:{port}/chat")
    subprocess.run(next_dev_argv(WEB, port), cwd=WEB)


def cmd_build() -> None:
    ensure_node()
    ensure_node_modules()
    subprocess.run([node_cmd("npm"), "run", "build"], cwd=UI, check=True)


def cmd_all() -> None:
    py = ensure_python()
    ensure_node()
    ensure_node_modules()
    ensure_db(py)

    # apps/web is a second, separate cockpit and is not on every branch.
    with_web = WEB.is_dir()
    if with_web:
        ensure_node_modules(WEB)

    api_port = pick_port(API_PORT_DEFAULT)
    web_port = (
        pick_port(UI_PORT_DEFAULT, reserved={api_port}) if with_web else None
    )
    reserved = {api_port, *([web_port] if web_port is not None else [])}
    erp_port = pick_port(ERP_PORT_DEFAULT, reserved=reserved)

    logs = ROOT / ".logs"
    logs.mkdir(exist_ok=True)
    api_log = (logs / "api.log").open("w")
    ui_log = (logs / "ui.log").open("w")
    web_log = (logs / "web.log").open("w") if with_web else None

    # A new process group on Windows so Ctrl-C reaches the children the same way
    # a POSIX signal would.
    flags = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WINDOWS else {}
    frontend_env = {
        "NEXT_PUBLIC_DATA_SOURCE": "live",
        "NEXT_PUBLIC_API_BASE": f"http://localhost:{api_port}",
        # ui/next.config.ts exposes this harmless value to the cockpit page.
        "UI_PORT": str(web_port or UI_PORT_DEFAULT),
    }
    configured_origins = os.environ.get("CASES_ALLOWED_ORIGINS", "").strip()
    erp_origins = [
        f"http://localhost:{erp_port}",
        f"http://127.0.0.1:{erp_port}",
    ]
    api_env = {
        **os.environ,
        "PYTHONPATH": "",
        "CASES_ALLOWED_ORIGINS": ",".join(
            [origin for origin in (configured_origins, *erp_origins) if origin]
        ),
    }

    api = subprocess.Popen(
        [str(py), "-m", "uvicorn", "backend.api.main:app", "--port", str(api_port)],
        cwd=ROOT, env=api_env,
        stdout=api_log, stderr=subprocess.STDOUT, **flags,
    )
    ui = subprocess.Popen(
        next_dev_argv(UI, erp_port),
        cwd=UI, env={**os.environ, **frontend_env},
        stdout=ui_log, stderr=subprocess.STDOUT, **flags,
    )
    web = subprocess.Popen(
        next_dev_argv(WEB, web_port),
        cwd=WEB, env={**os.environ, **frontend_env},
        stdout=web_log, stderr=subprocess.STDOUT, **flags,
    ) if with_web else None

    children = [p for p in (api, ui, web) if p is not None]

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
        if with_web:
            ok(f"web app   http://localhost:{web_port}/chat")
        ok(f"ERP       http://localhost:{erp_port}/inventory")
        ok(f"API       http://localhost:{api_port}/docs")
        dim(f"  logs      {logs}")
        dim("  Ctrl-C to stop everything")
        print()

        # Any child exiting means the run is over; the finally block stops the rest.
        while all(proc.poll() is None for proc in children):
            time.sleep(0.5)

        for name, proc, log in (
            ("ERP", ui, "ui.log"),
            ("web app", web, "web.log"),
            ("API", api, "api.log"),
        ):
            if proc is None or proc.poll() is None:
                continue
            warn(f"the {name} stopped")
            with contextlib.suppress(OSError):
                tail = (logs / log).read_text(encoding="utf-8", errors="replace").strip()
                if tail:
                    dim("\n".join(tail.splitlines()[-12:]))
    except KeyboardInterrupt:
        print()
        dim("stopping…")
    finally:
        for proc in reversed(children):
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    proc.kill()
        for handle in (api_log, ui_log, web_log):
            if handle is not None:
                handle.close()


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
    "web": lambda a: cmd_web(),
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

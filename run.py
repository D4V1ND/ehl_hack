#!/usr/bin/env python3
"""One command to run Slice B, on Windows, macOS and Linux.

    python run.py            build the database, start the API and the cockpit
    python run.py ui         cockpit only (it runs offline; this is the demo path)
    python run.py api        API only
    python run.py tunnel     public HTTPS front door for the CALL-E webhook, on its own
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

# All interfaces, not loopback. Under WSL the browser is a Windows process and
# cannot reach a socket bound to 127.0.0.1 inside the VM -- every fetch fails
# before it leaves the browser, which looks like CORS but is not. Next already
# binds this way; the API has to match. Override with API_HOST for a locked-down
# machine.
API_HOST = os.environ.get("API_HOST", "0.0.0.0")


# --- output ---------------------------------------------------------------
# Colour only when the terminal will render it. Windows consoles that predate
# virtual-terminal support would otherwise print raw escape codes.
_COLOUR = sys.stdout.isatty() and (not WINDOWS or os.environ.get("WT_SESSION") or os.environ.get("TERM"))


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOUR else text


def bold(msg: str) -> None:
    print(_c("1", msg), flush=True)


def dim(msg: str) -> None:
    print(_c("2", msg), flush=True)


def ok(msg: str) -> None:
    print(f"  {_c('32', 'OK')} {msg}", flush=True)


def warn(msg: str) -> None:
    print(f"  {_c('33', '!')} {msg}", flush=True)


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
    if _NODE_BIN is not None:
        for candidate in (_NODE_BIN / name, _NODE_BIN / f"{name}.cmd"):
            if candidate.exists():
                return str(candidate)
    found = shutil.which(name) or (shutil.which(name + ".cmd") if WINDOWS else None)
    if not found:
        die(f"{name} not found on PATH. Install Node >= {MIN_NODE_MAJOR}.9 from https://nodejs.org")
    return found


# Set once a usable node is located somewhere other than PATH, and prepended to
# PATH for every subprocess we spawn.
_NODE_BIN: Path | None = None


def _node_major(node: str | Path) -> int | None:
    try:
        out = subprocess.run([str(node), "-v"], capture_output=True, text=True).stdout.strip()
        return int(out.lstrip("v").split(".")[0])
    except (OSError, ValueError, IndexError):
        return None


def _nvm_candidates() -> list[Path]:
    """New-enough node binaries installed under nvm, newest last.

    A shell whose nvm default is old is the common case, not a missing node.
    Rather than telling you to run `nvm use`, we just use the one you have --
    `nvm use` only edits PATH, and we control the PATH our subprocesses get.
    """
    versions = Path(os.environ.get("NVM_DIR", Path.home() / ".nvm")) / "versions" / "node"
    if not versions.is_dir():
        return []

    def parts(d: Path) -> tuple:
        try:
            return tuple(int(x) for x in d.name.lstrip("v").split("."))
        except ValueError:
            return (0,)

    return sorted(
        (d / "bin" for d in versions.iterdir()
         if d.name.startswith("v") and (d / "bin" / "node").exists()
         and parts(d)[0] >= MIN_NODE_MAJOR),
        key=lambda b: parts(b.parent),
    )


def _shell_node_version() -> str:
    node = shutil.which("node")
    if not node:
        return "none"
    return subprocess.run([node, "-v"], capture_output=True, text=True).stdout.strip()


def node_env() -> dict:
    """Environment for node subprocesses, with a usable node first on PATH."""
    if _NODE_BIN is None:
        return dict(os.environ)
    return {**os.environ, "PATH": f"{_NODE_BIN}{os.pathsep}{os.environ.get('PATH', '')}"}


def ensure_node() -> None:
    global _NODE_BIN

    on_path = shutil.which("node")
    if on_path and (_node_major(on_path) or 0) >= MIN_NODE_MAJOR:
        return

    for candidate in reversed(_nvm_candidates()):
        if (_node_major(candidate / "node") or 0) >= MIN_NODE_MAJOR:
            _NODE_BIN = candidate
            version = subprocess.run([str(candidate / "node"), "-v"],
                                     capture_output=True, text=True).stdout.strip()
            shell = f" (this shell defaults to {_shell_node_version()})" if on_path else ""
            dim(f"  using node {version} from nvm{shell}")
            return

    if not on_path:
        die(f"node not found. Install Node >= {MIN_NODE_MAJOR}.9 from https://nodejs.org "
            "(or `nvm install 22` if you use nvm).")
    die(f"node {subprocess.run([on_path, '-v'], capture_output=True, text=True).stdout.strip()} "
        f"is too old for Next 16 (ui/.nvmrc pins 22).\n"
        f"  Install Node >= {MIN_NODE_MAJOR}.9, or with nvm: nvm install 22")


def ensure_node_modules() -> None:
    if not (UI / "node_modules").exists():
        warn("ui/node_modules missing — installing (this takes a minute)")
        subprocess.run([node_cmd("npm"), "install"], cwd=UI, env=node_env(), check=True)


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
    subprocess.run([node_cmd("npm"), "install"], cwd=UI, env=node_env(), check=True)
    ok("node ready")
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
    if subprocess.run([node_cmd("npx"), "tsc", "--noEmit"], cwd=UI, env=node_env()).returncode != 0:
        raise SystemExit(1)
    ok("no type errors")


def live_calling() -> bool:
    """Whether this run places real calls.

    Asks `backend.settings` rather than reading the environment again: importing
    it is what loads `.env`, and one switch read in two places is how a run ends
    up tunnelling for a rehearsal or dialling without a webhook.
    """
    from backend import settings as backend_settings

    return not backend_settings.FAKE_CALLS


def open_tunnel(port: int) -> subprocess.Popen | None:
    """A public HTTPS address for the webhook, or None and a reason why not.

    Only opened for a live run: rehearsal delivers its own results in-process and
    has nothing to receive from outside. Never fatal — a failed tunnel costs the
    answers, not the calls, and finding that out at dispatch time is worse than
    reading it here.
    """
    from backend.tunnel import TunnelUnavailable, start

    try:
        url, process = start(port)
    except TunnelUnavailable as exc:
        warn(f"no public webhook address ({exc})")
        warn("calls will still be placed, but their answers cannot come back")
        return None

    os.environ["PUBLIC_BASE_URL"] = url
    ok(f"webhook reachable at {url}/calle/webhook")
    return process


def cmd_tunnel() -> None:
    """The tunnel on its own, for a run whose API is already up elsewhere."""
    ensure_python()
    port = int(os.environ.get("API_PORT", API_PORT_DEFAULT))
    process = open_tunnel(port)
    if process is None:
        raise SystemExit(1)
    bold(f"Tunnelling port {port}. Export this into the API's environment:")
    print(f"  PUBLIC_BASE_URL={os.environ['PUBLIC_BASE_URL']}")
    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()


def cmd_api() -> None:
    py = ensure_python()
    ensure_db(py)
    port = pick_port(API_PORT_DEFAULT)
    tunnel = open_tunnel(port) if live_calling() else None
    bold(f"API on http://localhost:{port}  (docs at /docs)")
    try:
        run_module(py, "uvicorn", "backend.api.main:app", "--reload",
                   "--host", API_HOST, "--port", str(port))
    finally:
        if tunnel is not None:
            tunnel.terminate()


def cmd_ui() -> None:
    ensure_node()
    ensure_node_modules()
    port = pick_port(UI_PORT_DEFAULT)
    bold(f"Cockpit on http://localhost:{port}/cockpit")
    subprocess.run([node_cmd("npx"), "next", "dev", "--port", str(port)], cwd=UI, env=node_env())


def cmd_build() -> None:
    ensure_node()
    ensure_node_modules()
    subprocess.run([node_cmd("npm"), "run", "build"], cwd=UI, env=node_env(), check=True)


def cmd_all() -> None:
    py = ensure_python()
    ensure_node()
    ensure_node_modules()
    ensure_db(py)

    api_port = pick_port(API_PORT_DEFAULT)
    ui_port = pick_port(UI_PORT_DEFAULT)

    # Before the API process is spawned: the webhook address travels to it in
    # the environment, and a tunnel opened afterwards would arrive too late.
    tunnel = open_tunnel(api_port) if live_calling() else None

    logs = ROOT / ".logs"
    logs.mkdir(exist_ok=True)
    api_log = (logs / "api.log").open("w")
    ui_log = (logs / "ui.log").open("w")

    # A new process group on Windows so Ctrl-C reaches the children the same way
    # a POSIX signal would.
    flags = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WINDOWS else {}

    api = subprocess.Popen(
        [str(py), "-m", "uvicorn", "backend.api.main:app",
         "--host", API_HOST, "--port", str(api_port)],
        cwd=ROOT, env={**os.environ, "PYTHONPATH": ""},
        stdout=api_log, stderr=subprocess.STDOUT, **flags,
    )
    ui = subprocess.Popen(
        [node_cmd("npx"), "next", "dev", "--port", str(ui_port)],
        cwd=UI,
        env={
            **node_env(),
            "NEXT_PUBLIC_API_BASE": f"http://localhost:{api_port}",
            # Starting the API is the whole reason this command exists, so the
            # cockpit reads it live rather than the committed fixtures. Override
            # with NEXT_PUBLIC_DATA_SOURCE=fixtures for the offline demo, or use
            # `run.py ui`, which never starts an API at all.
            "NEXT_PUBLIC_DATA_SOURCE": os.environ.get("NEXT_PUBLIC_DATA_SOURCE", "live"),
        },
        stdout=ui_log, stderr=subprocess.STDOUT, **flags,
    )

    def ui_daemon_pid() -> int | None:
        """Next 16 forks a background dev server and prints its pid.

        The foreground `next dev` then exits immediately, so its exit says
        nothing about whether the cockpit is up -- and killing it on the way out
        would leave the real server running on the port.
        """
        try:
            for line in (logs / "ui.log").read_text(errors="replace").splitlines():
                if "- PID:" in line:
                    return int(line.split("- PID:")[1].strip())
        except (OSError, ValueError, IndexError):
            pass
        return None

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

        mode = "rehearsal"
        try:
            import json as _json
            from urllib.request import urlopen

            with urlopen(f"http://localhost:{api_port}/healthz", timeout=3) as response:
                mode = _json.load(response).get("call_mode", "rehearsal")
        except Exception:
            pass

        for _ in range(80):
            if not port_free(ui_port):
                break
            time.sleep(0.5)
        else:
            print((logs / "ui.log").read_text(errors="replace")[-1500:])
            die("the cockpit never came up — see .logs/ui.log")

        print()
        bold("Stockout — Slice B")
        ok(f"cockpit   http://localhost:{ui_port}/cockpit")
        ok(f"API       http://localhost:{api_port}/docs")
        ok(f"calls     {mode}"
           + ("  — REAL PHONE CALLS" if mode == "live" else "  — nothing is dialled"))
        if tunnel is not None:
            ok(f"webhook   {os.environ['PUBLIC_BASE_URL']}/calle/webhook")
        dim(f"  logs      {logs / 'api.log'}  {logs / 'ui.log'}")
        dim("  Ctrl-C to stop both")
        print()

        # Wait on the API only. The cockpit's launcher has already exited by
        # design; the port test above is what proves it is actually serving.
        while api.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print()
        dim("stopping…")
    finally:
        daemon = ui_daemon_pid()
        for proc in (ui, api, tunnel):
            if proc is None:
                continue
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    proc.kill()
        if daemon is not None:
            try:
                os.kill(daemon, 15)
            except OSError:
                pass
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
    "tunnel": lambda a: cmd_tunnel(),
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

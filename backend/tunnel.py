"""A public HTTPS front door for the webhook, for as long as the demo runs.

CALL-E delivers a finished call by POSTing to `webhook_url`. That URL has to be
reachable from Cloudflare's network, and `http://localhost:8010` is not — so
without this the calls go out and the answers never come back.

A Cloudflare quick tunnel is the right tool for a hackathon: one static binary,
no account, no DNS, no config file. `cloudflared tunnel --url` prints a fresh
`https://<random>.trycloudflare.com` on startup and proxies it to the local API
until the process is killed. The URL changes every run, which is fine — nothing
persists it; dispatch reads it at call time.

The binary is downloaded once into `.tools/` (gitignored) rather than added as a
dependency, because it is a platform-specific 30 MB executable that only the
machine placing live calls needs.
"""

from __future__ import annotations

import platform
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / ".tools"

_RELEASE = "https://github.com/cloudflare/cloudflared/releases/latest/download"
_URL = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")

# How long to wait for Cloudflare to hand out a hostname before giving up. It is
# normally two or three seconds; a minute is the point at which something is
# wrong rather than slow.
STARTUP_TIMEOUT = 60.0


class TunnelUnavailable(RuntimeError):
    """No public URL. Live calls can still be placed; results cannot come back."""


def _asset() -> tuple[str, bool]:
    """(release asset name, is it a tarball) for this machine."""
    system = platform.system().lower()
    machine = platform.machine().lower()
    arch = "arm64" if machine in ("arm64", "aarch64") else "amd64"
    if system == "windows":
        return f"cloudflared-windows-{arch}.exe", False
    if system == "darwin":
        return f"cloudflared-darwin-{arch}.tgz", True
    return f"cloudflared-linux-{arch}", False


def ensure_binary() -> Path:
    """The cloudflared executable, downloading it on first use."""
    suffix = ".exe" if platform.system().lower() == "windows" else ""
    binary = TOOLS / f"cloudflared{suffix}"
    if binary.exists():
        return binary

    asset, tarred = _asset()
    TOOLS.mkdir(exist_ok=True)
    print(f"downloading {asset} (once) ...", file=sys.stderr, flush=True)
    try:
        with urllib.request.urlopen(f"{_RELEASE}/{asset}", timeout=180) as response:
            data = response.read()
    except OSError as exc:
        raise TunnelUnavailable(f"could not download cloudflared: {exc}") from None

    if tarred:
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / asset
            archive.write_bytes(data)
            with tarfile.open(archive) as tar:
                member = next(m for m in tar.getmembers() if m.name.endswith("cloudflared"))
                extracted = tar.extractfile(member)
                data = extracted.read() if extracted else b""

    binary.write_bytes(data)
    binary.chmod(0o755)
    return binary


def start(port: int, log_path: Path | None = None) -> tuple[str, subprocess.Popen]:
    """Open a quick tunnel to `port`. Returns (public https URL, process).

    The caller owns the process and must terminate it — the tunnel lives exactly
    as long as the run that opened it.
    """
    binary = ensure_binary()
    log = (log_path or (ROOT / ".logs" / "tunnel.log"))
    log.parent.mkdir(exist_ok=True)
    handle = log.open("w+")

    process = subprocess.Popen(
        [
            str(binary), "tunnel",
            "--url", f"http://127.0.0.1:{port}",
            "--no-autoupdate",
            # A quick tunnel is anonymous, so the only place the hostname appears
            # is this log. Keep it terse but keep it.
            "--loglevel", "info",
        ],
        cwd=ROOT,
        stdout=handle,
        stderr=subprocess.STDOUT,
    )

    url = _await_url(process, log)
    if url is None:
        process.terminate()
        raise TunnelUnavailable(
            f"cloudflared did not report a public URL within {STARTUP_TIMEOUT:.0f}s "
            f"— see {log}"
        )
    return url, process


def _await_url(process: subprocess.Popen, log: Path) -> str | None:
    """Poll the log for the hostname Cloudflare assigns on connect."""
    import time

    deadline = time.monotonic() + STARTUP_TIMEOUT
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return None
        match = _URL.search(log.read_text(errors="replace"))
        if match:
            return match.group(0)
        time.sleep(0.25)
    return None

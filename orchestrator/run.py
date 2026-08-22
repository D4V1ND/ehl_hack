"""Launch a case against the Next.js backend.

    python -m orchestrator.run --case CASE-001 --api http://localhost:3000

The CLI only POSTs /api/cases and prints the response. It does not touch the
ERP and it never places a phone call.
"""

from __future__ import annotations

import argparse
import json
import sys

import httpx

DEFAULT_API = "http://localhost:3000"


def launch(case_id: str, api: str, timeout: float = 60.0) -> dict:
    """POST the case and return the decoded JSON body."""
    url = f"{api.rstrip('/')}/api/cases"
    response = httpx.post(url, json={"case_id": case_id}, timeout=timeout)
    response.raise_for_status()
    return response.json()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="orchestrator.run")
    parser.add_argument("--case", required=True, help="case id, e.g. CASE-001")
    parser.add_argument(
        "--api",
        default=DEFAULT_API,
        help=f"backend base URL (default {DEFAULT_API})",
    )
    args = parser.parse_args(argv)

    try:
        payload = launch(args.case, args.api)
    except httpx.HTTPStatusError as error:
        print(
            f"POST {error.request.url} failed: {error.response.status_code} "
            f"{error.response.text}",
            file=sys.stderr,
        )
        return 1
    except httpx.HTTPError as error:
        print(f"could not reach {args.api}: {error}", file=sys.stderr)
        return 1

    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

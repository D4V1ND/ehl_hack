"""Drive a sourcing case from the terminal — including the call placed on stage.

    python -m orchestrator.sourcing run     --case CASE-001 --hold-for SUP-KBY
    python -m orchestrator.sourcing call    --case CASE-001 --supplier SUP-KBY [--live]
    python -m orchestrator.sourcing collect --case CASE-001
    python -m orchestrator.sourcing state   --case CASE-001
    python -m orchestrator.sourcing publish --case CASE-001

`run` does the unattended part: read the shortage and the part, screen the
approved suppliers, ask the ones that pass, price every plan and write the review
package. `--hold-for` leaves one supplier uncalled so that call can be placed
deliberately; `collect` files the answer whenever it arrives and re-prices.

`--live` dials for real, and only works if live calling was turned on in the
environment. Without it, and by default, nothing is dialled.
"""

from __future__ import annotations

import argparse
import json
import sys

import httpx

DEFAULT_API = "http://localhost:8010"


def _post(api: str, path: str, params: dict[str, object], timeout: float) -> dict:
    response = httpx.post(f"{api.rstrip('/')}{path}", params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _get(api: str, path: str, params: dict[str, object], timeout: float) -> dict:
    response = httpx.get(f"{api.rstrip('/')}{path}", params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="orchestrator.sourcing")
    parser.add_argument("command", choices=["run", "call", "collect", "state", "publish"])
    parser.add_argument("--case", required=True, help="case id, e.g. CASE-001")
    parser.add_argument("--api", default=DEFAULT_API, help=f"backend base URL (default {DEFAULT_API})")
    parser.add_argument("--hold-for", default=None, help="supplier to leave uncalled")
    parser.add_argument("--supplier", default=None, help="supplier to call")
    parser.add_argument(
        "--live",
        action="store_true",
        help="place a real phone call (requires live calling to be enabled server-side)",
    )
    args = parser.parse_args(argv)

    try:
        if args.command == "run":
            params: dict[str, object] = {"case_id": args.case}
            if args.hold_for:
                params["hold_for"] = args.hold_for
            body = _post(args.api, "/flow/run", params, 300.0)
        elif args.command == "call":
            if not args.supplier:
                parser.error("call needs --supplier")
            body = _post(
                args.api,
                "/flow/call",
                {"case_id": args.case, "supplier_ref": args.supplier, "live": args.live},
                60.0,
            )
        elif args.command == "collect":
            body = _post(args.api, "/flow/collect", {"case_id": args.case}, 120.0)
        elif args.command == "publish":
            body = _post(args.api, "/tools/publish_pr", {"case_id": args.case}, 120.0)
        else:
            body = _get(args.api, "/flow/state", {"case_id": args.case}, 30.0)
    except httpx.HTTPStatusError as error:
        print(
            f"{error.request.method} {error.request.url} failed: "
            f"{error.response.status_code} {error.response.text}",
            file=sys.stderr,
        )
        return 1
    except httpx.HTTPError as error:
        print(f"could not reach {args.api}: {error}", file=sys.stderr)
        return 1

    print(json.dumps(body, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

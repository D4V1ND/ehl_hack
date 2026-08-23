"""Drive a SupplyOS sourcing case through the canonical FastAPI service.

    python -m supplyos_api.cli run     --case CASE-001 --hold-for SUP-KBY
    python -m supplyos_api.cli call    --case CASE-001 --supplier SUP-KBY [--live]
    python -m supplyos_api.cli collect --case CASE-001
    python -m supplyos_api.cli state   --case CASE-001
    python -m supplyos_api.cli publish --case CASE-001

`run` performs the unattended rehearsal flow. `--hold-for` leaves one supplier
uncalled so it can be contacted deliberately with `call`. Real calling is
opt-in twice: this client must receive `--live`, and the API must have its live
calling safeguard enabled. Without both, this module never asks for a real call.
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
    parser = argparse.ArgumentParser(prog="supplyos_api.cli")
    parser.add_argument("command", choices=["run", "call", "collect", "state", "publish"])
    parser.add_argument("--case", required=True, help="case id, e.g. CASE-001")
    parser.add_argument("--api", default=DEFAULT_API, help=f"API base URL (default {DEFAULT_API})")
    parser.add_argument("--hold-for", default=None, help="supplier to leave uncalled")
    parser.add_argument("--supplier", default=None, help="supplier to call")
    parser.add_argument(
        "--live",
        action="store_true",
        help="request a real call (also requires live calling to be enabled server-side)",
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

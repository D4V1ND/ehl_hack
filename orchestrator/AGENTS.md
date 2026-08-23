# orchestrator — the CLI that drives a case

Two entry points, both thin:

- `sourcing.py` — `run`, `call`, `collect`, `state`, `publish` against a running API. `--hold-for` leaves one supplier uncalled so that call can be placed deliberately on stage.
- `run.py` — the Slice 1 launch path against the Next route handlers.

This package parses arguments, calls the API or `backend/`, and prints. Domain logic that appears here belongs in `backend/` instead, where it is testable without a process.

`--live` is refused with a `409` unless the server has both live guards set. Keep it that way: no client-side flag may become the thing that dials a phone.

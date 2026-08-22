# Slice B — core API, system of record, seed data (+ the cockpit route)

Everything in this slice is **additive**. No file that existed before it was
moved, renamed or edited; `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
and `components/theme-provider.tsx` are exactly as the team left them.

## Run it

```bash
./run.sh setup   # once per machine: venv deps, npm install, build the database
./run.sh         # API + cockpit together. Ctrl-C stops both.
./run.sh ui      # cockpit only — runs offline, this is the demo path
./run.sh test    # 87 backend tests + typecheck. Never touches the network.
```

Cockpit at `/cockpit`; API docs at `/docs` on whichever port it picked.

## What this slice adds

| Path | |
|---|---|
| `packages/contracts/` | the frozen contract — Pydantic models, and the JSON Schema + TypeScript generated from them |
| `backend/record/` | system of record: two adapters behind one interface, plus the seed data |
| `backend/store/` | case store and append-only event log |
| `backend/api/` | one FastAPI process: Devin tool endpoints + cockpit read API |
| `backend/detect/` | shortage detector |
| `backend/tests/` | 87 tests |
| `app/cockpit/` | the cockpit route + its own scoped stylesheet |
| `components/cockpit/` | cockpit components |
| `lib/api/`, `lib/contracts.ts`, `lib/fixtures/`, `lib/format.ts`, `lib/stages.ts` | data layer and generated types |
| `cases/` | runtime output — the artifact *is* the datastore |

**Design tokens are scoped to the route.** `app/cockpit/cockpit.css` carries the
DESIGN.md palette and is loaded only on `/cockpit`, so nothing in Slice B
requires editing `app/globals.css`, which the landing page shares.

Build artifacts are kept out of git by `backend/.gitignore` and
`packages/.gitignore` — the root `.gitignore` is untouched.

## The system of record

`SystemOfRecord` (`backend/record/ports.py`) is the plug-in point. Two adapters
implement it and **both run against the same test suite**, which is what makes
"swapping in a real ERPNext is one adapter class" demonstrable rather than a
claim:

| Adapter | Backing | |
|---|---|---|
| `SqliteERP` | `backend/record/supplyguard.db`, ERPNext-shaped tables | default |
| `MockERP` | `backend/record/demo_data/*.yaml` | reference implementation, and the seed source |

The YAML is what a human edits; `./run.sh db` compiles it into SQLite. The `.db`
is a build artifact and is gitignored. Switch with `RECORD_BACKEND=yaml|sqlite`.

Money is stored as `TEXT`, never `REAL` — SQLite's `REAL` is a float, and a float
cent error is invisible in a demo and fatal in procurement.

**Opening the database in a Windows GUI:** `./run.sh db-export`. DB Browser
cannot open it in place — the repo is on ext4 inside WSL and Windows reaches
that over `\\wsl.localhost`, which has no POSIX file locking, so SQLite reports
*"database is locked"* whatever is running. `db-export` writes a `VACUUM INTO`
snapshot to your Windows Downloads folder.

Case artifacts deliberately stay files. `cases/<id>/` is Git, not SQL, because
the procurement-as-code thesis is that the artifact *is* the datastore.

## Ground rules this slice enforces

- **Phone numbers** validated to E.164 on entry, masked everywhere else. No API
  model has a field for a raw number. `backend/tests/test_no_raw_phones.py`
  scans every endpoint.
- **Rehearsal is the default.** Live calling needs `LIVE_CALLS` set to exactly
  `yes-place-real-calls`. Never a fallback.
- **"Unknown" is a first-class answer**, and filing a claim never raises.
- **Money is `Decimal`**, serialized as a string. No float arithmetic.
- **No real phone numbers.** Seed numbers use the German BNetzA drama range.

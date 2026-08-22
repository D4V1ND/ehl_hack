# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

SupplyGuard: a factory calls its approved suppliers (via the CALL-E phone API) to ask about a part shortage — availability, price, stock status, certification — and turns each call into a structured, typed "claim." It never compares those claims against the factory's own records or makes any purchasing decision; that's an explicitly out-of-scope later phase.

The full behavioral spec (no code, just what goes in/out and why) lives at `docs/specs/supplyguard-plan-1-foundation-spec.md`. Read it before implementing anything in this domain — it defines the five building blocks (phone number safety, shared vocabulary, system of record, call script/answer sheet, call-to-claim conversion) and the non-negotiable rules below.

The code lives in `backend/` (FastAPI app, outreach providers, persistence) and `packages/contracts/` (the shared models every slice builds against). Calls go through the official `calle` SDK — `client.calls.create()` to dial, `client.calls.wait_for_result()` to collect — both outbound, so no tunnel or public URL is involved.

## Commands

```bash
# Run the whole suite. Nothing here touches the network.
pytest test/ -v

# Force rehearsal if .env has FAKE_CALLS=0, so the fake-provider tests pass
FAKE_CALLS=1 pytest test/ -v

# Start the API
python -m uvicorn backend.main:app --port 8000
```

Two by-hand scripts, neither run by pytest: `test/try_fake_outreach.py` exercises the rehearsal flow, and `test/try_real_outreach.py` places one real, billed call and prints the resulting quote and transcript.

Config is read from `.env` (gitignored; copy `.env.example` to `.env` and fill in `CALLE_API_KEY`, etc.). `FAKE_CALLS=0` is what enables real dialing — nothing else does.

Finished quotes are written to `data/quotes/<case_id>/<task_id>.json` (gitignored: real phone numbers and transcripts). `STORE` is in-memory and dies with the process, so that directory is the only durable record of a call.

## Non-negotiable domain rules

These apply to all code in this repo:

- **Phone numbers**: validate to E.164 the moment a number enters the system; mask (`+1******0199` style) everywhere it's displayed, logged, or printed. The *only* place a raw, unmasked number may appear is inside the literal outbound request body used to place the call.
- **Rehearsal vs. live mode**: rehearsal (reading a saved/faked call result) is always the default. Live calling (actually dialing) is always an explicit, deliberate opt-in — never a fallback and never triggered by a merely-unset setting. No test, demo, or rehearsal run may touch the network.
- **AI disclosure**: every call script must open with the AI disclosure (who it is, who it's calling for, that it won't commit to price/quantity/delivery, that it will end the call if asked for a human or to stop). This cannot be optional or skippable.
- **"Unknown" is a first-class answer**: fields like price-quoted, certification-current, part-number-confirmed, and stock-status must allow "unknown" rather than forcing a guess. Turning a call result into a claim must never crash — a garbled/incomplete result becomes a claim with fields defaulted to "unknown"/zero and confidence 0, not an exception.
- **Money** uses exact decimal precision, never float arithmetic that can drift.
- **No real secrets or real phone numbers** in the repo. Demo/test phone numbers must come from officially reserved fictional ranges for their country.

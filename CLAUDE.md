# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

SupplyGuard: a factory calls its approved suppliers (via the CALL-E phone API) to ask about a part shortage — availability, price, stock status, certification — and turns each call into a structured, typed "claim." It never compares those claims against the factory's own records or makes any purchasing decision; that's an explicitly out-of-scope later phase.

The full behavioral spec (no code, just what goes in/out and why) lives at `docs/specs/supplyguard-plan-1-foundation-spec.md`. Read it before implementing anything in this domain — it defines the five building blocks (phone number safety, shared vocabulary, system of record, call script/answer sheet, call-to-claim conversion) and the non-negotiable rules below.

The `supplyguard` package described in the spec does not exist yet. Currently the repo contains only a standalone smoke test (`test/test_calle.py`) that talks to CALL-E's REST API directly, ahead of that package being built.

## Commands

```bash
# Run all non-network tests (default; the live test is skipped automatically unless opted in)
pytest test/test_calle.py -v -m "not live"

# Run everything, including the one live test that places a real phone call
pytest test/test_calle.py -v
```

Config is read from `.env` (gitignored; copy `.env.example` to `.env` and fill in `CALLE_API_KEY`, etc.). The live test only runs when `CALLE_API_KEY`, `TEST_CALL_DESTINATION_NUMBER`, and `CALLE_LIVE_TEST_CONFIRM=yes-call-my-phone` are all set — this triple-guard is intentional so a real call (and real spend) can never happen by accident.

## Non-negotiable domain rules

These apply to any code added in this repo, not just the existing test:

- **Phone numbers**: validate to E.164 the moment a number enters the system; mask (`+1******0199` style) everywhere it's displayed, logged, or printed. The *only* place a raw, unmasked number may appear is inside the literal outbound request body used to place the call.
- **Rehearsal vs. live mode**: rehearsal (reading a saved/faked call result) is always the default. Live calling (actually dialing) is always an explicit, deliberate opt-in — never a fallback and never triggered by a merely-unset setting. No test, demo, or rehearsal run may touch the network.
- **AI disclosure**: every call script must open with the AI disclosure (who it is, who it's calling for, that it won't commit to price/quantity/delivery, that it will end the call if asked for a human or to stop). This cannot be optional or skippable.
- **"Unknown" is a first-class answer**: fields like price-quoted, certification-current, part-number-confirmed, and stock-status must allow "unknown" rather than forcing a guess. Turning a call result into a claim must never crash — a garbled/incomplete result becomes a claim with fields defaulted to "unknown"/zero and confidence 0, not an exception.
- **Money** uses exact decimal precision, never float arithmetic that can drift.
- **No real secrets or real phone numbers** in the repo. Demo/test phone numbers must come from officially reserved fictional ranges for their country.

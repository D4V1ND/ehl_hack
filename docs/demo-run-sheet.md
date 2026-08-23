# Demo run sheet

Five minutes, one laptop. The deterministic backend does the whole case in under a
second; a live Devin session takes tens of minutes, so a session belongs in the
recorded part of the video, never in the live slot.

## Before the room

```bash
.venv/bin/python -m backend.record.seed_db        # 40 parts, 15 suppliers
.venv/bin/python run.py api                       # :8010
cloudflared tunnel --url http://localhost:8010    # only needed for a live call
cd apps/web && NEXT_PUBLIC_API_BASE=http://localhost:8010 npm run dev -- --port 3000
cd ui && NEXT_PUBLIC_DATA_SOURCE=live NEXT_PUBLIC_API_BASE=http://localhost:8010 UI_PORT=3000 npm run dev -- --port 3001
```

Check `GET /healthz`: `call_mode` must read `live` only when you intend to dial.
Live dialling needs `CALLE_API_KEY`, `DEMO_CALL_DESTINATION` (your phone, E.164),
`LIVE_CALLS=yes-place-real-calls` and `FAKE_CALLS=0`. `DEMO_CALL_DESTINATION`
sends every supplier call to that one number, so no real supplier can be reached.

## On stage

1. `http://localhost:3001/inventory` — the item master. Any part, not just bearings.
   Press **Source this part** on 6204-2RS. The shortage is derived from the ERP:
   bin, take rate, the BOM line that stops, the incumbent, the slipped PO.
2. `POST /flow/run?case_id=<id>&hold_for=SUP-KBY` — screens 6 suppliers, asks the
   compliant ones, prices every single-source and split plan. Sub-second, and it
   leaves SUP-KBY uncalled for the live moment.
3. The case page is the deliverable: what each supplier offered, what is still
   unknown, and the plans ranked on-time-first-then-cheapest.
4. `POST /flow/call?case_id=<id>&supplier_ref=SUP-KBY&live=true` — the phone
   rings. Answer it as the supplier.
5. `POST /flow/collect?case_id=<id>` files that answer as a claim and re-prices.
   **CALL-E took ~18 minutes to return a result in rehearsal on 2026-08-23**, so
   do not make the re-price the finale: talk through the analysis while it lands.

## What not to promise

Nothing is ordered. The agent ranks and stops; a buyer picks. Every field a call
did not establish reads `unknown`, and a plan that misses the line stop is shown
as too late however cheap it is.

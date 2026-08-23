# Demo run sheet

Five minutes, one laptop. The deterministic rehearsal completes quickly; a live
Devin session or CALL-E result can take many minutes and belongs in a recorded
segment rather than the live finale.

## Before the room

```bash
python run.py setup
python run.py test
python run.py
```

Confirm these pages and endpoints:

- ERP inventory: <http://localhost:3000/inventory>
- SupplyOS: <http://localhost:3001/chat>
- API health: <http://localhost:8010/healthz>
- API docs: <http://localhost:8010/docs>

`call_mode` in `/healthz` must read `rehearsal`. For a deliberate live segment,
set `CALLE_API_KEY`, `DEMO_CALL_DESTINATION`,
`LIVE_CALLS=yes-place-real-calls`, and `FAKE_CALLS=0`, restart the API, and check
health again. `DEMO_CALL_DESTINATION` must be a phone controlled by the operator.

## On stage

1. In ERP, open inventory and choose **Source this part** for `6204-2RS`.
2. Show the handoff to SupplyOS with the returned case ID in the URL.
3. Run the unattended rehearsal while leaving one compliant supplier for the
   live moment:

   ```bash
   python -m supplyos_api.cli run --case <case-id> --hold-for SUP-KBY
   ```

4. In SupplyOS, show the incident evidence, policy exclusions, per-supplier
   checklist, and the difference between records and claims.
5. Optional live segment only:

   ```bash
   python -m supplyos_api.cli call --case <case-id> --supplier SUP-KBY --live
   ```

6. Do not wait on the provider result for the finale. End on the rehearsed ranked
   plans and the explicit buyer-approval boundary. Collect later with:

   ```bash
   python -m supplyos_api.cli collect --case <case-id>
   ```

## Claims to make precisely

- The ERP is a replaceable mock behind the system-of-record interface.
- Supplier statements remain claims until checked against records and policy.
- The system prices and ranks options; it does not create purchase orders.
- Rehearsal is the safe default and the live path requires multiple deliberate
  confirmations.

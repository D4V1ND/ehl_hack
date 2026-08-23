# CASE-6204-2RS — where these numbers come from

Read this before the decision. A buyer decides; nothing here was ordered.

**No supplier ever answered.** The case ran with `call_mode: live` on the tunnel;
three outreach tasks were queued for the compliant suppliers (SUP-KBY, SUP-RUL,
SUP-SKF) and none returned a result. So every price, quantity and lead time in
this package is the **ERP record** — contract price breaks, standard lead time
and trusted fill from `suppliers.yaml` — and not a supplier-confirmed quote.

What is therefore still **unknown**, and is what the calls were for:

- whether the supplier confirms the price at this quantity, today
- MOQ, Incoterm and payment terms
- current free stock against the quantity asked for
- whether ISO 9001 / DIN 625 conformity is current (record says yes; unconfirmed)
- part-number confirmation

Treat the ranking as the shape of the trade-off, not as offers. Confirm the top
one or two plans with the supplier before releasing a PO.

**The screening is firm** — it is policy against the record, not a claim anyone
had to make: SUP-NPB rejected on blocked origin (CN), SUP-PUL on certifications
expired 2026-03-31, SUP-NBT on never having been audited for a high-criticality
part. Those three are not options no matter what they would have said.

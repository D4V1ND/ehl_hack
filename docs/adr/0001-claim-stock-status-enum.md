# Claim `stock_status` uses the PLAN vocabulary

CALL-E's `recipient_result_schema` and the Claim type share one `stock_status` enum. We keep the names from `docs/PLAN.md`: `free_in_stock`, `in_stock_allocated`, `to_be_made`, `unavailable`, `unclear`.

The smoke test used `on_hand_unallocated`, `on_hand_allocated`, `in_production`, `not_available`, `unknown`. Those names are rejected. `unknown` stays on yes/no Claim fields only. Stock that cannot be classified is `unclear`.

**Status:** accepted

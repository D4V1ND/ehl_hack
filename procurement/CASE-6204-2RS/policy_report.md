# Policy report — CASE-6204-2RS

`6204-2RS` (rolling_bearing, high criticality), 10,500 pcs needed by 2026-09-03. Screened 6 approved suppliers on 2026-08-22.

**3 cleared, 3 rejected.**

| supplier | country | verdict | rule | why |
| --- | --- | --- | --- | --- |
| Kugellager Bayern GmbH | DE | cleared | — | approved for 6204-2RS, incumbent, preferred, contract EUR 1.42/pc, 10d door-to-door |
| Ningbo Precision Bearing Co. Ltd | CN | rejected | `blocked_origin_country` | CN is on the blocked-origin list (CN, RU, BY, IR, KP). |
| Pulman AG | DE | rejected | `missing_required_certification` | rolling_bearing requires ISO_9001, DIN_625_CONFORMITY; SUP-PUL ISO_9001, DIN_625_CONFORMITY lapsed on 2026-03-31. |
| Rulmenti Est SRL | RO | cleared | — | approved for 6204-2RS, contract EUR 1.30/pc, 21d door-to-door |
| NordBearing Trading ApS | DK | rejected | `audit_required_and_not_audited` | 6204-2RS is high criticality, which requires an on-site audit; SUP-NBT is never_audited. |
| SKF Deutschland Vertrieb GmbH | DE | cleared | — | approved for 6204-2RS, contract EUR 1.95/pc, 6d door-to-door |

A rejection cites the rule that produced it, and every rule reads one field of `company_profile.yaml`. Nothing here is a judgement call by the agent.

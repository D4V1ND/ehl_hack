# Decision — CASE-6204-2RS

**Recommendation: Split: 4,000 bridge from Kugellager Bayern GmbH (road) + 6,500 from Rulmenti Est SRL (road)** — landed EUR 16769.98 (EUR 1.5971/pc), full quantity on site 2026-09-12.

PO-2291 (30,000 pcs, SUP-KBY) slipped from 2026-08-26 to 2026-09-17. On-hand cover is 12 days at ASSY-3's take rate of 350/day.

## Why this plan

- The line stops on 2026-09-03 at EUR 18400.00/hour. This plan keeps it running; EUR 3974400.00 of downtime avoided against the cheapest plan that does not.
- 4,000 pcs from Kugellager Bayern GmbH by road, ETA 2026-09-01; 6,500 pcs from Rulmenti Est SRL by road, ETA 2026-09-12. Landed EUR 16769.98; line keeps running.
- Runner-up `STR-01` (Single source: Kugellager Bayern GmbH (road)): +EUR 1133.76, full qty 2026-09-01, feasible.
- Runner-up `STR-06` (Split: 4,000 bridge from Kugellager Bayern GmbH (air) + 6,500 from Rulmenti Est SRL (road)): +EUR 1517.65, full qty 2026-09-12, feasible.
- Runner-up `STR-07` (Split: 4,000 bridge from SKF Deutschland Vertrieb GmbH (road) + 6,500 from Rulmenti Est SRL (road)): +EUR 1693.75, full qty 2026-09-12, feasible.

## Order lines

| supplier | qty | mode | ETA | landed EUR |
| --- | --- | --- | --- | --- |
| Kugellager Bayern GmbH | 4,000 | road | 2026-09-01 | 7206.45 |
| Rulmenti Est SRL | 6,500 | road | 2026-09-12 | 9563.53 |

## What a human still owns

- Approving this PR is the approval. Nothing was ordered.
- Policy: `policy_report.md`. Cost arithmetic: `cost_report.md`. Event log: `events.jsonl`.
- Devin session: https://app.devin.ai/sessions/2ddef68c8a9f45fda34ea2a192f24520

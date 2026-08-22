---
status: proposed
---

# SupplyGuard recommends; a human approves by merging

The system never places an order. It publishes a Decision — the recommended Strategy, the runners-up and the reasoning — as a pull request, and a human approves it by merging. The foundation spec's rule that the system makes no purchasing decision therefore still holds in the strict sense, even though the system now compares options and picks a favourite.

## Consequences

The approval gate is the code review, which means it is recorded, attributable and reversible for free, and there is no separate approval workflow to build. It also means the answer to "what stops it buying the wrong thing?" is structural rather than a promise about model behaviour. Purchase execution is deliberately out of scope.

"""Who gets which share of the quantity, and does the line keep running.

The search is small and deliberate rather than clever. On CASE-001 no single
compliant supplier can both cover 36 000 pieces and beat the line stop, so the
answer is necessarily a split, and the interesting question is *which* split:

    obvious   take everything the fast suppliers will give, cheap source covers
              the rest — feasible, and pays a premium on pieces that were never
              needed early
    bridge    buy only enough fast stock to keep the line running until the
              cheap shipment lands, everything else on the cheap line

Both are generated, both are priced, and both go in the comparison table,
because a recommendation is only credible next to the alternative it beat.

Feasibility is not "does the first delivery beat the line-stop date". It is a
day-by-day simulation of on-hand stock against the take rate: arrivals go in,
consumption comes out, and if the balance ever goes negative the line stopped.
That is the only check that a bridge order is actually a bridge.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from packages.contracts.enums import FreightMode
from packages.contracts.models import (
    Claim,
    CompanyProfile,
    Incident,
    LandedCost,
    OrderLine,
    Part,
    Strategy,
    SupplierRecord,
)
from packages.contracts.money import quantize_total, quantize_unit
from backend.cost.cost_model import Line, available_modes, eta, landed_cost
from backend.policy.rules import deliverable_qty, lead_days

# Suppliers quote and ship in lots. Asking for 4 137 pieces is not a real order.
LOT = 1000

HOURS_PER_DAY = Decimal("24")


@dataclass(frozen=True)
class Option:
    """One compliant supplier, with whatever the call added to the file."""

    supplier: SupplierRecord
    claim: Claim | None = None

    @property
    def supplier_ref(self) -> str:
        return self.supplier.supplier_id


def round_up_lot(qty: int, lot: int = LOT) -> int:
    return -(-qty // lot) * lot


def simulate(
    *,
    arrivals: list[tuple[date, int]],
    qty_on_hand: int,
    daily_consumption: int,
    start: date,
    qty_required: int,
) -> tuple[bool, date | None]:
    """Run the line forward day by day.

    Returns whether it ever runs dry, and the day the full requirement is on
    site. Consumption is charged at the end of each day, so stock that lands on
    the morning it is needed still counts.
    """
    horizon = max((a[0] - start).days for a in arrivals) + 1 if arrivals else 1
    by_day: dict[int, int] = {}
    for arrival_date, qty in arrivals:
        day = max((arrival_date - start).days, 0)
        by_day[day] = by_day.get(day, 0) + qty

    inventory = qty_on_hand
    delivered = 0
    coverage: date | None = None
    ran_dry = False
    # The loop runs to the end even after a stockout: "when is the full quantity
    # on site" is worth reporting for a plan that failed, because it is what the
    # comparison table shows next to the plan that did not.
    for day in range(horizon + 1):
        inventory += by_day.get(day, 0)
        delivered += by_day.get(day, 0)
        if coverage is None and delivered >= qty_required:
            coverage = start + timedelta(days=day)
        inventory -= daily_consumption
        if inventory < 0:
            ran_dry = True
    return not ran_dry, coverage


def _risk(lines: list[tuple[Option, int]]) -> float:
    """More lines, thinner evidence and quantities nobody has shipped before all
    push this up. Bounded to [0, 1] because it is a comparison aid, not a
    probability anyone should bet the plant on."""
    if not lines:
        return 1.0
    penalties = 0.0
    for option, qty in lines:
        claim = option.claim
        penalties += (1.0 - claim.confidence) * 0.35 if claim is not None else 0.15
        if qty > max(option.supplier.max_historical_fill, 1):
            penalties += 0.20
        if option.supplier.audit_status.value != "audited":
            penalties += 0.15
    return round(min(penalties / len(lines) + 0.05 * (len(lines) - 1), 1.0), 3)


class StrategyBuilder:
    """Prices and scores plans for one case. Holds no state between cases."""

    def __init__(
        self,
        *,
        incident: Incident,
        part: Part,
        profile: CompanyProfile,
        options: list[Option],
        daily_consumption: int,
        today: date,
    ) -> None:
        self.incident = incident
        self.part = part
        self.profile = profile
        self.today = today
        self.daily_consumption = max(daily_consumption, 1)
        # Only suppliers who have told us, or whose file tells us, how long they
        # take can be planned around at all.
        self.options = [o for o in options if lead_days(o.supplier, o.claim) is not None]
        self._counter = 0

    # -- plan construction --------------------------------------------------

    def build(self) -> list[Strategy]:
        plans: list[Strategy] = []
        plans.extend(self._single_source())
        plans.extend(self._bridge_splits())
        obvious = self._obvious_split()
        if obvious is not None:
            plans.append(obvious)
        return self.rank(plans)

    def _single_source(self) -> list[Strategy]:
        out: list[Strategy] = []
        qty = self.incident.qty_required
        for option in self.options:
            if deliverable_qty(option.supplier, option.claim) < qty:
                continue
            for mode in available_modes(option.supplier.country):
                strategy = self.price(
                    [(option, qty, mode)],
                    label=f"Single source: {option.supplier.supplier_name} ({mode.value})",
                )
                if strategy is not None:
                    out.append(strategy)
        return out

    def _bridge_splits(self) -> list[Strategy]:
        """Fast supplier covers only the gap; the cheap one covers the rest."""
        out: list[Strategy] = []
        qty = self.incident.qty_required
        for bulk in self.options:
            bulk_arrival = self._eta(bulk, self._mode(bulk))
            for bridge in self.options:
                if bridge.supplier_ref == bulk.supplier_ref:
                    continue
                for bridge_mode in available_modes(bridge.supplier.country):
                    bridge_qty = self._bridge_qty(bridge, bulk_arrival, bridge_mode)
                    if bridge_qty <= 0 or bridge_qty >= qty:
                        continue
                    if deliverable_qty(bulk.supplier, bulk.claim) < qty - bridge_qty:
                        continue
                    strategy = self.price(
                        [
                            (bridge, bridge_qty, bridge_mode),
                            (bulk, qty - bridge_qty, self._mode(bulk)),
                        ],
                        label=(
                            f"Split: {bridge_qty:,} bridge from {bridge.supplier.supplier_name}"
                            f" ({bridge_mode.value})"
                            f" + {qty - bridge_qty:,} from {bulk.supplier.supplier_name}"
                            f" ({self._mode(bulk).value})"
                        ),
                    )
                    if strategy is not None:
                        out.append(strategy)
        return out

    def _obvious_split(self) -> Strategy | None:
        """Everything the fast suppliers will give, remainder on the cheapest.

        The plan a hurried buyer writes. Kept so the recommendation has
        something honest to be compared against.
        """
        qty = self.incident.qty_required
        deadline = self.incident.line_stop_at.date()
        fast = [o for o in self.options if self._eta(o, self._mode(o)) <= deadline]
        if not fast:
            return None
        fast_refs = {o.supplier_ref for o in fast}
        cheap = sorted(
            (o for o in self.options if o.supplier_ref not in fast_refs),
            key=self._unit_hint,
        )
        if not cheap:
            return None

        lines: list[tuple[Option, int, FreightMode]] = []
        remaining = qty
        for option in sorted(fast, key=lambda o: self._eta(o, self._mode(o))):
            take = min(deliverable_qty(option.supplier, option.claim), remaining)
            take = (take // LOT) * LOT
            if take <= 0:
                continue
            lines.append((option, take, self._mode(option)))
            remaining -= take
        if remaining <= 0 or not lines:
            return None
        bulk = cheap[0]
        if deliverable_qty(bulk.supplier, bulk.claim) < remaining:
            return None
        lines.append((bulk, remaining, self._mode(bulk)))
        return self.price(
            lines,
            label="Split: everything the fast suppliers will give, remainder on the cheapest",
        )

    # -- pricing ------------------------------------------------------------

    def price(
        self, allocation: list[tuple[Option, int, FreightMode]], *, label: str
    ) -> Strategy | None:
        lines: list[OrderLine] = []
        costs: list[LandedCost] = []
        arrivals: list[tuple[date, int]] = []

        for option, qty, mode in allocation:
            if qty <= 0:
                continue
            arrival = self._eta(option, mode)
            priced = landed_cost(
                line=Line(
                    supplier=option.supplier,
                    qty=qty,
                    mode=mode,
                    eta=arrival,
                    claim=option.claim,
                ),
                part=self.part,
                profile=self.profile,
                needed_by=self.incident.needed_by,
                daily_consumption=self.daily_consumption,
            )
            if not priced.goods_cost:
                return None  # nobody has quoted this supplier a price; not a plan
            costs.append(priced)
            arrivals.append((arrival, qty))
            lines.append(
                OrderLine(
                    supplier_ref=option.supplier_ref,
                    supplier_name=option.supplier.supplier_name,
                    qty=qty,
                    mode=mode,
                    eta=arrival,
                    landed=priced,
                )
            )
        if not lines:
            return None

        total = quantize_total(sum((c.total for c in costs), Decimal("0")))
        qty_total = sum(line.qty for line in lines)
        runs, coverage = simulate(
            arrivals=arrivals,
            qty_on_hand=self.opening_stock(),
            daily_consumption=self.daily_consumption,
            start=self.today,
            qty_required=self.incident.qty_required,
        )
        self._counter += 1
        return Strategy(
            strategy_id=f"STR-{self._counter:02d}",
            label=label,
            lines=lines,
            total_cost=total,
            unit_effective=quantize_unit(total / Decimal(qty_total)) if qty_total else Decimal("0"),
            coverage_date=coverage or max(line.eta for line in lines),
            meets_line_stop=runs,
            risk_score=_risk([(o, q) for o, q, _ in allocation]),
            rationale=self._rationale(lines, runs, total),
        )

    def opening_stock(self) -> int:
        """Stock we can still consume from today, not the incident's snapshot.

        `qty_on_hand` was true when the shortage was detected. The record also
        says the line stops on a given date, and that date is the authority: if we
        start planning three days before it, we have three days of stock left, not
        the twelve the snapshot implies. Taking the smaller of the two is what
        keeps a plan from looking feasible because it was priced late.
        """
        days_left = max((self.incident.line_stop_at.date() - self.today).days, 0)
        return min(self.incident.qty_on_hand, days_left * self.daily_consumption)

    def downtime_cost(self, arrivals: list[tuple[date, int]]) -> Decimal:
        """Cash cost of the days the line is down under a plan.

        Charged from the line-stop date to the first arrival that restarts it,
        which is the number that makes a EUR 12 000 air freight bill look cheap.
        """
        deadline = self.incident.line_stop_at.date()
        first = min((a[0] for a in arrivals), default=deadline)
        days = max((first - deadline).days, 0)
        return quantize_total(
            self.incident.line_stop_cost_per_hour * HOURS_PER_DAY * Decimal(days)
        )

    def rank(self, plans: list[Strategy]) -> list[Strategy]:
        """Feasible first, then cheapest all-in, then least risky.

        All-in means procurement cash plus the downtime the plan concedes, so an
        infeasible plan is not accidentally the "cheapest" one on the table.
        """

        def key(strategy: Strategy) -> tuple[int, Decimal, float]:
            exposure = self.downtime_cost([(line.eta, line.qty) for line in strategy.lines])
            return (0 if strategy.meets_line_stop else 1, strategy.total_cost + exposure, strategy.risk_score)

        return sorted(plans, key=key)

    # -- helpers ------------------------------------------------------------

    def _mode(self, option: Option) -> FreightMode:
        return available_modes(option.supplier.country)[0]

    def _eta(self, option: Option, mode: FreightMode) -> date:
        return eta(
            supplier=option.supplier,
            profile=self.profile,
            mode=mode,
            today=self.today,
            claim=option.claim,
        )

    def _unit_hint(self, option: Option) -> Decimal:
        """Cheapest price anyone has named for this supplier, for ordering only."""
        claim = option.claim
        breaks = claim.price_breaks if claim is not None and claim.price_breaks else option.supplier.price_breaks
        if breaks:
            return min(b.unit_price for b in breaks)
        if claim is not None and claim.unit_price is not None:
            return claim.unit_price
        return option.supplier.contract_unit_price or Decimal("999")

    def _bridge_qty(self, bridge: Option, bulk_arrival: date, mode: FreightMode) -> int:
        """Just enough to carry the line from its stop date to the bulk arrival.

        Rounded up to a full lot, capped at what the bridge supplier can actually
        deliver, and zero if the bulk order lands before the line would stop.
        """
        gap_days = (bulk_arrival - self.incident.line_stop_at.date()).days
        if gap_days <= 0:
            return 0
        needed = round_up_lot(gap_days * self.daily_consumption)
        return min(needed, (deliverable_qty(bridge.supplier, bridge.claim) // LOT) * LOT)

    def _rationale(self, lines: list[OrderLine], runs: bool, total: Decimal) -> str:
        parts = [
            f"{line.qty:,} pcs from {line.supplier_name} by {line.mode.value}, ETA {line.eta.isoformat()}"
            for line in lines
        ]
        exposure = self.downtime_cost([(line.eta, line.qty) for line in lines])
        verdict = (
            "line keeps running"
            if runs
            else f"line stops — EUR {exposure} of downtime before the first arrival"
        )
        return f"{'; '.join(parts)}. Landed EUR {total}; {verdict}."

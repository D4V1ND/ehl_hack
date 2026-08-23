"""One case, end to end: screen, price, decide, write the review package.

This is the only stateful step in the decision path. It reads the system of
record and whatever claims have been filed, calls the pure policy and cost
modules, then writes `candidates.json`, `policy_report.md`, `cost_report.md`,
`decision.md`, `po_draft.md` and `decision.json` into `cases/<case_id>/`.

It is safe to run before any call has come back: with no claims it decides on
the strength of our own files alone and says so. Re-running after each round of
claims is the intended flow, and every run rewrites the same artifacts, so the
case directory always reflects what is currently known.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from packages.contracts.enums import (
    Actor,
    DecisionStatus,
    FreightMode,
    Level,
    Stage,
    StockStatus,
)
from packages.contracts.models import (
    Candidate,
    Claim,
    CompanyProfile,
    Decision,
    DecisionChecks,
    Incident,
    OrderLine,
    Part,
    Strategy,
    SupplierRecord,
)
from packages.contracts.money import quantize_total, quantize_unit
from backend.casestore.case_store import CaseStore
from backend.cost.strategy import Option, StrategyBuilder
from backend.cost.cost_model import Line, eta, landed_cost
from backend.cost.strategy import simulate
from backend.decide import artifacts
from backend.policy.rules import check_lead_time
from backend.policy.screen import screen
from backend.record.ports import SystemOfRecord

# How many alternatives the reports carry. Enough to show the trade-off, few
# enough that a buyer reads the table instead of skimming it.
RUNNERS_UP = 3
DECISION_CONFIDENCE_THRESHOLD = 0.40


@dataclass(frozen=True)
class DecisionOutcome:
    decision: Decision
    candidates: list[Candidate]
    strategies: list[Strategy]
    recommended: Strategy | None


def build_recorded_decision(
    *,
    case_id: str,
    incident: Incident,
    part: Part,
    profile: CompanyProfile,
    suppliers: list[SupplierRecord],
    candidates: list[Candidate],
    claims: list[Claim],
    today: date,
    decided_at: datetime,
    revision: int = 1,
) -> Decision | None:
    """Build the deterministic split from eligible provider-backed Claims."""
    cleared = {
        candidate.supplier_ref
        for candidate in candidates
        if candidate.compliance.passed
    }
    eligible = [
        claim
        for claim in claims
        if claim.supplier_ref in cleared
        and claim.confidence >= DECISION_CONFIDENCE_THRESHOLD
        and claim.available
        and claim.qty_offered > 0
        and claim.unit_price is not None
        and claim.lead_time_days is not None
        and claim.stock_status
        in {StockStatus.FREE_IN_STOCK, StockStatus.TO_BE_MADE}
    ]
    by_supplier = {supplier.supplier_id: supplier for supplier in suppliers}
    shortfall = incident.shortfall
    strategies: list[Strategy] = []

    if shortfall > 0 and eligible:
        bulk = max(
            eligible,
            key=lambda claim: (
                min(claim.qty_offered, shortfall),
                -(claim.unit_price or Decimal("999999")),
                claim.supplier_ref,
            ),
        )
        bulk_qty = min(bulk.qty_offered, shortfall)
        bridge_qty = shortfall - bulk_qty
        bridge_options = [
            claim
            for claim in eligible
            if claim.supplier_ref != bulk.supplier_ref and claim.qty_offered >= bridge_qty
        ]
        bridge = min(
            bridge_options,
            key=lambda claim: (
                claim.lead_time_days or 999999,
                claim.unit_price or Decimal("999999"),
                claim.supplier_ref,
            ),
            default=None,
        )

        if bridge is not None and bridge_qty > 0:
            allocation = (
                (bridge, bridge_qty, FreightMode.AIR),
                (bulk, bulk_qty, FreightMode.SEA),
            )
            lines: list[OrderLine] = []
            arrivals: list[tuple[date, int]] = []
            for claim, qty, mode in allocation:
                supplier = by_supplier[claim.supplier_ref]
                arrival = eta(
                    supplier=supplier,
                    profile=profile,
                    mode=mode,
                    today=today,
                    claim=claim,
                )
                priced = landed_cost(
                    line=Line(
                        supplier=supplier,
                        qty=qty,
                        mode=mode,
                        eta=arrival,
                        claim=claim,
                    ),
                    part=part,
                    profile=profile,
                    needed_by=incident.needed_by,
                    daily_consumption=_daily_consumption(incident, today),
                )
                lines.append(
                    OrderLine(
                        supplier_ref=supplier.supplier_id,
                        supplier_name=supplier.supplier_name,
                        qty=qty,
                        mode=mode,
                        eta=arrival,
                        landed=priced,
                    )
                )
                arrivals.append((arrival, qty))

            total = quantize_total(sum((line.landed.total for line in lines), Decimal("0")))
            meets_line_stop, coverage_date = simulate(
                arrivals=arrivals,
                qty_on_hand=incident.qty_on_hand,
                daily_consumption=_daily_consumption(incident, today),
                start=today,
                qty_required=shortfall,
            )
            strategy = Strategy(
                strategy_id="STR-01",
                label=(
                    f"Split: {bridge_qty:,} bridge from {lines[0].supplier_name} (air) "
                    f"+ {bulk_qty:,} from {lines[1].supplier_name} (sea)"
                ),
                lines=lines,
                total_cost=total,
                unit_effective=quantize_unit(total / Decimal(shortfall)),
                coverage_date=coverage_date or max(line.eta for line in lines),
                meets_line_stop=meets_line_stop,
                risk_score=round((2 - bridge.confidence - bulk.confidence) / 2, 3),
                rationale="Provider-backed bridge and bulk Claims cover the trusted shortfall.",
            )
            strategies.append(strategy)

    policy_passed = bool(strategies) and all(
        candidate.compliance.passed
        for candidate in candidates
        if candidate.supplier_ref
        in {line.supplier_ref for line in strategies[0].lines}
    )
    cost_model_passed = (
        bool(strategies)
        and strategies[0].total_cost > 0
        and strategies[0].meets_line_stop
    )
    if not policy_passed or not cost_model_passed:
        return None
    return Decision(
        case_id=case_id,
        strategies=strategies,
        recommended_strategy_id=strategies[0].strategy_id if strategies else None,
        runner_up_ids=[],
        rationale_md=(
            strategies[0].rationale
            if strategies
            else "No eligible provider-backed Claims cover the trusted shortfall."
        ),
        decided_at=decided_at,
        revision=revision,
        status=DecisionStatus.READY,
        checks=DecisionChecks(
            policy_passed=policy_passed,
            cost_model_passed=cost_model_passed,
        ),
    )


def _daily_consumption(incident: Incident, today: date) -> int:
    days = max((incident.line_stop_at.date() - today).days, 1)
    return max(incident.qty_on_hand // days, 1)


def run(
    *,
    case_id: str,
    records: SystemOfRecord,
    cases: CaseStore,
    today: date | None = None,
    devin_session_url: str | None = None,
) -> DecisionOutcome:
    incident = records.get_incident(case_id)
    if incident is None:
        raise ValueError(f"no incident {case_id}")
    part = records.get_part(incident.part_id)
    if part is None:
        raise ValueError(f"incident {case_id} points at unknown part {incident.part_id}")

    profile = records.get_company_profile()
    suppliers = records.get_suppliers_for_part(incident.part_id)
    today = today or datetime.now(timezone.utc).date()

    claims = _latest_claims(cases.read_claims(case_id))
    candidates = screen(
        case_id=case_id,
        suppliers=suppliers,
        part=part,
        profile=profile,
        today=today,
        claims=claims,
    )
    cases.write_candidates(case_id, candidates)

    stock = records.get_stock(incident.part_id, incident.plant_id)
    daily_consumption = stock[0].daily_consumption if stock else 1

    cleared = {c.supplier_ref for c in candidates if c.compliance.passed}
    options = [
        Option(supplier=s, claim=claims.get(s.supplier_id))
        for s in suppliers
        if s.supplier_id in cleared
    ]
    builder = StrategyBuilder(
        incident=incident,
        part=part,
        profile=profile,
        options=options,
        daily_consumption=daily_consumption,
        today=today,
    )
    strategies = builder.build()
    feasible = [s for s in strategies if s.meets_line_stop]
    recommended = feasible[0] if feasible else None
    runners_up = [s for s in strategies if recommended is None or s.strategy_id != recommended.strategy_id][:RUNNERS_UP]

    # What the recommendation is worth: the downtime of the best plan that does
    # not keep the line running, minus its own (zero, if it is feasible).
    infeasible = [s for s in strategies if not s.meets_line_stop]
    downtime_avoided = Decimal("0")
    if recommended is not None and infeasible:
        cheapest_infeasible = min(infeasible, key=lambda s: s.total_cost)
        downtime_avoided = quantize_total(
            builder.downtime_cost([(line.eta, line.qty) for line in cheapest_infeasible.lines])
        )

    decision = Decision(
        case_id=case_id,
        strategies=strategies,
        recommended_strategy_id=recommended.strategy_id if recommended else None,
        runner_up_ids=[s.strategy_id for s in runners_up],
        rationale_md="",
        policy_report_url="policy_report.md",
        cost_report_url="cost_report.md",
        devin_session_url=devin_session_url,
        decided_at=datetime.now(timezone.utc),
    )

    claim_list = [claims[key] for key in sorted(claims)]
    decision.rationale_md = artifacts.decision_md(
        incident=incident,
        part=part,
        decision=decision,
        recommended=recommended,
        runners_up=runners_up,
        claims=claim_list,
        downtime_avoided=downtime_avoided,
    )

    cases.write_markdown(
        case_id,
        "policy_report.md",
        artifacts.policy_report_md(
            incident=incident, part=part, candidates=candidates, today=today
        ),
    )
    cases.write_markdown(
        case_id,
        "cost_report.md",
        artifacts.cost_report_md(
            incident=incident, part=part, strategies=strategies, recommended=recommended
        ),
    )
    cases.write_markdown(case_id, "decision.md", decision.rationale_md)
    cases.write_markdown(
        case_id,
        "po_draft.md",
        artifacts.po_draft_md(
            incident=incident,
            part=part,
            recommended=recommended,
            suppliers={s.supplier_id: s for s in suppliers},
        ),
    )
    cases.write_decision(decision)

    rejected = [c for c in candidates if not c.compliance.passed]
    cases.append_event(
        case_id,
        actor=Actor.DEVIN,
        stage=Stage.DECIDED if recommended else Stage.COSTING,
        level=Level.INFO if recommended else Level.WARN,
        message=(
            f"{recommended.label} — EUR {recommended.total_cost} landed, "
            f"full qty {recommended.coverage_date.isoformat()}"
            if recommended
            else "no compliant plan keeps the line running; needs a human buyer"
        ),
        payload={
            "strategies": len(strategies),
            "rejected_suppliers": len(rejected),
            "recommended": recommended.strategy_id if recommended else None,
            "total_cost": str(recommended.total_cost) if recommended else None,
        },
    )

    return DecisionOutcome(
        decision=decision,
        candidates=candidates,
        strategies=strategies,
        recommended=recommended,
    )


def single_source_blockers(
    *, case_id: str, records: SystemOfRecord, today: date
) -> dict[str, list[str]]:
    """Which suppliers cannot single-source the case, and why, by rule name.

    The fourth policy rule is about an order, not a supplier, so it is reported
    here rather than in `Candidate.compliance`. The policy report shows it as the
    reason single-sourcing is off the table.
    """
    incident = records.get_incident(case_id)
    if incident is None:
        return {}
    blockers: dict[str, list[str]] = {}
    for supplier in records.get_suppliers_for_part(incident.part_id):
        result = check_lead_time(supplier=supplier, incident=incident, today=today)
        if not result.passed:
            blockers[supplier.supplier_id] = [rule.value for rule in result.failed_rules]
    return blockers


def _latest_claims(claims: list[Claim]) -> dict[str, Claim]:
    """One claim per supplier: the highest round we have, then the latest.

    A second call supersedes the first — that is what a follow-up round is for.
    """
    latest: dict[str, Claim] = {}
    for claim in claims:
        current = latest.get(claim.supplier_ref)
        if current is None or (claim.round, claim.received_at or datetime.min.replace(tzinfo=timezone.utc)) > (
            current.round,
            current.received_at or datetime.min.replace(tzinfo=timezone.utc),
        ):
            latest[claim.supplier_ref] = claim
    return latest

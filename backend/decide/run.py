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

from packages.contracts.enums import Actor, Level, Stage
from packages.contracts.models import Candidate, Claim, Decision, Strategy
from packages.contracts.money import quantize_total
from backend.casestore.case_store import CaseStore
from backend.cost.strategy import Option, StrategyBuilder
from backend.decide import artifacts
from backend.policy.rules import check_lead_time
from backend.policy.screen import screen
from backend.record.ports import SystemOfRecord

# How many alternatives the reports carry. Enough to show the trade-off, few
# enough that a buyer reads the table instead of skimming it.
RUNNERS_UP = 3


@dataclass(frozen=True)
class DecisionOutcome:
    decision: Decision
    candidates: list[Candidate]
    strategies: list[Strategy]
    recommended: Strategy | None


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

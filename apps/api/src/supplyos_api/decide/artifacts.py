"""The markdown a buyer reads: policy report, cost report, decision, PO draft.

Rendering only. No arithmetic happens here — every number on the page was
computed by `supplyos_api.policy` or `supplyos_api.cost` and is passed in, so the report
cannot drift from the decision it describes.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from packages.contracts.models import (
    Candidate,
    Claim,
    Decision,
    Incident,
    Part,
    Strategy,
    SupplierRecord,
)


def policy_report_md(
    *,
    incident: Incident,
    part: Part,
    candidates: list[Candidate],
    today: date,
) -> str:
    passed = [c for c in candidates if c.compliance.passed]
    rejected = [c for c in candidates if not c.compliance.passed]

    lines = [
        f"# Policy report — {incident.case_id}",
        "",
        f"`{part.item_code}` ({part.part_class.value}, {part.criticality.value} criticality), "
        f"{incident.qty_required:,} pcs needed by {incident.needed_by.isoformat()}. "
        f"Screened {len(candidates)} approved suppliers on {today.isoformat()}.",
        "",
        f"**{len(passed)} cleared, {len(rejected)} rejected.**",
        "",
        "| supplier | country | verdict | rule | why |",
        "| --- | --- | --- | --- | --- |",
    ]
    for candidate in candidates:
        if candidate.compliance.passed:
            lines.append(
                f"| {candidate.supplier_name} | {candidate.country} | cleared | — | {candidate.why_matched} |"
            )
            continue
        for rule in candidate.compliance.failed_rules:
            lines.append(
                f"| {candidate.supplier_name} | {candidate.country} | rejected | "
                f"`{rule.value}` | {candidate.compliance.explanations.get(rule, '')} |"
            )
    lines.append("")
    lines.append(
        "A rejection cites the rule that produced it, and every rule reads one field of "
        "`company_profile.yaml`. Nothing here is a judgement call by the agent."
    )
    return "\n".join(lines) + "\n"


def cost_report_md(
    *,
    incident: Incident,
    part: Part,
    strategies: list[Strategy],
    recommended: Strategy | None,
) -> str:
    lines = [
        f"# Cost report — {incident.case_id}",
        "",
        f"Landed cost, not unit price: goods at the tier the order actually reaches, plus "
        f"freight on {part.weight_kg} kg/pc, duty by origin, and the capital and pallet-months "
        f"the stock ties up. Exact decimal arithmetic throughout.",
        "",
        "| # | plan | lines | landed EUR | EUR/pc | full qty on site | line keeps running | risk |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for index, strategy in enumerate(strategies, start=1):
        marker = "**→**" if recommended is not None and strategy.strategy_id == recommended.strategy_id else str(index)
        lines.append(
            f"| {marker} | {strategy.label} | {len(strategy.lines)} | {strategy.total_cost} | "
            f"{strategy.unit_effective} | {strategy.coverage_date.isoformat()} | "
            f"{'yes' if strategy.meets_line_stop else 'NO'} | {strategy.risk_score} |"
        )

    if recommended is not None:
        lines += ["", f"## Breakdown — {recommended.label}", ""]
        for line in recommended.lines:
            lines.append(line.landed.breakdown_md)
    return "\n".join(lines) + "\n"


def decision_md(
    *,
    incident: Incident,
    part: Part,
    decision: Decision,
    recommended: Strategy | None,
    runners_up: list[Strategy],
    claims: list[Claim],
    downtime_avoided: Decimal,
) -> str:
    if recommended is None:
        return (
            f"# Decision — {incident.case_id}\n\n"
            "**No compliant plan keeps the line running.** Every screened supplier either fails "
            "policy or cannot deliver in time. This needs a human buyer: the options left are an "
            "alternate part, a design deviation, or accepting the downtime.\n"
        )

    lines = [
        f"# Decision — {incident.case_id}",
        "",
        f"**Recommendation: {recommended.label}** — landed EUR {recommended.total_cost} "
        f"(EUR {recommended.unit_effective}/pc), full quantity on site "
        f"{recommended.coverage_date.isoformat()}.",
        "",
        f"{incident.reason.strip()}",
        "",
        "## Why this plan",
        "",
        f"- The line stops on {incident.line_stop_at.date().isoformat()} at "
        f"EUR {incident.line_stop_cost_per_hour}/hour. This plan keeps it running; "
        f"EUR {downtime_avoided} of downtime avoided against the cheapest plan that does not.",
        f"- {recommended.rationale}",
    ]
    for runner in runners_up:
        delta = runner.total_cost - recommended.total_cost
        sign = "+" if delta >= 0 else ""
        lines.append(
            f"- Runner-up `{runner.strategy_id}` ({runner.label}): {sign}EUR {delta}, "
            f"full qty {runner.coverage_date.isoformat()}, "
            f"{'feasible' if runner.meets_line_stop else 'line stops'}."
        )

    lines += ["", "## Order lines", "", "| supplier | qty | mode | ETA | landed EUR |", "| --- | --- | --- | --- | --- |"]
    for line in recommended.lines:
        lines.append(
            f"| {line.supplier_name} | {line.qty:,} | {line.mode.value} | "
            f"{line.eta.isoformat()} | {line.landed.total} |"
        )

    if claims:
        lines += ["", "## What the suppliers actually said", "", "| supplier | stock | offered | lead | confidence |", "| --- | --- | --- | --- | --- |"]
        for claim in claims:
            lines.append(
                f"| {claim.supplier_ref} | {claim.stock_status.value} | {claim.qty_offered:,} | "
                f"{claim.lead_time_days if claim.lead_time_days is not None else 'unknown'} d | "
                f"{claim.confidence:.0%} |"
            )
        lines.append("")
        lines.append(
            "`in_stock_allocated` is why the offered quantity can be far below what was "
            "first said to be in stock. Our files are the baseline; a claim never silently "
            "overwrites them."
        )

    lines += [
        "",
        "## What a human still owns",
        "",
        "- Approving this PR is the approval. Nothing was ordered.",
        f"- Policy: `policy_report.md`. Cost arithmetic: `cost_report.md`. "
        f"Event log: `events.jsonl`.",
    ]
    if decision.devin_session_url:
        lines.append(f"- Devin session: {decision.devin_session_url}")
    return "\n".join(lines) + "\n"


def po_draft_md(
    *,
    incident: Incident,
    part: Part,
    recommended: Strategy | None,
    suppliers: dict[str, SupplierRecord],
) -> str:
    if recommended is None:
        return f"# Purchase order draft — {incident.case_id}\n\nNo plan to draft.\n"

    lines = [
        f"# Purchase order draft — {incident.case_id}",
        "",
        f"Draft only. Not sent, not committed to any supplier. {part.item_code} — {part.item_name}.",
        "",
    ]
    for index, line in enumerate(recommended.lines, start=1):
        supplier = suppliers.get(line.supplier_ref)
        lines += [
            f"## Line {index} — {line.supplier_name} ({line.supplier_ref})",
            "",
            f"- Part: `{part.item_code}` — {part.description}",
            f"- Quantity: {line.qty:,} {part.stock_uom}",
            f"- Unit (landed, incl. freight/duty/carrying): EUR {line.landed.unit_effective}",
            f"- Line total (landed): EUR {line.landed.total}",
            f"- Mode: {line.mode.value}, ETA {line.eta.isoformat()}",
            f"- Ship to: {incident.plant_id}, line {incident.production_line}",
            f"- Contact: {supplier.email if supplier and supplier.email else 'see supplier record'}"
            f" / {supplier.phone_masked if supplier else 'n/a'}",
            "",
        ]
    lines.append(
        "Phone numbers are masked here and everywhere else outside the outbound call itself."
    )
    return "\n".join(lines) + "\n"

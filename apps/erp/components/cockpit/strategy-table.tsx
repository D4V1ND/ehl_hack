import type { Claim, Strategy } from "@/lib/contracts"
import { day, money, qty } from "@/lib/format"
import { Card, Kicker, Mono } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/** On time first, then cheapest: a plan that lands after the line stops is not cheaper. */
function ranked(strategies: Strategy[]): Strategy[] {
  return [...strategies].sort((a, b) => {
    if (a.meets_line_stop !== b.meets_line_stop) return a.meets_line_stop ? -1 : 1
    return Number(a.total_cost) - Number(b.total_cost)
  })
}

/**
 * Every way to buy it, fully costed — goods, freight, duty, carrying cost,
 * expediting.
 *
 * Nothing is ordered here. The recommendation is a recommendation; the buyer
 * picks, which is why the plans that miss the line stop stay on the page instead
 * of being filtered out.
 */
export function StrategyTable({
  strategies,
  recommendedId,
  claims = [],
}: {
  strategies: Strategy[]
  recommendedId?: string | null
  claims?: Claim[]
}) {
  if (strategies.length === 0) {
    return (
      <Card className="border-dashed bg-canvas-soft px-5 py-6">
        <p className="text-[15px] text-muted-ink">No plans priced yet.</p>
      </Card>
    )
  }

  const quoted = new Set(claims.map((claim) => claim.supplier_ref))
  const plans = ranked(strategies)

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-hairline bg-canvas-soft text-left">
              {["", "Plan", "Landed", "Per piece", "Full qty on site", "Line stop"].map(
                (heading, index) => (
                  <th
                    key={heading || index}
                    className={cn(
                      "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.88px] text-muted-ink",
                      index >= 2 && index <= 3 ? "text-right" : "",
                    )}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {plans.map((strategy, index) => (
              <tr
                key={strategy.strategy_id}
                className={cn(
                  "border-b border-hairline last:border-0",
                  strategy.meets_line_stop ? "" : "bg-semantic-error/[0.04]",
                )}
              >
                <td className="tnum px-4 py-3 align-top text-muted-soft">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{strategy.label}</span>
                    {strategy.strategy_id === recommendedId ? (
                      <span className="rounded-pill bg-timeline-done px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.7px] text-on-primary">
                        Best value
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 text-[12px] text-muted-ink">
                    {strategy.lines.map((line) => (
                      <span key={`${line.supplier_ref}-${line.eta}`}>
                        <span className="tnum">{qty(line.qty)}</span> from {line.supplier_name} by{" "}
                        <span className="tnum">{day(line.eta)}</span> ({line.mode})
                        {/* A held-back supplier is priced on its ERP contract, not on
                            anything it said — say so or the plan reads as a quote. */}
                        {quoted.has(line.supplier_ref) ? null : " — contract terms, not quoted"}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="tnum px-4 py-3 text-right text-ink">{money(strategy.total_cost)}</td>
                <td className="tnum px-4 py-3 text-right text-body">
                  {money(strategy.unit_effective)}
                </td>
                <td className="tnum px-4 py-3 text-body">{day(strategy.coverage_date)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "text-[13px]",
                      strategy.meets_line_stop ? "text-semantic-success" : "text-semantic-error",
                    )}
                  >
                    {strategy.meets_line_stop ? "in time" : "too late"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-hairline bg-canvas-soft px-4 py-2.5">
        <Kicker>
          {plans.length} plans · landed cost includes freight, duty and carrying cost at{" "}
          <Mono>WACC</Mono>
        </Kicker>
      </div>
    </Card>
  )
}

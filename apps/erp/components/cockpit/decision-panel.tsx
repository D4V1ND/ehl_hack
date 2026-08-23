import { ArrowUpRight } from "lucide-react"

import type { Decision, Strategy } from "@/lib/contracts"
import { day, money } from "@/lib/format"
import { Card, Kicker, Mono } from "@/components/cockpit/primitives"

/**
 * The artifact: the case as a pull request a human merges.
 *
 * Merging is the approval. Nothing is ordered before it, which is why this panel
 * shows the runners-up too — the buyer is choosing, not rubber-stamping.
 */
export function DecisionPanel({ decision }: { decision?: Decision | null }) {
  if (!decision) {
    return (
      <Card className="border-dashed bg-canvas-soft px-5 py-6">
        <p className="text-[15px] text-muted-ink">Nothing decided yet.</p>
      </Card>
    )
  }

  const strategies = decision.strategies ?? []
  const byId = new Map<string, Strategy>(strategies.map((s) => [s.strategy_id, s]))
  const recommended = decision.recommended_strategy_id
    ? byId.get(decision.recommended_strategy_id)
    : undefined
  const runnersUp = (decision.runner_up_ids ?? [])
    .map((id) => byId.get(id))
    .filter((s): s is Strategy => s !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <Card className="px-5 py-4">
        <Kicker>Recommended, not ordered</Kicker>
        {recommended ? (
          <>
            <div className="mt-1.5 text-[19px] leading-[1.3] text-ink">{recommended.label}</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[14px] text-body">
              <span className="tnum">{money(recommended.total_cost)} landed</span>
              <span className="tnum">{money(recommended.unit_effective)} per piece</span>
              <span className="tnum">full quantity {day(recommended.coverage_date)}</span>
              <span
                className={
                  recommended.meets_line_stop ? "text-semantic-success" : "text-semantic-error"
                }
              >
                {recommended.meets_line_stop ? "beats the line stop" : "misses the line stop"}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-[15px] text-muted-ink">
            No compliant plan covers the shortage — the rejected suppliers and what a waiver would
            cost are the decision a human has to make.
          </p>
        )}
        {runnersUp.length ? (
          <div className="mt-3 border-t border-hairline pt-3 text-[13px] text-muted-ink">
            Runners-up:{" "}
            {runnersUp
              .map((strategy) => `${strategy.label} (${money(strategy.total_cost)})`)
              .join(" · ")}
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <Kicker>Approve by merging</Kicker>
          <div className="mt-1 text-[14px] text-body">
            {decision.pr_url ? (
              <a
                className="inline-flex items-center gap-1 text-ink underline decoration-hairline-strong underline-offset-4"
                href={decision.pr_url}
              >
                {decision.pr_url}
                <ArrowUpRight className="size-3.5" />
              </a>
            ) : (
              <>
                Rehearsed — no pull request opened. Set <Mono>GITHUB_TOKEN</Mono> and{" "}
                <Mono>GITHUB_REPO</Mono> to publish the case, policy report, cost report and PO
                draft.
              </>
            )}
          </div>
        </div>
        {decision.decided_at ? (
          <div className="text-right text-[12px] text-muted-ink">
            decided <span className="tnum">{day(decision.decided_at)}</span>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

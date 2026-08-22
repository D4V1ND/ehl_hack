"use client"

import type { ShortageAlert } from "@/lib/contracts"
import { money, qty } from "@/lib/format"
import { Kicker } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/**
 * Parts at risk, worst first -- the "what is on fire" view.
 *
 * Kept as a strip at the top of the case page rather than its own route: with
 * one case in play, a second screen would be a click that leads nowhere useful
 * mid-demo.
 */
export function ShortageStrip({
  shortages,
  selectedCaseId,
  onSelect,
}: {
  shortages: ShortageAlert[]
  selectedCaseId: string
  onSelect: (caseId: string) => void
}) {
  const sourceable = shortages.filter((alert) => alert.case_id)
  const watchlist = shortages.filter((alert) => !alert.case_id)

  return (
    <div className="border-b border-hairline bg-canvas-soft px-6 py-4 lg:px-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex items-baseline justify-between">
          <Kicker>Parts at risk</Kicker>
          <span className="text-[12px] text-muted-ink">
            {shortages.length} below reorder point · {sourceable.length} with an open case
          </span>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {sourceable.map((alert) => {
            const active = alert.case_id === selectedCaseId
            return (
              <button
                key={alert.part_id}
                type="button"
                onClick={() => onSelect(alert.case_id!)}
                className={cn(
                  "min-w-[236px] shrink-0 rounded-lg border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-surface-card"
                    : "border-hairline bg-surface-card hover:border-hairline-strong",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] text-ink">{alert.item_code}</span>
                  <span
                    className={cn(
                      "tnum text-[13px] font-medium",
                      alert.days_to_line_stop <= 12
                        ? "text-semantic-error"
                        : "text-semantic-warning",
                    )}
                  >
                    {alert.days_to_line_stop}d cover
                  </span>
                </div>
                <div className="mt-1 truncate text-[13px] text-body">{alert.item_name}</div>
                <div className="tnum mt-2 flex items-center gap-3 text-[12px] text-muted-ink">
                  <span>{qty(alert.qty_on_hand)} on hand</span>
                  <span className="text-muted-soft">/</span>
                  <span>{qty(alert.reorder_level)} reorder</span>
                </div>
                <div className="mt-1 text-[12px] text-muted-ink">
                  {money(alert.line_stop_cost_per_hour)}/h if the line stops
                </div>
              </button>
            )
          })}

          {watchlist.slice(0, 4).map((alert) => (
            <div
              key={alert.part_id}
              className="min-w-[176px] shrink-0 rounded-lg border border-dashed border-hairline px-4 py-3"
            >
              <div className="font-mono text-[13px] text-muted-ink">{alert.item_code}</div>
              <div className="tnum mt-1 text-[12px] text-muted-soft">
                {alert.days_to_line_stop}d cover · no case
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

"use client"

import type { Stage } from "@/lib/contracts"
import { STAGES, STAGE_INDEX } from "@/lib/stages"
import { cn } from "@/lib/utils"

/**
 * Where the case has got to.
 *
 * The same five colours as the event dock, in the same order as the sections
 * below. A viewer learns the vocabulary once.
 */
export function StageRail({ stage }: { stage: Stage }) {
  const reached = STAGE_INDEX[stage] ?? 0
  return (
    <ol className="flex items-center gap-1.5">
      {STAGES.map((entry, index) => {
        const done = index <= reached
        return (
          <li key={entry.id} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px] transition-colors",
                done ? entry.pill : "bg-hairline-soft text-muted-soft",
              )}
            >
              {entry.label}
            </span>
            {index < STAGES.length - 1 ? (
              <span
                className={cn("h-px w-3", index < reached ? "bg-hairline-strong" : "bg-hairline")}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

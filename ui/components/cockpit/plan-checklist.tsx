"use client"

import * as React from "react"
import { Check, Circle, Loader2, Minus, X } from "lucide-react"

import type { CasePlan, PlanStep, StepStatus } from "@/lib/contracts"
import { Card, Kicker } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/**
 * The checklist the audience actually watches.
 *
 * The eight headers are fixed and exist from the moment a case is opened, so
 * the screen shows the whole job before any of it is done — the work ahead is
 * as much of the story as the work finished. The lines *inside* a header are
 * not fixed: how many suppliers get screened and called is the agent's
 * decision, and each one appears here the moment it tells the backend about it.
 */

const STATUS_ICON: Record<StepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  active: Loader2,
  done: Check,
  failed: X,
  skipped: Minus,
}

const STATUS_TONE: Record<StepStatus, string> = {
  pending: "text-muted-soft",
  active: "text-semantic-warning",
  done: "text-semantic-success",
  failed: "text-semantic-error",
  skipped: "text-muted-soft",
}

function StepRow({ step }: { step: PlanStep }) {
  const status = step.status ?? "pending"
  const Icon = STATUS_ICON[status]
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <Icon
        className={cn(
          "mt-[3px] size-3.5 shrink-0",
          STATUS_TONE[status],
          status === "active" && "animate-spin",
        )}
      />
      <div className="min-w-0">
        <div
          className={cn(
            "text-[14px] leading-[1.45]",
            status === "pending" && "text-muted-ink",
            status === "active" && "text-ink",
            status === "done" && "text-body",
            status === "failed" && "text-semantic-error",
            status === "skipped" && "text-muted-soft line-through",
          )}
        >
          {step.label}
        </div>
        {step.detail ? (
          <div className="text-[12px] leading-[1.45] text-muted-ink">{step.detail}</div>
        ) : null}
      </div>
    </li>
  )
}

export function PlanChecklist({ plan }: { plan: CasePlan | null }) {
  if (!plan) {
    return (
      <Card className="border-dashed px-5 py-6">
        <p className="text-[14px] text-muted-ink">No checklist for this case yet.</p>
      </Card>
    )
  }

  const total = plan.total ?? 0
  const done = plan.done ?? 0
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <Kicker>What the agent is doing</Kicker>
        <span className="tnum text-[12px] text-muted-ink">
          {done}/{total} done
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-hairline-soft">
        <div
          className="h-full rounded-pill bg-semantic-success transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-4 space-y-4">
        {(plan.sections ?? []).map((section) => {
          const steps = section.steps ?? []
          return (
            <li key={section.group}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-pill",
                    section.status === "done"
                      ? "bg-semantic-success"
                      : section.status === "active"
                        ? "bg-semantic-warning"
                        : section.status === "failed"
                          ? "bg-semantic-error"
                          : "bg-hairline-strong",
                  )}
                />
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    section.status === "pending" ? "text-muted-ink" : "text-ink",
                  )}
                >
                  {section.label}
                </span>
              </div>
              <ul className="ml-[13px] border-l border-hairline pl-4">
                {steps.length ? (
                  steps.map((step) => <StepRow key={step.step_id} step={step} />)
                ) : (
                  <li className="py-1.5 text-[13px] text-muted-soft">not started</li>
                )}
              </ul>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

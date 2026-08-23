import {
  CheckIcon,
  CircleIcon,
  Loader2Icon,
  Phone,
  XIcon,
} from "@/components/icons"
import { DotLoader } from "@/components/cockpit/dot-loader"
import type { LivePlan, LivePlanStep, LiveStepStatus } from "@/lib/live/plan"
import { cn } from "@/lib/utils"

export function PlanChecklist({
  plan,
  launching,
}: {
  plan: LivePlan | null
  launching: boolean
}) {
  if (launching && !plan) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <DotLoader className="size-4" />
        <span>Opening the case…</span>
      </div>
    )
  }

  if (!plan) {
    return (
      <p className="text-sm text-muted-foreground">
        No checklist yet. It appears when the case opens.
      </p>
    )
  }

  const percent = plan.total ? Math.round((plan.done / plan.total) * 100) : 0
  const liveCalls = plan.sections
    .flatMap((section) => section.steps)
    .filter(
      (step) =>
        step.group === "outreach" &&
        step.supplier_ref &&
        step.status === "active"
    )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">What the agent is doing</h2>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {plan.done}/{plan.total}
          </p>
        </div>
        <div className="h-px overflow-hidden bg-border/70">
          <div
            className="h-full bg-foreground/80 transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      <ol className="flex flex-col gap-7">
        {plan.sections.map((section) => {
          const status = section.status ?? "pending"
          return (
          <li key={section.group} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  status === "done" && "bg-foreground",
                  status === "active" && "bg-foreground/70",
                  status === "failed" && "bg-destructive",
                  (status === "pending" || status === "skipped") &&
                    "bg-muted-foreground/30"
                )}
              />
              <h3
                className={cn(
                  "text-[13px] font-medium",
                  status === "pending"
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}
              >
                {section.label}
              </h3>
            </div>
            <ul className="ml-2 flex flex-col border-l border-border/70 pl-4">
              {section.steps.length === 0 ? (
                <li className="py-1.5 text-[13px] text-muted-foreground">
                  {section.group === "outreach"
                    ? "Waiting for Devin to name who to call."
                    : "Not started."}
                </li>
              ) : (
                section.steps.map((step) => (
                  <StepRow key={step.step_id} step={step} />
                ))
              )}
            </ul>
            {section.group === "outreach" && liveCalls.length > 1 ? (
              <p className="ml-6 text-[11px] text-muted-foreground">
                {liveCalls.length} shown in parallel. One live dial to the demo
                number.
              </p>
            ) : null}
          </li>
          )
        })}
      </ol>
    </div>
  )
}

function StepRow({ step }: { step: LivePlanStep }) {
  const calling = Boolean(step.supplier_ref && step.group === "outreach")
  const Icon = iconFor(step.status, calling)

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          toneFor(step.status),
          step.status === "active" && !calling && "animate-spin"
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm leading-5",
            step.status === "pending" && "text-muted-foreground",
            step.status === "active" && "text-foreground",
            step.status === "done" && "text-foreground/80",
            step.status === "failed" && "text-destructive",
            step.status === "skipped" && "text-muted-foreground line-through"
          )}
        >
          {step.label}
        </p>
        {step.detail ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {step.detail}
          </p>
        ) : step.status === "active" && calling ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Dialing…
          </p>
        ) : null}
      </div>
    </li>
  )
}

function iconFor(status: LiveStepStatus, calling: boolean) {
  if (status === "active" && calling) return Phone
  if (status === "active") return Loader2Icon
  if (status === "done") return CheckIcon
  if (status === "failed") return XIcon
  return CircleIcon
}

function toneFor(status: LiveStepStatus): string {
  if (status === "active") return "text-foreground"
  if (status === "done") return "text-foreground/70"
  if (status === "failed") return "text-destructive"
  return "text-muted-foreground/50"
}

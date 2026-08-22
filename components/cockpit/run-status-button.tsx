import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SCRIPT } from "@/lib/case-001"
import { cn } from "@/lib/utils"

type RunStageState = "complete" | "active" | "pending"

const RUN_STAGES = [
  { label: "Incident", afterId: null },
  { label: "Candidates", afterId: "suppliers" },
  { label: "Outreach Tasks", afterId: "outreach" },
  { label: "Claims", afterId: "claims" },
  { label: "Decision", afterId: "strategy" },
] as const

const PEBBLE_CLASS: Record<RunStageState, string> = {
  complete: "bg-primary",
  active: "bg-foreground ring-1 ring-background/40",
  pending: "bg-muted-foreground/40",
}

export function RunStatusButton({
  visible,
  approved,
}: {
  visible: number
  approved: boolean
}) {
  const states = getRunStageStates(visible, approved)
  const activeIndex = states.findIndex((state) => state === "active")
  const currentIndex = activeIndex === -1 ? RUN_STAGES.length - 1 : activeIndex
  const currentStage = RUN_STAGES[currentIndex]

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="bg-transparent px-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted dark:hover:bg-muted"
            aria-label={`Sourcing run status: ${currentStage.label}`}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                PEBBLE_CLASS[states[currentIndex]]
              )}
            />
            {currentStage.label}
          </Button>
        }
      />
      <TooltipContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="min-w-44 flex-col items-stretch gap-0 px-3 py-3"
      >
        <ol aria-label="Sourcing run stages">
          {RUN_STAGES.map((stage, index) => (
            <RunStage key={stage.label} index={index} state={states[index]} />
          ))}
        </ol>
      </TooltipContent>
    </Tooltip>
  )
}

function RunStage({ index, state }: { index: number; state: RunStageState }) {
  return (
    <li
      aria-current={state === "active" ? "step" : undefined}
      className="relative flex gap-3 pb-3 last:pb-0"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 mt-0.5 size-2 shrink-0 rounded-full",
          PEBBLE_CLASS[state]
        )}
      />
      {index < RUN_STAGES.length - 1 ? (
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-0 left-[3.5px] w-px bg-border"
        />
      ) : null}
      <span
        className={cn(
          "leading-none",
          state === "pending" && "text-muted-foreground"
        )}
      >
        {RUN_STAGES[index].label}
      </span>
    </li>
  )
}

function getRunStageStates(
  visible: number,
  approved: boolean
): RunStageState[] {
  const completed = RUN_STAGES.map((stage) => {
    if (stage.label === "Decision") return approved
    if (stage.afterId === null) return true
    const stepIndex = SCRIPT.findIndex((step) => step.id === stage.afterId)
    return stepIndex >= 0 && visible > stepIndex
  })
  const activeIndex = completed.findIndex((complete) => !complete)

  return completed.map((complete, index) => {
    if (complete) return "complete"
    return index === activeIndex ? "active" : "pending"
  })
}

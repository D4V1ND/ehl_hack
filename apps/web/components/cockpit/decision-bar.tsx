import { CheckIcon, ChevronDownIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { STRATEGIES } from "@/lib/case-001"

export type DecisionStatus =
  "evaluating" | "on hold" | "needs human review" | "approved"

type DecisionBarProps = {
  checksPassed: boolean
  status: DecisionStatus
  onApprove: () => void
}

export function DecisionBar({
  checksPassed,
  status,
  onApprove,
}: DecisionBarProps) {
  const approved = status === "approved"
  const recommended = STRATEGIES.find((strategy) => strategy.recommended)!

  return (
    <div className="mx-auto w-full max-w-[50vw] px-4 pt-3">
      <Collapsible>
        <Card size="sm" className="w-full gap-0 py-0 ring-0 bg-accent">
          <CollapsibleContent className="border-b border-border/70 px-3 py-3">
            <DecisionDetails checksPassed={checksPassed} />
          </CollapsibleContent>
          <div className="flex min-w-0 items-center gap-3 px-3 py-2">
            <CollapsibleTrigger
              className="group flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label="Toggle Decision details"
            >
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[panel-open]:-rotate-90 motion-reduce:transition-none" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Decision</span>
                  <DecisionStatusBadge status={status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {recommended.name}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {recommended.total}
              </span>
            </CollapsibleTrigger>
            <Button
              type="button"
              size="sm"
              variant={approved ? "secondary" : "default"}
              disabled={!checksPassed || approved}
              onClick={onApprove}
            >
              {approved ? <CheckIcon data-icon="inline-start" /> : null}
              {approved ? "Approved" : "Mark approved"}
            </Button>
          </div>
        </Card>
      </Collapsible>
    </div>
  )
}

function DecisionDetails({ checksPassed }: { checksPassed: boolean }) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <p className="font-medium">Rationale</p>
        <p className="text-muted-foreground">
          SKF air protects the line-stop. FAG sea lowers total Landed Cost for
          the remaining quantity.
        </p>
        <p className="font-medium">Runner-ups</p>
        {STRATEGIES.filter((strategy) => !strategy.recommended).map(
          (strategy) => (
            <div
              key={strategy.name}
              className="flex justify-between gap-3 text-xs text-muted-foreground"
            >
              <span>{strategy.name}</span>
              <span className="shrink-0 tabular-nums">{strategy.total}</span>
            </div>
          )
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-medium">Required checks</p>
        {(["Policy", "Cost model"] as const).map((check) => (
          <div
            key={check}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2"
          >
            <span>{check}</span>
            <Badge variant={checksPassed ? "secondary" : "outline"}>
              {checksPassed ? "passed" : "evaluating"}
            </Badge>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Approval is local rehearsal state. It does not place an order.
        </p>
      </div>
    </div>
  )
}

function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  if (status === "approved") return <Badge variant="secondary">approved</Badge>
  if (status === "on hold") return <Badge variant="destructive">on hold</Badge>
  if (status === "needs human review") return null
  return <Badge variant="outline">evaluating</Badge>
}

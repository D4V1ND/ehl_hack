import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CANDIDATES, type ScriptStep } from "@/lib/case-001"

export function AssistantTurn({
  step,
  latest,
}: {
  step: ScriptStep
  latest: boolean
}) {
  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className="w-full max-w-full">
        <MessageResponse>
          {step.kind === "decision"
            ? "Decision ready for human review."
            : step.summary}
        </MessageResponse>
        {step.method && step.path ? (
          <Tool defaultOpen={false} className="mb-0">
            <ToolHeader
              type={`tool-${step.id}`}
              state={latest ? "input-available" : "output-available"}
              title={`${step.method} ${step.path}`}
            />
            <ToolContent>
              <ToolOutput
                output={<p className="p-3 text-pretty">{step.detail}</p>}
                errorText={undefined}
              />
            </ToolContent>
          </Tool>
        ) : null}
        <StepExtras step={step} />
      </MessageContent>
    </Message>
  )
}

function StepExtras({ step }: { step: ScriptStep }) {
  if (step.kind === "outreach") return <OutreachTasks />

  if (step.kind === "policy") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Shenzhen Bearing Co rejected</AlertTitle>
        <AlertDescription>
          Rule <span className="font-mono">blocked_origin_country</span>. No
          Outreach Task.
        </AlertDescription>
      </Alert>
    )
  }

  if (step.kind === "deltas") {
    return (
      <p className="text-sm text-muted-foreground">
        Munich Motion Claim is{" "}
        <Badge variant="destructive">in_stock_allocated</Badge> — that stock is
        not ours.
      </p>
    )
  }

  if (step.kind === "decision") {
    return (
      <p className="text-sm text-muted-foreground">
        Winning Strategy: split 20% SKF air + 80% FAG sea. Required checks
        passed.
      </p>
    )
  }

  return null
}

function OutreachTasks() {
  const candidates = CANDIDATES.filter(
    (candidate) => candidate.compliance === "passed"
  )

  return (
    <Task defaultOpen>
      <TaskTrigger title="Outreach Tasks · 4 parallel" />
      <TaskContent className="[&>div]:mt-2 [&>div]:grid [&>div]:gap-2 [&>div]:border-l-0 [&>div]:pl-0 sm:[&>div]:grid-cols-2">
        {candidates.map((candidate) => (
          <TaskItem
            key={candidate.name}
            className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-foreground">
                {candidate.name}
              </span>
              <span className="font-mono text-xs">{candidate.phone}</span>
            </span>
            <Badge variant="secondary">calling</Badge>
          </TaskItem>
        ))}
      </TaskContent>
    </Task>
  )
}

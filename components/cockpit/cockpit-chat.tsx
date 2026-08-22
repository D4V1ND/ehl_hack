"use client"

import { Suspense, useEffect, useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react"

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CallDetailDialog } from "@/components/cockpit/call-detail-dialog"
import { CandidatePanel } from "@/components/cockpit/candidate-panel"
import { CockpitShell } from "@/components/cockpit/cockpit-shell"
import { DotLoader } from "@/components/cockpit/dot-loader"
import {
  CANDIDATES,
  INCIDENT,
  SCRIPT,
  STRATEGIES,
  TICK_MS,
  USER_PROMPT,
  type ScriptStep,
} from "@/lib/case-001"

type Phase = "idle" | "running" | "done"
type DecisionStatus =
  | "evaluating"
  | "on hold"
  | "needs human review"
  | "approved"

type RunStage = {
  label: "Incident" | "Candidates" | "Outreach Tasks" | "Claims" | "Decision"
  afterId: string | null
}

const RUN_STAGES: RunStage[] = [
  { label: "Incident", afterId: null },
  { label: "Candidates", afterId: "suppliers" },
  { label: "Outreach Tasks", afterId: "outreach" },
  { label: "Claims", afterId: "claims" },
  { label: "Decision", afterId: "strategy" },
]

const hoursToLineStop = Number(INCIDENT.lineStopDays) * 24
const standingStill = `${INCIDENT.lineStopCostPerHour.replace(/\.00$/, "")} / h`

function groupThousands(qty: string): string {
  return Number(qty).toLocaleString("en-US").replaceAll(",", "\u00a0")
}

function isStepVisible(stepId: string, visible: number): boolean {
  const index = SCRIPT.findIndex((step) => step.id === stepId)
  return index >= 0 && visible > index
}

export function CockpitChat() {
  const [started, setStarted] = useState(false)
  const [visible, setVisible] = useState(0)
  const [approved, setApproved] = useState(false)
  const phase: Phase = !started
    ? "idle"
    : visible >= SCRIPT.length
      ? "done"
      : "running"

  useEffect(() => {
    if (!started) {
      return
    }
    if (visible >= SCRIPT.length) {
      return
    }
    const id = window.setInterval(() => {
      setVisible((count) => Math.min(count + 1, SCRIPT.length))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [started, visible])

  const currentStep =
    phase === "idle"
      ? "Awaiting launch"
      : visible === 0
        ? "Launching"
        : SCRIPT[Math.min(visible, SCRIPT.length) - 1].kind === "decision"
          ? "Decision ready"
          : SCRIPT[Math.min(visible, SCRIPT.length) - 1].stepName
  const checksPassed = isStepVisible("tests", visible)
  const decisionExists = isStepVisible("strategy", visible)
  const decisionStatus: DecisionStatus = approved
    ? "approved"
    : phase === "done" && !checksPassed
      ? "on hold"
      : checksPassed
        ? "needs human review"
        : "evaluating"

  function launch() {
    const skipTicks = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    setStarted(true)
    setVisible(skipTicks ? SCRIPT.length : 0)
    setApproved(false)
  }

  function reset() {
    setStarted(false)
    setVisible(0)
    setApproved(false)
  }

  return (
    <CockpitShell>
      <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-mono">{INCIDENT.caseId}</span>
          <span className="text-muted-foreground">{INCIDENT.partId}</span>
          <span>{INCIDENT.lineStopDays} days to line stop</span>
        </div>
        <span className="text-muted-foreground text-sm">Devin session</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <Conversation className="min-h-0">
            <ConversationContent className="gap-4">
              <SourcingRunRail
                visible={visible}
                started={started}
                approved={approved}
              />
              <IncidentChip />

              {SCRIPT.slice(0, visible).map((step, index) => (
                <AssistantTurn
                  key={step.id}
                  step={step}
                  latest={index === visible - 1 && phase === "running"}
                />
              ))}

              {phase === "running" ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DotLoader />
                  <span>{currentStep}</span>
                </div>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          {decisionExists ? (
            <DecisionBar
              checksPassed={checksPassed}
              status={decisionStatus}
              onApprove={() => setApproved(true)}
            />
          ) : null}
          <Composer phase={phase} onLaunch={launch} onReset={reset} />
        </div>
        <div className="min-h-0 min-w-0">
          <CandidatePanel visible={visible} />
        </div>
      </div>
      <Suspense fallback={null}>
        <CallDetailDialog />
      </Suspense>
    </CockpitShell>
  )
}

function SourcingRunRail({
  visible,
  started,
  approved,
}: {
  visible: number
  started: boolean
  approved: boolean
}) {
  const completed = RUN_STAGES.map((stage) => {
    if (stage.label === "Decision") return approved
    return stage.afterId === null
      ? started
      : isStepVisible(stage.afterId, visible)
  })
  const firstIncomplete = completed.findIndex((stageComplete) => !stageComplete)
  const activeIndex = firstIncomplete === -1 ? RUN_STAGES.length - 1 : firstIncomplete

  return (
    <nav
      aria-label="Sourcing run status"
      className="overflow-x-auto rounded-lg border border-border bg-card px-3 py-2"
    >
      <ol className="flex min-w-max items-center">
        {RUN_STAGES.map((stage, index) => {
          const complete = completed[index]
          const active = index === activeIndex && !complete

          return (
            <li key={stage.label} className="flex items-center">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="mx-2 w-5 border-t border-border"
                />
              ) : null}
              <span
                aria-current={active ? "step" : undefined}
                className={
                  active || complete
                    ? "flex items-center gap-1.5 text-xs font-medium text-foreground"
                    : "flex items-center gap-1.5 text-xs text-muted-foreground"
                }
              >
                {complete ? (
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  <CircleIcon
                    className={active ? "size-3.5 fill-current" : "size-3.5"}
                    aria-hidden="true"
                  />
                )}
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function DecisionBar({
  checksPassed,
  status,
  onApprove,
}: {
  checksPassed: boolean
  status: DecisionStatus
  onApprove: () => void
}) {
  const approved = status === "approved"
  const recommended = STRATEGIES.find((strategy) => strategy.recommended)!

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 pt-3">
      <Collapsible>
        <Card size="sm" className="gap-0 py-0">
          <div className="flex min-w-0 items-center gap-3 px-3 py-2">
            <CollapsibleTrigger
              className="group flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label="Toggle Decision details"
            >
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-[state=open]:rotate-180" />
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
          <CollapsibleContent className="border-t border-border px-3 py-3">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="font-medium">Rationale</p>
                <p className="text-muted-foreground">
                  SKF air protects the line-stop. FAG sea lowers total Landed
                  Cost for the remaining quantity.
                </p>
                <p className="font-medium">Runner-ups</p>
                {STRATEGIES.filter((strategy) => !strategy.recommended).map(
                  (strategy) => (
                    <div
                      key={strategy.name}
                      className="flex justify-between gap-3 text-xs text-muted-foreground"
                    >
                      <span>{strategy.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {strategy.total}
                      </span>
                    </div>
                  )
                )}
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-medium">Required checks</p>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2">
                  <span>Policy</span>
                  <Badge variant={checksPassed ? "secondary" : "outline"}>
                    {checksPassed ? "passed" : "evaluating"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2">
                  <span>Cost model</span>
                  <Badge variant={checksPassed ? "secondary" : "outline"}>
                    {checksPassed ? "passed" : "evaluating"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approval is local rehearsal state. It does not place an order.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}

function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  if (status === "approved") {
    return <Badge variant="secondary">approved</Badge>
  }
  if (status === "on hold") {
    return <Badge variant="destructive">on hold</Badge>
  }
  if (status === "needs human review") {
    return <Badge variant="outline">needs human review</Badge>
  }
  return <Badge variant="outline">evaluating</Badge>
}

function IncidentChip() {
  return (
    <Card size="sm" className="w-full" aria-label="Incident from ERP">
      <CardHeader>
        <CardTitle>
          Incident · {INCIDENT.plant} plant
        </CardTitle>
        <CardDescription>
          {INCIDENT.partId} {INCIDENT.description}
        </CardDescription>
        <CardAction>
          <Badge variant="outline">from ERP</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-3 gap-3 tabular-nums">
          <div>
            <dt className="text-muted-foreground text-xs">Qty short</dt>
            <dd className="font-medium">{groupThousands(INCIDENT.shortfall)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">To line-stop</dt>
            <dd className="font-medium">
              {INCIDENT.lineStopDays} d / {hoursToLineStop} h
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Standing still</dt>
            <dd className="font-medium">{standingStill}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-sm">
          {groupThousands(INCIDENT.qtyOnHand)} on hand vs{" "}
          {groupThousands(INCIDENT.qtyRequired)} required. ERP already showed
          the shortage.
        </p>
      </CardContent>
    </Card>
  )
}

function AssistantTurn({
  step,
  latest,
}: {
  step: ScriptStep
  latest: boolean
}) {
  return (
    <Message from="assistant">
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
  if (step.kind === "outreach") {
    const outreachCandidates = CANDIDATES.filter(
      (candidate) => candidate.compliance === "passed"
    )

    return (
      <Task defaultOpen>
        <TaskTrigger title="Outreach Tasks · 4 parallel" />
        <TaskContent className="grid gap-2 sm:grid-cols-2">
          {outreachCandidates.map((candidate) => (
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
      <p className="text-muted-foreground text-sm">
        Munich Motion Claim is{" "}
        <Badge variant="destructive">in_stock_allocated</Badge> — that stock is
        not ours.
      </p>
    )
  }

  if (step.kind === "decision") {
    return (
      <p className="text-muted-foreground text-sm">
        Winning Strategy: split 20% SKF air + 80% FAG sea. Required checks
        passed.
      </p>
    )
  }

  return null
}

function Composer({
  phase,
  onLaunch,
  onReset,
}: {
  phase: Phase
  onLaunch: () => void
  onReset: () => void
}) {
  const running = phase === "running"
  const done = phase === "done"

  return (
    <div className="shrink-0 bg-background px-4 py-3">
      <PromptInput
        className="w-full"
        onSubmit={() => {
          if (running) {
            return
          }
          if (done) {
            onReset()
            onLaunch()
            return
          }
          onLaunch()
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            readOnly
            value={USER_PROMPT}
            placeholder="Sourcing prompt"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {phase !== "idle" ? (
              <PromptInputButton type="button" onClick={onReset}>
                <RotateCcwIcon data-icon="inline-start" />
                Reset
              </PromptInputButton>
            ) : null}
          </PromptInputTools>
          <PromptInputSubmit
            disabled={running}
            size="sm"
            status={running ? "submitted" : "ready"}
          >
            {running ? (
              <DotLoader />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            {done ? "Replay" : "Launch sourcing agent"}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

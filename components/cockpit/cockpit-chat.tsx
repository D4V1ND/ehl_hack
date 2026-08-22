"use client"

import { Suspense, useEffect, useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  CostIcon,
  FactoryIcon,
  type IconComponent,
  LineStopIcon,
  PartIcon,
  PlayIcon,
  QuantityIcon,
  RotateCcwIcon,
  WarehouseIcon,
} from "@/components/icons"

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
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { SidebarTrigger } from "@/components/ui/sidebar"
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
  "evaluating" | "on hold" | "needs human review" | "approved"

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
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <IncidentHeader />
          <Composer phase={phase} onLaunch={launch} onReset={reset} />
          <Conversation className="min-h-0">
            <ConversationContent className="gap-4">
              <SourcingRunRail
                visible={visible}
                started={started}
                approved={approved}
              />

              {SCRIPT.slice(0, visible).map((step, index) => (
                <AssistantTurn
                  key={step.id}
                  step={step}
                  latest={index === visible - 1 && phase === "running"}
                />
              ))}

              {phase === "running" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
        </div>
        <div className="hidden min-h-0 min-w-0 xl:block">
          <CandidatePanel visible={visible} />
        </div>
      </div>
      <Suspense fallback={null}>
        <CallDetailDialog />
      </Suspense>
    </CockpitShell>
  )
}

function IncidentHeader() {
  return (
    <Collapsible className="shrink-0">
      <header className="group/incident-header flex h-11 items-center gap-2 border-b border-border/70 bg-background px-3">
        <SidebarTrigger />
        <CollapsibleTrigger
          className="group/incident-trigger flex min-w-0 flex-1 items-center gap-4 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Toggle Incident details"
        >
          <span className="font-mono text-sm">{INCIDENT.caseId}</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {INCIDENT.partId}
          </span>
          <span className="hidden text-sm md:inline">
            {INCIDENT.lineStopDays} days to line stop
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover/incident-header:opacity-100 group-focus-visible/incident-trigger:opacity-100 group-data-[state=open]/incident-trigger:rotate-180 group-data-[state=open]/incident-trigger:opacity-100 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <h1 className="ml-auto shrink-0 text-sm font-medium">Stockout</h1>
      </header>
      <CollapsibleContent className="border-b border-border/70 bg-muted/20">
        <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
          <IncidentProperty
            icon={FactoryIcon}
            label="Plants"
            value={INCIDENT.plant}
          />
          <IncidentProperty
            icon={PartIcon}
            label="Part"
            value={`${INCIDENT.partId} · ${INCIDENT.description}`}
          />
          <IncidentProperty
            icon={QuantityIcon}
            label="Quantity short"
            value={groupThousands(INCIDENT.shortfall)}
          />
          <IncidentProperty
            icon={LineStopIcon}
            label="To line-stop"
            value={`${INCIDENT.lineStopDays} d · ${hoursToLineStop} h`}
          />
          <IncidentProperty
            icon={CostIcon}
            label="Standing still"
            value={standingStill}
          />
          <IncidentProperty
            icon={WarehouseIcon}
            label="Inventory"
            value={`${groupThousands(INCIDENT.qtyOnHand)} on hand · ${groupThousands(INCIDENT.qtyRequired)} required`}
          />
        </dl>
      </CollapsibleContent>
    </Collapsible>
  )
}

function IncidentProperty({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent
  label: string
  value: string
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 text-muted-foreground"
        stroke={1.75}
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words tabular-nums">
          {value}
        </dd>
      </div>
    </div>
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
  const activeIndex =
    firstIncomplete === -1 ? RUN_STAGES.length - 1 : firstIncomplete

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
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
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
    <div className="shrink-0 border-b border-border/70 bg-background px-4 py-3">
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
            {running ? <DotLoader /> : <PlayIcon data-icon="inline-start" />}
            {done ? "Replay" : "Launch sourcing agent"}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

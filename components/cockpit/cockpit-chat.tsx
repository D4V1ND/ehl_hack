"use client"

import { Suspense, useEffect, useState } from "react"
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CostIcon,
  FactoryIcon,
  type IconComponent,
  LineStopIcon,
  PartIcon,
  PanelRightOpenIcon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  type ScriptStep,
} from "@/lib/case-001"
import { cn } from "@/lib/utils"

type Phase = "running" | "done"
type DecisionStatus =
  "evaluating" | "on hold" | "needs human review" | "approved"

type RunStage = {
  label: "Incident" | "Candidates" | "Outreach Tasks" | "Claims" | "Decision"
  afterId: string | null
}

type RunStageState = "complete" | "active" | "pending"

const RUN_STAGES: RunStage[] = [
  { label: "Incident", afterId: null },
  { label: "Candidates", afterId: "suppliers" },
  { label: "Outreach Tasks", afterId: "outreach" },
  { label: "Claims", afterId: "claims" },
  { label: "Decision", afterId: "strategy" },
]

const RUN_STAGE_PEBBLE_CLASS: Record<RunStageState, string> = {
  complete: "bg-primary",
  active: "bg-foreground ring-1 ring-background/40",
  pending: "bg-muted-foreground/40",
}

const hoursToLineStop = Number(INCIDENT.lineStopDays) * 24
const standingStill = `${INCIDENT.lineStopCostPerHour.replace(/\.00$/, "")} / h`

function groupThousands(qty: string): string {
  return Number(qty).toLocaleString("en-US").replaceAll(",", "\u00a0")
}

function isStepVisible(stepId: string, visible: number): boolean {
  const index = SCRIPT.findIndex((step) => step.id === stepId)
  return index >= 0 && visible > index
}

function getRunStageStates(
  visible: number,
  approved: boolean
): RunStageState[] {
  const completed = RUN_STAGES.map((stage) => {
    if (stage.label === "Decision") return approved
    return stage.afterId === null || isStepVisible(stage.afterId, visible)
  })
  const activeIndex = completed.findIndex((complete) => !complete)

  return completed.map((complete, index) => {
    if (complete) return "complete"
    if (index === activeIndex) return "active"
    return "pending"
  })
}

export function CockpitChat() {
  const [visible, setVisible] = useState(0)
  const [approved, setApproved] = useState(false)
  const [candidatesOpen, setCandidatesOpen] = useState(true)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<string[]>([])
  const phase: Phase = visible >= SCRIPT.length ? "done" : "running"

  useEffect(() => {
    if (visible >= SCRIPT.length) {
      return
    }
    const id = window.setInterval(() => {
      setVisible((count) => Math.min(count + 1, SCRIPT.length))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [visible])

  const currentStep =
    visible === 0
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

  function replay() {
    const skipTicks = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    setVisible(skipTicks ? SCRIPT.length : 0)
    setApproved(false)
  }

  function sendMessage(message: string) {
    const text = message.trim()
    if (!text) return

    setMessages((current) => [...current, text])
    setDraft("")
  }

  return (
    <CockpitShell
      rightSidebar={
        candidatesOpen ? (
          <CandidatePanel
            visible={visible}
            onClose={() => setCandidatesOpen(false)}
          />
        ) : undefined
      }
    >
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <IncidentHeader
          visible={visible}
          approved={approved}
          phase={phase}
          onReplay={replay}
          showOpenCandidates={!candidatesOpen}
          onOpenCandidates={() => setCandidatesOpen(true)}
        />
        <Conversation className="min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-[50vw] gap-4 px-4 py-4"
            scrollClassName="chat-scrollbar overflow-x-hidden overflow-y-auto"
          >
            <IncidentRequestMessage />

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

            {messages.map((message, index) => (
              <Message key={`${index}-${message}`} from="user">
                <MessageContent>
                  <p>{message}</p>
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="shrink-0 bg-background">
          {decisionExists ? (
            <DecisionBar
              checksPassed={checksPassed}
              status={decisionStatus}
              onApprove={() => setApproved(true)}
            />
          ) : null}
          <MessageComposer
            value={draft}
            onChange={setDraft}
            onSend={sendMessage}
          />
        </div>
      </div>
      <Suspense fallback={null}>
        <CallDetailDialog />
      </Suspense>
    </CockpitShell>
  )
}

function IncidentRequestMessage() {
  return (
    <Message from="user">
      <MessageContent>
        <p className="leading-6">
          Resolve{" "}
          <span className="inline-flex items-center gap-1 text-xs py-[1px] rounded-md bg-primary/30 px-1 align-baseline font-medium text-primary">
            @
            <span className="text-foreground">{INCIDENT.caseId} · {INCIDENT.partId}</span>
          </span>{" "}
          by finding Candidates, gathering Claims, and recommending a Decision.
        </p>
      </MessageContent>
    </Message>
  )
}

function IncidentHeader({
  visible,
  approved,
  phase,
  onReplay,
  showOpenCandidates,
  onOpenCandidates,
}: {
  visible: number
  approved: boolean
  phase: Phase
  onReplay: () => void
  showOpenCandidates: boolean
  onOpenCandidates: () => void
}) {
  const running = phase === "running"

  return (
    <Collapsible className="shrink-0">
      <header className="group/incident-header flex h-11 items-center gap-2 border-b border-border/70 bg-background px-3">
        <SidebarTrigger className="md:hidden" />
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
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover/incident-header:opacity-100 group-focus-visible/incident-trigger:opacity-100 group-data-[panel-open]/incident-trigger:rotate-180 group-data-[panel-open]/incident-trigger:opacity-100 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <RunStatusButton visible={visible} approved={approved} />
          <Button
            type="button"
            size="sm"
            disabled={running}
            onClick={onReplay}
          >
            {running ? (
              <DotLoader />
            ) : (
              <RotateCcwIcon data-icon="inline-start" />
            )}
            {running ? "Running" : "Replay"}
          </Button>
          {showOpenCandidates ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Open Candidates sidebar"
                    onClick={onOpenCandidates}
                  >
                    <PanelRightOpenIcon aria-hidden="true" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">Open Candidates</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
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

function RunStatusButton({
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
  const currentState = states[currentIndex]

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
                RUN_STAGE_PEBBLE_CLASS[currentState]
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
          {RUN_STAGES.map((stage, index) => {
            const state = states[index]

            return (
              <li
                key={stage.label}
                aria-current={state === "active" ? "step" : undefined}
                className="relative flex gap-3 pb-3 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 mt-0.5 size-2 shrink-0 rounded-full",
                    RUN_STAGE_PEBBLE_CLASS[state]
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
                  {stage.label}
                </span>
              </li>
            )
          })}
        </ol>
      </TooltipContent>
    </Tooltip>
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
    <div className="mx-auto w-full max-w-[50vw] px-4 pt-3">
      <Collapsible>
        <Card size="sm" className="w-full gap-0 py-0 ring-0">
          <CollapsibleContent className="border-b border-border/70 px-3 py-3">
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

function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  if (status === "approved") {
    return <Badge variant="secondary">approved</Badge>
  }
  if (status === "on hold") {
    return <Badge variant="destructive">on hold</Badge>
  }
  if (status === "needs human review") {
    return null
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
  if (step.kind === "outreach") {
    const outreachCandidates = CANDIDATES.filter(
      (candidate) => candidate.compliance === "passed"
    )

    return (
      <Task defaultOpen>
        <TaskTrigger title="Outreach Tasks · 4 parallel" />
        <TaskContent className="[&>div]:mt-2 [&>div]:grid [&>div]:gap-2 [&>div]:border-l-0 [&>div]:pl-0 sm:[&>div]:grid-cols-2">
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

function MessageComposer({
  value,
  onChange,
  onSend,
}: {
  value: string
  onChange: (value: string) => void
  onSend: (value: string) => void
}) {
  return (
    <div className="mx-auto w-full max-w-[50vw] px-4 py-3">
      <PromptInput
        className="w-full bg-card [&_[data-slot=input-group]]:border-border/70"
        onSubmit={({ text }) => onSend(text)}
      >
        <PromptInputBody>
          <PromptInputTextarea
            aria-label="Message Stockout"
            placeholder="Message Stockout"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit disabled={!value.trim()} status="ready">
            <ArrowUpIcon aria-hidden="true" />
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

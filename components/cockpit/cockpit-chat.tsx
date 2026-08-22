"use client"

import { useEffect, useState } from "react"
import { PlayIcon, RotateCcwIcon } from "lucide-react"

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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CockpitShell } from "@/components/cockpit/cockpit-shell"
import { DotLoader } from "@/components/cockpit/dot-loader"
import {
  WorkingPane,
  paneForVisible,
  type WorkingTab,
} from "@/components/cockpit/working-pane"
import {
  CANDIDATES,
  INCIDENT,
  SCRIPT,
  STRATEGIES,
  TICK_MS,
  USER_PROMPT,
  type ScriptStep,
  type StockStatus,
} from "@/lib/case-001"

type Phase = "idle" | "running" | "done"

const hoursToLineStop = Number(INCIDENT.lineStopDays) * 24
const standingStill = `${INCIDENT.lineStopCostPerHour.replace(/\.00$/, "")} / h`

function groupThousands(qty: string): string {
  return Number(qty).toLocaleString("en-US").replaceAll(",", "\u00a0")
}

function stockBadgeVariant(
  status: StockStatus
): "secondary" | "destructive" | "outline" {
  if (status === "in_stock_allocated" || status === "unavailable") {
    return "destructive"
  }
  if (status === "free_in_stock") {
    return "secondary"
  }
  return "outline"
}

export function CockpitChat() {
  const [started, setStarted] = useState(false)
  const [visible, setVisible] = useState(0)
  const [pinnedTab, setPinnedTab] = useState<WorkingTab | null>(null)
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

  const tab = pinnedTab ?? paneForVisible(visible)

  const currentStep =
    phase === "idle"
      ? "Awaiting launch"
      : visible === 0
        ? "Launching"
        : SCRIPT[Math.min(visible, SCRIPT.length) - 1].stepName

  function launch() {
    const skipTicks = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    setStarted(true)
    setVisible(skipTicks ? SCRIPT.length : 0)
    setPinnedTab(null)
  }

  function reset() {
    setStarted(false)
    setVisible(0)
    setPinnedTab(null)
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
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <Conversation className="min-h-0">
            <ConversationContent>
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
          <Composer phase={phase} onLaunch={launch} onReset={reset} />
        </div>
        <WorkingPane
          visible={visible}
          tab={tab}
          onTabChange={setPinnedTab}
        />
      </div>
    </CockpitShell>
  )
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
        <MessageResponse>{step.summary}</MessageResponse>
        {step.method && step.path ? (
          <Tool defaultOpen={latest} className="mb-0">
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

  if (step.kind === "claims") {
    return (
      <Task defaultOpen>
        <TaskTrigger title="Claims" />
        <TaskContent>
          {CANDIDATES.filter((candidate) => candidate.stockStatus).map(
            (candidate) => (
              <TaskItem
                key={candidate.name}
                className="flex flex-wrap items-center gap-2"
              >
                <span>{candidate.name}</span>
                <Badge variant={stockBadgeVariant(candidate.stockStatus!)}>
                  {candidate.stockStatus}
                </Badge>
              </TaskItem>
            )
          )}
        </TaskContent>
      </Task>
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

  if (step.kind === "strategy") {
    return (
      <Task defaultOpen>
        <TaskTrigger title="Strategies" />
        <TaskContent>
          {STRATEGIES.map((strategy) => (
            <TaskItem key={strategy.name} className="tabular-nums">
              <span className="font-medium">{strategy.name}</span>
              <span> · {strategy.total}</span>
              {strategy.recommended ? (
                <Badge className="ml-2" variant="default">
                  recommended
                </Badge>
              ) : null}
              <p>{strategy.note}</p>
            </TaskItem>
          ))}
        </TaskContent>
      </Task>
    )
  }

  if (step.kind === "decision") {
    return (
      <p className="text-muted-foreground text-sm">
        Winning Strategy is split 20% SKF air + 80% FAG sea. A human approves
        by merging.
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

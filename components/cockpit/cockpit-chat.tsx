"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GitPullRequestIcon, PlayIcon, RotateCcwIcon } from "lucide-react"

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
import { DotLoader } from "@/components/cockpit/dot-loader"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CANDIDATES,
  INCIDENT,
  PR_PATH,
  SCRIPT,
  STRATEGIES,
  TICK_MS,
  USER_PROMPT,
  type ScriptStep,
  type StockStatus,
} from "@/lib/case-001"

type Phase = "idle" | "running" | "done"

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
        : SCRIPT[Math.min(visible, SCRIPT.length) - 1].stepName

  function launch() {
    const skipTicks = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    setStarted(true)
    setVisible(skipTicks ? SCRIPT.length : 0)
  }

  function reset() {
    setStarted(false)
    setVisible(0)
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          render={<Link href="/" />}
        >
          stockout
        </Button>
        <Badge variant="outline">{INCIDENT.caseId}</Badge>
        <Badge variant="secondary">rehearsal</Badge>
        <p
          className="ml-auto flex items-center gap-2 truncate text-sm text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {phase === "running" ? <DotLoader /> : null}
          {currentStep}
          <span className="text-muted-foreground/70">
            {" "}
            · {visible} Event{visible === 1 ? "" : "s"}
          </span>
        </p>
      </header>

      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-2xl">
          <UserIncident />

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
  )
}

function UserIncident() {
  return (
    <Message from="user">
      <MessageContent>
        <MessageResponse>{USER_PROMPT}</MessageResponse>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">qty_required</dt>
            <dd>{INCIDENT.qtyRequired}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">qty_on_hand</dt>
            <dd>{INCIDENT.qtyOnHand}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">shortfall</dt>
            <dd>{INCIDENT.shortfall}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">line_stop</dt>
            <dd>{INCIDENT.lineStopDays}d</dd>
          </div>
        </dl>
      </MessageContent>
    </Message>
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
    return <ClaimRecordTable />
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
      <Alert>
        <GitPullRequestIcon />
        <AlertTitle>Decision ready for merge</AlertTitle>
        <AlertDescription>
          SPLIT 20% SKF air + 80% FAG sea. A human approves by merging{" "}
          <span className="font-mono">{PR_PATH}</span>.
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

function ClaimRecordTable() {
  const rows = CANDIDATES.filter((candidate) => candidate.claimUnit)

  return (
    <Table>
      <TableCaption>
        Claim values sit next to the Supplier Record. Claims are not facts.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Candidate</TableHead>
          <TableHead>Record unit</TableHead>
          <TableHead>Claim unit</TableHead>
          <TableHead>stock_status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((candidate) => (
          <TableRow key={candidate.name}>
            <TableCell>{candidate.name}</TableCell>
            <TableCell className="tabular-nums font-mono">
              {candidate.recordUnit}
            </TableCell>
            <TableCell className="tabular-nums font-mono">
              {candidate.claimUnit}
            </TableCell>
            <TableCell>
              <Badge variant={stockBadgeVariant(candidate.stockStatus!)}>
                {candidate.stockStatus}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
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
        className="mx-auto w-full max-w-2xl"
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
                <RotateCcwIcon />
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
              <PlayIcon />
            )}
            {done ? "Replay" : "Launch sourcing agent"}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

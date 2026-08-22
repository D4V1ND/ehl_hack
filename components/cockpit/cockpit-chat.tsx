"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BotIcon,
  ChevronDownIcon,
  GitPullRequestIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Marker, MarkerContent } from "@/components/ui/marker"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
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
          className="ml-auto truncate text-sm text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {currentStep}
          <span className="text-muted-foreground/70">
            {" "}
            · {visible} Event{visible === 1 ? "" : "s"}
          </span>
        </p>
      </header>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label="Sourcing transcript">
            <MessageScrollerContent className="mx-auto w-full max-w-2xl gap-6 px-4 py-6">
              <MessageScrollerItem messageId="marker">
                <Marker variant="separator">
                  <MarkerContent>Incident {INCIDENT.caseId}</MarkerContent>
                </Marker>
              </MessageScrollerItem>

              <MessageScrollerItem messageId="user" scrollAnchor>
                <UserIncident />
              </MessageScrollerItem>

              {SCRIPT.slice(0, visible).map((step, index) => (
                <MessageScrollerItem key={step.id} messageId={step.id}>
                  <AssistantTurn
                    step={step}
                    latest={index === visible - 1 && phase === "running"}
                  />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <Composer phase={phase} onLaunch={launch} onReset={reset} />
    </div>
  )
}

function UserIncident() {
  return (
    <Message align="end">
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>Y</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>You</MessageHeader>
        <Bubble variant="default" align="end">
          <BubbleContent>
            <p className="text-pretty">{USER_PROMPT}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-4">
              <div>
                <dt className="opacity-70">qty_required</dt>
                <dd>{INCIDENT.qtyRequired}</dd>
              </div>
              <div>
                <dt className="opacity-70">qty_on_hand</dt>
                <dd>{INCIDENT.qtyOnHand}</dd>
              </div>
              <div>
                <dt className="opacity-70">shortfall</dt>
                <dd>{INCIDENT.shortfall}</dd>
              </div>
              <div>
                <dt className="opacity-70">line_stop</dt>
                <dd>{INCIDENT.lineStopDays}d</dd>
              </div>
            </dl>
          </BubbleContent>
        </Bubble>
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
    <Message align="start">
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>
            <BotIcon />
          </AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Devin</MessageHeader>
        <Bubble variant={step.kind === "decision" ? "tinted" : "muted"} align="start">
          <BubbleContent className="flex max-w-full flex-col gap-3">
            <p className="text-pretty">{step.summary}</p>
            {step.method && step.path ? (
              <Attachment state={latest ? "processing" : "done"}>
                <AttachmentMedia variant="icon">
                  {latest ? <Spinner /> : <BotIcon />}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>
                    {step.method} {step.path}
                  </AttachmentTitle>
                  <AttachmentDescription>{step.detail}</AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ) : null}
            <StepExtras step={step} />
          </BubbleContent>
        </Bubble>
        <MessageFooter>
          {latest ? (
            <span className="shimmer">{step.stepName}</span>
          ) : (
            step.stepName
          )}
        </MessageFooter>
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
      <div className="flex flex-col gap-2">
        {CANDIDATES.filter((candidate) => candidate.stockStatus).map(
          (candidate) => (
            <div key={candidate.name} className="flex flex-wrap items-center gap-2">
              <span>{candidate.name}</span>
              <Badge variant={stockBadgeVariant(candidate.stockStatus!)}>
                {candidate.stockStatus}
              </Badge>
            </div>
          )
        )}
      </div>
    )
  }

  if (step.kind === "deltas") {
    return <ClaimRecordTable />
  }

  if (step.kind === "strategy") {
    return (
      <ul className="flex flex-col gap-2 tabular-nums">
        {STRATEGIES.map((strategy) => (
          <li key={strategy.name}>
            <span className="font-medium">{strategy.name}</span>
            <span className="text-muted-foreground"> · {strategy.total}</span>
            {strategy.recommended ? (
              <Badge className="ml-2" variant="default">
                recommended
              </Badge>
            ) : null}
            <p className="text-muted-foreground">{strategy.note}</p>
          </li>
        ))}
      </ul>
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

  if (step.detail && step.method) {
    return (
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
          Result
          <ChevronDownIcon data-icon="inline-end" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="pt-2 text-pretty text-muted-foreground">{step.detail}</p>
        </CollapsibleContent>
      </Collapsible>
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
    <form
      className="shrink-0 border-t border-border bg-background px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault()
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <Field>
          <FieldLabel htmlFor="sourcing-prompt" className="sr-only">
            Sourcing prompt
          </FieldLabel>
          <InputGroup className="h-auto">
            <InputGroupTextarea
              id="sourcing-prompt"
              readOnly
              rows={2}
              value={USER_PROMPT}
            />
            <InputGroupAddon align="block-end" className="justify-end gap-2">
              {phase !== "idle" ? (
                <InputGroupButton
                  type="button"
                  variant="ghost"
                  onClick={onReset}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Reset
                </InputGroupButton>
              ) : null}
              <InputGroupButton type="submit" variant="default" disabled={running}>
                {running ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {done ? "Replay" : "Launch sourcing agent"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
    </form>
  )
}

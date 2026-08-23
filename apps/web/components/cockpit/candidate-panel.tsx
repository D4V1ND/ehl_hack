"use client"

import { useRouter } from "next/navigation"
import { Bot, ChevronDownIcon, XIcon } from "@/components/icons"
import { CandidateComparison } from "@/components/cockpit/candidate-comparison"
import {
  candidateLifecycleStatus,
  type CandidateLifecycleStatus,
} from "@/components/cockpit/candidate-status"
import { RejectedCandidate } from "@/components/cockpit/rejected-candidate"
import type {
  Candidate,
  CandidateState,
} from "@/components/cockpit/candidate-types"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  CALLS,
  CANDIDATES,
  LANDED_LINES,
  SCRIPT,
  type CallingAgentRun,
} from "@/lib/case-001"
import { cn } from "@/lib/utils"

export function CandidatePanel({
  visible,
  agentRuns,
  chosenCandidateIds,
  decisionRecorded,
  onClose,
}: {
  visible: number
  agentRuns: readonly CallingAgentRun[]
  chosenCandidateIds: readonly string[]
  decisionRecorded: boolean
  onClose: () => void
}) {
  const visibleIds = new Set(SCRIPT.slice(0, visible).map((step) => step.id))
  const state: CandidateState = {
    candidatesVisible: visibleIds.has("suppliers"),
    policyComplete: visibleIds.has("policy"),
    outreachStarted: agentRuns.some((agent) => agent.phase !== "queued"),
    claimsComplete: visibleIds.has("claims"),
    costsComplete: visibleIds.has("deltas"),
    decisionRecorded,
  }
  const candidates = state.candidatesVisible ? CANDIDATES : []

  return (
    <aside
      aria-label="Candidates"
      className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-sidebar text-foreground"
    >
      <header className="flex min-h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-medium">Candidates</h2>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Close Candidates sidebar"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </header>
      {candidates.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No Candidates matched yet.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.name}
              candidate={candidate as Candidate}
              state={state}
              agentRun={agentRuns.find(
                (agent) => agent.candidateId === candidate.id
              )}
              researchComplete={
                candidate.researchChannel === "website"
                  ? visibleIds.has(candidate.researchAfterId)
                  : agentRuns.some(
                      (agent) =>
                        agent.candidateId === candidate.id &&
                        agent.phase === "complete"
                    )
              }
              chosen={chosenCandidateIds.includes(candidate.id)}
            />
          ))}
        </div>
      )}
    </aside>
  )
}

function CandidateRow({
  candidate,
  state,
  agentRun,
  researchComplete,
  chosen,
}: {
  candidate: Candidate
  state: CandidateState
  agentRun?: CallingAgentRun
  researchComplete: boolean
  chosen: boolean
}) {
  const rejected = state.policyComplete && candidate.compliance === "failed"
  const callFixture = CALLS.find((item) => item.candidateId === candidate.id)
  const call =
    callFixture && agentRun?.phase !== "queued" ? callFixture : undefined
  const landedLine = LANDED_LINES.find(
    (line) => line.candidateId === candidate.id
  )
  const status = candidateLifecycleStatus({
    candidate,
    state,
    call,
    landedLine,
    researchComplete,
    chosen: state.decisionRecorded && chosen,
  })
  const description = candidate.supplierRecord.preferred
    ? `${candidate.country} · Preferred Supplier Record`
    : `${candidate.country} · Supplier Record`
  const candidateState = {
    ...state,
    claimsComplete: researchComplete || state.claimsComplete,
  }

  return (
    <Collapsible className="border-b border-border">
      <CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 px-2.5 pt-1.5 pb-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {candidate.name}
          </span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">
            {description}
          </span>
        </span>
        <LifecycleStatus status={status} />
        <ChevronDownIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      {callFixture && agentRun ? (
        <CallingAgentCard call={callFixture} agentRun={agentRun} />
      ) : null}
      <CollapsibleContent>
        <div className="border-t border-border bg-background/50 px-3 py-2.5">
          {rejected ? (
            <RejectedCandidate candidate={candidate} />
          ) : (
            <CandidateComparison
              candidate={candidate}
              state={candidateState}
              call={call}
              landedLine={landedLine}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

const STATUS_STYLES: Record<
  CandidateLifecycleStatus,
  { className: string; dotClassName: string }
> = {
  sourced: {
    className: "bg-muted-foreground/20 text-foreground",
    dotClassName: "bg-muted-foreground",
  },
  "no answer": {
    className: "bg-muted-foreground/20 text-foreground",
    dotClassName: "bg-muted-foreground",
  },
  incomplete: {
    className: "bg-chart-1/30 text-foreground",
    dotClassName: "bg-chart-1",
  },
  ready: {
    className: "bg-chart-5/30 text-foreground",
    dotClassName: "bg-chart-5",
  },
  chosen: {
    className: "bg-primary/30 text-foreground",
    dotClassName: "bg-primary",
  },
  rejected: {
    className: "bg-destructive/30 text-foreground",
    dotClassName: "bg-destructive",
  },
}

function LifecycleStatus({ status }: { status: CandidateLifecycleStatus }) {
  const style = STATUS_STYLES[status]

  return (
    <span
      className={cn(
        "inline-flex h-4.5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium",
        style.className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", style.dotClassName)}
      />
      {status}
    </span>
  )
}

function CallingAgentCard({
  call,
  agentRun,
}: {
  call: (typeof CALLS)[number]
  agentRun: CallingAgentRun
}) {
  const router = useRouter()
  const active = agentRun.phase === "dialing" || agentRun.phase === "calling"
  const status =
    agentRun.phase === "dialing"
      ? "dialing..."
      : `calling · ${agentRun.durationLabel}`

  function openCall() {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("call", call.id)
    router.replace(`${window.location.pathname}?${nextParams.toString()}`, {
      scroll: false,
    })
  }

  return (
    <div className="candidate-agent-reveal grid px-2.5" data-visible={active}>
      <div className="min-h-0 overflow-hidden">
        <button
          type="button"
          className="candidate-agent-card mb-1.5 flex w-full items-center gap-2 rounded-full bg-background/60 p-1 pr-2 text-left transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          onClick={openCall}
          disabled={!active}
          tabIndex={active ? 0 : -1}
          aria-hidden={!active}
          aria-label={`Open ${agentRun.name}'s call with ${call.supplier}`}
        >
          <Avatar size="sm" className="after:border-0">
            <AvatarFallback className={agentRun.avatarClassName}>
              <Bot aria-hidden="true" className="size-3.5" />
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {agentRun.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {status}
          </span>
        </button>
      </div>
    </div>
  )
}

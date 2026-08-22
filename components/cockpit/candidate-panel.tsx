"use client"

import { ChevronDownIcon, XIcon } from "@/components/icons"
import { CandidateComparison } from "@/components/cockpit/candidate-comparison"
import { RejectedCandidate } from "@/components/cockpit/rejected-candidate"
import {
  claimStatus,
  complianceStatus,
  landedCostStatus,
  outreachStatus,
  stockStatus,
} from "@/components/cockpit/candidate-status"
import type {
  Candidate,
  CandidateState,
} from "@/components/cockpit/candidate-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CALLS, CANDIDATES, LANDED_LINES, SCRIPT } from "@/lib/case-001"
import { cn } from "@/lib/utils"

export function CandidatePanel({
  visible,
  onClose,
}: {
  visible: number
  onClose: () => void
}) {
  const visibleIds = new Set(SCRIPT.slice(0, visible).map((step) => step.id))
  const state: CandidateState = {
    candidatesVisible: visibleIds.has("suppliers"),
    policyComplete: visibleIds.has("policy"),
    outreachStarted: visibleIds.has("outreach"),
    claimsComplete: visibleIds.has("claims"),
    costsComplete: visibleIds.has("deltas"),
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
              visibleIds={visibleIds}
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
  visibleIds,
}: {
  candidate: Candidate
  state: CandidateState
  visibleIds: ReadonlySet<string>
}) {
  const rejected = state.policyComplete && candidate.compliance === "failed"
  const call = CALLS.find(
    (item) => item.candidateId === candidate.id && visibleIds.has(item.afterId)
  )
  const landedLine = LANDED_LINES.find(
    (line) => line.candidateId === candidate.id
  )

  return (
    <Collapsible className="border-b border-border">
      <CollapsibleTrigger className="group flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {candidate.name}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {candidate.country}
            </span>
          </span>
          <CandidateStatuses candidate={candidate} state={state} />
        </span>
        <LifecycleBadge candidate={candidate} state={state} />
        <ChevronDownIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border bg-background/50 px-3 py-3">
          {rejected ? (
            <RejectedCandidate candidate={candidate} />
          ) : (
            <CandidateComparison
              candidate={candidate}
              state={state}
              call={call}
              landedLine={landedLine}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CandidateStatuses({
  candidate,
  state,
}: {
  candidate: Candidate
  state: CandidateState
}) {
  const allocated =
    state.claimsComplete && candidate.stockStatus === "in_stock_allocated"
  const values = [
    [
      "compliance",
      complianceStatus(candidate, state),
      state.policyComplete && candidate.compliance === "failed",
    ],
    ["Outreach Task", outreachStatus(candidate, state), false],
    ["Claim", claimStatus(candidate, state), false],
    ["stock_status", stockStatus(candidate, state), allocated],
    ["Landed Cost", landedCostStatus(candidate, state), false],
  ] as const

  return (
    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {values.map(([label, value, destructive]) => (
        <span
          key={label}
          className={cn("whitespace-nowrap", destructive && "text-destructive")}
        >
          {label} <span className="font-mono text-foreground">{value}</span>
        </span>
      ))}
    </span>
  )
}

function LifecycleBadge({
  candidate,
  state,
}: {
  candidate: Candidate
  state: CandidateState
}) {
  if (state.policyComplete && candidate.compliance === "failed")
    return <Badge variant="destructive">rejected</Badge>
  if (state.claimsComplete)
    return <Badge variant="secondary">Claim filed</Badge>
  if (state.outreachStarted) return <Badge variant="outline">outreach</Badge>
  if (state.policyComplete) return <Badge variant="secondary">passed</Badge>
  return <Badge variant="outline">matched</Badge>
}

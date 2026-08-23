"use client"

import { ChevronDownIcon, XIcon } from "@/components/icons"
import { CandidateComparison } from "@/components/cockpit/candidate-comparison"
import { RejectedCandidate } from "@/components/cockpit/rejected-candidate"
import type {
  Candidate,
  CandidateState,
} from "@/components/cockpit/candidate-types"
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
  const status = getLifecycleStatus(candidate, state)
  const rejected = state.policyComplete && candidate.compliance === "failed"
  const call = CALLS.find(
    (item) => item.candidateId === candidate.id && visibleIds.has(item.afterId)
  )
  const landedLine = LANDED_LINES.find(
    (line) => line.candidateId === candidate.id
  )
  const description = candidate.supplierRecord.preferred
    ? `${candidate.country} · Preferred Supplier Record`
    : `${candidate.country} · Supplier Record`

  return (
    <Collapsible className="border-b border-border">
      <CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 px-2.5 py-1.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {candidate.name}
          </span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">
            {description}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex h-4.5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium",
            status.className
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", status.dotClassName)}
          />
          {status.label}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
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

function getLifecycleStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed")
    return {
      label: "rejected",
      className: "bg-destructive/30 text-foreground",
      dotClassName: "bg-destructive",
    }
  if (state.claimsComplete)
    return {
      label: "Claim filed",
      className: "bg-chart-5/30 text-foreground",
      dotClassName: "bg-chart-5",
    }
  if (state.outreachStarted)
    return {
      label: "outreach",
      className: "bg-chart-1/30 text-foreground",
      dotClassName: "bg-chart-1",
    }
  if (state.policyComplete)
    return {
      label: "passed",
      className: "bg-primary/30 text-foreground",
      dotClassName: "bg-primary",
    }
  return {
    label: "matched",
    className: "bg-muted-foreground/30 text-foreground",
    dotClassName: "bg-muted-foreground",
  }
}

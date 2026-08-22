"use client"

import {
  ChevronDownIcon,
  ExternalLinkIcon,
  XIcon,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  type StockStatus,
} from "@/lib/case-001"
import { cn } from "@/lib/utils"

type Candidate = (typeof CANDIDATES)[number] & {
  recordStockStatus?: StockStatus | null
}

type CandidateState = {
  candidatesVisible: boolean
  policyComplete: boolean
  outreachStarted: boolean
  claimsComplete: boolean
  costsComplete: boolean
}

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
      className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-muted text-foreground"
    >
      <header className="flex min-h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div>
          <h2 className="text-sm font-medium">Candidates</h2>
          <p className="text-xs text-muted-foreground">Stable match order</p>
        </div>
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
          {candidates.map((fixture) => (
            <CandidateRow
              key={fixture.name}
              candidate={fixture as Candidate}
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
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <StatusText
              label="compliance"
              value={complianceStatus(candidate, state)}
              destructive={rejected}
            />
            <StatusText
              label="Outreach Task"
              value={outreachStatus(candidate, state)}
            />
            <StatusText label="Claim" value={claimStatus(candidate, state)} />
            <StatusText
              label="stock_status"
              value={stockStatus(candidate, state)}
              destructive={
                state.claimsComplete &&
                candidate.stockStatus === "in_stock_allocated"
              }
            />
            <StatusText
              label="Landed Cost"
              value={landedCostStatus(landedLine, candidate, state)}
            />
          </span>
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

function StatusText({
  label,
  value,
  destructive = false,
}: {
  label: string
  value: string
  destructive?: boolean
}) {
  return (
    <span
      className={cn("whitespace-nowrap", destructive && "text-destructive")}
    >
      <span>{label}</span>{" "}
      <span className="font-mono text-foreground">{value}</span>
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
  if (state.policyComplete && candidate.compliance === "failed") {
    return <Badge variant="destructive">rejected</Badge>
  }
  if (state.claimsComplete) {
    return <Badge variant="secondary">Claim filed</Badge>
  }
  if (state.outreachStarted) {
    return <Badge variant="outline">outreach</Badge>
  }
  if (state.policyComplete) {
    return <Badge variant="secondary">passed</Badge>
  }
  return <Badge variant="outline">matched</Badge>
}

function RejectedCandidate({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">compliance</span>
        <Badge variant="destructive">failed</Badge>
      </div>
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <p className="font-mono text-xs text-destructive">
          {candidate.failedRules.join(", ") || "rule not provided"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Shenzhen Bearing Co is rejected. No Outreach Task or Claim.
        </p>
      </div>
    </div>
  )
}

function CandidateComparison({
  candidate,
  state,
  call,
  landedLine,
}: {
  candidate: Candidate
  state: CandidateState
  call: (typeof CALLS)[number] | undefined
  landedLine: (typeof LANDED_LINES)[number] | undefined
}) {
  const hasClaim = state.claimsComplete && candidate.claimUnit !== null

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={`${slug(candidate.name)}-comparison`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3
            id={`${slug(candidate.name)}-comparison`}
            className="text-xs font-medium"
          >
            Supplier Record vs Claim
          </h3>
          <span className="text-xs text-muted-foreground">
            Claims are not facts.
          </span>
        </div>
        <div className="grid grid-cols-[minmax(5rem,0.75fr)_minmax(0,1fr)_minmax(0,1fr)] border border-border text-xs">
          <div className="bg-muted/50 px-2 py-2 text-muted-foreground">
            field
          </div>
          <div className="bg-muted/50 px-2 py-2">
            <span className="block font-medium">Supplier Record</span>
            <span className="text-muted-foreground">trusted</span>
          </div>
          <div className="bg-muted/50 px-2 py-2">
            <span className="block font-medium">Claim</span>
            <span className="text-destructive">untrusted</span>
          </div>
          <DiffRow
            field="unit price"
            record={candidate.recordUnit}
            claim={hasClaim ? candidate.claimUnit : null}
          />
          <DiffRow
            field="lead time"
            record={`${candidate.recordLeadDays} days`}
            claim={
              hasClaim && candidate.claimLeadDays !== null
                ? `${candidate.claimLeadDays} days`
                : null
            }
          />
          <DiffRow
            field="certification"
            record={candidate.recordCertification}
            claim={hasClaim ? candidate.claimCertificationCurrent : null}
          />
          <DiffRow
            field="stock_status"
            record={
              candidate.recordStockStatus ??
              `${candidate.recordKnownAllocations} known allocated`
            }
            claim={hasClaim ? candidate.stockStatus : null}
            destructive={candidate.stockStatus === "in_stock_allocated"}
          />
        </div>
      </section>

      {hasClaim && candidate.stockStatus === "in_stock_allocated" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Munich Motion stock is allocated. In stock is not ours.
        </p>
      ) : null}

      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 border-t border-border pt-2 text-xs">
        <dt className="py-2 text-muted-foreground">confidence</dt>
        <dd className="py-2 font-mono">
          {hasClaim ? formatOptional(candidate.claim?.confidence) : "pending"}
        </dd>
        <dt className="self-start py-2 text-muted-foreground">evidence</dt>
        <dd className="flex min-w-0 flex-col py-0">
          {hasClaim ? (
            <span className="py-2 text-muted-foreground">
              “{candidate.claim?.evidence[0] ?? "not provided"}”
            </span>
          ) : (
            <span className="py-2 font-mono">pending</span>
          )}
          {call ? (
            <a
              href={`?call=${call.id}`}
              className="inline-flex min-h-10 w-fit items-center gap-1 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open call
              <ExternalLinkIcon aria-hidden className="size-3" />
              <span className="sr-only">for {candidate.name}</span>
            </a>
          ) : null}
        </dd>
      </dl>

      <section aria-labelledby={`${slug(candidate.name)}-landed-cost`}>
        <h3
          id={`${slug(candidate.name)}-landed-cost`}
          className="mb-2 text-xs font-medium"
        >
          Landed Cost
        </h3>
        {state.costsComplete && landedLine ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-xs">
            <CostValue label="mode" value={landedLine.mode} />
            <CostValue label="goods" value={landedLine.goods} />
            <CostValue label="freight" value={landedLine.freight} />
            <CostValue label="total" value={landedLine.total} strong />
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            {state.costsComplete ? "Not available." : "Pending Claim checks."}
          </p>
        )}
      </section>
    </div>
  )
}

function DiffRow({
  field,
  record,
  claim,
  destructive = false,
}: {
  field: string
  record: string | null | undefined
  claim: string | null | undefined
  destructive?: boolean
}) {
  const recordValue = formatOptional(record)
  const claimValue = formatOptional(claim)
  const changed = recordValue !== claimValue

  return (
    <>
      <div className="border-t border-border px-2 py-2 text-muted-foreground">
        {field}
      </div>
      <div className="border-t border-border px-2 py-2 font-mono tabular-nums">
        {recordValue}
      </div>
      <div
        className={cn(
          "border-t border-border px-2 py-2 font-mono tabular-nums",
          changed && "font-medium",
          destructive && "text-destructive"
        )}
      >
        {claimValue}
      </div>
    </>
  )
}

function CostValue({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn("mt-0.5 font-mono tabular-nums", strong && "font-medium")}
      >
        {value}
      </dd>
    </div>
  )
}

function complianceStatus(candidate: Candidate, state: CandidateState) {
  if (!state.policyComplete) return "pending"
  return candidate.compliance
}

function outreachStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed")
    return "blocked"
  if (!state.outreachStarted) return "pending"
  return state.claimsComplete ? "completed" : "calling"
}

function claimStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed") return "none"
  if (state.claimsComplete) return "filed"
  return state.outreachStarted ? "waiting" : "pending"
}

function stockStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed")
    return "unavailable"
  if (!state.claimsComplete) return "pending"
  return candidate.stockStatus ?? "unclear"
}

function landedCostStatus(
  line: (typeof LANDED_LINES)[number] | undefined,
  candidate: Candidate,
  state: CandidateState
) {
  if (state.policyComplete && candidate.compliance === "failed") return "none"
  if (!state.costsComplete) return "pending"
  return line?.total ?? "not available"
}

function formatOptional(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "")
    return "not provided"
  return String(value)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

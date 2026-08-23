import { ExternalLinkIcon } from "@/components/icons"
import {
  CandidateComparisonTable,
  formatOptional,
} from "@/components/cockpit/candidate-comparison-table"
import type {
  Candidate,
  CandidateState,
} from "@/components/cockpit/candidate-types"
import { CALLS, LANDED_LINES } from "@/lib/case-001"
import { cn } from "@/lib/utils"

type CandidateComparisonProps = {
  candidate: Candidate
  state: CandidateState
  call: (typeof CALLS)[number] | undefined
  landedLine: (typeof LANDED_LINES)[number] | undefined
}

export function CandidateComparison({
  candidate,
  state,
  call,
  landedLine,
}: CandidateComparisonProps) {
  const hasClaim = state.claimsComplete && candidate.claimUnit !== null
  const headingId = `${slug(candidate.name)}-comparison`

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={headingId}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 id={headingId} className="text-xs font-medium">
            Supplier Record vs Claim
          </h3>
          <span className="text-xs text-muted-foreground">
            Claims are not facts.
          </span>
        </div>
        <CandidateComparisonTable candidate={candidate} hasClaim={hasClaim} />
      </section>
      {hasClaim && candidate.stockStatus === "in_stock_allocated" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Munich Motion stock is allocated. In stock is not ours.
        </p>
      ) : null}
      <ClaimEvidence candidate={candidate} call={call} hasClaim={hasClaim} />
      <LandedCost
        candidate={candidate}
        costsComplete={state.costsComplete}
        landedLine={landedLine}
      />
    </div>
  )
}

function ClaimEvidence({
  candidate,
  call,
  hasClaim,
}: Pick<CandidateComparisonProps, "candidate" | "call"> & {
  hasClaim: boolean
}) {
  return (
    <dl className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 border-t border-border pt-2 text-xs">
      <dt className="py-2 text-muted-foreground">confidence</dt>
      <dd className="py-2 font-mono">
        {hasClaim ? formatOptional(candidate.claim?.confidence) : "pending"}
      </dd>
      <dt className="self-start py-2 text-muted-foreground">evidence</dt>
      <dd className="flex min-w-0 flex-col py-0">
        <span
          className={cn(
            "py-2",
            hasClaim ? "text-muted-foreground" : "font-mono"
          )}
        >
          {hasClaim
            ? `“${candidate.claim?.evidence[0] ?? "not provided"}”`
            : "pending"}
        </span>
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
  )
}

function LandedCost({
  candidate,
  costsComplete,
  landedLine,
}: Pick<CandidateComparisonProps, "candidate" | "landedLine"> & {
  costsComplete: boolean
}) {
  const headingId = `${slug(candidate.name)}-landed-cost`

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-xs font-medium">
        Landed Cost
      </h3>
      {costsComplete && landedLine ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-xs">
          <CostValue label="mode" value={landedLine.mode} />
          <CostValue label="goods" value={landedLine.goods} />
          <CostValue label="freight" value={landedLine.freight} />
          <CostValue label="total" value={landedLine.total} strong />
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">
          {costsComplete ? "Not available." : "Pending Claim checks."}
        </p>
      )}
    </section>
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

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

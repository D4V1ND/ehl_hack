import type { Candidate } from "@/components/cockpit/candidate-types"
import { cn } from "@/lib/utils"

export function CandidateComparisonTable({
  candidate,
  hasClaim,
}: {
  candidate: Candidate
  hasClaim: boolean
}) {
  return (
    <div className="grid grid-cols-[minmax(5rem,0.75fr)_minmax(0,1fr)_minmax(0,1fr)] border border-border text-xs">
      <div className="bg-muted/50 px-2 py-2 text-muted-foreground">field</div>
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
          recordValue !== claimValue && "font-medium",
          destructive && "text-destructive"
        )}
      >
        {claimValue}
      </div>
    </>
  )
}

export function formatOptional(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "")
    return "not provided"
  return String(value)
}

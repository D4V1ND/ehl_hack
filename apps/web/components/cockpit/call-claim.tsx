import { ChevronDownIcon } from "@/components/icons"
import {
  ActivityTimestamp,
  DetailRow,
} from "@/components/cockpit/call-activity"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { RehearsalCall } from "@/lib/case-001"

export function CallClaim({
  call,
  completedAt,
}: {
  call: RehearsalCall
  completedAt?: string
}) {
  const stockAllocated = call.claim.stockStatus === "in_stock_allocated"
  const rows = [
    ["Quantity", call.claim.quantityAvailable],
    ["Earliest ready", call.claim.earliestReady],
    ["Price quoted", call.claim.priceQuoted],
    ["Unit price", call.claim.unitPrice],
    ["Certification valid", call.claim.certificationCurrent],
    ["Exact part confirmed", call.claim.partNumberConfirmed],
    ["stock_status", call.claim.stockStatus],
    ["Confidence", call.claim.confidence],
  ] as const

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="group/claim -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Claim filed</span>
            <Badge variant={stockAllocated ? "destructive" : "secondary"}>
              {call.claim.confidence}
            </Badge>
          </span>
          <span className="text-xs text-muted-foreground">
            Supplier statement · not verified
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <ActivityTimestamp timestamp={completedAt} />
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[state=open]/claim:rotate-180 motion-reduce:transition-none" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 border-t border-border pt-1">
          <dl className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <DetailRow
                key={label}
                label={label}
                value={value}
                mono
                destructive={label === "stock_status" && stockAllocated}
              />
            ))}
          </dl>
          <div className="border-t border-border py-4">
            <h3 className="text-xs font-medium text-muted-foreground">
              Evidence
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              {call.evidence.length > 0 ? (
                call.evidence.map((quote, index) => (
                  <blockquote
                    key={`${call.id}-evidence-${index}`}
                    className="rounded-lg bg-background/70 p-3 text-sm leading-6"
                  >
                    “{quote}”
                  </blockquote>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No evidence recorded.
                </p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

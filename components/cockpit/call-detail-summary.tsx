import { Badge } from "@/components/ui/badge"
import { CALLS, INCIDENT } from "@/lib/case-001"

type Call = (typeof CALLS)[number]

export function CallDetailSummary({ call }: { call: Call }) {
  const stockAllocated = call.claim.stockStatus === "in_stock_allocated"

  return (
    <div className="min-h-0 overflow-y-auto border-b border-border p-5 md:border-r md:border-b-0 md:p-6">
      <section aria-labelledby="outreach-task-heading">
        <SectionHeading id="outreach-task-heading">
          Outreach Task
        </SectionHeading>
        <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
          <DetailRow label="Candidate" value={call.supplier} />
          <DetailRow label="Channel" value="Phone" />
          <DetailRow label="Masked number" value={call.phone} mono />
          <DetailRow label="Part" value={INCIDENT.partId} mono />
          <DetailRow label="Call ID" value={call.id} mono />
          <DetailRow label="Call round" value={String(call.claim.round)} mono />
        </dl>
      </section>
      <section className="mt-6" aria-labelledby="disclosure-heading">
        <SectionHeading id="disclosure-heading">
          Mandatory disclosure
        </SectionHeading>
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm leading-6">
            I am an AI assistant calling for Munich plant purchasing. I will not
            agree to price, quantity, or delivery commitments. A human makes the
            Decision. You can request a human or ask me to stop.
          </p>
        </div>
      </section>
      <section className="mt-6" aria-labelledby="claim-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading id="claim-heading">Claim</SectionHeading>
          <span className="text-xs text-muted-foreground">
            Supplier statement · not verified
          </span>
        </div>
        <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
          <DetailRow
            label="Quantity"
            value={call.claim.quantityAvailable}
            mono
          />
          <DetailRow
            label="Earliest ready"
            value={call.claim.earliestReady}
            mono
          />
          <DetailRow label="Price quoted" value={call.claim.priceQuoted} mono />
          <DetailRow label="Unit price" value={call.claim.unitPrice} mono />
          <DetailRow label="Currency" value={call.claim.currency} mono />
          <DetailRow
            label="Certification valid"
            value={call.claim.certificationCurrent}
            mono
          />
          <DetailRow
            label="Exact part confirmed"
            value={call.claim.partNumberConfirmed}
            mono
          />
          <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] gap-4 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">stock_status</dt>
            <dd className="min-w-0 text-right font-mono text-xs">
              {stockAllocated ? (
                <Badge variant="destructive">{call.claim.stockStatus}</Badge>
              ) : (
                call.claim.stockStatus
              )}
            </dd>
          </div>
          <DetailRow label="Confidence" value={call.claim.confidence} mono />
        </dl>
      </section>
      <section className="mt-6" aria-labelledby="evidence-heading">
        <SectionHeading id="evidence-heading">Evidence</SectionHeading>
        <div className="mt-3 flex flex-col gap-2">
          {call.evidence.length > 0 ? (
            call.evidence.map((quote, index) => (
              <blockquote
                key={`${call.id}-evidence-${index}`}
                className="rounded-lg border border-border bg-muted/50 p-3 text-sm leading-6"
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
      </section>
    </div>
  )
}

function SectionHeading({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <h2 id={id} className="text-sm font-medium">
      {children}
    </h2>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] gap-4 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-right text-xs break-words ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}

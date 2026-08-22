"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CALLS, INCIDENT } from "@/lib/case-001"

export function CallDetailDialog() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callId = searchParams.get("call")
  const call = CALLS.find((candidate) => candidate.id === callId)

  function closeDialog() {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("call")
    const query = nextParams.toString()

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (!call) return null

  const stockAllocated = call.claim.stockStatus === "in_stock_allocated"

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[min(76rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 gap-3 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Rehearsal</Badge>
            <Badge variant="outline">No call placed</Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-lg">
              Call details · {call.supplier}
            </DialogTitle>
            <DialogDescription>
              Structured Outreach Task and Claim beside the complete rehearsal
              transcript. Claims are not facts.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(19rem,0.85fr)_minmax(24rem,1.15fr)]">
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
                  I am an AI assistant calling for Munich plant purchasing. I
                  will not agree to price, quantity, or delivery commitments. A
                  human makes the Decision. You can request a human or ask me to
                  stop.
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
                <DetailRow
                  label="Price quoted"
                  value={call.claim.priceQuoted}
                  mono
                />
                <DetailRow
                  label="Unit price"
                  value={call.claim.unitPrice}
                  mono
                />
                <DetailRow
                  label="Currency"
                  value={call.claim.currency}
                  mono
                />
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
                  <dt className="text-xs text-muted-foreground">
                    stock_status
                  </dt>
                  <dd className="min-w-0 text-right font-mono text-xs">
                    {stockAllocated ? (
                      <Badge variant="destructive">
                        {call.claim.stockStatus}
                      </Badge>
                    ) : (
                      call.claim.stockStatus
                    )}
                  </dd>
                </div>
                <DetailRow
                  label="Confidence"
                  value={call.claim.confidence}
                  mono
                />
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

          <section
            className="flex min-h-[22rem] min-w-0 flex-1 flex-col md:min-h-0"
            aria-labelledby="transcript-heading"
          >
            <div
              className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6"
              role="status"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                <h2 id="transcript-heading" className="text-sm font-medium">
                  Full transcript
                </h2>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                <span>{call.connectedLabel}</span>
                <span>{call.phone}</span>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
              {call.transcript.map((turn, index) => (
                <article
                  key={`${turn.speaker}-${index}`}
                  className="grid gap-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4"
                >
                  <h3 className="font-mono text-xs text-muted-foreground">
                    {turn.speaker}
                  </h3>
                  <p className="text-sm leading-6 text-pretty">{turn.text}</p>
                </article>
              ))}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 font-mono text-xs text-muted-foreground sm:px-6">
              <span className="uppercase">Claim</span>
              <span>price · {call.claim.unitPrice}</span>
              <span>stock_status · {call.claim.stockStatus}</span>
              <span>cert · {call.claim.certificationCurrent}</span>
              <span>confidence · {call.claim.confidence}</span>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
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

import { CALLS } from "@/lib/case-001"

type Call = (typeof CALLS)[number]

export function CallTranscript({ call }: { call: Call }) {
  return (
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
  )
}

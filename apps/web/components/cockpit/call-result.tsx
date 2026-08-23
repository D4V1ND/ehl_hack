"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type CallRecord = {
  id: string
  supplier: string
  phone: string
  afterId: "outreach" | "claims"
  connectedLabel: string
  claimStrip: { price: string; stock: string; cert: string }
  turns: readonly { speaker: string; text: string }[]
}

export function CallResult({ call }: { call: CallRecord }) {
  const stockAllocated = call.claimStrip.stock === "in_stock_allocated"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-2 shrink-0" aria-hidden />
          <span className="text-sm font-medium">{call.connectedLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-xs">
            {call.phone}
          </span>
          <Button size="sm" type="button">
            End
          </Button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {call.turns.map((turn, index) => (
          <div key={`${turn.speaker}-${index}`} className="flex flex-col gap-1">
            <span className="text-muted-foreground font-mono text-xs">
              {turn.speaker}
            </span>
            <p className="text-sm text-pretty">{turn.text}</p>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground flex h-12 shrink-0 items-center gap-4 overflow-x-auto border-t border-border px-4 font-mono text-xs">
        <span className="uppercase">Claim</span>
        <span>price · {call.claimStrip.price}</span>
        <span className="inline-flex items-center gap-1.5">
          stock ·{" "}
          {stockAllocated ? (
            <Badge variant="destructive">{call.claimStrip.stock}</Badge>
          ) : (
            call.claimStrip.stock
          )}
        </span>
        <span>cert · {call.claimStrip.cert}</span>
      </div>
    </div>
  )
}

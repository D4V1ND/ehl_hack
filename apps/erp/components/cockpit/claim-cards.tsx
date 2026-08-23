"use client"

import * as React from "react"
import { Phone } from "lucide-react"

import type { Candidate, Claim } from "@/lib/contracts"
import { money, percent, qty, titleise } from "@/lib/format"
import { STOCK_STATUS } from "@/lib/stages"
import { Card, Kicker, Mono } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/** Latest round per supplier: a second call supersedes the first, never adds a card. */
function latest(claims: Claim[]): Claim[] {
  const bySupplier = new Map<string, Claim>()
  for (const claim of claims) {
    const held = bySupplier.get(claim.supplier_ref)
    if (
      held === undefined ||
      (claim.round ?? 1) > (held.round ?? 1) ||
      (claim.received_at ?? "") >= (held.received_at ?? "")
    ) {
      bySupplier.set(claim.supplier_ref, claim)
    }
  }
  return [...bySupplier.values()]
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Kicker>{label}</Kicker>
      <div className="tnum mt-0.5 text-[15px] text-ink">{value}</div>
    </div>
  )
}

/**
 * What the suppliers actually said — one card per answered call.
 *
 * Nothing here is treated as fact: it is what a supplier claimed, with the
 * confidence the call earned and every field it failed to establish left as
 * `unknown` rather than defaulted to something plausible.
 */
export function ClaimCards({
  claims,
  candidates,
  heldFor,
  onCall,
  calling,
}: {
  claims: Claim[]
  candidates: Candidate[]
  /** The supplier kept back for the live call, if the flow held one. */
  heldFor?: string | null
  onCall?: (supplierRef: string) => void
  calling?: string | null
}) {
  const answered = latest(claims)
  const nameOf = new Map(candidates.map((c) => [c.supplier_ref, c.supplier_name]))
  const held = heldFor && !answered.some((claim) => claim.supplier_ref === heldFor) ? heldFor : null

  if (answered.length === 0 && !held) {
    return (
      <Card className="border-dashed bg-canvas-soft px-5 py-6">
        <p className="text-[15px] text-muted-ink">No supplier has answered yet.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {held ? (
        <Card className="border-dashed px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-ink">{nameOf.get(held) ?? held}</div>
              <Mono className="mt-1 inline-block">{held}</Mono>
              <p className="mt-2 text-[13px] text-muted-ink">
                Held back for a live call. The AI disclosure is read before anything is asked.
              </p>
            </div>
            {onCall ? (
              <button
                type="button"
                onClick={() => onCall(held)}
                disabled={calling === held}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-[18px] text-[14px] font-medium transition-colors",
                  calling === held
                    ? "cursor-not-allowed bg-hairline-soft text-muted-ink"
                    : "bg-primary text-on-primary hover:bg-primary-active",
                )}
              >
                <Phone className="size-4" />
                {calling === held ? "Dialling…" : "Call now"}
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {answered.map((claim) => {
        const status = STOCK_STATUS[claim.stock_status ?? "unclear"]
        return (
          <Card key={claim.supplier_ref} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-ink">
                  {nameOf.get(claim.supplier_ref) ?? claim.supplier_ref}
                </div>
                <Mono className="mt-1 inline-block">{claim.supplier_ref}</Mono>
              </div>
              <span
                className={cn(
                  "rounded-pill border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.7px]",
                  status.className,
                )}
              >
                {status.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Offered" value={claim.available ? qty(claim.qty_offered) : "nothing"} />
              <Field label="Unit price" value={money(claim.unit_price)} />
              <Field
                label="Lead time"
                value={claim.lead_time_days != null ? `${claim.lead_time_days} d` : "unknown"}
              />
              <Field label="MOQ" value={claim.moq != null ? qty(claim.moq) : "unknown"} />
              <Field label="Incoterm" value={claim.incoterm ?? "unknown"} />
              <Field label="Confidence" value={percent(claim.confidence)} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-[13px] text-muted-ink">
              <span>Part number {titleise(claim.part_number_confirmed ?? "unknown")}</span>
              <span>·</span>
              <span>Certification {titleise(claim.certification_current ?? "unknown")}</span>
              {claim.certs_claimed?.map((cert) => <Mono key={cert}>{cert}</Mono>)}
            </div>

            {claim.earliest_ready_text ? (
              <p className="mt-2 text-[13px] italic leading-[1.45] text-body">
                “{claim.earliest_ready_text}”
              </p>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}

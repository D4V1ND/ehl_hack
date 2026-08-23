"use client"

import { useMemo, useState } from "react"

import { CandidateDetailDialog } from "@/components/cockpit/candidate-detail-dialog"
import { XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { rankCandidates } from "@/lib/live/rank"
import type { LiveCandidate, SupplierRecord } from "@/lib/live/types"
import { cn } from "@/lib/utils"

export function LiveCandidatePanel({
  candidates,
  supplierRecords = [],
  onClose,
}: {
  candidates: readonly LiveCandidate[]
  supplierRecords?: readonly SupplierRecord[]
  onClose: () => void
}) {
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const recordsById = useMemo(
    () => new Map(supplierRecords.map((record) => [record.supplier_id, record])),
    [supplierRecords]
  )
  const ranked = useMemo(
    () => rankCandidates(candidates, recordsById),
    [candidates, recordsById]
  )
  const selected = ranked.find(
    (candidate) => candidate.supplier_ref === selectedRef
  )

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
      {ranked.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No Candidates yet. They appear when Devin writes them to the case.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {ranked.map((candidate) => {
            const record = recordsById.get(candidate.supplier_ref)
            const passed = candidate.compliance.passed
            return (
              <li
                key={candidate.supplier_ref}
                className="border-b border-border/70"
              >
                <button
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    !passed && "opacity-70"
                  )}
                  onClick={() => setSelectedRef(candidate.supplier_ref)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium">
                      {candidate.supplier_name}
                    </p>
                    <PolicyPill passed={passed} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {candidate.country}
                  </p>
                  <dl className="mt-2 flex gap-4 font-mono text-sm tabular-nums">
                    <div>
                      <dt className="text-[10px] text-muted-foreground">EUR</dt>
                      <dd
                        className={
                          record?.contract_unit_price
                            ? "text-chart-5"
                            : "text-muted-foreground"
                        }
                      >
                        {record?.contract_unit_price ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">d</dt>
                      <dd
                        className={
                          record?.standard_lead_days != null
                            ? "text-chart-2"
                            : "text-muted-foreground"
                        }
                      >
                        {record?.standard_lead_days != null
                          ? record.standard_lead_days
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {selected ? (
        <CandidateDetailDialog
          candidate={selected}
          record={recordsById.get(selected.supplier_ref)}
          onClose={() => setSelectedRef(null)}
        />
      ) : null}
    </aside>
  )
}

function PolicyPill({ passed }: { passed: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4.5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium",
        passed
          ? "bg-chart-5/30 text-foreground"
          : "bg-destructive/30 text-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          passed ? "bg-chart-5" : "bg-destructive"
        )}
      />
      {passed ? "passed" : "rejected"}
    </span>
  )
}

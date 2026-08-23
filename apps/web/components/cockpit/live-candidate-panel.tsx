"use client"

import { useMemo, useState } from "react"

import { CandidateDetailDialog } from "@/components/cockpit/candidate-detail-dialog"
import { XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { offerTeaser } from "@/lib/live/format"
import type { LiveCandidate, SupplierRecord } from "@/lib/live/types"

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
  const selected = candidates.find(
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
      {candidates.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No Candidates yet. They appear when Devin writes them to the case.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {candidates.map((candidate) => {
            const record = recordsById.get(candidate.supplier_ref)
            return (
              <li
                key={candidate.supplier_ref}
                className="border-b border-border/70"
              >
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => setSelectedRef(candidate.supplier_ref)}
                >
                  <p className="text-sm font-medium">{candidate.supplier_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {candidate.country} ·{" "}
                    {candidate.compliance.passed ? "passed policy" : "rejected"}
                  </p>
                  <p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">
                    {offerTeaser(
                      record?.contract_unit_price,
                      record?.standard_lead_days
                    )}
                  </p>
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

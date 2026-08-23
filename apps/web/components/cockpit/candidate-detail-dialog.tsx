"use client"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatDay,
  formatEurPerPc,
  formatLabel,
  formatLeadDays,
  formatQty,
  maskPhone,
} from "@/lib/live/format"
import type { LiveCandidate, SupplierRecord } from "@/lib/live/types"

export function CandidateDetailDialog({
  candidate,
  record,
  onClose,
}: {
  candidate: LiveCandidate
  record: SupplierRecord | undefined
  onClose: () => void
}) {
  const passed = candidate.compliance.passed
  const flags = [
    record?.incumbent ? "incumbent" : null,
    record?.preferred ? "preferred" : null,
    record?.approved ? "approved" : null,
  ].filter((flag): flag is string => flag != null)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[min(90dvh,40rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader className="border-b border-border px-4 py-4 pr-12">
          <DialogTitle>{candidate.supplier_name}</DialogTitle>
          <DialogDescription>
            {candidate.country}
            {record ? ` · ${record.supplier_id}` : ""}
          </DialogDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant={passed ? "secondary" : "destructive"}>
              {passed ? "passed policy" : "rejected"}
            </Badge>
            {flags.map((flag) => (
              <Badge key={flag} variant="outline">
                {flag}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-4 py-4">
          <section>
            <h3 className="mb-2 text-xs font-medium">On file</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat
                label="Contract unit price"
                value={formatEurPerPc(record?.contract_unit_price)}
                mono
              />
              <Stat
                label="Lead time"
                value={formatLeadDays(record?.standard_lead_days)}
              />
              <Stat
                label="Channel"
                value={formatLabel(candidate.channel)}
              />
              <Stat
                label="Known allocations"
                value={formatQty(record?.known_allocations)}
                mono
              />
              <Stat
                label="Max historical fill"
                value={formatQty(record?.max_historical_fill)}
                mono
              />
            </dl>
            <PriceBreaks breaks={record?.price_breaks ?? []} />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium">Company</h3>
            <dl className="divide-y divide-border border-y border-border">
              <Field label="Supplier ID" value={record?.supplier_id ?? "—"} mono />
              <Field
                label="Phone"
                value={maskPhone(record?.phone_masked)}
                mono
              />
              <Field label="Email" value={record?.email ?? "—"} />
              <Field
                label="Marketplace"
                value={record?.marketplace_url ?? "—"}
              />
              <Field
                label="Certifications"
                value={
                  record?.certifications?.length
                    ? record.certifications.join(", ")
                    : "—"
                }
              />
              <Field
                label="Certification expires"
                value={formatDay(record?.certification_expires_at)}
              />
              <Field
                label="Audit status"
                value={formatLabel(record?.audit_status)}
              />
              <Field
                label="Approved parts"
                value={
                  record?.part_ids?.length ? record.part_ids.join(", ") : "—"
                }
                mono
              />
            </dl>
          </section>

          {passed ? null : (
            <FailedPolicy candidate={candidate} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "mt-0.5 font-mono text-sm tabular-nums"
            : "mt-0.5 text-sm"
        }
      >
        {value}
      </dd>
    </div>
  )
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "min-w-0 break-words font-mono text-xs tabular-nums"
            : "min-w-0 break-words text-xs"
        }
      >
        {value}
      </dd>
    </div>
  )
}

function PriceBreaks({
  breaks,
}: {
  breaks: NonNullable<SupplierRecord["price_breaks"]>
}) {
  if (breaks.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">No price breaks on file.</p>
    )
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs text-muted-foreground">Price breaks</p>
      <ul className="space-y-1 font-mono text-xs tabular-nums">
        {breaks.map((row) => (
          <li key={row.min_qty}>
            {formatQty(row.min_qty)} pcs → {formatEurPerPc(row.unit_price)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FailedPolicy({ candidate }: { candidate: LiveCandidate }) {
  const explanations = candidate.compliance.explanations ?? {}
  const rules = candidate.compliance.failed_rules

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium">Policy</h3>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">Rejected. Rule not provided.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule}
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3"
            >
              <p className="font-mono text-xs text-destructive">{rule}</p>
              {explanations[rule] ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {explanations[rule]}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { getSuppliers } from "@/lib/api/client"
import type { SupplierRecord } from "@supplyos/contracts"

export default function SupplierRecordsPage() {
  const { partId } = useParams<{ partId: string }>()
  const [suppliers, setSuppliers] = React.useState<SupplierRecord[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    getSuppliers(partId)
      .then((records) => {
        if (!cancelled) setSuppliers(records)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load supplier records"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [partId])

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-sm lg:px-8">
      <Link className="text-muted-foreground underline" href="/inventory">
        ← Inventory
      </Link>
      <div className="mt-5">
        <p className="font-mono text-xs text-muted-foreground">{partId}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
          Approved suppliers
        </h1>
        <p className="mt-1 text-muted-foreground">
          Masked contact and commercial records from the mock ERP.
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-muted-foreground">Loading suppliers…</p>
      ) : null}
      {error ? (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      {!loading && !error && suppliers.length === 0 ? (
        <p className="mt-6 rounded border border-dashed p-4 text-muted-foreground">
          No approved suppliers are recorded for this part.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {suppliers.map((supplier) => (
          <article
            key={supplier.supplier_id}
            className="rounded-lg border border-hairline bg-surface-card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  {supplier.supplier_id}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {supplier.supplier_name}
                </h2>
              </div>
              {supplier.preferred ? (
                <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800">
                  Preferred
                </span>
              ) : null}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-muted-foreground">Country</dt>
                <dd>{supplier.country}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Audit</dt>
                <dd>{supplier.audit_status ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-mono">{supplier.phone_masked}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lead time</dt>
                <dd>
                  {supplier.standard_lead_days === null ||
                  supplier.standard_lead_days === undefined
                    ? "—"
                    : `${supplier.standard_lead_days} days`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contract price</dt>
                <dd className="font-mono">
                  {supplier.contract_unit_price ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Max historical fill</dt>
                <dd className="font-mono">
                  {supplier.max_historical_fill?.toLocaleString() ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-hairline pt-4 text-xs text-muted-foreground">
              Certifications:{" "}
              {supplier.certifications?.join(", ") || "none recorded"}
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}

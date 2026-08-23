"use client"

import * as React from "react"
import Link from "next/link"

import { getInventory, openCase, supplyOsCaseUrl } from "@/lib/api/client"
import type { InventoryRow } from "@supplyos/contracts"

export default function InventoryPage() {
  const [rows, setRows] = React.useState<InventoryRow[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)
    getInventory()
      .then(setRows)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load inventory"
        )
      )
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    let cancelled = false
    getInventory()
      .then((inventory) => {
        if (!cancelled) setRows(inventory)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Could not load inventory"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function trigger(row: InventoryRow) {
    setBusy(row.part_id)
    setError(null)
    try {
      const opened = await openCase(row.part_id)
      window.location.assign(supplyOsCaseUrl(opened.case_id))
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not open a sourcing case"
      )
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-sm lg:px-8">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Inventory</h1>
      <p className="mt-1 text-muted-foreground">
        System-of-record stock, cover, purchase-order status, and approved
        supplier records.
      </p>

      {error ? (
        <div className="mt-6 flex items-center justify-between gap-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          <p>{error}</p>
          <button
            className="font-medium underline"
            onClick={load}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className="mt-6 text-muted-foreground">Loading inventory…</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-lg border border-hairline bg-surface-card">
        <table className="w-full min-w-[58rem] border-collapse">
          <thead className="text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Part</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Plant</th>
              <th className="px-4 py-3 text-right">On hand</th>
              <th className="px-4 py-3 text-right">Cover</th>
              <th className="px-4 py-3 text-right">Suppliers</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.part_id}
                className="border-t border-hairline align-top"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{row.item_name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.item_code}
                  </div>
                </td>
                <td className="px-4 py-3">{row.part_class}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.plant_id}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.on_hand.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.days_of_cover === null ? "—" : `${row.days_of_cover}d`}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    className="font-mono underline"
                    href={`/suppliers/${row.part_id}`}
                  >
                    {row.suppliers}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">
                  {row.below_reorder ? (
                    <span className="text-amber-700">below reorder</span>
                  ) : null}
                  {row.delayed_po ? (
                    <div className="text-red-700">{row.delayed_po} delayed</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.open_case_id ? (
                    <a
                      className="font-medium text-primary underline"
                      href={supplyOsCaseUrl(row.open_case_id)}
                    >
                      Open in SupplyOS
                    </a>
                  ) : (
                    <button
                      className="rounded border border-hairline px-3 py-1 font-medium hover:border-primary disabled:opacity-50"
                      disabled={busy !== null}
                      onClick={() => trigger(row)}
                      type="button"
                    >
                      {busy === row.part_id ? "Opening…" : "Source in SupplyOS"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

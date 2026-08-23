"use client"

/**
 * The trigger screen.
 *
 * Every part we stock, thinnest cover first, with one button per row: open a
 * case and hand it to a Devin session. This is where the demo starts — the
 * claim is that any part can be sourced, so the human picks the row rather than
 * the code hard-coding a bearing.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { DATA_SOURCE, getInventory, openCase } from "@/lib/api/client"
import type { InventoryRow } from "@/lib/contracts"

export default function InventoryPage() {
  const router = useRouter()
  const [rows, setRows] = React.useState<InventoryRow[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    getInventory()
      .then(setRows)
      .catch((cause: Error) => setError(cause.message))
  }, [])

  React.useEffect(load, [load])

  async function trigger(row: InventoryRow) {
    setBusy(row.part_id)
    setError(null)
    try {
      const opened = await openCase(row.part_id)
      router.push(`/cases/${opened.case_id}`)
    } catch (cause) {
      setError((cause as Error).message)
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-8 text-sm">
      <h1 className="text-lg font-semibold">Inventory</h1>
      <p className="mt-1 text-muted-foreground">
        Days of cover at the current take rate. Sourcing a part opens a case and starts the session
        that works it.
      </p>

      {DATA_SOURCE === "fixtures" ? (
        <p className="mt-6 rounded border border-dashed p-4 text-muted-foreground">
          Fixtures mode: nothing to trigger. Start the API and set{" "}
          <code>NEXT_PUBLIC_DATA_SOURCE=live</code>.
        </p>
      ) : null}
      {error ? <p className="mt-6 rounded border border-red-500 p-4 text-red-600">{error}</p> : null}

      <table className="mt-6 w-full border-collapse">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Part</th>
            <th className="py-2">Class</th>
            <th className="py-2">Plant</th>
            <th className="py-2 text-right">On hand</th>
            <th className="py-2 text-right">Cover</th>
            <th className="py-2 text-right">Suppliers</th>
            <th className="py-2">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.part_id} className="border-t align-top">
              <td className="py-2">
                <div className="font-medium">{row.item_name}</div>
                <div className="font-mono text-xs text-muted-foreground">{row.item_code}</div>
              </td>
              <td className="py-2">{row.part_class}</td>
              <td className="py-2 font-mono text-xs">{row.plant_id}</td>
              <td className="py-2 text-right font-mono">{row.on_hand.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">
                {row.days_of_cover === null ? "—" : `${row.days_of_cover}d`}
              </td>
              <td className="py-2 text-right font-mono">{row.suppliers}</td>
              <td className="py-2 text-xs">
                {row.below_reorder ? <span className="text-amber-600">below reorder</span> : null}
                {row.delayed_po ? (
                  <div className="text-red-600">{row.delayed_po} delayed</div>
                ) : null}
              </td>
              <td className="py-2 text-right">
                {row.open_case_id ? (
                  <Link className="underline" href={`/cases/${row.open_case_id}`}>
                    {row.open_case_id}
                  </Link>
                ) : (
                  <button
                    className="rounded border px-3 py-1 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => trigger(row)}
                    type="button"
                  >
                    {busy === row.part_id ? "Opening…" : "Source this part"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

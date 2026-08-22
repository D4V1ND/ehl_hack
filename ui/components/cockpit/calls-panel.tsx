"use client"

import * as React from "react"
import { Phone, PhoneCall, TriangleAlert } from "lucide-react"

import {
  DATA_SOURCE,
  dispatchOutreach,
  getHealth,
  getQuotes,
  type CallMode,
} from "@/lib/api/client"
import type { Quote, SupplierRecord } from "@/lib/contracts"
import { maskPhone, money, qty as fmtQty } from "@/lib/format"
import { Card, Kicker, Mono } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/**
 * Placing the calls, and watching the answers land.
 *
 * Dispatch is asynchronous on purpose -- Slice C's provider returns a receipt
 * immediately and the answers arrive later, because that is the shape a real
 * phone call has. So this polls rather than awaiting a result.
 *
 * Safety, which is the whole reason this component is careful:
 *   - the mode comes from the backend, never from the browser
 *   - live mode is visually unmistakable and needs a second, typed confirmation
 *   - phone numbers arrive masked from the API; there is no unmasked field
 */
export function CallsPanel({
  caseId,
  suppliers,
  qty,
}: {
  caseId: string
  suppliers: SupplierRecord[]
  qty: number
}) {
  const [mode, setMode] = React.useState<CallMode | null>(null)
  const [dispatching, setDispatching] = React.useState(false)
  const [quotes, setQuotes] = React.useState<Quote[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [inFlight, setInFlight] = React.useState<string[]>([])
  // Nothing is selected by default. Calling a supplier has to be a decision
  // someone made, not the result of pressing the obvious button.
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [target, setTarget] = React.useState<string | null>(null)

  React.useEffect(() => {
    getHealth().then((h) => {
      setMode(h?.call_mode ?? null)
      setTarget(h?.call_target ?? null)
    })
  }, [])

  function toggle(ref: string) {
    setSelected((prior) => {
      const next = new Set(prior)
      next.has(ref) ? next.delete(ref) : next.add(ref)
      return next
    })
  }

  // Poll while answers are outstanding. Stops as soon as everyone has replied,
  // so an idle cockpit is not hammering the API.
  React.useEffect(() => {
    if (!inFlight.length) return
    const outstanding = inFlight.filter((ref) => !quotes.some((q) => q.supplier_ref === ref))
    if (!outstanding.length) return
    const timer = setTimeout(() => {
      getQuotes(caseId).then(setQuotes).catch(() => undefined)
    }, 1000)
    return () => clearTimeout(timer)
  }, [caseId, inFlight, quotes])

  const callable = suppliers.filter((s) => s.channels?.includes("voice"))
  const offline = DATA_SOURCE === "fixtures"

  async function place() {
    setError(null)
    setConfirming(false)
    setDispatching(true)
    const refs = callable.filter((s) => selected.has(s.supplier_id)).map((s) => s.supplier_id)
    try {
      await dispatchOutreach(caseId, refs, qty)
      setInFlight(refs)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Kicker>Outreach</Kicker>
            <p className="mt-1.5 max-w-xl text-[14px] leading-[1.5] text-body">
              Pick who to call. Each one is briefed with the part spec, {fmtQty(qty)} pieces and
              the need-by date, then asked for price breaks, MOQ, lead time, incoterm,
              certification and whether stock is free or already promised.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
              <button
                type="button"
                onClick={() =>
                  setSelected(
                    selected.size === callable.length
                      ? new Set()
                      : new Set(callable.map((s) => s.supplier_id)),
                  )
                }
                className="text-primary underline-offset-4 hover:underline"
              >
                {selected.size === callable.length ? "Clear selection" : "Select all"}
              </button>
              <span className="text-muted-ink">
                {selected.size} of {callable.length} selected
              </span>
              {mode === "live" && target ? (
                <span className="tnum text-semantic-error">
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <ModeBadge mode={mode} offline={offline} />
            {confirming ? (
              <ConfirmLive
                count={selected.size}
                target={target}
                onConfirm={place}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <button
                type="button"
                disabled={offline || dispatching || selected.size === 0}
                onClick={() => (mode === "live" ? setConfirming(true) : place())}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md px-[18px] text-[14px] font-medium transition-colors",
                  offline || dispatching || selected.size === 0
                    ? "cursor-not-allowed bg-hairline-soft text-muted-ink"
                    : mode === "live"
                      ? "bg-semantic-error text-on-primary hover:brightness-95"
                      : "bg-primary text-on-primary hover:bg-primary-active",
                )}
              >
                <Phone className="size-4" />
                {dispatching
                  ? "Connecting…"
                  : selected.size === 0
                    ? "Select a supplier"
                    : mode === "live"
                      ? `Call ${selected.size}`
                      : `Call ${selected.size} supplier${selected.size === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </div>

        {offline ? (
          <p className="mt-3 border-t border-hairline pt-3 text-[13px] text-muted-ink">
            Showing a recorded case. Connect to the sourcing service to contact suppliers from
            here.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 flex items-start gap-2 border-t border-hairline pt-3 text-[13px] text-semantic-error">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {callable.map((supplier) => (
          <CallCard
            key={supplier.supplier_id}
            supplier={supplier}
            quote={quotes.find((q) => q.supplier_ref === supplier.supplier_id)}
            calling={inFlight.includes(supplier.supplier_id)}
            selected={selected.has(supplier.supplier_id)}
            onToggle={() => toggle(supplier.supplier_id)}
            disabled={offline}
          />
        ))}
      </div>
    </div>
  )
}

function ModeBadge({ mode, offline }: { mode: CallMode | null; offline: boolean }) {
  if (offline) {
    return (
      <span className="rounded-pill border border-hairline-strong bg-canvas-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px] text-muted-ink">
        offline
      </span>
    )
  }
  if (mode === null) {
    return <span className="text-[12px] text-muted-soft">checking mode…</span>
  }
  return (
    <span
      className={cn(
        "rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px]",
        mode === "live"
          ? "bg-semantic-error text-on-primary"
          : "border border-hairline-strong bg-canvas-soft text-muted-ink",
      )}
    >
      {mode === "live" ? "live calling" : "test mode"}
    </span>
  )
}

/**
 * Live mode asks twice. A phone call to a real supplier cannot be taken back,
 * and a mis-click is otherwise indistinguishable from an intention.
 */
function ConfirmLive({
  count,
  target,
  onConfirm,
  onCancel,
}: {
  count: number
  target: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border border-semantic-error/40 bg-semantic-error/5 px-4 py-3 text-right">
      <p className="text-[13px] textate-ink text-ink">
        This places {count} real call{count === 1 ? "" : "s"}
        {target ? (
          <>
            {" "}to <span className="tnum">{target}</span>
          </>
        ) : null}
        . Continue?
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-md border border-hairline-strong bg-surface-card px-3 text-[13px] text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-8 rounded-md bg-semantic-error px-3 text-[13px] font-medium text-on-primary"
        >
          Yes, place the calls
        </button>
      </div>
    </div>
  )
}

function CallCard({
  supplier,
  quote,
  calling,
  selected,
  onToggle,
  disabled,
}: {
  supplier: SupplierRecord
  quote?: Quote
  calling: boolean
  selected: boolean
  onToggle: () => void
  disabled: boolean
}) {
  const waiting = calling && !quote
  return (
    <Card
      className={cn(
        "px-4 py-3.5 transition-colors",
        selected ? "border-primary" : "",
        disabled ? "opacity-60" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={onToggle}
            aria-label={`Call ${supplier.supplier_name}`}
            className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
          />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium text-ink">{supplier.supplier_name}</div>
          <div className="tnum mt-1 text-[12px] text-muted-ink">
            {maskPhone(supplier.phone_masked)} · {supplier.country}
          </div>
        </div>
        </div>
        <Status waiting={waiting} quote={quote} />
      </div>

      {quote ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-hairline pt-3 sm:grid-cols-4">
          <Field label="offered" value={quote.available ? fmtQty(quote.qty_offered ?? 0) : "—"} />
          <Field label="unit" value={money(quote.unit_price ?? null)} />
          <Field label="lead" value={quote.lead_time_days != null ? `${quote.lead_time_days} d` : "—"} />
          <Field label="MOQ" value={quote.moq != null ? fmtQty(quote.moq) : "—"} />
          {quote.price_breaks?.length ? (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-[11px] uppercase tracking-[0.7px] text-muted-soft">price breaks</dt>
              <dd className="tnum mt-0.5 flex flex-wrap gap-2 text-[13px] text-ink">
                {quote.price_breaks.map((b) => (
                  <span key={b.min_qty} className="rounded-xs border border-hairline bg-canvas-soft px-1.5 py-0.5">
                    {fmtQty(b.min_qty)}+ → {money(b.unit_price)}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </Card>
  )
}

function Status({ waiting, quote }: { waiting: boolean; quote?: Quote }) {
  if (waiting) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-pill border border-timeline-read bg-timeline-read/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px] text-ink">
        <PhoneCall className="size-3 animate-pulse" />
        on the line
      </span>
    )
  }
  if (!quote) {
    return (
      <span className="shrink-0 rounded-pill border border-hairline-strong px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px] text-muted-soft">
        not contacted
      </span>
    )
  }
  return (
    <span
      className={cn(
        "shrink-0 rounded-pill border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px]",
        quote.available
          ? "border-semantic-success/35 bg-semantic-success/10 text-semantic-success"
          : "border-semantic-error/35 bg-semantic-error/10 text-semantic-error",
      )}
    >
      {quote.available ? "quoted" : "cannot supply"}
    </span>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.7px] text-muted-soft">{label}</dt>
      <dd className="tnum text-[13px] text-ink">{value}</dd>
    </div>
  )
}

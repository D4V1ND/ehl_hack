"use client"

/**
 * The buyer's screen: what every supplier offered, and what each way of buying
 * would cost.
 *
 * The agent never orders. It narrows fifteen approved suppliers to the ones
 * policy allows, asks them, prices every single-source and split plan, and stops
 * — so this page is the deliverable, and it is built to be *read* under time
 * pressure: what was said, what is still unknown, and which plans miss the line
 * stop however cheap they are.
 */

import { use, useEffect, useState } from "react"
import Link from "next/link"

import { getCase, getEvents } from "@/lib/api/client"
import type { CaseSnapshot, Claim, Event, Strategy } from "@/lib/contracts"

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
const NUM = new Intl.NumberFormat("de-DE")

function money(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const parsed = Number(value)
  return Number.isFinite(parsed) ? EUR.format(parsed) : value
}

function unknownable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "" || value === "unknown") return "unknown"
  return typeof value === "number" ? NUM.format(value) : value
}

/** Latest round wins: a second call supersedes the first. */
function latestClaims(claims: Claim[]): Map<string, Claim> {
  const bySupplier = new Map<string, Claim>()
  for (const claim of claims) {
    const held = bySupplier.get(claim.supplier_ref)
    const newer =
      held === undefined ||
      (claim.received_at ?? "") >= (held.received_at ?? "") ||
      (claim.round ?? 1) > (held.round ?? 1)
    if (newer) bySupplier.set(claim.supplier_ref, claim)
  }
  return bySupplier
}

function ranked(strategies: Strategy[]): Strategy[] {
  // On time first, then cheapest. A cheaper plan that lands after the line stops
  // is not a better plan, and the ordering has to say so.
  return [...strategies].sort((a, b) => {
    if (a.meets_line_stop !== b.meets_line_stop) return a.meets_line_stop ? -1 : 1
    return Number(a.total_cost) - Number(b.total_cost)
  })
}

const styles = {
  page: {
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    maxWidth: 1120,
    margin: "0 auto",
    padding: 24,
    color: "#111",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    background: "#fff",
  },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 14 },
  th: {
    textAlign: "left" as const,
    borderBottom: "2px solid #111",
    padding: "6px 8px",
    whiteSpace: "nowrap" as const,
  },
  td: { borderBottom: "1px solid #eee", padding: "6px 8px", verticalAlign: "top" as const },
  muted: { color: "#666", fontSize: 13 },
  pill: {
    display: "inline-block",
    borderRadius: 999,
    padding: "1px 8px",
    fontSize: 12,
    border: "1px solid #ccc",
  },
}

export default function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params)
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const [nextCase, nextEvents] = await Promise.all([getCase(caseId), getEvents(caseId)])
        if (cancelled) return
        setSnapshot(nextCase)
        setEvents(nextEvents)
        setError(null)
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message)
      }
    }

    poll()
    const timer = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [caseId])

  const incident = snapshot?.incident
  const part = snapshot?.part
  const claims = latestClaims(snapshot?.claims ?? [])
  const strategies = ranked(snapshot?.decision?.strategies ?? [])
  const recommended = snapshot?.decision?.recommended_strategy_id ?? null
  const suppliers = new Map((snapshot?.supplier_records ?? []).map((s) => [s.supplier_id, s]))

  return (
    <main style={styles.page}>
      <p style={styles.muted}>
        <Link href="/inventory">inventory</Link> · <Link href="/cockpit">cockpit</Link>
        {snapshot?.devin_session_url ? (
          <>
            {" · "}
            <a href={snapshot.devin_session_url}>session</a>
          </>
        ) : null}
      </p>

      <h1 style={{ marginBottom: 4 }}>
        {caseId} — {part?.item_name ?? incident?.part_id ?? "loading"}
      </h1>
      {incident ? (
        <p style={styles.muted}>
          {NUM.format(Math.max(incident.qty_required - incident.qty_on_hand, 0))} pcs short of{" "}
          {NUM.format(incident.qty_required)} · line {incident.production_line} at{" "}
          {incident.plant_id} stops {incident.line_stop_at?.slice(0, 10)} ·{" "}
          {money(incident.line_stop_cost_per_hour)}/hour standing · stage {snapshot?.stage}
        </p>
      ) : null}
      {incident?.reason ? <p style={{ fontSize: 14 }}>{incident.reason}</p> : null}
      {error ? <p style={styles.muted}>waiting for the backend: {error}</p> : null}

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>What each supplier offered</h2>
        <p style={styles.muted}>
          Rejected suppliers stay on the list with the rule they failed — a shortlist that hides
          them cannot be argued with. Anything the call did not establish reads
          &ldquo;unknown&rdquo;, never a guess.
        </p>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Supplier</th>
              <th style={styles.th}>Policy</th>
              <th style={styles.th}>Offered</th>
              <th style={styles.th}>Unit price</th>
              <th style={styles.th}>Lead time</th>
              <th style={styles.th}>Stock</th>
              <th style={styles.th}>MOQ / Incoterm</th>
              <th style={styles.th}>Certification</th>
              <th style={styles.th}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot?.candidates ?? []).map((candidate) => {
              const claim = claims.get(candidate.supplier_ref)
              const record = suppliers.get(candidate.supplier_ref)
              const failed = candidate.compliance.failed_rules ?? []
              return (
                <tr key={candidate.supplier_ref}>
                  <td style={styles.td}>
                    <strong>{candidate.supplier_name}</strong>
                    <div style={styles.muted}>
                      {candidate.country}
                      {record?.incumbent ? " · incumbent" : ""} · {candidate.channel}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {candidate.compliance.passed ? (
                      <span style={styles.pill}>allowed</span>
                    ) : (
                      <>
                        <span style={{ ...styles.pill, borderColor: "#b00", color: "#b00" }}>
                          rejected
                        </span>
                        <div style={styles.muted}>
                          {failed
                            .map((rule) => candidate.compliance.explanations?.[rule] ?? rule)
                            .join(" ")}
                        </div>
                      </>
                    )}
                  </td>
                  <td style={styles.td}>
                    {claim ? `${NUM.format(claim.qty_offered ?? 0)} pcs` : "not asked"}
                  </td>
                  <td style={styles.td}>{money(claim?.unit_price)}</td>
                  <td style={styles.td}>
                    {unknownable(claim?.lead_time_days ?? record?.standard_lead_days ?? null)} d
                  </td>
                  <td style={styles.td}>{unknownable(claim?.stock_status)}</td>
                  <td style={styles.td}>
                    {unknownable(claim?.moq)} / {unknownable(claim?.incoterm)}
                  </td>
                  <td style={styles.td}>
                    {unknownable(claim?.certification_current)}
                    {claim?.certs_claimed?.length ? (
                      <div style={styles.muted}>{claim.certs_claimed.join(", ")}</div>
                    ) : null}
                  </td>
                  <td style={styles.td}>
                    {claim ? `${Math.round((claim.confidence ?? 0) * 100)}%` : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(snapshot?.candidates ?? []).length === 0 ? (
          <p style={styles.muted}>no suppliers screened yet</p>
        ) : null}
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Ways to buy it</h2>
        <p style={styles.muted}>
          Landed cost: goods, freight, duty, carrying cost and expediting. Nothing is ordered — a
          buyer picks one of these.
        </p>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Plan</th>
              <th style={styles.th}>Landed</th>
              <th style={styles.th}>EUR/pc</th>
              <th style={styles.th}>Full qty on site</th>
              <th style={styles.th}>Line stop</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((strategy, index) => (
              <tr
                key={strategy.strategy_id}
                style={strategy.meets_line_stop ? undefined : { background: "#fff5f5" }}
              >
                <td style={styles.td}>{index + 1}</td>
                <td style={styles.td}>
                  <strong>{strategy.label}</strong>
                  {strategy.strategy_id === recommended ? (
                    <span style={{ ...styles.pill, marginLeft: 8 }}>best value</span>
                  ) : null}
                  <div style={styles.muted}>
                    {strategy.lines
                      .map(
                        (line) =>
                          `${NUM.format(line.qty)} from ${line.supplier_name} by ${line.eta}` +
                          // A held-back supplier is priced on its ERP contract, not on
                          // anything it said. Say so, or the plan reads as a quote.
                          (claims.has(line.supplier_ref) ? "" : " (ERP contract terms, not quoted)"),
                      )
                      .join(" · ")}
                  </div>
                </td>
                <td style={styles.td}>{money(strategy.total_cost)}</td>
                <td style={styles.td}>{money(strategy.unit_effective)}</td>
                <td style={styles.td}>{strategy.coverage_date}</td>
                <td style={styles.td}>
                  {strategy.meets_line_stop ? "in time" : "too late"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {strategies.length === 0 ? (
          <p style={styles.muted}>no plans priced yet</p>
        ) : null}
        {snapshot?.decision?.pr_url ? (
          <p>
            Approve by merging: <a href={snapshot.decision.pr_url}>{snapshot.decision.pr_url}</a>
          </p>
        ) : null}
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>What the agent did</h2>
        <ol style={{ fontSize: 14, lineHeight: 1.5 }}>
          {events.map((event, index) => (
            <li key={`${event.ts}-${index}`}>
              <span style={styles.muted}>{event.stage}</span> — {event.message}
            </li>
          ))}
        </ol>
        {events.length === 0 ? <p style={styles.muted}>no events yet</p> : null}
      </section>
    </main>
  )
}

"use client"

import { use, useEffect, useState } from "react"
import type { CaseEvent } from "@/lib/cases/types"

export default function CaseEventsPage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = use(params)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const response = await fetch(`/api/cases/${caseId}/events`, {
          cache: "no-store",
        })
        const data = (await response.json()) as {
          events?: CaseEvent[]
          error?: string
        }
        if (cancelled) return
        setEvents(data.events ?? [])
        setError(response.ok ? null : (data.error ?? `HTTP ${response.status}`))
      } catch (err) {
        if (!cancelled) setError(String(err))
      }
    }

    poll()
    const timer = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [caseId])

  return (
    <main style={{ fontFamily: "monospace", padding: 24 }}>
      <h1>{caseId} events</h1>
      {error ? <p>waiting: {error}</p> : null}
      <ol>
        {events.map((event, index) => (
          <li key={`${event.ts}-${index}`}>
            <strong>{event.stage}</strong> — {event.message}
          </li>
        ))}
      </ol>
      {events.length === 0 && !error ? <p>no events yet</p> : null}
    </main>
  )
}

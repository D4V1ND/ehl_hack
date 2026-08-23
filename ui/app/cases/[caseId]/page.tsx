"use client"

/**
 * The case feed: what the session is doing, right now.
 *
 * Deliberately plain — the cockpit is the presentation surface. This page exists
 * so a case opened from the inventory screen can be watched from the moment it
 * is created, including the derived cases the cockpit has no fixture for.
 */

import { use, useEffect, useState } from "react"
import Link from "next/link"

import { getEvents } from "@/lib/api/client"
import type { Event } from "@/lib/contracts"

export default function CaseEventsPage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = use(params)
  const [events, setEvents] = useState<Event[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const next = await getEvents(caseId)
        if (cancelled) return
        setEvents(next)
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

  return (
    <main style={{ fontFamily: "monospace", padding: 24 }}>
      <h1>{caseId} events</h1>
      <p>
        <Link href="/inventory">inventory</Link> · <Link href="/cockpit">cockpit</Link>
      </p>
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

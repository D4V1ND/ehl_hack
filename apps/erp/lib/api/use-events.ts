"use client"

import * as React from "react"

import { getEvents } from "@/lib/api/client"
import type { Event } from "@/lib/contracts"

/**
 * The event feed.
 *
 * Two modes over one code path. `poll` asks the API for everything after the
 * last sequence number it saw, every two seconds -- which on stage looks
 * identical to a websocket and costs a tenth as much. `replay` takes the
 * recorded log and re-emits it with its original pacing compressed by `speed`,
 * so the cockpit tells the whole story with the backend switched off.
 *
 * Both end up calling the same `setEvents`, so the offline demo is not a second
 * implementation that can drift from the live one.
 */
export function useEvents(
  caseId: string,
  options: { replay?: boolean; speed?: number; enabled?: boolean } = {},
) {
  const { replay = false, speed = 4, enabled = true } = options
  const [events, setEvents] = React.useState<Event[]>([])
  const [complete, setComplete] = React.useState(false)

  React.useEffect(() => {
    if (!enabled) {
      setEvents([])
      setComplete(false)
      return
    }

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    async function start() {
      const all = await getEvents(caseId)
      if (cancelled) return

      if (!replay) {
        setEvents(all)
        setComplete(true)
        let since = all.length ? (all[all.length - 1].seq ?? 0) : 0
        const tick = async () => {
          if (cancelled) return
          const fresh = await getEvents(caseId, since)
          if (cancelled) return
          if (fresh.length) {
            since = fresh[fresh.length - 1].seq ?? since
            setEvents((prior) => [...prior, ...fresh])
          }
          timers.push(setTimeout(tick, 2000))
        }
        timers.push(setTimeout(tick, 2000))
        return
      }

      if (!all.length) {
        setComplete(true)
        return
      }
      const origin = new Date(all[0].ts).getTime()
      all.forEach((event, index) => {
        const offset = (new Date(event.ts).getTime() - origin) / speed
        timers.push(
          setTimeout(() => {
            if (cancelled) return
            setEvents((prior) => [...prior, event])
            if (index === all.length - 1) setComplete(true)
          }, offset),
        )
      })
    }

    start()
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [caseId, replay, speed, enabled])

  return { events, complete }
}

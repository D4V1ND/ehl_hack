"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  fetchCase,
  fetchEvents,
  openCase,
  sessionFromEvents,
} from "@/lib/live/api"
import { EVENT_POLL_MS, PART_ID } from "@/lib/live/config"
import type {
  CaseEvent,
  CaseSnapshot,
  LiveCandidate,
  OpenedCase,
  SessionInfo,
} from "@/lib/live/types"

export type DevinCaseStatus =
  | "idle"
  | "launching"
  | "live"
  | "stubbed"
  | "error"

type DevinCaseState = {
  status: DevinCaseStatus
  error: string | null
  caseId: string | null
  snapshot: CaseSnapshot | null
  events: CaseEvent[]
  session: SessionInfo | null
}

const EMPTY: DevinCaseState = {
  status: "idle",
  error: null,
  caseId: null,
  snapshot: null,
  events: [],
  session: null,
}

function statusFromSession(session: SessionInfo | null): DevinCaseStatus {
  if (!session) return "live"
  return session.stubbed ? "stubbed" : "live"
}

export function useDevinCase(caseIdFromUrl: string | null) {
  const [state, setState] = useState<DevinCaseState>(EMPTY)

  const attach = useCallback(async (caseId: string, opened?: OpenedCase) => {
    const [snapshot, events] = await Promise.all([
      fetchCase(caseId),
      fetchEvents(caseId),
    ])
    const session =
      opened !== undefined
        ? {
            session_id: opened.session_id,
            session_url: opened.session_url,
            stubbed: opened.stubbed,
            error: opened.session_error,
          }
        : sessionFromEvents(events)
    setState({
      status: statusFromSession(session),
      error: session?.error ?? null,
      caseId,
      snapshot,
      events,
      session,
    })
  }, [])

  const launch = useCallback(async () => {
    setState({ ...EMPTY, status: "launching" })
    try {
      const opened = await openCase(PART_ID)
      await attach(opened.case_id, opened)
      return opened.case_id
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not open a case"
      setState({ ...EMPTY, status: "error", error: message })
      return null
    }
  }, [attach])

  useEffect(() => {
    if (!caseIdFromUrl) return
    let cancelled = false

    const load = async () => {
      try {
        await attach(caseIdFromUrl)
      } catch (cause) {
        if (cancelled) return
        const message =
          cause instanceof Error ? cause.message : "Could not load the case"
        setState({ ...EMPTY, status: "error", error: message })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [attach, caseIdFromUrl])

  const eventsRef = useRef<CaseEvent[]>([])
  eventsRef.current = state.events

  useEffect(() => {
    const caseId = state.caseId
    if (!caseId || state.status === "error" || state.status === "launching") {
      return
    }
    let cancelled = false

    const tick = async () => {
      try {
        const since = eventsRef.current.at(-1)?.seq ?? 0
        const [snapshot, fresh] = await Promise.all([
          fetchCase(caseId),
          fetchEvents(caseId, since),
        ])
        if (cancelled) return
        setState((current) => {
          if (current.caseId !== caseId) return current
          const events =
            fresh.length > 0 ? [...current.events, ...fresh] : current.events
          const session = sessionFromEvents(events) ?? current.session
          return {
            ...current,
            snapshot,
            events,
            session,
            status: statusFromSession(session),
            error: session?.error ?? current.error,
          }
        })
      } catch {
        // Keep the last good feed. The next tick retries.
      }
    }

    const interval = window.setInterval(() => void tick(), EVENT_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [state.caseId, state.status])

  const candidates: readonly LiveCandidate[] = state.snapshot?.candidates ?? []

  return {
    ...state,
    candidates,
    launch,
    running: state.status === "launching" || state.status === "live",
  }
}

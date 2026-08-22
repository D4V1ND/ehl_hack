/**
 * In-memory case + event store.
 *
 * Vercel serverless has no durable local disk, so Slice 1 keeps everything in
 * a module-level map keyed by case_id. It survives only for the lifetime of a
 * single serverless instance: a case created by one instance is invisible to
 * another and disappears on cold start. That is accepted for this slice — a
 * durable store (KV/Turso) is a later slice, not this one.
 */

import type { CaseEvent, CaseRecord, EventLevel, Incident } from "./types"

type CaseState = {
  record: CaseRecord
  events: CaseEvent[]
}

const cases = new Map<string, CaseState>()

export function createCase(incident: Incident): CaseRecord {
  const record: CaseRecord = {
    case_id: incident.case_id,
    incident,
    created_at: new Date().toISOString(),
    session_id: null,
    session_url: null,
  }
  // Re-running the CLI on the same case_id restarts the case rather than
  // interleaving two runs in one event log.
  cases.set(record.case_id, { record, events: [] })
  return record
}

export function getCase(caseId: string): CaseRecord | undefined {
  return cases.get(caseId)?.record
}

export function setSession(
  caseId: string,
  sessionId: string | null,
  sessionUrl: string | null
): void {
  const state = cases.get(caseId)
  if (!state) return
  state.record.session_id = sessionId
  state.record.session_url = sessionUrl
}

export function appendEvent(
  caseId: string,
  event: {
    actor: string
    stage: string
    message: string
    level?: EventLevel
    payload?: Record<string, unknown>
  }
): CaseEvent {
  const stored: CaseEvent = {
    case_id: caseId,
    ts: new Date().toISOString(),
    actor: event.actor,
    stage: event.stage,
    level: event.level ?? "info",
    message: event.message,
    payload: event.payload ?? {},
  }
  const state = cases.get(caseId)
  if (state) state.events.push(stored)
  return stored
}

export function eventsFor(caseId: string): CaseEvent[] {
  return [...(cases.get(caseId)?.events ?? [])]
}

/** Test helper. Never called from a route handler. */
export function resetStore(): void {
  cases.clear()
}

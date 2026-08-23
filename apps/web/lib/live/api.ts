import { API_BASE } from "@/lib/live/config"
import type {
  CaseEvent,
  CaseSnapshot,
  OpenedCase,
  SessionInfo,
} from "@/lib/live/types"

let inFlightOpen: Promise<OpenedCase> | null = null

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail ?? fallback
  } catch {
    return fallback
  }
}

export async function openCase(partId: string): Promise<OpenedCase> {
  if (inFlightOpen) return inFlightOpen
  inFlightOpen = (async () => {
    const response = await fetch(`${API_BASE}/cases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ part_id: partId }),
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(await readError(response, `POST /cases -> ${response.status}`))
    }
    return (await response.json()) as OpenedCase
  })().finally(() => {
    inFlightOpen = null
  })
  return inFlightOpen
}

export async function fetchCase(caseId: string): Promise<CaseSnapshot | null> {
  const response = await fetch(
    `${API_BASE}/cases/${encodeURIComponent(caseId)}`,
    { cache: "no-store" }
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(await readError(response, `GET /cases/${caseId} -> ${response.status}`))
  }
  return (await response.json()) as CaseSnapshot
}

export async function fetchEvents(
  caseId: string,
  since = 0
): Promise<CaseEvent[]> {
  const response = await fetch(
    `${API_BASE}/cases/${encodeURIComponent(caseId)}/events?since=${since}`,
    { cache: "no-store" }
  )
  if (!response.ok) {
    throw new Error(
      await readError(response, `GET /cases/${caseId}/events -> ${response.status}`)
    )
  }
  return (await response.json()) as CaseEvent[]
}

const dialedCases = new Set<string>()
const dialing = new Set<string>()

export function alreadyLiveDialed(events: CaseEvent[]): boolean {
  return events.some((event) => event.payload.live === true)
}

/** One live CALL-E dial. Every supplier number is overridden by DEMO_CALL_DESTINATION. */
export async function placeLiveCall(
  caseId: string,
  supplierRef: string
): Promise<void> {
  if (dialedCases.has(caseId) || dialing.has(caseId)) return
  dialing.add(caseId)
  try {
    const query = new URLSearchParams({
      case_id: caseId,
      supplier_ref: supplierRef,
      live: "true",
    })
    const response = await fetch(`${API_BASE}/flow/call?${query}`, {
      method: "POST",
      cache: "no-store",
    })
    if (!response.ok) {
      dialedCases.add(caseId)
      throw new Error(await readError(response, `POST /flow/call -> ${response.status}`))
    }
    dialedCases.add(caseId)
  } finally {
    dialing.delete(caseId)
  }
}

export function sessionFromEvents(events: CaseEvent[]): SessionInfo | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const payload = events[index].payload
    if (typeof payload.session_url !== "string") continue
    return {
      session_id:
        typeof payload.session_id === "string" ? payload.session_id : null,
      session_url: payload.session_url,
      stubbed: payload.stubbed === true,
      error: typeof payload.error === "string" ? payload.error : null,
    }
  }
  return null
}

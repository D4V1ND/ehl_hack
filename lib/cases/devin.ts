/**
 * Devin session launcher.
 *
 * Real path: POST {DEVIN_API_BASE_URL}/v1/sessions with a bearer token
 * (https://docs.devin.ai/api-reference/v1/sessions/create-a-new-devin-session).
 * Without DEVIN_API_KEY we return a stub session so Slice 1 never fails on a
 * missing key. The key is only ever read from the environment.
 */

import type { Incident } from "./types"
import { shortfall } from "./types"

const DEFAULT_API_BASE_URL = "https://api.devin.ai"

export type DevinSession = {
  session_id: string
  session_url: string
  stubbed: boolean
  /** Set when the real API was attempted and failed; we still return a stub. */
  error?: string
}

export function backendBaseUrl(requestUrl: string): string {
  const configured = process.env.DEVIN_BACKEND_BASE_URL
  if (configured) return configured.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return new URL(requestUrl).origin
}

export function sessionPrompt(incident: Incident, baseUrl: string): string {
  return [
    `You are launching sourcing case ${incident.case_id}. Do not wait for a human — there is nobody to ask.`,
    `Backend base URL: ${baseUrl}. Read the case with GET ${baseUrl}/api/cases/${incident.case_id}/events.`,
    `Part ${incident.part_id} is short by ${shortfall(incident)} units (required ${incident.qty_required}, on hand ${incident.qty_on_hand}).`,
    `The line stops at ${incident.line_stop_at}. Costs are ${incident.currency} ${incident.line_stop_cost_per_hour}/hour of line stop and ${incident.expedite_fee} expedite fee.`,
    `Call only this backend. Do not place phone calls and do not contact suppliers in this slice.`,
  ].join("\n")
}

function stubSession(incident: Incident, error?: string): DevinSession {
  const suffix = incident.case_id.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const sessionId = `devin-stub-${suffix}-${Date.now()}`
  return {
    session_id: sessionId,
    session_url: `https://app.devin.ai/sessions/${sessionId}`,
    stubbed: true,
    error,
  }
}

export async function startDevinSession(
  incident: Incident,
  baseUrl: string
): Promise<DevinSession> {
  const apiKey = process.env.DEVIN_API_KEY
  if (!apiKey) return stubSession(incident)

  const apiBase = (
    process.env.DEVIN_API_BASE_URL ?? DEFAULT_API_BASE_URL
  ).replace(/\/$/, "")

  try {
    const response = await fetch(`${apiBase}/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: sessionPrompt(incident, baseUrl),
        title: `Sourcing ${incident.case_id} (${incident.part_id})`,
        tags: ["supplyguard", incident.case_id],
      }),
    })
    if (!response.ok) {
      const body = await response.text()
      return stubSession(
        incident,
        `Devin API ${response.status}: ${body.slice(0, 200)}`
      )
    }
    const data = (await response.json()) as {
      session_id?: string
      url?: string
    }
    if (!data.session_id) {
      return stubSession(incident, "Devin API response had no session_id")
    }
    return {
      session_id: data.session_id,
      session_url:
        data.url ?? `https://app.devin.ai/sessions/${data.session_id}`,
      stubbed: false,
    }
  } catch (error) {
    return stubSession(incident, `Devin API request failed: ${String(error)}`)
  }
}

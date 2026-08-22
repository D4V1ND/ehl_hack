import { backendBaseUrl, startDevinSession } from "@/lib/cases/devin"
import { CORS_HEADERS, json } from "@/lib/cases/http"
import { incidentFixture, incidentProblem } from "@/lib/cases/incidents"
import { appendEvent, createCase, setSession } from "@/lib/cases/store"
import type { Incident } from "@/lib/cases/types"
import { shortfall } from "@/lib/cases/types"

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "body must be JSON" }, 400)
  }

  const { case_id: caseId, incident: given } = (body ?? {}) as {
    case_id?: unknown
    incident?: unknown
  }
  if (typeof caseId !== "string" || caseId === "") {
    return json({ error: "case_id is required" }, 400)
  }

  let incident: Incident
  if (given === undefined) {
    const fixture = incidentFixture(caseId)
    if (!fixture) {
      return json({ error: `no incident fixture for ${caseId}` }, 404)
    }
    incident = fixture
  } else {
    const problem = incidentProblem(given)
    if (problem) return json({ error: problem }, 400)
    incident = given as Incident
    if (incident.case_id !== caseId) {
      return json({ error: "incident.case_id must match case_id" }, 400)
    }
  }

  createCase(incident)
  appendEvent(caseId, {
    actor: "system",
    stage: "created",
    message: `Case ${caseId} created for part ${incident.part_id}: short ${shortfall(incident)} of ${incident.qty_required}, line stops ${incident.line_stop_at}`,
    payload: { incident, shortfall: shortfall(incident) },
  })

  const baseUrl = backendBaseUrl(request.url)
  const session = await startDevinSession(incident, baseUrl)
  setSession(caseId, session.session_id, session.session_url)
  appendEvent(caseId, {
    actor: "system",
    stage: "session_started",
    level: session.error ? "warn" : "info",
    message: session.stubbed
      ? `Stub Devin session ${session.session_id}${session.error ? ` (${session.error})` : " (DEVIN_API_KEY not set)"}`
      : `Devin session ${session.session_id} started`,
    payload: {
      session_id: session.session_id,
      session_url: session.session_url,
      stubbed: session.stubbed,
      backend_base_url: baseUrl,
    },
  })

  return json(
    {
      case_id: caseId,
      session_id: session.session_id,
      session_url: session.session_url,
      stubbed: session.stubbed,
    },
    201
  )
}

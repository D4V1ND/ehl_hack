import { CORS_HEADERS, json } from "@/lib/cases/http"
import { eventsFor, getCase } from "@/lib/cases/store"

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<Response> {
  const { caseId } = await params
  const record = getCase(caseId)
  if (!record) {
    return json({ error: `unknown case ${caseId}`, events: [] }, 404)
  }
  return json(
    {
      case_id: caseId,
      session_id: record.session_id,
      session_url: record.session_url,
      events: eventsFor(caseId),
    },
    200
  )
}

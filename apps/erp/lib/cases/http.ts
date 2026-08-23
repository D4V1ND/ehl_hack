/**
 * The UI is same-origin. A CLI on another origin is not a browser and needs no
 * CORS header at all, so cross-origin access is opt-in: only origins listed in
 * `CASES_ALLOWED_ORIGINS` (comma-separated) get one. Without that, a page on any
 * origin could drive `POST /api/cases` and spend Devin credits.
 */

const ALLOWED = (process.env.CASES_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin")
  if (!origin || !ALLOWED.includes(origin)) return { Vary: "Origin" }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  }
}

export function json(body: unknown, status: number, request: Request): Response {
  return Response.json(body, { status, headers: corsHeaders(request) })
}

/**
 * The UI is same-origin, but the CLI may run against another origin
 * (localhost CLI vs deployed backend), so the case endpoints allow CORS.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const

export function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

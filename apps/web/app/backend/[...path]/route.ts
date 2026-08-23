const API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010"
).replace(/\/$/, "")

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  const incoming = new URL(request.url)
  const target = `${API}/${path.join("/")}${incoming.search}`
  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("connection")
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer()
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy

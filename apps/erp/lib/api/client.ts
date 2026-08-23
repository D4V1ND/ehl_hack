import type {
  InventoryRow,
  OpenedCase,
  SupplierRecord,
} from "@supplyos/contracts"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010"
const SUPPLYOS_BASE =
  process.env.NEXT_PUBLIC_SUPPLYOS_URL ?? "http://localhost:3001"

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
  })
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) detail = payload.detail
    } catch {
      // Preserve the status when the API returns a non-JSON error page.
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export async function getInventory(): Promise<InventoryRow[]> {
  return api<InventoryRow[]>("/inventory")
}

export async function getSuppliers(partId: string): Promise<SupplierRecord[]> {
  return api<SupplierRecord[]>(
    `/tools/suppliers?part_id=${encodeURIComponent(partId)}`
  )
}

export async function openCase(partId: string): Promise<OpenedCase> {
  return api<OpenedCase>("/cases", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ part_id: partId }),
  })
}

export function supplyOsCaseUrl(
  caseId: string,
  baseUrl = SUPPLYOS_BASE
): string {
  const url = new URL("/chat", `${baseUrl.replace(/\/$/, "")}/`)
  url.searchParams.set("case", caseId)
  return url.toString()
}

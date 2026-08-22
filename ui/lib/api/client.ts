import type {
  CaseSnapshot,
  CaseSummary,
  CompanyProfile,
  Event,
  OutreachTask,
  Quote,
  ShortageAlert,
} from "@/lib/contracts"

import caseOne from "@/lib/fixtures/CASE-001.json"
import caseOneEvents from "@/lib/fixtures/CASE-001.events.json"
import caseOneArtifacts from "@/lib/fixtures/CASE-001.artifacts.json"
import caseTwo from "@/lib/fixtures/CASE-002.json"
import caseTwoEvents from "@/lib/fixtures/CASE-002.events.json"
import caseTwoArtifacts from "@/lib/fixtures/CASE-002.artifacts.json"
import casesIndex from "@/lib/fixtures/cases.json"
import profileFixture from "@/lib/fixtures/profile.json"
import shortagesFixture from "@/lib/fixtures/shortages.json"

/**
 * One data layer, two sources.
 *
 * `fixtures` is the default and is what the demo runs on: the committed bundle
 * is a *recording* of the real endpoints, produced by
 * `python -m supplyguard.contracts.export`, so the offline path is the same
 * shape as the live one rather than a mock that can rot.
 *
 * `live` points at the FastAPI process. Same functions, same types.
 */
export const DATA_SOURCE = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "fixtures") as "fixtures" | "live"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010"

const FIXTURES = {
  cases: casesIndex as unknown as CaseSummary[],
  profile: profileFixture as unknown as CompanyProfile,
  shortages: shortagesFixture as unknown as ShortageAlert[],
  snapshots: {
    "CASE-001": caseOne as unknown as CaseSnapshot,
    "CASE-002": caseTwo as unknown as CaseSnapshot,
  } as Record<string, CaseSnapshot>,
  events: {
    "CASE-001": caseOneEvents as unknown as Event[],
    "CASE-002": caseTwoEvents as unknown as Event[],
  } as Record<string, Event[]>,
  artifacts: {
    "CASE-001": caseOneArtifacts as Record<string, string>,
    "CASE-002": caseTwoArtifacts as Record<string, string>,
  } as Record<string, Record<string, string>>,
}

async function live<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" })
  if (!response.ok) throw new Error(`${path} -> ${response.status}`)
  return (await response.json()) as T
}

export async function getShortages(): Promise<ShortageAlert[]> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.shortages
  return live<ShortageAlert[]>("/dashboard/shortages")
}

export async function getCases(): Promise<CaseSummary[]> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.cases
  return live<CaseSummary[]>("/cases")
}

export async function getCase(caseId: string): Promise<CaseSnapshot | null> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.snapshots[caseId] ?? null
  return live<CaseSnapshot>(`/cases/${caseId}`)
}

export async function getEvents(caseId: string, since = 0): Promise<Event[]> {
  if (DATA_SOURCE === "fixtures") {
    return (FIXTURES.events[caseId] ?? []).filter((event) => (event.seq ?? 0) > since)
  }
  return live<Event[]>(`/cases/${caseId}/events?since=${since}`)
}

export async function getArtifacts(caseId: string): Promise<Record<string, string>> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.artifacts[caseId] ?? {}
  const index = await live<{ artifacts: { name: string; is_markdown: boolean }[] }>(
    `/cases/${caseId}/artifacts`,
  )
  const entries = await Promise.all(
    index.artifacts
      .filter((a) => a.is_markdown)
      .map(async (a) => {
        const body = await live<{ body: string }>(`/cases/${caseId}/artifacts/${a.name}`)
        return [a.name, body.body] as const
      }),
  )
  return Object.fromEntries(entries)
}

export async function getProfile(): Promise<CompanyProfile> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.profile
  return live<CompanyProfile>("/profile")
}

/**
 * Synchronous fixture reads, for initial render.
 *
 * The fixture bundle is a static import, so in `fixtures` mode the cockpit can
 * paint the whole case on the server rather than flashing a loading state and
 * filling in after an effect. In `live` mode these return null and the async
 * getters above take over.
 */
export function initialShortages(): ShortageAlert[] {
  return DATA_SOURCE === "fixtures" ? FIXTURES.shortages : []
}

export function initialProfile(): CompanyProfile | null {
  return DATA_SOURCE === "fixtures" ? FIXTURES.profile : null
}

export function initialCase(caseId: string): CaseSnapshot | null {
  return DATA_SOURCE === "fixtures" ? (FIXTURES.snapshots[caseId] ?? null) : null
}

// --- outreach -------------------------------------------------------------
// These are the only calls in the cockpit that make the backend *do* something
// rather than report something, so they are live-only by construction: in
// fixtures mode there is no backend to dispatch through, and pretending
// otherwise would put a button on screen that looks like it places calls.

export type CallMode = "rehearsal" | "live"

export interface OutreachDispatch {
  case_id: string
  provider: string
  mode: CallMode
  tasks: OutreachTask[]
}

export interface Health {
  ok: boolean
  call_mode: CallMode
  parts: number
  suppliers: number
  incidents: number
}

export async function getHealth(): Promise<Health | null> {
  if (DATA_SOURCE === "fixtures") return null
  try {
    return await live<Health>("/healthz")
  } catch {
    return null
  }
}

export async function dispatchOutreach(
  caseId: string,
  supplierRefs: string[],
  qty: number,
): Promise<OutreachDispatch> {
  if (DATA_SOURCE === "fixtures") {
    throw new Error(
      "The cockpit is reading committed fixtures. Start the API and set " +
        "NEXT_PUBLIC_DATA_SOURCE=live to place calls.",
    )
  }
  const params = new URLSearchParams({ case_id: caseId, qty: String(qty) })
  const response = await fetch(`${API_BASE}/tools/outreach?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(supplierRefs),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`outreach failed: ${response.status}`)
  return (await response.json()) as OutreachDispatch
}

export async function getQuotes(caseId: string): Promise<Quote[]> {
  if (DATA_SOURCE === "fixtures") return []
  return live<Quote[]>(`/tools/quotes?case_id=${encodeURIComponent(caseId)}`)
}

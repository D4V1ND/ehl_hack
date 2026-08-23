import type {
  CasePlan,
  CaseSnapshot,
  CaseSummary,
  CompanyProfile,
  Event,
  InventoryRow,
  OpenedCase,
  ShortageAlert,
} from "@/lib/contracts"

import caseOne from "@/lib/fixtures/CASE-001.json"
import caseOneEvents from "@/lib/fixtures/CASE-001.events.json"
import caseOneArtifacts from "@/lib/fixtures/CASE-001.artifacts.json"
import caseOnePlan from "@/lib/fixtures/CASE-001.plan.json"
import caseTwo from "@/lib/fixtures/CASE-002.json"
import caseTwoEvents from "@/lib/fixtures/CASE-002.events.json"
import caseTwoArtifacts from "@/lib/fixtures/CASE-002.artifacts.json"
import caseTwoPlan from "@/lib/fixtures/CASE-002.plan.json"
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
  plans: {
    "CASE-001": caseOnePlan as unknown as CasePlan,
    "CASE-002": caseTwoPlan as unknown as CasePlan,
  } as Record<string, CasePlan>,
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

/**
 * The checklist: fixed headers plus whatever per-supplier lines the run created.
 *
 * This is the screen the audience watches, so it is its own read: it changes on
 * every step transition, far more often than the joined case snapshot.
 */
export async function getPlan(caseId: string): Promise<CasePlan | null> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.plans[caseId] ?? null
  return live<CasePlan>(`/cases/${caseId}/plan`)
}

export function initialPlan(caseId: string): CasePlan | null {
  return DATA_SOURCE === "fixtures" ? (FIXTURES.plans[caseId] ?? null) : null
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

/**
 * The trigger list: every part we could open a case for.
 *
 * Live only — there is nothing to trigger without a backend, so in fixtures
 * mode the inventory screen says so rather than offering a dead button.
 */
export async function getInventory(): Promise<InventoryRow[]> {
  if (DATA_SOURCE === "fixtures") return []
  return live<InventoryRow[]>("/inventory")
}

export async function openCase(partId: string): Promise<OpenedCase> {
  const response = await fetch(`${API_BASE}/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ part_id: partId }),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(((await response.json()) as { detail?: string }).detail ?? `HTTP ${response.status}`)
  }
  return (await response.json()) as OpenedCase
}

async function post<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", cache: "no-store" })
  if (!response.ok) {
    throw new Error(
      ((await response.json()) as { detail?: string }).detail ?? `${path} -> ${response.status}`,
    )
  }
  return (await response.json()) as T
}

/**
 * Run the whole case: screen, ask, file claims, price every split.
 *
 * `holdFor` leaves one supplier unasked so its call can be placed live from the
 * cockpit -- the stage moment. Rehearsed by default; the backend refuses to dial
 * for real unless the operator turned live calling on there.
 */
export async function runFlow(caseId: string, holdFor?: string | null) {
  const held = holdFor ? `&hold_for=${encodeURIComponent(holdFor)}` : ""
  return post<Record<string, unknown>>(`/flow/run?case_id=${encodeURIComponent(caseId)}${held}`)
}

export async function placeCall(caseId: string, supplierRef: string, isLive: boolean) {
  return post<Record<string, unknown>>(
    `/flow/call?case_id=${encodeURIComponent(caseId)}&supplier_ref=${encodeURIComponent(
      supplierRef,
    )}&live=${isLive}`,
  )
}

/** Turn whatever the call came back with into a claim and re-price the case. */
export async function collectCalls(caseId: string) {
  return post<Record<string, unknown>>(`/flow/collect?case_id=${encodeURIComponent(caseId)}`)
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

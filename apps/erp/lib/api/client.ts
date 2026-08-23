import type { CaseSnapshot, CompanyProfile, ShortageAlert } from "@/lib/contracts"

import caseOne from "@/lib/fixtures/CASE-001.json"
import caseTwo from "@/lib/fixtures/CASE-002.json"
import profileFixture from "@/lib/fixtures/profile.json"
import shortagesFixture from "@/lib/fixtures/shortages.json"

export const DATA_SOURCE = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "fixtures") as
  | "fixtures"
  | "live"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010"

const FIXTURES = {
  profile: profileFixture as unknown as CompanyProfile,
  shortages: shortagesFixture as unknown as ShortageAlert[],
  snapshots: {
    "CASE-001": caseOne as unknown as CaseSnapshot,
    "CASE-002": caseTwo as unknown as CaseSnapshot,
  } as Record<string, CaseSnapshot>,
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

export async function getCase(caseId: string): Promise<CaseSnapshot | null> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.snapshots[caseId] ?? null
  return live<CaseSnapshot>(`/cases/${caseId}`)
}

export async function getProfile(): Promise<CompanyProfile> {
  if (DATA_SOURCE === "fixtures") return FIXTURES.profile
  return live<CompanyProfile>("/profile")
}

export function initialShortages(): ShortageAlert[] {
  return DATA_SOURCE === "fixtures" ? FIXTURES.shortages : []
}

export function initialProfile(): CompanyProfile | null {
  return DATA_SOURCE === "fixtures" ? FIXTURES.profile : null
}

export function initialCase(caseId: string): CaseSnapshot | null {
  return DATA_SOURCE === "fixtures" ? (FIXTURES.snapshots[caseId] ?? null) : null
}

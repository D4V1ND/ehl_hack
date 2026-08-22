/**
 * Seeded Incident fixtures.
 *
 * Imported statically instead of read with `fs` so the JSON is bundled with the
 * route handler on Vercel.
 */

import caseOne from "@/fixtures/incidents/CASE-001.json"
import type { Incident } from "./types"

const FIXTURES: Record<string, Incident> = {
  "CASE-001": caseOne,
}

export function incidentFixture(caseId: string): Incident | undefined {
  return FIXTURES[caseId]
}

const MONEY = /^-?\d+(\.\d+)?$/

/** Returns the problem with `value` as an Incident, or null when it is one. */
export function incidentProblem(value: unknown): string | null {
  if (typeof value !== "object" || value === null)
    return "incident must be an object"
  const it = value as Record<string, unknown>
  for (const key of ["case_id", "part_id", "line_stop_at", "currency"]) {
    if (typeof it[key] !== "string" || it[key] === "") {
      return `incident.${key} must be a non-empty string`
    }
  }
  for (const key of ["qty_required", "qty_on_hand"]) {
    if (!Number.isInteger(it[key])) return `incident.${key} must be an integer`
  }
  for (const key of ["line_stop_cost_per_hour", "expedite_fee"]) {
    if (typeof it[key] !== "string" || !MONEY.test(it[key] as string)) {
      return `incident.${key} must be a decimal string, not a float`
    }
  }
  return null
}

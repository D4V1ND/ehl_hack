import { API_BASE, CASE_ID, HOLD_FOR, PACE_MS } from "@/lib/live/config"

export type LiveStepStatus =
  | "pending"
  | "active"
  | "done"
  | "failed"
  | "skipped"

export type LivePlanStep = {
  step_id: string
  group: string
  label: string
  status: LiveStepStatus
  detail: string | null
  supplier_ref: string | null
  dynamic: boolean
  started_at: string | null
  completed_at: string | null
}

export type LivePlanSection = {
  group: string
  label: string
  steps: LivePlanStep[]
}

export type LivePlan = {
  case_id: string
  sections: LivePlanSection[]
  active_step_id: string | null
  done: number
  total: number
}

export type PlanIndex = Readonly<Record<string, LivePlanStep>>

export async function fetchPlan(
  caseId: string = CASE_ID
): Promise<LivePlan | null> {
  const response = await fetch(
    `${API_BASE}/cases/${encodeURIComponent(caseId)}/plan`,
    { cache: "no-store" }
  )
  if (!response.ok) return null
  return (await response.json()) as LivePlan
}

export function indexPlan(plan: LivePlan): PlanIndex {
  const byId: Record<string, LivePlanStep> = {}
  for (const section of plan.sections) {
    for (const step of section.steps) {
      byId[step.step_id] = step
    }
  }
  return byId
}

export function stepFinished(step: LivePlanStep | undefined): boolean {
  return (
    step !== undefined &&
    (step.status === "done" ||
      step.status === "failed" ||
      step.status === "skipped")
  )
}

export function stepStarted(step: LivePlanStep | undefined): boolean {
  return step !== undefined && step.status !== "pending"
}

/** Kick off the deterministic run that ticks the same checklist a Devin session does. */
export async function startRun(caseId: string = CASE_ID): Promise<boolean> {
  const query = new URLSearchParams({ case_id: caseId })
  if (PACE_MS > 0) query.set("pace_ms", String(PACE_MS))
  if (HOLD_FOR) query.set("hold_for", HOLD_FOR)
  const response = await fetch(`${API_BASE}/flow/run?${query}`, {
    method: "POST",
  })
  return response.ok
}

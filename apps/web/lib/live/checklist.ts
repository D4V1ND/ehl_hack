import type { LivePlan, LivePlanSection, LivePlanStep } from "@/lib/live/plan"
import type { LiveCandidate } from "@/lib/live/types"

/** Overlay Devin's candidate list onto the seeded plan.
 *
 * Fixed headers stay. Call lines are whoever Devin named, not a baked-in
 * supplier set. Once outreach starts, unfinished call rows go active together
 * so the screen reads as a parallel fan-out. The backend still routes every
 * live dial to DEMO_CALL_DESTINATION.
 */
export function resolveChecklist(
  plan: LivePlan,
  candidates: readonly LiveCandidate[]
): LivePlan {
  const passed = candidates.filter((candidate) => candidate.compliance.passed)
  const outreach = plan.sections.find((section) => section.group === "outreach")
  const callingNow = outreachStarted(outreach)

  const sections = plan.sections.map((section) => {
    if (section.group === "screening") {
      return mergeSupplierRows(section, candidates, screeningRow, false)
    }
    if (section.group === "outreach") {
      return mergeSupplierRows(section, passed, callingRow, callingNow)
    }
    return section
  })

  const steps = sections.flatMap((section) => section.steps)
  return {
    ...plan,
    sections,
    done: steps.filter((step) => isFinished(step.status)).length,
    total: steps.length,
    active_step_id:
      steps.find((step) => step.status === "active")?.step_id ??
      plan.active_step_id,
  }
}

export function pickLiveCallSupplier(
  plan: LivePlan | null,
  candidates: readonly LiveCandidate[],
  holdFor = ""
): string | null {
  if (holdFor) return holdFor
  const passed = candidates.find((candidate) => candidate.compliance.passed)
  if (passed) return passed.supplier_ref
  const calling = plan?.sections
    .find((section) => section.group === "outreach")
    ?.steps.find((step) => step.supplier_ref && step.status === "active")
  return calling?.supplier_ref ?? null
}

export function outreachIsLive(plan: LivePlan | null): boolean {
  if (!plan) return false
  return outreachStarted(
    plan.sections.find((section) => section.group === "outreach")
  )
}

function outreachStarted(section: LivePlanSection | undefined): boolean {
  if (!section) return false
  if (section.status === "active") return true
  return section.steps.some(
    (step) =>
      step.status === "active" ||
      (step.step_id === "outreach:brief" && isFinished(step.status))
  )
}

function mergeSupplierRows(
  section: LivePlanSection,
  suppliers: readonly LiveCandidate[],
  build: (candidate: LiveCandidate, existing?: LivePlanStep) => LivePlanStep,
  forceActive: boolean
): LivePlanSection {
  const fixed = section.steps.filter((step) => !step.supplier_ref)
  const byRef = new Map(
    section.steps
      .filter((step) => step.supplier_ref)
      .map((step) => [step.supplier_ref, step])
  )

  const fromDevin = suppliers.map((candidate) => {
    const row = build(candidate, byRef.get(candidate.supplier_ref))
    byRef.delete(candidate.supplier_ref)
    if (forceActive && row.status === "pending") {
      return { ...row, status: "active" as const }
    }
    return row
  })

  const leftover = [...byRef.values()].map((step) =>
    forceActive && step.status === "pending"
      ? { ...step, status: "active" as const }
      : step
  )

  const steps = [...fixed, ...fromDevin, ...leftover]
  return {
    ...section,
    steps,
    status: sectionStatus(steps),
  }
}

function screeningRow(
  candidate: LiveCandidate,
  existing?: LivePlanStep
): LivePlanStep {
  if (existing) return existing
  return {
    step_id: `screening:${candidate.supplier_ref}`,
    group: "screening",
    label: candidate.supplier_name,
    status: candidate.compliance.passed ? "done" : "failed",
    detail: candidate.compliance.passed
      ? "Passed procurement policy"
      : candidate.compliance.failed_rules.join(", ") || "Rejected",
    supplier_ref: candidate.supplier_ref,
    dynamic: true,
    started_at: null,
    completed_at: null,
  }
}

function callingRow(
  candidate: LiveCandidate,
  existing?: LivePlanStep
): LivePlanStep {
  if (existing) {
    return {
      ...existing,
      label: existing.label || `Calling ${candidate.supplier_name}`,
    }
  }
  return {
    step_id: `outreach:${candidate.supplier_ref}`,
    group: "outreach",
    label: `Calling ${candidate.supplier_name}`,
    status: "pending",
    detail: null,
    supplier_ref: candidate.supplier_ref,
    dynamic: true,
    started_at: null,
    completed_at: null,
  }
}

function isFinished(status: LivePlanStep["status"]): boolean {
  return status === "done" || status === "failed" || status === "skipped"
}

function sectionStatus(steps: LivePlanStep[]): LivePlanSection["status"] {
  if (steps.some((step) => step.status === "active")) return "active"
  if (steps.some((step) => step.status === "failed") && steps.every(isFinished)) {
    return "failed"
  }
  if (steps.length > 0 && steps.every((step) => isFinished(step.status))) {
    return "done"
  }
  return "pending"
}

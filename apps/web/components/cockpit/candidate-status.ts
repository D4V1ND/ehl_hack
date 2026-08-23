import type {
  Candidate,
  CandidateState,
} from "@/components/cockpit/candidate-types"
import { CALLS, LANDED_LINES, type Claim } from "@/lib/case-001"

export type CandidateLifecycleStatus =
  "sourced" | "no answer" | "incomplete" | "ready" | "chosen" | "rejected"

type Call = (typeof CALLS)[number]
type LandedLine = (typeof LANDED_LINES)[number]

export function candidateLifecycleStatus({
  candidate,
  state,
  call,
  landedLine,
  researchComplete = state.claimsComplete,
  chosen = false,
}: {
  candidate: Candidate
  state: CandidateState
  call?: Call
  landedLine?: LandedLine
  researchComplete?: boolean
  chosen?: boolean
}): CandidateLifecycleStatus {
  if (state.policyComplete && candidate.compliance === "failed") {
    return "rejected"
  }
  if (researchComplete && landedLine?.usable === false) return "rejected"
  if (chosen) return "chosen"
  if (!researchComplete) return "sourced"
  if (call?.status === "no_answer") return "no answer"
  if (!hasRequiredClaimData(candidate)) return "incomplete"
  return "ready"
}

function hasRequiredClaimData(candidate: { claim: Claim | null }): boolean {
  const claim = candidate.claim
  if (!claim) return false

  return (
    claim.priceQuoted === "yes" &&
    claim.certificationCurrent !== "unknown" &&
    claim.partNumberConfirmed !== "unknown" &&
    claim.stockStatus !== "unclear" &&
    Number(claim.confidence) > 0
  )
}

export function complianceStatus(candidate: Candidate, state: CandidateState) {
  return state.policyComplete ? candidate.compliance : "pending"
}

export function outreachStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed")
    return "blocked"
  if (!state.outreachStarted) return "pending"
  return state.claimsComplete ? "completed" : "calling"
}

export function claimStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed") return "none"
  if (state.claimsComplete) return "filed"
  return state.outreachStarted ? "waiting" : "pending"
}

export function stockStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed")
    return "unavailable"
  if (!state.claimsComplete) return "pending"
  return candidate.stockStatus ?? "unclear"
}

export function landedCostStatus(candidate: Candidate, state: CandidateState) {
  if (state.policyComplete && candidate.compliance === "failed") return "none"
  if (!state.costsComplete) return "pending"
  return (
    LANDED_LINES.find((line) => line.candidateId === candidate.id)?.total ??
    "not available"
  )
}

import type {
  Candidate,
  CandidateState,
} from "@/components/cockpit/candidate-types"
import { LANDED_LINES } from "@/lib/case-001"

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

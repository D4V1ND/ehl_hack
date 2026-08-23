import { CANDIDATES, type StockStatus } from "@/lib/case-001"

export type Candidate = (typeof CANDIDATES)[number] & {
  recordStockStatus?: StockStatus | null
}

export type CandidateState = {
  candidatesVisible: boolean
  policyComplete: boolean
  outreachStarted: boolean
  claimsComplete: boolean
  costsComplete: boolean
  decisionRecorded: boolean
}

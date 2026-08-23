import type {
  Candidate,
  CaseSnapshot,
  Event,
  Incident,
  Part,
  PriceBreak,
  SupplierRecord,
} from "@supplyos/contracts"

export type { CaseSnapshot, Incident, Part, PriceBreak, SupplierRecord }

/** SupplyOS presents the API's Candidate contract as a live workspace row. */
export type LiveCandidate = Candidate

/** Event payloads are always materialized by the API read endpoint. */
export type CaseEvent = Omit<Event, "payload"> & {
  payload: Record<string, unknown>
}

export type SessionInfo = {
  session_id: string | null
  session_url: string | null
  stubbed: boolean
  error: string | null
}

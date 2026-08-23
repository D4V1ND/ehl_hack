export type StockStatus =
  | "free_in_stock"
  | "in_stock_allocated"
  | "to_be_made"
  | "unavailable"
  | "unclear"

export type YesNoUnknown = "yes" | "no" | "unknown"
export type DecisionState = "researching" | "ready" | "recorded"
export type CallStatus =
  "dialing" | "calling" | "completed" | "no_answer" | "stopped_for_human"
export type OutreachTaskStatus = "completed"

export type ScriptKind =
  "tool" | "policy" | "outreach" | "claims" | "deltas" | "strategy" | "tests"

export type ScriptStep = {
  id: string
  /** The backend checklist step this row mirrors, e.g. "erp:part" or "outreach:SUP-KBY". */
  planStepId?: string
  stepName: string
  kind: ScriptKind
  waitMs: number
  method?: string
  path?: string
  callId?: string
  summary: string
  detail: string
}

export type IncidentStage = "open" | "calling" | "decided"

export type SupplierRecord = {
  supplierId: string
  supplierRef: string
  displayName: string
  maskedPhone: string
  countryRegion: string
  language: string
  partId: string
  approved: boolean
  preferred: boolean
  contractUnitPrice: string
  standardLeadDays: string
  certification: string
  certificationExpiresAt: string
  knownAllocations: string
  maxHistoricalFill: string
}

export type Candidate = {
  id: string
  supplierRef: string
  name: string
  country: string
  phone: string
  compliance: "passed" | "failed"
  researchChannel: "voice" | "website" | "none"
  researchAfterId: string
  failedRules: string[]
  supplierRecord: SupplierRecord
  claim: Claim | null
  recordUnit: string
  recordLeadDays: string
  recordCertification: string
  recordCertificationExpiresAt: string
  recordKnownAllocations: string
  recordMaxHistoricalFill: string
  recordStockStatus: StockStatus
  claimUnit: string | null
  claimConfidence: string | null
  claimEvidence: string | null
  claimLeadDays: string | null
  claimCertificationCurrent: YesNoUnknown | null
  stockStatus: StockStatus | null
  freight: string | null
}

export type LandedLine = {
  candidateId: string
  supplier: string
  quantity: string
  mode: string
  unitPrice: string
  goods: string
  freight: string
  duty: string
  carryingCost: string
  total: string
  arrivalDays: string
  usable: boolean
}

export type Claim = {
  supplierId: string
  round: number
  sourceChannel: "voice" | "website"
  sourceRef: string
  callId?: string
  quantityAvailable: string
  earliestReady: string
  priceQuoted: YesNoUnknown
  unitPrice: string
  currency: "EUR" | "unknown"
  certificationCurrent: YesNoUnknown
  partNumberConfirmed: YesNoUnknown
  stockStatus: StockStatus
  confidence: string
  evidence: readonly string[]
}

export type RehearsalCall = {
  id: string
  supplier: string
  supplierRef?: string
  candidateId: string
  phone: string
  maskedPhone: string
  status: CallStatus
  duration: string
  afterId: "outreach" | "claims"
  connectedLabel: string
  claimStrip: { price: string; stock: StockStatus; cert: YesNoUnknown }
  claim: Claim
  confidence: string
  evidence: readonly string[]
  transcript: readonly { speaker: string; text: string }[]
  turns: readonly { speaker: string; text: string }[]
  runtimeAgentName?: string
  runtimeStartedAt?: string
  visibleTranscriptTurnCount?: number
}

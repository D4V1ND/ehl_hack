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

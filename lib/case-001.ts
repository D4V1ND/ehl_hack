export type StockStatus =
  | "free_in_stock"
  | "in_stock_allocated"
  | "to_be_made"
  | "unavailable"
  | "unclear"

export type YesNoUnknown = "yes" | "no" | "unknown"
export type DecisionState =
  "evaluating" | "on_hold" | "needs_human_review" | "approved"
export type CallStatus = "completed" | "no_answer" | "stopped_for_human"
export type OutreachTaskStatus = "completed"

export type ScriptKind =
  | "tool"
  | "policy"
  | "outreach"
  | "claims"
  | "deltas"
  | "strategy"
  | "tests"
  | "decision"

export type ScriptStep = {
  id: string
  stepName: string
  kind: ScriptKind
  method?: string
  path?: string
  summary: string
  detail: string
}

export type IncidentStage = "open" | "calling" | "decided"

export type Claim = {
  supplierId: string
  round: number
  callId: string
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
}

export const BUYER_NAME = "German automotive manufacturer"

export const INCIDENT = {
  caseId: "CASE-001",
  partId: "6204-2RS",
  description: "deep-groove ball bearing (DIN 625)",
  plant: "Munich + Stuttgart",
  plants: ["Munich", "Stuttgart"],
  plantLabel: "Munich and Stuttgart assembly plants",
  qtyRequired: "40000",
  qtyOnHand: "8000",
  shortfall: "32000",
  lineStopDays: "12",
  lineStopCostPerHour: "EUR 4000.00",
  currency: "EUR",
} as const

export const INCIDENTS = [
  {
    caseId: "CASE-001",
    partLabel: "6204-2RS deep-groove ball bearing",
    lineStopDays: "12",
    stage: "open" as IncidentStage,
    plant: "Munich",
    plantLabel: "Munich assembly plant",
    href: "/chat",
  },
  {
    caseId: "CASE-002",
    partLabel: "DIN 933 M8×40 body bolt",
    lineStopDays: "21",
    stage: "calling" as IncidentStage,
    plant: "Munich",
    plantLabel: "Munich assembly plant",
    href: null,
  },
  {
    caseId: "CASE-003",
    partLabel: "6205-2RS transmission bearing",
    lineStopDays: null,
    stage: "decided" as IncidentStage,
    plant: "Munich",
    plantLabel: "Munich assembly plant",
    href: null,
  },
  {
    caseId: "CASE-004",
    partLabel: "M10 suspension bracket bolt",
    lineStopDays: "8",
    stage: "open" as IncidentStage,
    plant: "Stuttgart",
    plantLabel: "Stuttgart vehicle assembly plant",
    href: null,
  },
  {
    caseId: "CASE-005",
    partLabel: "6004-2Z electric-drive bearing",
    lineStopDays: null,
    stage: "decided" as IncidentStage,
    plant: "Stuttgart",
    plantLabel: "Stuttgart vehicle assembly plant",
    href: null,
  },
] as const

export const CASE_FILES = [
  { name: "sourcing_case.yaml", ext: "yml", afterId: "part" },
  { name: "candidates.json", ext: "json", afterId: "suppliers" },
  { name: "claims/skf.json", ext: "json", afterId: "claims" },
  { name: "claims/fag.json", ext: "json", afterId: "claims" },
  { name: "claims/nsk.json", ext: "json", afterId: "claims" },
  { name: "claims/munich-motion.json", ext: "json", afterId: "claims" },
  { name: "cost_report.md", ext: "md", afterId: "deltas" },
  { name: "policy_report.md", ext: "md", afterId: "tests" },
  { name: "decision.md", ext: "md", afterId: "pr" },
  { name: "po_draft.md", ext: "md", afterId: "pr" },
] as const

export const SUPPLIER_RECORDS = [
  {
    supplierId: "supplier-skf-nordic",
    displayName: "SKF Nordic",
    maskedPhone: "+46******0100",
    countryRegion: "SE",
    language: "en",
    partId: "6204-2RS",
    approved: true,
    preferred: true,
    contractUnitPrice: "EUR 4.20",
    standardLeadDays: "10",
    certification: "IATF 16949",
    certificationExpiresAt: "2026-11-30",
    knownAllocations: "0",
    maxHistoricalFill: "40000",
  },
  {
    supplierId: "supplier-schaeffler-fag",
    displayName: "Schaeffler FAG",
    maskedPhone: "+49*******0199",
    countryRegion: "DE",
    language: "de",
    partId: "6204-2RS",
    approved: true,
    preferred: true,
    contractUnitPrice: "EUR 2.40",
    standardLeadDays: "28",
    certification: "IATF 16949",
    certificationExpiresAt: "2027-03-31",
    knownAllocations: "0",
    maxHistoricalFill: "50000",
  },
  {
    supplierId: "supplier-nsk-europe",
    displayName: "NSK Europe",
    maskedPhone: "+49*******0200",
    countryRegion: "DE",
    language: "de",
    partId: "6204-2RS",
    approved: true,
    preferred: false,
    contractUnitPrice: "EUR 3.10",
    standardLeadDays: "14",
    certification: "IATF 16949",
    certificationExpiresAt: "2026-08-15",
    knownAllocations: "0",
    maxHistoricalFill: "32000",
  },
  {
    supplierId: "supplier-shenzhen-bearing",
    displayName: "Shenzhen Bearing Co",
    maskedPhone: "+86*******0100",
    countryRegion: "CN",
    language: "en",
    partId: "6204-2RS",
    approved: false,
    preferred: false,
    contractUnitPrice: "EUR 1.40",
    standardLeadDays: "35",
    certification: "IATF 16949",
    certificationExpiresAt: "2025-09-30",
    knownAllocations: "0",
    maxHistoricalFill: "60000",
  },
  {
    supplierId: "supplier-munich-motion",
    displayName: "Munich Motion GmbH",
    maskedPhone: "+49*******0210",
    countryRegion: "DE",
    language: "de",
    partId: "6204-2RS",
    approved: true,
    preferred: false,
    contractUnitPrice: "EUR 3.80",
    standardLeadDays: "2",
    certification: "IATF 16949",
    certificationExpiresAt: "2026-05-20",
    knownAllocations: "32000",
    maxHistoricalFill: "32000",
  },
] as const

export const CLAIMS = [
  {
    supplierId: "supplier-skf-nordic",
    round: 1,
    callId: "skf",
    quantityAvailable: "32000",
    earliestReady: "3 days",
    priceQuoted: "yes",
    unitPrice: "EUR 4.80",
    currency: "EUR",
    certificationCurrent: "yes",
    partNumberConfirmed: "yes",
    stockStatus: "free_in_stock",
    confidence: "0.96",
    evidence: [
      "We can release 32,000 units from free stock.",
      "The IATF 16949 certificate is current.",
    ],
  },
  {
    supplierId: "supplier-schaeffler-fag",
    round: 1,
    callId: "fag",
    quantityAvailable: "32000",
    earliestReady: "21 days",
    priceQuoted: "yes",
    unitPrice: "EUR 2.10",
    currency: "EUR",
    certificationCurrent: "yes",
    partNumberConfirmed: "yes",
    stockStatus: "to_be_made",
    confidence: "0.93",
    evidence: [
      "The full 32,000-unit batch must be made.",
      "Production can be ready in 21 days.",
    ],
  },
  {
    supplierId: "supplier-nsk-europe",
    round: 1,
    callId: "nsk",
    quantityAvailable: "32000",
    earliestReady: "14 days",
    priceQuoted: "yes",
    unitPrice: "EUR 3.05",
    currency: "EUR",
    certificationCurrent: "yes",
    partNumberConfirmed: "yes",
    stockStatus: "free_in_stock",
    confidence: "0.91",
    evidence: [
      "32,000 units are free for your order.",
      "Road delivery is available after 14 days.",
    ],
  },
  {
    supplierId: "supplier-munich-motion",
    round: 1,
    callId: "munich-motion",
    quantityAvailable: "32000",
    earliestReady: "2 days",
    priceQuoted: "yes",
    unitPrice: "EUR 3.80",
    currency: "EUR",
    certificationCurrent: "yes",
    partNumberConfirmed: "yes",
    stockStatus: "in_stock_allocated",
    confidence: "0.98",
    evidence: [
      "The units are allocated to another customer.",
      "I cannot promise those units to you.",
    ],
  },
] as const satisfies readonly Claim[]

const AI_DISCLOSURE = `I am an AI assistant calling on behalf of a German automotive manufacturer. This call is recorded. I cannot agree to a price, quantity, or delivery commitment. A human makes the Decision. Ask for a human or ask me to stop at any time.`

export const OUTREACH_TASKS = [
  {
    id: "outreach-case-001-skf",
    caseId: "CASE-001",
    candidateId: "supplier-skf-nordic",
    channel: "phone",
    maskedPhone: "+46******0100",
    status: "completed" as OutreachTaskStatus,
    batchId: "case-001-round-1",
    round: 1,
    startedAt: "2025-02-14T09:15:00Z",
    callId: "skf",
  },
  {
    id: "outreach-case-001-fag",
    caseId: "CASE-001",
    candidateId: "supplier-schaeffler-fag",
    channel: "phone",
    maskedPhone: "+49*******0199",
    status: "completed" as OutreachTaskStatus,
    batchId: "case-001-round-1",
    round: 1,
    startedAt: "2025-02-14T09:15:00Z",
    callId: "fag",
  },
  {
    id: "outreach-case-001-nsk",
    caseId: "CASE-001",
    candidateId: "supplier-nsk-europe",
    channel: "phone",
    maskedPhone: "+49*******0200",
    status: "completed" as OutreachTaskStatus,
    batchId: "case-001-round-1",
    round: 1,
    startedAt: "2025-02-14T09:15:00Z",
    callId: "nsk",
  },
  {
    id: "outreach-case-001-munich-motion",
    caseId: "CASE-001",
    candidateId: "supplier-munich-motion",
    channel: "phone",
    maskedPhone: "+49*******0210",
    status: "completed" as OutreachTaskStatus,
    batchId: "case-001-round-1",
    round: 1,
    startedAt: "2025-02-14T09:15:00Z",
    callId: "munich-motion",
  },
] as const

export const CALLS: readonly RehearsalCall[] = [
  {
    id: "skf",
    supplier: "SKF Nordic",
    candidateId: "supplier-skf-nordic",
    phone: "+46******0100",
    maskedPhone: "+46******0100",
    status: "completed" as CallStatus,
    duration: "01:36",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:36",
    claimStrip: { price: "EUR 4.80", stock: "free_in_stock", cert: "yes" },
    claim: CLAIMS[0],
    confidence: CLAIMS[0].confidence,
    evidence: CLAIMS[0].evidence,
    transcript: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "SKF Nordic",
        text: "For 6204-2RS, we can release 32,000 units from free stock in 3 days at EUR 4.80 each. The IATF 16949 certificate is current.",
      },
    ],
    turns: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "SKF Nordic",
        text: "For 6204-2RS, we can release 32,000 units from free stock in 3 days at EUR 4.80 each. The IATF 16949 certificate is current.",
      },
    ],
  },
  {
    id: "fag",
    supplier: "Schaeffler FAG",
    candidateId: "supplier-schaeffler-fag",
    phone: "+49*******0199",
    maskedPhone: "+49*******0199",
    status: "completed" as CallStatus,
    duration: "01:48",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:48",
    claimStrip: { price: "EUR 2.10", stock: "to_be_made", cert: "yes" },
    claim: CLAIMS[1],
    confidence: CLAIMS[1].confidence,
    evidence: CLAIMS[1].evidence,
    transcript: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "Schaeffler FAG",
        text: "We can make all 32,000 units in 21 days at EUR 2.10 each. They are not in stock today. The part and certification are confirmed.",
      },
    ],
    turns: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "Schaeffler FAG",
        text: "We can make all 32,000 units in 21 days at EUR 2.10 each. They are not in stock today. The part and certification are confirmed.",
      },
    ],
  },
  {
    id: "nsk",
    supplier: "NSK Europe",
    candidateId: "supplier-nsk-europe",
    phone: "+49*******0200",
    maskedPhone: "+49*******0200",
    status: "completed" as CallStatus,
    duration: "01:31",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:31",
    claimStrip: { price: "EUR 3.05", stock: "free_in_stock", cert: "yes" },
    claim: CLAIMS[2],
    confidence: CLAIMS[2].confidence,
    evidence: CLAIMS[2].evidence,
    transcript: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "NSK Europe",
        text: "We have 32,000 certified 6204-2RS units free at EUR 3.05 each. Road delivery takes 14 days.",
      },
    ],
    turns: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "NSK Europe",
        text: "We have 32,000 certified 6204-2RS units free at EUR 3.05 each. Road delivery takes 14 days.",
      },
    ],
  },
  {
    id: "munich-motion",
    supplier: "Munich Motion GmbH",
    candidateId: "supplier-munich-motion",
    phone: "+49*******0210",
    maskedPhone: "+49*******0210",
    status: "completed" as CallStatus,
    duration: "01:04",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:04",
    claimStrip: {
      price: "EUR 3.80",
      stock: "in_stock_allocated",
      cert: "yes",
    },
    claim: CLAIMS[3],
    confidence: CLAIMS[3].confidence,
    evidence: CLAIMS[3].evidence,
    transcript: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "Agent",
        text: "Confirm stock_status: free for us, or already allocated to another customer?",
      },
      {
        speaker: "Munich Motion",
        text: "We have 32,000 units at EUR 3.80 each, but they are allocated to another customer. I cannot promise them.",
      },
    ],
    turns: [
      { speaker: "Agent", text: AI_DISCLOSURE },
      {
        speaker: "Agent",
        text: "Confirm stock_status: free for us, or already allocated to another customer?",
      },
      {
        speaker: "Munich Motion",
        text: "We have 32,000 units at EUR 3.80 each, but they are allocated to another customer. I cannot promise them.",
      },
    ],
  },
] as const

export const CANDIDATES = [
  {
    id: "supplier-skf-nordic",
    name: "SKF Nordic",
    country: "SE",
    phone: "+46******0100",
    compliance: "passed" as const,
    failedRules: [] as string[],
    supplierRecord: SUPPLIER_RECORDS[0],
    claim: CLAIMS[0],
    recordUnit: "EUR 4.20",
    recordLeadDays: "10",
    recordCertification: "IATF 16949",
    recordCertificationExpiresAt: "2026-11-30",
    recordKnownAllocations: "0",
    recordMaxHistoricalFill: "40000",
    recordStockStatus: "unclear" as StockStatus,
    claimUnit: "EUR 4.80",
    claimConfidence: "0.96",
    claimEvidence: "We can release 32,000 units from free stock.",
    claimLeadDays: "3",
    claimCertificationCurrent: "yes" as YesNoUnknown,
    stockStatus: "free_in_stock" as StockStatus,
    freight: "air",
  },
  {
    id: "supplier-schaeffler-fag",
    name: "Schaeffler FAG",
    country: "DE",
    phone: "+49*******0199",
    compliance: "passed" as const,
    failedRules: [] as string[],
    supplierRecord: SUPPLIER_RECORDS[1],
    claim: CLAIMS[1],
    recordUnit: "EUR 2.40",
    recordLeadDays: "28",
    recordCertification: "IATF 16949",
    recordCertificationExpiresAt: "2027-03-31",
    recordKnownAllocations: "0",
    recordMaxHistoricalFill: "50000",
    recordStockStatus: "unclear" as StockStatus,
    claimUnit: "EUR 2.10",
    claimConfidence: "0.93",
    claimEvidence: "The full 32,000-unit batch must be made.",
    claimLeadDays: "21",
    claimCertificationCurrent: "yes" as YesNoUnknown,
    stockStatus: "to_be_made" as StockStatus,
    freight: "sea",
  },
  {
    id: "supplier-nsk-europe",
    name: "NSK Europe",
    country: "DE",
    phone: "+49*******0200",
    compliance: "passed" as const,
    failedRules: [] as string[],
    supplierRecord: SUPPLIER_RECORDS[2],
    claim: CLAIMS[2],
    recordUnit: "EUR 3.10",
    recordLeadDays: "14",
    recordCertification: "IATF 16949",
    recordCertificationExpiresAt: "2026-08-15",
    recordKnownAllocations: "0",
    recordMaxHistoricalFill: "32000",
    recordStockStatus: "unclear" as StockStatus,
    claimUnit: "EUR 3.05",
    claimConfidence: "0.91",
    claimEvidence: "32,000 units are free for your order.",
    claimLeadDays: "14",
    claimCertificationCurrent: "yes" as YesNoUnknown,
    stockStatus: "free_in_stock" as StockStatus,
    freight: "road",
  },
  {
    id: "supplier-shenzhen-bearing",
    name: "Shenzhen Bearing Co",
    country: "CN",
    phone: "+86*******0100",
    compliance: "failed" as const,
    failedRules: ["blocked_origin_country"],
    supplierRecord: SUPPLIER_RECORDS[3],
    claim: null,
    recordUnit: "EUR 1.40",
    recordLeadDays: "35",
    recordCertification: "IATF 16949",
    recordCertificationExpiresAt: "2025-09-30",
    recordKnownAllocations: "0",
    recordMaxHistoricalFill: "60000",
    recordStockStatus: "unclear" as StockStatus,
    claimUnit: null,
    claimConfidence: null,
    claimEvidence: null,
    claimLeadDays: null,
    claimCertificationCurrent: null,
    stockStatus: null,
    freight: null,
  },
  {
    id: "supplier-munich-motion",
    name: "Munich Motion GmbH",
    country: "DE",
    phone: "+49*******0210",
    compliance: "passed" as const,
    failedRules: [] as string[],
    supplierRecord: SUPPLIER_RECORDS[4],
    claim: CLAIMS[3],
    recordUnit: "EUR 3.80",
    recordLeadDays: "2",
    recordCertification: "IATF 16949",
    recordCertificationExpiresAt: "2026-05-20",
    recordKnownAllocations: "32000",
    recordMaxHistoricalFill: "32000",
    recordStockStatus: "in_stock_allocated" as StockStatus,
    claimUnit: "EUR 3.80",
    claimConfidence: "0.98",
    claimEvidence: "The units are allocated to another customer.",
    claimLeadDays: "2",
    claimCertificationCurrent: "yes" as YesNoUnknown,
    stockStatus: "in_stock_allocated" as StockStatus,
    freight: "road",
  },
] as const

export const FIELD_DIFF_ROWS = CANDIDATES.filter(
  (candidate) => candidate.claim !== null
).map((candidate) => ({
  candidateId: candidate.id,
  supplier: candidate.name,
  recordUnit: candidate.recordUnit,
  claimUnit: candidate.claimUnit,
  recordLeadDays: candidate.recordLeadDays,
  claimLeadDays: candidate.claimLeadDays,
  recordCertification: candidate.recordCertification,
  claimCertificationCurrent: candidate.claimCertificationCurrent,
  recordKnownAllocations: candidate.recordKnownAllocations,
  recordStockStatus: candidate.recordStockStatus,
  claimStockStatus: candidate.stockStatus,
  claimConfidence: candidate.claimConfidence,
  claimEvidence: candidate.claimEvidence,
}))

export const LANDED_LINES = [
  {
    candidateId: "supplier-skf-nordic",
    supplier: "SKF Nordic",
    quantity: "32000",
    mode: "air",
    unitPrice: "EUR 4.80",
    goods: "EUR 153600.00",
    freight: "EUR 14800.00",
    duty: "EUR 0.00",
    carryingCost: "EUR 0.00",
    total: "EUR 168400.00",
    arrivalDays: "3",
    usable: true,
  },
  {
    candidateId: "supplier-schaeffler-fag",
    supplier: "Schaeffler FAG",
    quantity: "32000",
    mode: "sea",
    unitPrice: "EUR 2.10",
    goods: "EUR 67200.00",
    freight: "EUR 4000.00",
    duty: "EUR 0.00",
    carryingCost: "EUR 0.00",
    total: "EUR 71200.00",
    arrivalDays: "21",
    usable: true,
  },
  {
    candidateId: "supplier-nsk-europe",
    supplier: "NSK Europe",
    quantity: "32000",
    mode: "road",
    unitPrice: "EUR 3.05",
    goods: "EUR 97600.00",
    freight: "EUR 2100.00",
    duty: "EUR 0.00",
    carryingCost: "EUR 0.00",
    total: "EUR 99700.00",
    arrivalDays: "14",
    usable: true,
  },
  {
    candidateId: "supplier-munich-motion",
    supplier: "Munich Motion GmbH",
    quantity: "32000",
    mode: "road",
    unitPrice: "EUR 3.80",
    goods: "EUR 121600.00",
    freight: "EUR 400.00",
    duty: "EUR 0.00",
    carryingCost: "EUR 0.00",
    total: "EUR 122000.00",
    arrivalDays: "2",
    usable: false,
  },
] as const

export const STRATEGIES = [
  {
    name: "100% FAG sea",
    total: "EUR 71200.00",
    note: "Cheapest unit price. Misses the line-stop date.",
    recommended: false,
  },
  {
    name: "100% SKF air",
    total: "EUR 168400.00",
    note: "Covers the line-stop. Highest Landed Cost.",
    recommended: false,
  },
  {
    name: "SPLIT 20% SKF air + 80% FAG sea",
    total: "EUR 94880.00",
    note: "Air covers the line-stop. Sea takes the rest.",
    recommended: true,
  },
] as const

export const DECISION_STATES = [
  "evaluating",
  "on_hold",
  "needs_human_review",
  "approved",
] as const satisfies readonly DecisionState[]

export const DECISION = {
  caseId: "CASE-001",
  state: "needs_human_review" as DecisionState,
  recommendedStrategy: "SPLIT 20% SKF air + 80% FAG sea",
  total: "EUR 94880.00",
  policyCheck: "passed",
  costModelCheck: "passed",
  approval: "A human marks the Decision approved in Stockout.",
} as const

export const PR_PATH = "github.com/D4V1ND/ehl_hack/compare/case/CASE-001"

export const SCRIPT: ScriptStep[] = [
  {
    id: "part",
    stepName: "Read part",
    kind: "tool",
    method: "GET",
    path: "/tools/part/6204-2RS",
    summary: "Part 6204-2RS. part_class rotating. Weight 0.106 kg.",
    detail: "Trusted factory record. Not a Claim.",
  },
  {
    id: "stock",
    stepName: "Read stock",
    kind: "tool",
    method: "GET",
    path: "/tools/stock",
    summary: "Munich assembly plant: 8000 on hand. Reorder point breached.",
    detail: "shortfall 32000. line_stop in 12 days.",
  },
  {
    id: "suppliers",
    stepName: "List Candidates",
    kind: "tool",
    method: "GET",
    path: "/tools/suppliers",
    summary: "5 stable Candidates matched to 6204-2RS. Preferred first.",
    detail:
      "SKF Nordic, Schaeffler FAG, NSK Europe, Shenzhen Bearing Co, Munich Motion GmbH.",
  },
  {
    id: "prices",
    stepName: "Price history",
    kind: "tool",
    method: "GET",
    path: "/tools/price_history",
    summary: "Contract unit prices loaded. Shenzhen is cheapest on paper.",
    detail: "Cheapest unit price is not the Decision.",
  },
  {
    id: "policy",
    stepName: "Policy check",
    kind: "policy",
    method: "GET",
    path: "/tools/policy",
    summary: "Shenzhen Bearing Co rejected: blocked_origin_country.",
    detail: "No Outreach Task. The other four Candidates pass.",
  },
  {
    id: "outreach",
    stepName: "Outreach Tasks",
    kind: "outreach",
    method: "POST",
    path: "/tools/outreach",
    summary:
      "CALL-E batch. 4 simultaneous Outreach Tasks. Masked numbers only.",
    detail: "+46******0100, +49*******0199, +49*******0200, +49*******0210.",
  },
  {
    id: "claims",
    stepName: "Claims in",
    kind: "claims",
    summary:
      "4 Claims filed. Munich Motion stock is allocated. SKF is free_in_stock.",
    detail: "A Claim is what the supplier said. It is not a fact.",
  },
  {
    id: "deltas",
    stepName: "Claim vs record",
    kind: "deltas",
    summary: "Claim fields appear next to the separate Supplier Record fields.",
    detail: "Low-confidence or allocated stock is not used in the Strategy.",
  },
  {
    id: "strategy",
    stepName: "Strategy search",
    kind: "strategy",
    summary: "Winning Strategy is a split order. Cheapest unit price loses.",
    detail: "Air 20% SKF to cover the line-stop. Sea 80% FAG for unit economy.",
  },
  {
    id: "tests",
    stepName: "pytest green",
    kind: "tests",
    summary: "policy suite green. cost_model suite green.",
    detail: "Both suites must pass before the Decision can be approved.",
  },
  {
    id: "decision",
    stepName: "Decision ready",
    kind: "decision",
    summary: "Decision needs human review in Stockout.",
    detail: "The agent recommends. A human marks the Decision approved.",
  },
]

export const TICK_MS = 760
export const USER_PROMPT = `${BUYER_NAME}, ${INCIDENT.plantLabel}: Incident ${INCIDENT.caseId}, part ${INCIDENT.partId} ${INCIDENT.description}. qty_required ${INCIDENT.qtyRequired}, qty_on_hand ${INCIDENT.qtyOnHand}, shortfall ${INCIDENT.shortfall}, line_stop in ${INCIDENT.lineStopDays} days. Find Candidates, gather Claims, recommend a Decision.`

export type StockStatus =
  | "free_in_stock"
  | "in_stock_allocated"
  | "to_be_made"
  | "unavailable"
  | "unclear"

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

export const INCIDENT = {
  caseId: "CASE-001",
  partId: "6204-2RS",
  description: "deep-groove ball bearing (DIN 625)",
  plant: "Munich",
  qtyRequired: "40000",
  qtyOnHand: "8000",
  shortfall: "32000",
  lineStopDays: "12",
  lineStopCostPerHour: "EUR 4000.00",
} as const

export const INCIDENTS = [
  {
    caseId: "CASE-001",
    partLabel: "6204-2RS bearing",
    lineStopDays: "12",
    stage: "open" as IncidentStage,
    plant: "Munich",
    href: "/chat",
  },
  {
    caseId: "CASE-002",
    partLabel: "DIN 933 M8×40",
    lineStopDays: "21",
    stage: "calling" as IncidentStage,
    plant: "Munich",
    href: null,
  },
  {
    caseId: "CASE-003",
    partLabel: "6205-2RS bearing",
    lineStopDays: null,
    stage: "decided" as IncidentStage,
    plant: "Munich",
    href: null,
  },
  {
    caseId: "CASE-004",
    partLabel: "Hex bolt M10",
    lineStopDays: "8",
    stage: "open" as IncidentStage,
    plant: "Stuttgart",
    href: null,
  },
  {
    caseId: "CASE-005",
    partLabel: "6004-2Z bearing",
    lineStopDays: null,
    stage: "decided" as IncidentStage,
    plant: "Munich",
    href: null,
  },
] as const

export const CASE_FILES = [
  { name: "sourcing_case.yaml", ext: "yml", afterId: "part" },
  { name: "candidates.json", ext: "json", afterId: "suppliers" },
  { name: "claims/skf.json", ext: "json", afterId: "claims" },
  { name: "claims/fag.json", ext: "json", afterId: "claims" },
  { name: "cost_report.md", ext: "md", afterId: "deltas" },
  { name: "policy_report.md", ext: "md", afterId: "tests" },
  { name: "decision.md", ext: "md", afterId: "pr" },
  { name: "po_draft.md", ext: "md", afterId: "pr" },
] as const

export const CALLS = [
  {
    id: "skf",
    supplier: "SKF Nordic",
    phone: "+46******0100",
    afterId: "outreach",
    connectedLabel: "Call connected 0:22",
    claimStrip: { price: "unknown", stock: "unclear", cert: "unknown" },
    turns: [
      {
        speaker: "Agent",
        text: "I am an AI calling for Munich plant purchasing. This call is recorded. You may ask for a human at any time.",
      },
      {
        speaker: "SKF",
        text: "Understood. 6204-2RS, we have stock. What quantity?",
      },
    ],
  },
  {
    id: "munich-motion",
    supplier: "Munich Motion GmbH",
    phone: "+49*******0210",
    afterId: "claims",
    connectedLabel: "Call connected 1:04",
    claimStrip: { price: "EUR 3.80", stock: "in_stock_allocated", cert: "yes" },
    turns: [
      {
        speaker: "Agent",
        text: "Confirm stock_status: free for us, or already allocated to another customer?",
      },
      {
        speaker: "Munich Motion",
        text: "We have units, but they are allocated to another customer. I cannot promise them.",
      },
    ],
  },
] as const

export const LANDED_LINES = [
  {
    supplier: "SKF Nordic",
    mode: "air",
    goods: "EUR 153600.00",
    freight: "EUR 14800.00",
    total: "EUR 168400.00",
    usable: true,
  },
  {
    supplier: "Schaeffler FAG",
    mode: "sea",
    goods: "EUR 67200.00",
    freight: "EUR 4000.00",
    total: "EUR 71200.00",
    usable: true,
  },
  {
    supplier: "NSK Europe",
    mode: "road",
    goods: "EUR 97600.00",
    freight: "EUR 2100.00",
    total: "EUR 99700.00",
    usable: true,
  },
  {
    supplier: "Munich Motion GmbH",
    mode: "road",
    goods: "EUR 121600.00",
    freight: "EUR 400.00",
    total: "EUR 122000.00",
    usable: false,
  },
] as const

export const CANDIDATES = [
  {
    name: "SKF Nordic",
    country: "SE",
    phone: "+46******0100",
    compliance: "passed" as const,
    failedRules: [] as string[],
    recordUnit: "EUR 4.20",
    recordLeadDays: "10",
    claimUnit: "EUR 4.80",
    claimLeadDays: "3",
    stockStatus: "free_in_stock" as StockStatus,
    freight: "air",
  },
  {
    name: "Schaeffler FAG",
    country: "DE",
    phone: "+49*******0199",
    compliance: "passed" as const,
    failedRules: [] as string[],
    recordUnit: "EUR 2.40",
    recordLeadDays: "28",
    claimUnit: "EUR 2.10",
    claimLeadDays: "21",
    stockStatus: "to_be_made" as StockStatus,
    freight: "sea",
  },
  {
    name: "NSK Europe",
    country: "DE",
    phone: "+49*******0200",
    compliance: "passed" as const,
    failedRules: [] as string[],
    recordUnit: "EUR 3.10",
    recordLeadDays: "14",
    claimUnit: "EUR 3.05",
    claimLeadDays: "14",
    stockStatus: "free_in_stock" as StockStatus,
    freight: "road",
  },
  {
    name: "Shenzhen Bearing Co",
    country: "CN",
    phone: "+86*******0100",
    compliance: "failed" as const,
    failedRules: ["blocked_origin_country"],
    recordUnit: "EUR 1.40",
    recordLeadDays: "35",
    claimUnit: null,
    claimLeadDays: null,
    stockStatus: null,
    freight: null,
  },
  {
    name: "Munich Motion GmbH",
    country: "DE",
    phone: "+49*******0210",
    compliance: "passed" as const,
    failedRules: [] as string[],
    recordUnit: "EUR 3.80",
    recordLeadDays: "2",
    claimUnit: "EUR 3.80",
    claimLeadDays: "2",
    stockStatus: "in_stock_allocated" as StockStatus,
    freight: "road",
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
    summary: "Munich plant: 8000 on hand. Reorder point already breached.",
    detail: "shortfall 32000. line_stop in 12 days.",
  },
  {
    id: "suppliers",
    stepName: "List Candidates",
    kind: "tool",
    method: "GET",
    path: "/tools/suppliers",
    summary: "5 Candidates matched to 6204-2RS. Preferred first.",
    detail: "SKF Nordic, Schaeffler FAG, NSK Europe, Shenzhen Bearing Co, Munich Motion GmbH.",
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
    stepName: "Outreach Task",
    kind: "outreach",
    method: "POST",
    path: "/tools/outreach",
    summary: "CALL-E batch. 4 recipients. Masked numbers only.",
    detail: "+46******0100, +49*******0199, +49*******0200, +49*******0210.",
  },
  {
    id: "claims",
    stepName: "Claims in",
    kind: "claims",
    summary: "4 Claims filed. Munich Motion stock is allocated. SKF is free_in_stock.",
    detail: "A Claim is what the supplier said. It is not a fact.",
  },
  {
    id: "deltas",
    stepName: "Claim vs record",
    kind: "deltas",
    summary: "Claim unit price and lead time next to the Supplier Record.",
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
    detail: "Both suites must pass before the pull request opens.",
  },
  {
    id: "pr",
    stepName: "Open PR",
    kind: "decision",
    summary: "Decision written. Pull request case/CASE-001 is ready for human merge.",
    detail: PR_PATH,
  },
]

export const TICK_MS = 760
export const USER_PROMPT = `Munich plant: Incident ${INCIDENT.caseId}, part ${INCIDENT.partId} ${INCIDENT.description}. qty_required ${INCIDENT.qtyRequired}, qty_on_hand ${INCIDENT.qtyOnHand}, shortfall ${INCIDENT.shortfall}, line_stop in ${INCIDENT.lineStopDays} days. Find Candidates, gather Claims, recommend a Decision.`

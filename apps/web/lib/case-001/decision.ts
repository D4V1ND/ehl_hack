import type { DecisionState, LandedLine } from "@/lib/case-001/types"

export const LANDED_LINES: readonly LandedLine[] = [
  {
    candidateId: "supplier-kby",
    supplier: "Kugellager Bayern GmbH",
    quantity: "12000",
    mode: "road",
    unitPrice: "EUR 1.49",
    goods: "EUR 17876.40",
    freight: "EUR 1407.60",
    duty: "EUR 0.00",
    carryingCost: "EUR 95.81",
    total: "EUR 19379.81",
    arrivalDays: "12",
    usable: true,
  },
  {
    candidateId: "supplier-rul",
    supplier: "Rulmenti Est SRL",
    quantity: "36000",
    mode: "road",
    unitPrice: "EUR 1.31",
    goods: "EUR 47113.20",
    freight: "EUR 4222.80",
    duty: "EUR 0.00",
    carryingCost: "EUR 287.42",
    total: "EUR 51623.42",
    arrivalDays: "24",
    usable: true,
  },
  {
    candidateId: "supplier-skf",
    supplier: "SKF Deutschland Vertrieb GmbH",
    quantity: "8000",
    mode: "road",
    unitPrice: "EUR 2.19",
    goods: "EUR 17496.80",
    freight: "EUR 938.40",
    duty: "EUR 0.00",
    carryingCost: "EUR 63.87",
    total: "EUR 18499.07",
    arrivalDays: "6",
    usable: true,
  },
]

export const STRATEGIES = [
  {
    name: "100% Rulmenti Est road",
    total: "EUR 51623.42",
    note: "Cheapest unit price. Misses the line-stop date by 12 days.",
  },
  {
    name: "SPLIT 8,000 SKF + 28,000 Rulmenti",
    total: "EUR 58650.00",
    note: "Fast stock covers the line-stop. Highest Landed Cost.",
  },
  {
    name: "SPLIT 5,000 Kugellager Bayern bridge + 31,000 Rulmenti",
    total: "EUR 50117.30",
    note: "The bridge covers the line-stop. Recommended.",
  },
] as const

export const DECISION_STATES = [
  "researching",
  "ready",
  "recorded",
] as const satisfies readonly DecisionState[]

export const DECISION = {
  caseId: "CASE-001",
  state: "ready" as DecisionState,
  selectedCandidateId: null,
  policyCheck: "passed",
  costModelCheck: "passed",
  recordedAt: null,
  recordedBy: null,
} as const

export const PR_PATH = "github.com/D4V1ND/ehl_hack/compare/case/CASE-001"

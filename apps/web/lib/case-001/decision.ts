import type { DecisionState } from "@/lib/case-001/types"

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
  approval: "A human marks the Decision approved in SupplyOS.",
} as const

export const PR_PATH = "github.com/D4V1ND/ehl_hack/compare/case/CASE-001"

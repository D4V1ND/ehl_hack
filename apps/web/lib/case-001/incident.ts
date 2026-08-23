import type { IncidentStage } from "@/lib/case-001/types"

export const BUYER_NAME = "German automotive manufacturer"

export const INCIDENT = {
  caseId: "CASE-001",
  partId: "6204-2RS",
  description: "deep-groove ball bearing (DIN 625-1)",
  plant: "Munich",
  plants: ["Munich"],
  plantLabel: "Munich assembly plant, line ASSY-3",
  qtyRequired: "36000",
  qtyOnHand: "4200",
  shortfall: "31800",
  lineStopDays: "12",
  lineStopCostPerHour: "EUR 18400.00",
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
  { name: "claims/kugellager-bayern.json", ext: "json", afterId: "claims" },
  { name: "claims/rulmenti-est.json", ext: "json", afterId: "claims" },
  { name: "claims/skf-deutschland.json", ext: "json", afterId: "claims" },
  { name: "cost_report.md", ext: "md", afterId: "deltas" },
  { name: "policy_report.md", ext: "md", afterId: "tests" },
  { name: "decision.md", ext: "md", afterId: "pr" },
  { name: "po_draft.md", ext: "md", afterId: "pr" },
] as const

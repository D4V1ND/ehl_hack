import { BUYER_NAME, INCIDENT } from "@/lib/case-001/incident"
import type { ScriptStep } from "@/lib/case-001/types"

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
    summary: "Decision needs human review in SupplyOS.",
    detail: "The agent recommends. A human marks the Decision approved.",
  },
]

export const TICK_MS = 760
export const FINAL_MESSAGE =
  "I recommend the split Strategy: 20% SKF air and 80% FAG sea. The Decision is ready for human review."
export const USER_PROMPT = `${BUYER_NAME}, ${INCIDENT.plantLabel}: Incident ${INCIDENT.caseId}, part ${INCIDENT.partId} ${INCIDENT.description}. qty_required ${INCIDENT.qtyRequired}, qty_on_hand ${INCIDENT.qtyOnHand}, shortfall ${INCIDENT.shortfall}, line_stop in ${INCIDENT.lineStopDays} days. Find Candidates, gather Claims, recommend a Decision.`

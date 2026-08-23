import { BUYER_NAME, INCIDENT } from "@/lib/case-001/incident"
import type { ScriptStep } from "@/lib/case-001/types"

export const SCRIPT: ScriptStep[] = [
  {
    id: "part",
    stepName: "Read part",
    kind: "tool",
    waitMs: 1100,
    method: "GET",
    path: "/tools/part/6204-2RS",
    summary: "Part 6204-2RS. part_class rotating. Weight 0.106 kg.",
    detail: "Trusted factory record. Not a Claim.",
  },
  {
    id: "stock",
    stepName: "Read stock",
    kind: "tool",
    waitMs: 1600,
    method: "GET",
    path: "/tools/stock",
    summary: "Munich assembly plant: 8000 on hand. Reorder point breached.",
    detail: "shortfall 32000. line_stop in 12 days.",
  },
  {
    id: "suppliers",
    stepName: "List Candidates",
    kind: "tool",
    waitMs: 2200,
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
    waitMs: 1400,
    method: "GET",
    path: "/tools/price_history",
    summary: "Contract unit prices loaded. Shenzhen is cheapest on paper.",
    detail: "Cheapest unit price is not the Decision.",
  },
  {
    id: "policy",
    stepName: "Policy check",
    kind: "policy",
    waitMs: 1800,
    method: "GET",
    path: "/tools/policy",
    summary: "Shenzhen Bearing Co rejected: blocked_origin_country.",
    detail: "No Outreach Task. The other four Candidates pass.",
  },
  {
    id: "web-skf",
    stepName: "Search SKF Nordic",
    kind: "tool",
    waitMs: 2100,
    method: "GET",
    path: "/tools/web/search?q=SKF+Nordic+6204-2RS",
    summary: "Public SKF pages lack live allocation and quoted unit price.",
    detail:
      "Certification is public. Current free stock and price need a Claim.",
  },
  {
    id: "outreach-skf",
    stepName: "Call SKF Nordic",
    kind: "outreach",
    waitMs: 900,
    method: "POST",
    path: "/tools/outreach/skf",
    callId: "skf",
    summary: "A calling agent started the SKF Nordic Outreach Task.",
    detail: "Voice · +46******0100 · rehearsal only.",
  },
  {
    id: "web-fag",
    stepName: "Search Schaeffler FAG",
    kind: "tool",
    waitMs: 1800,
    method: "GET",
    path: "/tools/web/search?q=Schaeffler+FAG+6204-2RS",
    summary: "Public FAG pages confirm the part, but not the production slot.",
    detail: "Current quantity, readiness, and price still need a Claim.",
  },
  {
    id: "outreach-fag",
    stepName: "Call Schaeffler FAG",
    kind: "outreach",
    waitMs: 900,
    method: "POST",
    path: "/tools/outreach/fag",
    callId: "fag",
    summary: "A calling agent started the Schaeffler FAG Outreach Task.",
    detail: "Voice · +49*******0199 · rehearsal only.",
  },
  {
    id: "web-nsk",
    stepName: "Search NSK Europe",
    kind: "tool",
    waitMs: 2600,
    method: "GET",
    path: "/tools/web/search?q=NSK+Europe+6204-2RS",
    summary:
      "NSK publishes every required field. Website Claim filed; call skipped.",
    detail:
      "32,000 free units · EUR 3.05 · 14 days · part and certification confirmed. Fixture source retained as evidence.",
  },
  {
    id: "web-munich",
    stepName: "Search Munich Motion",
    kind: "tool",
    waitMs: 1700,
    method: "GET",
    path: "/tools/web/search?q=Munich+Motion+6204-2RS",
    summary: "Munich Motion lists price, but current allocation is unclear.",
    detail: "A call must separate free stock from stock allocated elsewhere.",
  },
  {
    id: "outreach-munich-motion",
    stepName: "Call Munich Motion",
    kind: "outreach",
    waitMs: 900,
    method: "POST",
    path: "/tools/outreach/munich-motion",
    callId: "munich-motion",
    summary: "A calling agent started the Munich Motion Outreach Task.",
    detail: "Voice · +49*******0210 · rehearsal only.",
  },
  {
    id: "claims",
    stepName: "Claims in",
    kind: "claims",
    waitMs: 0,
    summary:
      "3 call Claims and 1 website Claim filed. Munich Motion stock is allocated.",
    detail: "Every Claim retains its source. A Claim is not a trusted fact.",
  },
  {
    id: "deltas",
    stepName: "Claim vs record",
    kind: "deltas",
    waitMs: 1800,
    summary: "Claim fields appear next to the separate Supplier Record fields.",
    detail: "Low-confidence or allocated stock is not used in the Strategy.",
  },
  {
    id: "strategy",
    stepName: "Strategy checks",
    kind: "strategy",
    waitMs: 2200,
    summary: "Comparable Strategies are costed. No Candidate is chosen.",
    detail: "The human uses verified Claims and Landed Costs for the Decision.",
  },
  {
    id: "tests",
    stepName: "Checks complete",
    kind: "tests",
    waitMs: 1900,
    summary: "policy suite green. cost_model suite green.",
    detail: "Both suites must pass before a human records the Decision.",
  },
]

export const FINAL_MESSAGE =
  "Research is complete. Compare the ready Candidates and record your Decision."
export const SEND_DELAY_MS = 1500
export const STREAM_TICK_MS = 32
export const STREAM_CHARS_PER_TICK = 3
export const STEP_SETTLE_DELAY_MS = 260

export function getStepResponse(step: ScriptStep): string {
  return step.summary
}
export const USER_PROMPT = `${BUYER_NAME}, ${INCIDENT.plantLabel}: Incident ${INCIDENT.caseId}, part ${INCIDENT.partId} ${INCIDENT.description}. qty_required ${INCIDENT.qtyRequired}, qty_on_hand ${INCIDENT.qtyOnHand}, shortfall ${INCIDENT.shortfall}, line_stop in ${INCIDENT.lineStopDays} days. Find Candidates, gather Claims, and prepare the evidence for my Decision.`

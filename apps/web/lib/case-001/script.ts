import { BUYER_NAME, INCIDENT } from "@/lib/case-001/incident"
import type { ScriptStep } from "@/lib/case-001/types"

export const SCRIPT: ScriptStep[] = [
  {
    id: "incident",
    planStepId: "intake:incident",
    stepName: "Read incident",
    kind: "tool",
    waitMs: 1100,
    method: "GET",
    path: "/cases/CASE-001",
    summary:
      "PO-2291 (30,000 pcs, Kugellager Bayern) slipped to 2026-09-17. On-hand covers 12 days.",
    detail: "ASSY-3 takes 350/day. Line stops 2026-09-03 at EUR 18,400/h.",
  },
  {
    id: "part",
    planStepId: "erp:part",
    stepName: "Read part",
    kind: "tool",
    waitMs: 1100,
    method: "GET",
    path: "/tools/part/PRT-6204",
    summary:
      "Part 6204-2RS, deep-groove ball bearing, DIN 625-1. 20×47×14 mm, sealed, C3.",
    detail: "Trusted factory record: 0.106 kg, HS 8482.10. Not a Claim.",
  },
  {
    id: "stock",
    planStepId: "erp:stock",
    stepName: "Read stock",
    kind: "tool",
    waitMs: 1600,
    method: "GET",
    path: "/tools/stock",
    summary: "Munich plant: 4,200 on hand against 36,000 required.",
    detail: "shortfall 31,800. line_stop in 12 days.",
  },
  {
    id: "open-pos",
    planStepId: "erp:open_pos",
    stepName: "Open POs",
    kind: "tool",
    waitMs: 1300,
    method: "GET",
    path: "/tools/open_pos",
    summary: "One open PO covers 30,000 pcs — and now lands two weeks late.",
    detail: "No other delivery is scheduled before the line-stop date.",
  },
  {
    id: "prices",
    planStepId: "erp:price_history",
    stepName: "Price history",
    kind: "tool",
    waitMs: 1400,
    method: "GET",
    path: "/tools/price_history",
    summary: "We paid EUR 1.38–1.52 per piece over the last four quarters.",
    detail: "Cheapest unit price is not the Decision.",
  },
  {
    id: "suppliers",
    planStepId: "suppliers:list",
    stepName: "List Candidates",
    kind: "tool",
    waitMs: 2200,
    method: "GET",
    path: "/tools/suppliers",
    summary: "6 registered suppliers carry 6204-2RS. Incumbent first.",
    detail:
      "Kugellager Bayern, Ningbo Precision, Pulman AG, Rulmenti Est, NordBearing, SKF Deutschland.",
  },
  {
    id: "policy",
    planStepId: "screening:policy",
    stepName: "Policy check",
    kind: "policy",
    waitMs: 1800,
    method: "GET",
    path: "/tools/policy",
    summary:
      "3 of 6 rejected: Ningbo (blocked origin), Pulman (DIN 625 lapsed), NordBearing (never audited).",
    detail:
      "No Outreach Task for a rejected Candidate. Kugellager Bayern, Rulmenti Est and SKF pass.",
  },
  {
    id: "outreach-kby",
    planStepId: "outreach:SUP-KBY",
    stepName: "Call Kugellager Bayern",
    kind: "outreach",
    waitMs: 900,
    method: "POST",
    path: "/tools/outreach/SUP-KBY",
    callId: "kby",
    summary: "A calling agent started the Kugellager Bayern Outreach Task.",
    detail: "Voice · +49*******0142 · rehearsal only.",
  },
  {
    id: "outreach-rul",
    planStepId: "outreach:SUP-RUL",
    stepName: "Call Rulmenti Est",
    kind: "outreach",
    waitMs: 900,
    method: "POST",
    path: "/tools/outreach/SUP-RUL",
    callId: "rul",
    summary: "A calling agent started the Rulmenti Est Outreach Task.",
    detail: "Voice · +49*******0163 · rehearsal only.",
  },
  {
    id: "outreach-skf",
    planStepId: "outreach:SUP-SKF",
    stepName: "Call SKF Deutschland",
    kind: "outreach",
    waitMs: 900,
    method: "POST",
    path: "/tools/outreach/SUP-SKF",
    callId: "skf",
    summary: "A calling agent started the SKF Deutschland Outreach Task.",
    detail: "Voice · +49*******0117 · rehearsal only.",
  },
  {
    id: "claims",
    planStepId: "claims:normalise",
    stepName: "Claims in",
    kind: "claims",
    waitMs: 0,
    summary:
      "3 call Claims filed. Kugellager Bayern bridges 12,000; Rulmenti makes the lot in 24 days; SKF has 8,000 on the shelf.",
    detail: "Every Claim retains its source. A Claim is not a trusted fact.",
  },
  {
    id: "deltas",
    planStepId: "costing:landed",
    stepName: "Claim vs record",
    kind: "deltas",
    waitMs: 1800,
    summary: "Claim fields appear next to the separate Supplier Record fields.",
    detail: "Low-confidence or allocated stock is not used in the Strategy.",
  },
  {
    id: "strategy",
    planStepId: "costing:landed",
    stepName: "Strategy checks",
    kind: "strategy",
    waitMs: 2200,
    summary:
      "7 Strategies costed, split orders included. No Candidate is chosen.",
    detail:
      "Recommended: 5,000 bridge from Kugellager Bayern + 31,000 from Rulmenti Est — EUR 50,117.30 landed.",
  },
  {
    id: "tests",
    planStepId: "review:package",
    stepName: "Checks complete",
    kind: "tests",
    waitMs: 1900,
    summary: "policy suite green. cost_model suite green. Review package written.",
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

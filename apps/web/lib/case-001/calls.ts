import { CLAIMS } from "@/lib/case-001/claims"
import type { CallStatus, RehearsalCall } from "@/lib/case-001/types"

const AI_DISCLOSURE = `I am an AI assistant calling on behalf of a German automotive manufacturer. This call is recorded. I cannot agree to a price, quantity, or delivery commitment. A human makes the Decision. Ask for a human or ask me to stop at any time.`

const SKF_TRANSCRIPT = [
  { speaker: "Agent", text: AI_DISCLOSURE },
  {
    speaker: "SKF Nordic",
    text: "Understood. I can help with current availability for that bearing.",
  },
  {
    speaker: "Agent",
    text: "Please confirm part 6204-2RS, quantity available, whether the stock is free, earliest readiness, unit price, and current IATF certification.",
  },
  {
    speaker: "SKF Nordic",
    text: "We can release 32,000 units from free stock in 3 days at EUR 4.80 each. The IATF 16949 certificate is current.",
  },
  {
    speaker: "Agent",
    text: "To confirm: 32,000 free units, ready in 3 days, EUR 4.80 each, exact part confirmed, and certification current?",
  },
  { speaker: "SKF Nordic", text: "That is correct." },
] as const

const FAG_TRANSCRIPT = [
  { speaker: "Agent", text: AI_DISCLOSURE },
  {
    speaker: "Schaeffler FAG",
    text: "I understand. What quantity and delivery window do you need?",
  },
  {
    speaker: "Agent",
    text: "We need 32,000 units of 6204-2RS. Please state current stock, earliest readiness, unit price, and certification status.",
  },
  {
    speaker: "Schaeffler FAG",
    text: "The units are not in stock today. We can make the full 32,000-unit batch in 21 days at EUR 2.10 each.",
  },
  {
    speaker: "Agent",
    text: "Please confirm the exact part number and that the IATF 16949 certificate remains current.",
  },
  {
    speaker: "Schaeffler FAG",
    text: "Both are confirmed. The stock status is to be made, not in stock.",
  },
] as const

const MUNICH_MOTION_TRANSCRIPT = [
  { speaker: "Agent", text: AI_DISCLOSURE },
  {
    speaker: "Munich Motion",
    text: "Understood. We show 32,000 units at the Munich warehouse.",
  },
  {
    speaker: "Agent",
    text: "Confirm stock status: free for this order, or already allocated to another customer?",
  },
  {
    speaker: "Munich Motion",
    text: "They are allocated to another customer. I cannot promise those units.",
  },
  {
    speaker: "Agent",
    text: "Please confirm the record: EUR 3.80 each, 2-day handling, exact 6204-2RS part, but no free quantity.",
  },
  {
    speaker: "Munich Motion",
    text: "Correct. The price and certification are current, but the stock is not available to you.",
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
    transcript: SKF_TRANSCRIPT,
    turns: SKF_TRANSCRIPT,
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
    transcript: FAG_TRANSCRIPT,
    turns: FAG_TRANSCRIPT,
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
    claimStrip: { price: "EUR 3.80", stock: "in_stock_allocated", cert: "yes" },
    claim: CLAIMS[3],
    confidence: CLAIMS[3].confidence,
    evidence: CLAIMS[3].evidence,
    transcript: MUNICH_MOTION_TRANSCRIPT,
    turns: MUNICH_MOTION_TRANSCRIPT,
  },
] as const

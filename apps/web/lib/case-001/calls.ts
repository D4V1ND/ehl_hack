import { CLAIMS } from "@/lib/case-001/claims"
import type { CallStatus, RehearsalCall } from "@/lib/case-001/types"

const AI_DISCLOSURE = `I am an AI assistant calling on behalf of a German automotive manufacturer. This call is recorded. I cannot agree to a price, quantity, or delivery commitment. A human makes the Decision. Ask for a human or ask me to stop at any time.`

const KBY_TRANSCRIPT = [
  { speaker: "Agent", text: AI_DISCLOSURE },
  {
    speaker: "Kugellager Bayern",
    text: "Understood. You are calling about the slipped order, I assume?",
  },
  {
    speaker: "Agent",
    text: "Yes. PO-2291 now lands two weeks late. Please state what you can ship of 6204-2RS before then: quantity, earliest readiness, unit price, and certification status.",
  },
  {
    speaker: "Kugellager Bayern",
    text: "We can release 12,000 pieces from free stock in 12 days at EUR 1.49 each. The rest stays on the delayed order. ISO 9001 and DIN 625 conformity are current.",
  },
  {
    speaker: "Agent",
    text: "To confirm: 12,000 free pieces, ready in 12 days, EUR 1.49 each, exact part confirmed, certification current?",
  },
  { speaker: "Kugellager Bayern", text: "That is correct." },
] as const

const RUL_TRANSCRIPT = [
  { speaker: "Agent", text: AI_DISCLOSURE },
  {
    speaker: "Rulmenti Est",
    text: "I understand. What quantity and delivery window do you need?",
  },
  {
    speaker: "Agent",
    text: "We need 36,000 pieces of 6204-2RS. Please state current stock, earliest readiness, unit price, and certification status.",
  },
  {
    speaker: "Rulmenti Est",
    text: "Nothing is on the shelf, but we can produce the full 36,000-piece batch in 24 days at EUR 1.31 each.",
  },
  {
    speaker: "Agent",
    text: "Please confirm the exact part number and that ISO 9001 and DIN 625 conformity remain current.",
  },
  {
    speaker: "Rulmenti Est",
    text: "Both are confirmed. The stock status is to be made, not in stock.",
  },
] as const

const SKF_TRANSCRIPT = [
  { speaker: "Agent", text: AI_DISCLOSURE },
  {
    speaker: "SKF Deutschland",
    text: "Understood. We show 8,000 pieces of 6204-2RS in the Schweinfurt warehouse.",
  },
  {
    speaker: "Agent",
    text: "Confirm stock status: free for this order, earliest readiness, and the unit price at that volume.",
  },
  {
    speaker: "SKF Deutschland",
    text: "The 8,000 pieces are free stock, out the door in 6 days, at EUR 2.19 each. More than that has to come from the plant.",
  },
  {
    speaker: "Agent",
    text: "To confirm: 8,000 free pieces, 6 days, EUR 2.19 each, exact part confirmed, certification current?",
  },
  { speaker: "SKF Deutschland", text: "Correct on all points." },
] as const

export const CALLS: readonly RehearsalCall[] = [
  {
    id: "kby",
    supplier: "Kugellager Bayern GmbH",
    supplierRef: "SUP-KBY",
    candidateId: "supplier-kby",
    phone: "+49*******0142",
    maskedPhone: "+49*******0142",
    status: "completed" as CallStatus,
    duration: "01:36",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:36",
    claimStrip: { price: "EUR 1.49", stock: "free_in_stock", cert: "yes" },
    claim: CLAIMS[0],
    confidence: CLAIMS[0].confidence,
    evidence: CLAIMS[0].evidence,
    transcript: KBY_TRANSCRIPT,
    turns: KBY_TRANSCRIPT,
  },
  {
    id: "rul",
    supplier: "Rulmenti Est SRL",
    supplierRef: "SUP-RUL",
    candidateId: "supplier-rul",
    phone: "+49*******0163",
    maskedPhone: "+49*******0163",
    status: "completed" as CallStatus,
    duration: "01:48",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:48",
    claimStrip: { price: "EUR 1.31", stock: "to_be_made", cert: "yes" },
    claim: CLAIMS[1],
    confidence: CLAIMS[1].confidence,
    evidence: CLAIMS[1].evidence,
    transcript: RUL_TRANSCRIPT,
    turns: RUL_TRANSCRIPT,
  },
  {
    id: "skf",
    supplier: "SKF Deutschland Vertrieb GmbH",
    supplierRef: "SUP-SKF",
    candidateId: "supplier-skf",
    phone: "+49*******0117",
    maskedPhone: "+49*******0117",
    status: "completed" as CallStatus,
    duration: "01:04",
    afterId: "outreach" as const,
    connectedLabel: "Call completed 1:04",
    claimStrip: { price: "EUR 2.19", stock: "free_in_stock", cert: "yes" },
    claim: CLAIMS[2],
    confidence: CLAIMS[2].confidence,
    evidence: CLAIMS[2].evidence,
    transcript: SKF_TRANSCRIPT,
    turns: SKF_TRANSCRIPT,
  },
] as const

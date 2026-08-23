import { CLAIMS } from "@/lib/case-001/claims"
import type { CallStatus, RehearsalCall } from "@/lib/case-001/types"

const AI_DISCLOSURE = `I am an AI assistant calling on behalf of a German automotive manufacturer. This call is recorded. I cannot agree to a price, quantity, or delivery commitment. A human makes the Decision. Ask for a human or ask me to stop at any time.`

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
    claimStrip: { price: "EUR 3.80", stock: "in_stock_allocated", cert: "yes" },
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

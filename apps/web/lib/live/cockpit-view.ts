import type { LivePlan, LiveStepStatus } from "./plan";
import type { CaseEvent, CaseSnapshot, Claim } from "./types";

export type CockpitStepItem = {
  kind: "step";
  id: string;
  label: string;
  status: LiveStepStatus;
  detail: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type CockpitCallItem = {
  kind: "call";
  id: string;
  supplierRef: string;
  supplierName: string;
  status: LiveStepStatus;
  taskId: string | null;
  phoneMasked: string | null;
  startedAt: string | null;
  completedAt: string | null;
  detail: string | null;
  claim: CockpitClaimView | null;
};

export type CockpitClaimView = {
  available: boolean;
  quantityOffered: number;
  unitPrice: { amount: string; currency: string } | null;
  priceBreaks: { minQty: number; unitPrice: string }[];
  moq: number | null;
  leadTimeDays: number | null;
  earliestReady: string | null;
  incoterm: string | null;
  paymentTerms: string | null;
  stockStatus: string;
  priceQuoted: string;
  partNumberConfirmed: string;
  certificationCurrent: string;
  confidence: number;
  summary: string | null;
  evidence: string[];
  transcript: { offsetSeconds: number; speaker: string; text: string }[];
  transcriptUrl: string | null;
  recordingUrl: string | null;
};

export type CockpitViewItem = CockpitStepItem | CockpitCallItem;

export type CockpitViewSection = {
  group: string;
  label: string;
  status: LiveStepStatus;
  defaultOpen: boolean;
  items: CockpitViewItem[];
};

export type CockpitView = {
  sections: CockpitViewSection[];
};

export function buildCockpitView(
  snapshot: CaseSnapshot | null,
  plan: LivePlan | null,
  events: readonly CaseEvent[],
): CockpitView {
  if (!plan) return { sections: [] };

  const candidateByRef = new Map(
    snapshot?.candidates.map((candidate) => [
      candidate.supplier_ref,
      candidate,
    ]),
  );
  const recordByRef = new Map(
    snapshot?.supplier_records.map((record) => [record.supplier_id, record]),
  );
  const taskByRef = new Map(
    snapshot?.outreach_tasks.map((task) => [task.supplier_ref, task]),
  );
  const claimByRef = new Map(
    snapshot?.claims.map((claim) => [claim.supplier_ref, claim]),
  );
  const latestEventByRef = new Map<string, CaseEvent>();
  for (const event of events) {
    const supplierRef = event.payload.supplier_ref;
    if (typeof supplierRef === "string") {
      latestEventByRef.set(supplierRef, event);
    }
  }

  const sections = plan.sections.flatMap((section) => {
    const items = section.steps
      .filter((step) => step.status !== "pending")
      .map((step): CockpitViewItem => {
        if (section.group === "outreach" && step.supplier_ref) {
          const supplierRef = step.supplier_ref;
          const candidate = candidateByRef.get(supplierRef);
          const record = recordByRef.get(supplierRef);
          const task = taskByRef.get(supplierRef);
          const claim = claimByRef.get(supplierRef);
          const event = latestEventByRef.get(supplierRef);

          return {
            kind: "call",
            id: step.step_id,
            supplierRef,
            supplierName:
              candidate?.supplier_name ??
              record?.supplier_name ??
              step.label.replace(/^Calling\s+/, ""),
            status: step.status,
            taskId: task?.task_id ?? claim?.task_id ?? null,
            phoneMasked: record?.phone_masked ?? null,
            startedAt: step.started_at,
            completedAt: step.completed_at,
            detail: event?.message ?? step.detail,
            claim: claim ? buildClaimView(claim) : null,
          };
        }

        return {
          kind: "step",
          id: step.step_id,
          label: step.label,
          status: step.status,
          detail: step.detail,
          startedAt: step.started_at,
          completedAt: step.completed_at,
        };
      });

    if (items.length === 0) return [];

    return [
      {
        group: section.group,
        label: section.label,
        status: section.status ?? "pending",
        defaultOpen:
          section.status === "active" ||
          items.some((item) => item.id === plan.active_step_id),
        items,
      },
    ];
  });

  return { sections };
}

function buildClaimView(claim: Claim): CockpitClaimView {
  return {
    available: claim.available,
    quantityOffered: claim.qty_offered,
    unitPrice: claim.unit_price
      ? { amount: claim.unit_price, currency: claim.currency }
      : null,
    priceBreaks: claim.price_breaks.map((priceBreak) => ({
      minQty: priceBreak.min_qty,
      unitPrice: priceBreak.unit_price,
    })),
    moq: claim.moq,
    leadTimeDays: claim.lead_time_days,
    earliestReady: textOrNull(claim.earliest_ready_text),
    incoterm: claim.incoterm,
    paymentTerms: claim.payment_terms,
    stockStatus: claim.stock_status,
    priceQuoted: claim.price_quoted,
    partNumberConfirmed: claim.part_number_confirmed,
    certificationCurrent: claim.certification_current,
    confidence: claim.confidence,
    summary: textOrNull(claim.summary),
    evidence: [...claim.evidence],
    transcript: claim.transcript.map((turn) => ({
      offsetSeconds: turn.offset_seconds,
      speaker: turn.speaker,
      text: turn.text,
    })),
    transcriptUrl: claim.transcript_url,
    recordingUrl: claim.recording_url,
  };
}

function textOrNull(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

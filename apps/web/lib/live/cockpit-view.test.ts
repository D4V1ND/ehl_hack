import assert from "node:assert/strict";
import test from "node:test";

import { buildCockpitView } from "./cockpit-view";
import type { LivePlan } from "./plan";
import type { CaseSnapshot } from "./types";

test("shows only activity that has started", () => {
  const plan: LivePlan = {
    case_id: "CASE-001",
    active_step_id: "outreach:SUP-KBY",
    done: 1,
    total: 4,
    sections: [
      {
        group: "erp",
        label: "ERP records",
        status: "pending",
        steps: [
          {
            step_id: "erp:part",
            group: "erp",
            label: "Read the part record",
            status: "pending",
            detail: null,
            supplier_ref: null,
            dynamic: false,
            started_at: null,
            completed_at: null,
          },
        ],
      },
      {
        group: "outreach",
        label: "Supplier outreach",
        status: "active",
        steps: [
          {
            step_id: "outreach:brief",
            group: "outreach",
            label: "Write the call brief",
            status: "done",
            detail: "36,000 pcs by 2026-09-03",
            supplier_ref: null,
            dynamic: false,
            started_at: "2026-08-23T09:00:00Z",
            completed_at: "2026-08-23T09:01:00Z",
          },
          {
            step_id: "outreach:SUP-KBY",
            group: "outreach",
            label: "Calling Kugellager Bayern GmbH",
            status: "active",
            detail: null,
            supplier_ref: "SUP-KBY",
            dynamic: true,
            started_at: "2026-08-23T09:02:00Z",
            completed_at: null,
          },
          {
            step_id: "outreach:SUP-SKF",
            group: "outreach",
            label: "Calling SKF Deutschland Vertrieb GmbH",
            status: "pending",
            detail: null,
            supplier_ref: "SUP-SKF",
            dynamic: true,
            started_at: null,
            completed_at: null,
          },
        ],
      },
    ],
  };

  const view = buildCockpitView(null, plan, []);

  assert.deepEqual(
    view.sections.map((section) => ({
      group: section.group,
      defaultOpen: section.defaultOpen,
      itemIds: section.items.map((item) => item.id),
    })),
    [
      {
        group: "outreach",
        defaultOpen: true,
        itemIds: ["outreach:brief", "outreach:SUP-KBY"],
      },
    ],
  );
});

test("builds an active calling card from live supplier data", () => {
  const snapshot: CaseSnapshot = {
    case_id: "CASE-001",
    stage: "calling",
    incident: {
      case_id: "CASE-001",
      part_id: "PRT-6204",
      plant_id: "PLANT-MUC",
      production_line: "ASSY-3",
      qty_required: 36_000,
      qty_on_hand: 4_200,
      needed_by: "2026-09-03",
      line_stop_at: "2026-09-03T06:00:00Z",
      line_stop_cost_per_hour: "18400.00",
      currency: "EUR",
    },
    part: {
      part_id: "PRT-6204",
      item_code: "6204-2RS",
      item_name: "Deep-groove ball bearing",
      description: "DIN 625-1",
      spec: { bore: "20 mm" },
      stock_uom: "Nos",
      criticality: "high",
      part_class: "rolling_bearing",
      weight_kg: 0.102,
      hs_code: "8482.10.10",
      standard_cost: "1.42",
    },
    profile_summary: {},
    candidates: [
      {
        case_id: "CASE-001",
        supplier_ref: "SUP-KBY",
        supplier_name: "Kugellager Bayern GmbH",
        country: "DE",
        confidence: 0.96,
        channel: "voice",
        source: "erp",
        compliance: { passed: true, failed_rules: [] },
        why_matched: "Approved incumbent",
      },
    ],
    supplier_records: [
      {
        supplier_id: "SUP-KBY",
        supplier_name: "Kugellager Bayern GmbH",
        country: "DE",
        phone_masked: "+49******1234",
      },
    ],
    outreach_tasks: [
      {
        task_id: "TASK-KBY",
        case_id: "CASE-001",
        supplier_ref: "SUP-KBY",
        channel: "voice",
        brief: {
          part_spec: "6204-2RS / DIN 625-1",
          qty: 36_000,
          needed_by: "2026-09-03",
          target_price: "1.42",
          floor_price: null,
          must_ask: ["price_breaks", "stock_status"],
        },
      },
    ],
    claims: [],
    decision: null,
    devin_session_url: null,
    last_event_seq: 11,
  };
  const plan: LivePlan = {
    case_id: "CASE-001",
    active_step_id: "outreach:SUP-KBY",
    done: 1,
    total: 2,
    sections: [
      {
        group: "outreach",
        label: "Supplier outreach",
        status: "active",
        steps: [
          {
            step_id: "outreach:SUP-KBY",
            group: "outreach",
            label: "Calling Kugellager Bayern GmbH",
            status: "active",
            detail: null,
            supplier_ref: "SUP-KBY",
            dynamic: true,
            started_at: "2026-08-23T09:02:00Z",
            completed_at: null,
          },
        ],
      },
    ],
  };

  const view = buildCockpitView(snapshot, plan, [
    {
      seq: 11,
      case_id: "CASE-001",
      ts: "2026-08-23T09:02:05Z",
      actor: "calle",
      stage: "calling",
      level: "info",
      message: "Outreach started for Kugellager Bayern GmbH",
      payload: { supplier_ref: "SUP-KBY" },
    },
  ]);
  const item = view.sections[0]?.items[0];

  assert.deepEqual(item, {
    kind: "call",
    id: "outreach:SUP-KBY",
    supplierRef: "SUP-KBY",
    supplierName: "Kugellager Bayern GmbH",
    status: "active",
    taskId: "TASK-KBY",
    phoneMasked: "+49******1234",
    startedAt: "2026-08-23T09:02:00Z",
    completedAt: null,
    detail: "Outreach started for Kugellager Bayern GmbH",
    claim: null,
  });
});

test("exposes only available completed Claim evidence and transcript data", () => {
  const snapshot = {
    case_id: "CASE-001",
    candidates: [
      {
        supplier_ref: "SUP-KBY",
        supplier_name: "Kugellager Bayern GmbH",
      },
    ],
    supplier_records: [
      {
        supplier_id: "SUP-KBY",
        supplier_name: "Kugellager Bayern GmbH",
        phone_masked: "+49******1234",
      },
    ],
    outreach_tasks: [],
    claims: [
      {
        task_id: "TASK-KBY",
        case_id: "CASE-001",
        supplier_ref: "SUP-KBY",
        available: true,
        qty_offered: 12_000,
        unit_price: "1.4897",
        price_breaks: [{ min_qty: 10_000, unit_price: "1.4897" }],
        currency: "EUR",
        moq: null,
        lead_time_days: 8,
        expedite_option: null,
        incoterm: "DAP",
        certs_claimed: ["ISO_9001"],
        payment_terms: null,
        notes: "",
        transcript: [
          {
            offset_seconds: 0,
            speaker: "bot",
            text: "You are speaking with an AI calling assistant.",
          },
          {
            offset_seconds: 12,
            speaker: "user",
            text: "Twelve thousand are free next week.",
          },
        ],
        summary: "12,000 pieces available next week.",
        transcript_url: "https://example.test/transcript/TASK-KBY",
        recording_url: null,
        confidence: 0.73,
        raw: {},
        round: 1,
        call_id: "CALL-KBY",
        earliest_ready_text: "Next week",
        stock_status: "free_in_stock",
        price_quoted: "yes",
        part_number_confirmed: "yes",
        certification_current: "unknown",
        evidence: ["Twelve thousand are free next week."],
        received_at: "2026-08-23T09:05:00Z",
      },
    ],
  } as unknown as CaseSnapshot;
  const plan: LivePlan = {
    case_id: "CASE-001",
    active_step_id: null,
    done: 1,
    total: 1,
    sections: [
      {
        group: "outreach",
        label: "Supplier outreach",
        status: "done",
        steps: [
          {
            step_id: "outreach:SUP-KBY",
            group: "outreach",
            label: "Calling Kugellager Bayern GmbH",
            status: "done",
            detail: null,
            supplier_ref: "SUP-KBY",
            dynamic: true,
            started_at: "2026-08-23T09:02:00Z",
            completed_at: "2026-08-23T09:05:00Z",
          },
        ],
      },
    ],
  };

  const view = buildCockpitView(snapshot, plan, []);
  const item = view.sections[0]?.items[0];

  assert.equal(view.sections[0]?.defaultOpen, false);
  assert.equal(item?.kind, "call");
  if (item?.kind !== "call") assert.fail("expected a call item");
  assert.deepEqual(item.claim, {
    available: true,
    quantityOffered: 12_000,
    unitPrice: { amount: "1.4897", currency: "EUR" },
    priceBreaks: [{ minQty: 10_000, unitPrice: "1.4897" }],
    moq: null,
    leadTimeDays: 8,
    earliestReady: "Next week",
    incoterm: "DAP",
    paymentTerms: null,
    stockStatus: "free_in_stock",
    priceQuoted: "yes",
    partNumberConfirmed: "yes",
    certificationCurrent: "unknown",
    confidence: 0.73,
    summary: "12,000 pieces available next week.",
    evidence: ["Twelve thousand are free next week."],
    transcript: [
      {
        offsetSeconds: 0,
        speaker: "bot",
        text: "You are speaking with an AI calling assistant.",
      },
      {
        offsetSeconds: 12,
        speaker: "user",
        text: "Twelve thousand are free next week.",
      },
    ],
    transcriptUrl: "https://example.test/transcript/TASK-KBY",
    recordingUrl: null,
  });
});

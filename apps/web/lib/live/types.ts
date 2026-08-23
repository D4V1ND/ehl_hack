import type {
  Candidate,
  CaseSnapshot,
  Event,
  Incident,
  Part,
  PriceBreak,
  SupplierRecord,
} from "@supplyos/contracts";

export type { CaseSnapshot, Incident, Part, PriceBreak, SupplierRecord };

/** SupplyOS presents the API's Candidate contract as a live workspace row. */
export type LiveCandidate = Candidate;

/** Event payloads are always materialized by the API read endpoint. */
export type CaseEvent = Omit<Event, "payload"> & {
  payload: Record<string, unknown>;
};

export type SessionInfo = {
  session_id: string | null;
  session_url: string | null;
  stubbed: boolean;
  error: string | null;
};

export type LiveStrategyLine = {
  supplier_ref: string;
  qty: number;
  eta: string;
};

export type LiveStrategy = {
  strategy_id: string;
  label: string;
  total_cost: string;
  unit_effective: string;
  coverage_date: string;
  meets_line_stop: boolean;
  recommended: boolean;
  suppliers: LiveStrategyLine[];
};

export type LiveDecision = {
  recommended_strategy_id: string;
  options: LiveStrategy[];
  pr_url: string | null;
  approval: string;
};

export type LiveFlowState = {
  case_id: string;
  stage: string;
  message: string;
  at: string;
  events: number;
  candidates: number;
  claims: string[];
  decision: LiveDecision | null;
};

export type CaseEvent = {
  seq: number;
  case_id: string;
  ts: string;
  actor: string;
  stage: string;
  level: string;
  message: string;
  payload: Record<string, unknown>;
};

export type Incident = {
  case_id: string;
  part_id: string;
  plant_id: string;
  production_line: string;
  qty_required: number;
  qty_on_hand: number;
  needed_by: string;
  line_stop_at: string;
  line_stop_cost_per_hour: string;
  currency?: string;
  incumbent_supplier_id?: string | null;
  reason?: string;
};

export type Part = {
  part_id: string;
  item_code: string;
  item_name: string;
  description: string;
  spec: Record<string, string>;
  stock_uom: string;
  criticality: string;
  part_class: string;
  weight_kg: number;
  hs_code: string;
  standard_cost: string;
};

export type LiveCandidate = {
  case_id: string;
  supplier_ref: string;
  supplier_name: string;
  country: string;
  confidence: number;
  channel: string;
  source: string;
  compliance: {
    passed: boolean;
    failed_rules: string[];
    explanations?: Record<string, string>;
  };
  why_matched: string;
};

export type PriceBreak = {
  min_qty: number;
  unit_price: string;
};

export type SupplierRecord = {
  supplier_id: string;
  supplier_name: string;
  country: string;
  locale?: string;
  phone_masked: string;
  email?: string | null;
  marketplace_url?: string | null;
  channels?: string[];
  part_ids?: string[];
  approved?: boolean;
  preferred?: boolean;
  incumbent?: boolean;
  contract_unit_price?: string | null;
  standard_lead_days?: number | null;
  certifications?: string[];
  certification_expires_at?: string | null;
  audit_status?: string;
  known_allocations?: number;
  max_historical_fill?: number;
  price_breaks?: PriceBreak[];
};

export type OutreachBrief = {
  part_spec: string;
  qty: number;
  needed_by: string;
  target_price: string | null;
  floor_price: string | null;
  must_ask: string[];
};

export type OutreachTask = {
  task_id: string;
  case_id: string;
  supplier_ref: string;
  channel: string;
  brief: OutreachBrief;
};

export type TranscriptTurn = {
  offset_seconds: number;
  speaker: string;
  text: string;
};

export type ExpediteOption = {
  days: number;
  surcharge: string;
};

export type Claim = {
  task_id: string;
  case_id: string;
  supplier_ref: string;
  available: boolean;
  qty_offered: number;
  unit_price: string | null;
  price_breaks: PriceBreak[];
  currency: string;
  moq: number | null;
  lead_time_days: number | null;
  expedite_option: ExpediteOption | null;
  incoterm: string | null;
  certs_claimed: string[];
  payment_terms: string | null;
  notes: string;
  transcript: TranscriptTurn[];
  summary: string;
  transcript_url: string | null;
  recording_url: string | null;
  confidence: number;
  raw: Record<string, unknown>;
  round: number;
  call_id: string | null;
  earliest_ready_text: string;
  stock_status: string;
  price_quoted: string;
  part_number_confirmed: string;
  certification_current: string;
  evidence: string[];
  received_at: string | null;
};

export type LandedCost = {
  supplier_ref: string;
  qty: number;
  mode: string;
  goods_cost: string;
  freight: string;
  duty: string;
  tooling: string;
  carrying_cost: string;
  expedite_surcharge: string;
  total: string;
  unit_effective: string;
  breakdown_md: string;
};

export type OrderLine = {
  supplier_ref: string;
  supplier_name: string;
  qty: number;
  mode: string;
  eta: string;
  landed: LandedCost;
};

export type Strategy = {
  strategy_id: string;
  label: string;
  lines: OrderLine[];
  total_cost: string;
  unit_effective: string;
  coverage_date: string;
  meets_line_stop: boolean;
  risk_score: number;
  rationale: string;
};

export type Decision = {
  case_id: string;
  strategies: Strategy[];
  recommended_strategy_id: string | null;
  runner_up_ids: string[];
  rationale_md: string;
  policy_report_url: string | null;
  cost_report_url: string | null;
  pr_url: string | null;
  devin_session_url: string | null;
  decided_at: string | null;
};

export type CaseSummary = {
  case_id: string;
  part_id: string;
  item_name: string;
  stage: string;
  qty_required: number;
  line_stop_at: string;
  opened_at: string;
  pr_url: string | null;
};

export type OpenedCase = {
  case_id: string;
  incident: Incident;
  session_id: string;
  session_url: string;
  stubbed: boolean;
  session_error: string | null;
};

export type CaseSnapshot = {
  case_id: string;
  stage: string;
  incident: Incident;
  part: Part;
  profile_summary: Record<string, unknown>;
  candidates: LiveCandidate[];
  supplier_records: SupplierRecord[];
  outreach_tasks: OutreachTask[];
  claims: Claim[];
  decision: Decision | null;
  devin_session_url: string | null;
  last_event_seq: number;
};

export type SessionInfo = {
  session_id: string | null;
  session_url: string | null;
  stubbed: boolean;
  error: string | null;
};

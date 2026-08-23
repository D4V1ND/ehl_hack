export type CaseEvent = {
  seq: number
  case_id: string
  ts: string
  actor: string
  stage: string
  level: string
  message: string
  payload: Record<string, unknown>
}

export type Incident = {
  case_id: string
  part_id: string
  plant_id: string
  production_line: string
  qty_required: number
  qty_on_hand: number
  needed_by: string
  line_stop_at: string
  line_stop_cost_per_hour: string
  currency?: string
  incumbent_supplier_id?: string | null
  reason?: string
}

export type Part = {
  part_id: string
  item_code: string
  item_name: string
  description: string
}

export type LiveCandidate = {
  supplier_ref: string
  supplier_name: string
  country: string
  compliance: {
    passed: boolean
    failed_rules: string[]
  }
  why_matched: string
}

export type OpenedCase = {
  case_id: string
  incident: Incident
  session_id: string
  session_url: string
  stubbed: boolean
  session_error: string | null
}

export type CaseSnapshot = {
  case_id: string
  stage: string
  incident: Incident
  part: Part
  candidates?: LiveCandidate[]
  last_event_seq?: number
}

export type SessionInfo = {
  session_id: string | null
  session_url: string | null
  stubbed: boolean
  error: string | null
}

export type LiveStrategyLine = {
  supplier_ref: string
  qty: number
  eta: string
}

export type LiveStrategy = {
  strategy_id: string
  label: string
  total_cost: string
  unit_effective: string
  coverage_date: string
  meets_line_stop: boolean
  recommended: boolean
  suppliers: LiveStrategyLine[]
}

export type LiveDecision = {
  recommended_strategy_id: string
  options: LiveStrategy[]
  pr_url: string | null
  approval: string
}

export type LiveFlowState = {
  case_id: string
  stage: string
  message: string
  at: string
  events: number
  candidates: number
  claims: string[]
  decision: LiveDecision | null
}

/** Slice 1 domain types: Incident in, Event out. Money is always a string. */

export type Incident = {
  case_id: string
  part_id: string
  part_description?: string
  qty_required: number
  qty_on_hand: number
  line_stop_at: string
  /** Decimal string, never a float. */
  line_stop_cost_per_hour: string
  /** Decimal string, never a float. */
  expedite_fee: string
  currency: string
}

export type EventLevel = "info" | "warn" | "error"

export type CaseEvent = {
  case_id: string
  ts: string
  actor: string
  stage: string
  level: EventLevel
  message: string
  payload: Record<string, unknown>
}

export type CaseRecord = {
  case_id: string
  incident: Incident
  created_at: string
  session_id: string | null
  session_url: string | null
}

export function shortfall(incident: Incident): number {
  return Math.max(incident.qty_required - incident.qty_on_hand, 0)
}

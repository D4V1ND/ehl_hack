import type { Level, Stage, StockStatus } from "@/lib/contracts"

/**
 * The stage language.
 *
 * Five stages, five pastels from DESIGN.md, used identically in the event dock,
 * the section rail and the case header. One colour, one meaning, everywhere --
 * so a viewer learns the vocabulary once and then reads the rest of the page
 * without a legend.
 */
export const STAGES: {
  id: Stage
  label: string
  dot: string
  pill: string
}[] = [
  { id: "detected", label: "Detected", dot: "bg-timeline-thinking", pill: "bg-timeline-thinking text-ink" },
  { id: "researching", label: "Researching", dot: "bg-timeline-grep", pill: "bg-timeline-grep text-ink" },
  { id: "calling", label: "Calling", dot: "bg-timeline-read", pill: "bg-timeline-read text-ink" },
  { id: "costing", label: "Costing", dot: "bg-timeline-edit", pill: "bg-timeline-edit text-ink" },
  { id: "decided", label: "Decided", dot: "bg-timeline-done", pill: "bg-timeline-done text-on-primary" },
]

export const STAGE_INDEX: Record<Stage, number> = {
  detected: 0,
  researching: 1,
  calling: 2,
  costing: 3,
  decided: 4,
}

export function stageMeta(stage: Stage) {
  return STAGES[STAGE_INDEX[stage]] ?? STAGES[0]
}

export const LEVEL_STYLE: Record<Level, string> = {
  info: "text-body",
  warn: "text-semantic-warning",
  error: "text-semantic-error",
}

/**
 * `in_stock_allocated` gets the loud treatment on purpose: "yes, we have some"
 * meaning "yes, but not for you" is the single most useful thing a call
 * uncovers, and a yes/no availability field would never have caught it.
 */
export const STOCK_STATUS: Record<StockStatus, { label: string; className: string }> = {
  free_in_stock: {
    label: "Free in stock",
    className: "border-semantic-success/35 bg-semantic-success/10 text-semantic-success",
  },
  in_stock_allocated: {
    label: "In stock — allocated",
    className: "border-semantic-warning/40 bg-semantic-warning/12 text-semantic-warning",
  },
  to_be_made: {
    label: "To be made",
    className: "border-hairline-strong bg-canvas-soft text-body",
  },
  unavailable: {
    label: "Unavailable",
    className: "border-semantic-error/35 bg-semantic-error/10 text-semantic-error",
  },
  unclear: {
    label: "Unclear",
    className: "border-hairline-strong bg-canvas-soft text-muted-ink",
  },
}

export const POLICY_RULE_LABEL: Record<string, string> = {
  blocked_origin_country: "Blocked origin country",
  missing_required_certification: "Missing required certification",
  audit_required_and_not_audited: "Audit required, not audited",
  lead_time_after_line_stop: "Lead time after line stop",
}

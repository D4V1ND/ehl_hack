export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010"
).replace(/\/$/, "")

export const LIVE = process.env.NEXT_PUBLIC_DATA_SOURCE === "live"

export const CASE_ID = process.env.NEXT_PUBLIC_CASE_ID ?? "CASE-001"

/** Supplier left uncalled by a replayed run, e.g. the one dialled live on stage. */
export const HOLD_FOR = process.env.NEXT_PUBLIC_HOLD_FOR ?? ""

/** Dwell per checklist step when this UI triggers a run, so the list moves at watching speed. */
export const PACE_MS = Number(process.env.NEXT_PUBLIC_PACE_MS ?? "1500")

export const PLAN_POLL_MS = 1000

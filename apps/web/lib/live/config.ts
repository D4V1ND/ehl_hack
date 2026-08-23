export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010"
).replace(/\/$/, "");

const ERP_BASE = (
  process.env.NEXT_PUBLIC_ERP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Cases originate in the mock ERP, then hand off to SupplyOS. */
export const ERP_INVENTORY_URL = `${ERP_BASE}/inventory`;

export const PLAN_POLL_MS = 1000;

export const EVENT_POLL_MS = 2000;

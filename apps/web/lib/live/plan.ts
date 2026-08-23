import { API_BASE } from "@/lib/live/config";

export type LiveStepStatus =
  "pending" | "active" | "done" | "failed" | "skipped";

export type LivePlanStep = {
  step_id: string;
  group: string;
  label: string;
  status: LiveStepStatus;
  detail: string | null;
  supplier_ref: string | null;
  dynamic: boolean;
  started_at: string | null;
  completed_at: string | null;
};

export type LivePlanSection = {
  group: string;
  label: string;
  status?: LiveStepStatus;
  steps: LivePlanStep[];
};

export type LivePlan = {
  case_id: string;
  sections: LivePlanSection[];
  active_step_id: string | null;
  done: number;
  total: number;
};

export async function fetchPlan(caseId: string): Promise<LivePlan | null> {
  const response = await fetch(
    `${API_BASE}/cases/${encodeURIComponent(caseId)}/plan`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return (await response.json()) as LivePlan;
}

import { API_BASE } from "@/lib/live/config";
import type {
  CaseEvent,
  CaseSnapshot,
  LiveFlowState,
  SessionInfo,
} from "@/lib/live/types";

async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCase(caseId: string): Promise<CaseSnapshot | null> {
  const response = await fetch(
    `${API_BASE}/cases/${encodeURIComponent(caseId)}`,
    {
      cache: "no-store",
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      await readError(response, `GET /cases/${caseId} -> ${response.status}`),
    );
  }
  return (await response.json()) as CaseSnapshot;
}

export async function fetchEvents(
  caseId: string,
  since = 0,
): Promise<CaseEvent[]> {
  const response = await fetch(
    `${API_BASE}/cases/${encodeURIComponent(caseId)}/events?since=${since}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `GET /cases/${caseId}/events -> ${response.status}`,
      ),
    );
  }
  return (await response.json()) as CaseEvent[];
}

/** The latest priced buyer package and flow progress, if pricing has started. */
export async function fetchFlowState(
  caseId: string,
): Promise<LiveFlowState | null> {
  const response = await fetch(
    `${API_BASE}/flow/state?case_id=${encodeURIComponent(caseId)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      await readError(response, `GET /flow/state -> ${response.status}`),
    );
  }
  return (await response.json()) as LiveFlowState;
}

export function caseArtifactUrl(caseId: string, name: string): string {
  return `${API_BASE}/cases/${encodeURIComponent(caseId)}/artifacts/${encodeURIComponent(name)}`;
}

export function sessionFromEvents(events: CaseEvent[]): SessionInfo | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const payload = events[index].payload;
    if (typeof payload.session_url !== "string") continue;
    return {
      session_id:
        typeof payload.session_id === "string" ? payload.session_id : null,
      session_url: payload.session_url,
      stubbed: payload.stubbed === true,
      error: typeof payload.error === "string" ? payload.error : null,
    };
  }
  return null;
}

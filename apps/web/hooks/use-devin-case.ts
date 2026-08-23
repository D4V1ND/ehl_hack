"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchCase, fetchEvents, sessionFromEvents } from "@/lib/live/api";
import { resolveChecklist } from "@/lib/live/checklist";
import { EVENT_POLL_MS } from "@/lib/live/config";
import { fetchPlan, type LivePlan } from "@/lib/live/plan";
import type {
  CaseEvent,
  CaseSnapshot,
  LiveCandidate,
  SessionInfo,
} from "@/lib/live/types";

export type DevinCaseStatus = "idle" | "loading" | "live" | "stubbed" | "error";

type DevinCaseState = {
  status: DevinCaseStatus;
  error: string | null;
  caseId: string | null;
  snapshot: CaseSnapshot | null;
  events: CaseEvent[];
  plan: LivePlan | null;
  session: SessionInfo | null;
};

const EMPTY: DevinCaseState = {
  status: "idle",
  error: null,
  caseId: null,
  snapshot: null,
  events: [],
  plan: null,
  session: null,
};

function statusFromSession(session: SessionInfo | null): DevinCaseStatus {
  if (!session) return "live";
  return session.stubbed ? "stubbed" : "live";
}

export function useDevinCase(caseIdFromUrl: string | null) {
  const [state, setState] = useState<DevinCaseState>(EMPTY);

  const loadCase = useCallback(
    async (caseId: string): Promise<DevinCaseState> => {
      const [snapshot, events, plan] = await Promise.all([
        fetchCase(caseId),
        fetchEvents(caseId),
        fetchPlan(caseId),
      ]);
      const session = sessionFromEvents(events);
      return {
        status: statusFromSession(session),
        error: session?.error ?? null,
        caseId,
        snapshot,
        events,
        plan,
        session,
      };
    },
    [],
  );

  useEffect(() => {
    if (!caseIdFromUrl) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState({ ...EMPTY, status: "loading", caseId: caseIdFromUrl });

    const load = async () => {
      try {
        const next = await loadCase(caseIdFromUrl);
        if (!cancelled) setState(next);
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error ? cause.message : "Could not load the case";
        setState({ ...EMPTY, status: "error", error: message });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [caseIdFromUrl, loadCase]);

  const eventsRef = useRef<CaseEvent[]>([]);
  eventsRef.current = state.events;

  useEffect(() => {
    const caseId = state.caseId;
    if (!caseId || state.status === "error" || state.status === "loading") {
      return;
    }
    let cancelled = false;

    const tick = async () => {
      try {
        const since = eventsRef.current.at(-1)?.seq ?? 0;
        const [snapshot, fresh, plan] = await Promise.all([
          fetchCase(caseId),
          fetchEvents(caseId, since),
          fetchPlan(caseId),
        ]);
        if (cancelled) return;
        setState((current) => {
          if (current.caseId !== caseId) return current;
          const events =
            fresh.length > 0 ? [...current.events, ...fresh] : current.events;
          const session = sessionFromEvents(events) ?? current.session;
          return {
            ...current,
            snapshot,
            events,
            plan,
            session,
            status: statusFromSession(session),
            error: session?.error ?? current.error,
          };
        });
      } catch {
        // Keep the last good feed. The next tick retries.
      }
    };

    const interval = window.setInterval(() => void tick(), EVENT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [state.caseId, state.status]);

  const candidates: readonly LiveCandidate[] = state.snapshot?.candidates ?? [];
  const checklist = state.plan
    ? resolveChecklist(state.plan, candidates)
    : null;

  return {
    ...state,
    candidates,
    checklist,
  };
}

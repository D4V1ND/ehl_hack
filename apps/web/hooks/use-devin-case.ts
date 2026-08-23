"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchCase,
  fetchEvents,
  fetchFlowState,
  sessionFromEvents,
} from "@/lib/live/api";
import { resolveChecklist } from "@/lib/live/checklist";
import { EVENT_POLL_MS } from "@/lib/live/config";
import { fetchPlan, type LivePlan } from "@/lib/live/plan";
import type {
  CaseEvent,
  CaseSnapshot,
  LiveCandidate,
  LiveDecision,
  LiveFlowState,
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
  decision: LiveDecision | null;
  flow: LiveFlowState | null;
};

const EMPTY: DevinCaseState = {
  status: "idle",
  error: null,
  caseId: null,
  snapshot: null,
  events: [],
  plan: null,
  session: null,
  decision: null,
  flow: null,
};

function statusFromSession(session: SessionInfo | null): DevinCaseStatus {
  if (!session) return "live";
  return session.stubbed ? "stubbed" : "live";
}

export function useDevinCase(caseIdFromUrl: string | null) {
  const [state, setState] = useState<DevinCaseState>(EMPTY);

  const loadCase = useCallback(
    async (caseId: string): Promise<DevinCaseState> => {
      const [snapshot, events, plan, flow] = await Promise.all([
        fetchCase(caseId),
        fetchEvents(caseId),
        fetchPlan(caseId),
        fetchFlowState(caseId).catch(() => null),
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
        decision: flow?.decision ?? null,
        flow,
      };
    },
    [],
  );

  useEffect(() => {
    if (!caseIdFromUrl) return;
    let cancelled = false;

    const load = async () => {
      try {
        const next = await loadCase(caseIdFromUrl);
        if (!cancelled) setState(next);
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error ? cause.message : "Could not load the case";
        setState({
          ...EMPTY,
          status: "error",
          error: message,
          caseId: caseIdFromUrl,
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [caseIdFromUrl, loadCase]);

  const eventsRef = useRef<CaseEvent[]>([]);
  useEffect(() => {
    eventsRef.current = state.events;
  }, [state.events]);

  useEffect(() => {
    const caseId = state.caseId;
    if (!caseId || state.status === "error" || state.status === "loading")
      return;
    let cancelled = false;

    const tick = async () => {
      try {
        const since = eventsRef.current.at(-1)?.seq ?? 0;
        const [snapshot, fresh, plan, flow] = await Promise.all([
          fetchCase(caseId),
          fetchEvents(caseId, since),
          fetchPlan(caseId),
          fetchFlowState(caseId).catch(() => null),
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
            decision: flow?.decision ?? current.decision,
            flow: flow ?? current.flow,
            status: statusFromSession(session),
            error: session?.error ?? current.error,
          };
        });
      } catch {
        // Preserve the last good view. The next polling interval retries.
      }
    };

    const interval = window.setInterval(() => void tick(), EVENT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [state.caseId, state.status]);

  const visibleState: DevinCaseState = !caseIdFromUrl
    ? EMPTY
    : state.caseId === caseIdFromUrl
      ? state
      : { ...EMPTY, status: "loading", caseId: caseIdFromUrl };
  const candidates: readonly LiveCandidate[] =
    visibleState.snapshot?.candidates ?? [];
  const checklist = visibleState.plan
    ? resolveChecklist(visibleState.plan, candidates)
    : null;

  return {
    ...visibleState,
    candidates,
    checklist,
  };
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { CockpitShell } from "@/components/cockpit/cockpit-shell";
import { IncidentHeader } from "@/components/cockpit/incident-header";
import { LiveCandidatePanel } from "@/components/cockpit/live-candidate-panel";
import {
  MessageComposer,
  type ComposerState,
} from "@/components/cockpit/message-composer";
import { PlanChecklist } from "@/components/cockpit/plan-checklist";
import { SessionSidebar } from "@/components/cockpit/session-sidebar";
import { useDevinCase } from "@/hooks/use-devin-case";
import { buildCockpitView } from "@/lib/live/cockpit-view";

const COMPOSER_STATE: ComposerState = {
  status: "disabled",
  reason: "Follow-up messaging is not connected yet.",
};

export function CockpitChat() {
  return (
    <Suspense fallback={null}>
      <DevinCockpit />
    </Suspense>
  );
}

function DevinCockpit() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseFromUrl = searchParams.get("case");
  const devin = useDevinCase(caseFromUrl);
  const { status, launch } = devin;
  const [candidatesOpen, setCandidatesOpen] = useState(true);
  const [message, setMessage] = useState("");
  const cockpitView = useMemo(
    () => buildCockpitView(devin.snapshot, devin.plan, devin.events),
    [devin.events, devin.plan, devin.snapshot],
  );

  useEffect(() => {
    if (caseFromUrl || status !== "idle") return;
    void launch().then((caseId) => {
      if (caseId) router.replace(`/chat?case=${encodeURIComponent(caseId)}`);
    });
  }, [caseFromUrl, launch, router, status]);

  async function startNewSession() {
    const caseId = await devin.launch();
    if (caseId) router.replace(`/chat?case=${encodeURIComponent(caseId)}`);
  }

  function selectSession(caseId: string) {
    router.replace(`/chat?case=${encodeURIComponent(caseId)}`, {
      scroll: false,
    });
  }

  const incident = devin.snapshot?.incident ?? null;
  const part = devin.snapshot?.part ?? null;

  return (
    <CockpitShell
      leftSidebar={
        <SessionSidebar
          sessions={devin.cases}
          activeCaseId={devin.caseId}
          launching={devin.status === "launching"}
          onSelectSession={selectSession}
          onNewSession={() => void startNewSession()}
        />
      }
      rightSidebar={
        candidatesOpen ? (
          <LiveCandidatePanel
            candidates={devin.candidates}
            supplierRecords={devin.snapshot?.supplier_records ?? []}
            onClose={() => setCandidatesOpen(false)}
          />
        ) : undefined
      }
    >
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <IncidentHeader
          caseId={devin.caseId}
          incident={incident}
          part={part}
          sessionUrl={devin.session?.session_url ?? null}
          stubbed={devin.status === "stubbed"}
          running={devin.status === "launching"}
          onReplay={() => void startNewSession()}
          showOpenCandidates={!candidatesOpen}
          onOpenCandidates={() => setCandidatesOpen(true)}
        />
        <Conversation className="min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-3xl gap-4 px-3 py-4 sm:px-4"
            scrollClassName="chat-scrollbar overflow-x-hidden overflow-y-auto"
          >
            <SessionBanner
              status={devin.status}
              error={devin.error}
              sessionUrl={devin.session?.session_url ?? null}
            />
            <PlanChecklist
              view={cockpitView}
              launching={devin.status === "launching"}
            />
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <MessageComposer
          value={message}
          state={COMPOSER_STATE}
          onChange={setMessage}
          onSend={() => undefined}
        />
      </div>
    </CockpitShell>
  );
}

function SessionBanner({
  status,
  error,
  sessionUrl,
}: {
  status: string;
  error: string | null;
  sessionUrl: string | null;
}) {
  if (status === "idle" || status === "launching") return null;
  if (status === "error") {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? "The API did not start a Devin session."}
      </p>
    );
  }
  if (status === "stubbed") {
    return (
      <p className="text-sm text-amber-600">
        Case is open, but Devin was stubbed. Set <code>DEVIN_API_KEY</code> on
        the API and start a new session.
        {error ? ` ${error}` : ""}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Devin session is live
      {sessionUrl ? (
        <>
          {" · "}
          <a
            href={sessionUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            open session
          </a>
        </>
      ) : null}
    </p>
  );
}

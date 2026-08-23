"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { CockpitShell } from "@/components/cockpit/cockpit-shell";
import { IncidentHeader } from "@/components/cockpit/incident-header";
import { LiveCandidatePanel } from "@/components/cockpit/live-candidate-panel";
import { PlanChecklist } from "@/components/cockpit/plan-checklist";
import { useDevinCase } from "@/hooks/use-devin-case";
import { ERP_INVENTORY_URL } from "@/lib/live/config";

export function CockpitChat() {
  return (
    <Suspense fallback={null}>
      <DevinCockpit />
    </Suspense>
  );
}

function DevinCockpit() {
  const searchParams = useSearchParams();
  const caseFromUrl = searchParams.get("case");
  const devin = useDevinCase(caseFromUrl);
  const [candidatesOpen, setCandidatesOpen] = useState(true);

  const incident = devin.snapshot?.incident ?? null;
  const part = devin.snapshot?.part ?? null;

  return (
    <CockpitShell
      rightSidebar={
        caseFromUrl && candidatesOpen ? (
          <LiveCandidatePanel
            candidates={devin.candidates}
            supplierRecords={devin.snapshot?.supplier_records ?? []}
            onClose={() => setCandidatesOpen(false)}
          />
        ) : undefined
      }
    >
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <IncidentHeader
          caseId={devin.caseId}
          incident={incident}
          part={part}
          sessionUrl={devin.session?.session_url ?? null}
          stubbed={devin.status === "stubbed"}
          showOpenCandidates={!candidatesOpen}
          onOpenCandidates={() => setCandidatesOpen(true)}
        />
        <Conversation className="min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-[50vw] gap-4 px-4 py-4"
            scrollClassName="chat-scrollbar overflow-x-hidden overflow-y-auto"
          >
            <SessionBanner
              hasCase={Boolean(caseFromUrl)}
              status={devin.status}
              error={devin.error}
              sessionUrl={devin.session?.session_url ?? null}
            />
            {caseFromUrl ? <PlanChecklist plan={devin.checklist} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>
    </CockpitShell>
  );
}

function SessionBanner({
  hasCase,
  status,
  error,
  sessionUrl,
}: {
  hasCase: boolean;
  status: string;
  error: string | null;
  sessionUrl: string | null;
}) {
  if (!hasCase) {
    return (
      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-5">
        <h1 className="text-base font-medium">Start in ERP</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          SupplyOS opens a sourcing workspace after ERP identifies a shortage.
          Select a part in the mock ERP to create and hand off a case.
        </p>
        <a
          href={ERP_INVENTORY_URL}
          className="w-fit text-sm font-medium underline underline-offset-4"
        >
          Open ERP inventory
        </a>
      </div>
    );
  }
  if (status === "idle" || status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading case…</p>;
  }
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

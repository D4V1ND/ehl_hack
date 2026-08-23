"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { CockpitShell } from "@/components/cockpit/cockpit-shell"
import { DecisionPanel } from "@/components/cockpit/decision-panel"
import { IncidentHeader } from "@/components/cockpit/incident-header"
import { LiveCandidatePanel } from "@/components/cockpit/live-candidate-panel"
import { PlanChecklist } from "@/components/cockpit/plan-checklist"
import { useDevinCase } from "@/hooks/use-devin-case"

export function CockpitChat() {
  return (
    <Suspense fallback={null}>
      <DevinCockpit />
    </Suspense>
  )
}

function DevinCockpit() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const caseFromUrl = searchParams.get("case")
  const devin = useDevinCase(caseFromUrl)
  const { status, launch } = devin
  const [candidatesOpen, setCandidatesOpen] = useState(true)

  useEffect(() => {
    if (caseFromUrl || status !== "idle") return
    void launch().then((caseId) => {
      if (caseId) router.replace(`/chat?case=${encodeURIComponent(caseId)}`)
    })
  }, [caseFromUrl, launch, router, status])

  async function startNewSession() {
    const caseId = await devin.launch()
    if (caseId) router.replace(`/chat?case=${encodeURIComponent(caseId)}`)
  }

  const incident = devin.snapshot?.incident ?? null
  const part = devin.snapshot?.part ?? null

  return (
    <CockpitShell
      rightSidebar={
        candidatesOpen ? (
          <LiveCandidatePanel
            candidates={devin.candidates}
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
          running={devin.status === "launching"}
          onReplay={() => void startNewSession()}
          showOpenCandidates={!candidatesOpen}
          onOpenCandidates={() => setCandidatesOpen(true)}
        />
        <Conversation className="min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-[50vw] gap-4 px-4 py-4"
            scrollClassName="chat-scrollbar overflow-x-hidden overflow-y-auto"
          >
            <SessionBanner
              status={devin.status}
              error={devin.error}
              sessionUrl={devin.session?.session_url ?? null}
            />
            <PlanChecklist
              plan={devin.checklist}
              launching={devin.status === "launching"}
            />
            <DecisionPanel
              decision={devin.decision}
              candidates={devin.candidates}
              caseId={devin.caseId}
            />
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>
    </CockpitShell>
  )
}

function SessionBanner({
  status,
  error,
  sessionUrl,
}: {
  status: string
  error: string | null
  sessionUrl: string | null
}) {
  if (status === "idle" || status === "launching") return null
  if (status === "error") {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? "The API did not start a Devin session."}
      </p>
    )
  }
  if (status === "stubbed") {
    return (
      <p className="text-sm text-amber-600">
        Case is open, but Devin was stubbed. Set{" "}
        <code>DEVIN_API_KEY</code> on the API and start a new session.
        {error ? ` ${error}` : ""}
      </p>
    )
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
  )
}

"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { CockpitShell } from "@/components/cockpit/cockpit-shell"
import { DotLoader } from "@/components/cockpit/dot-loader"
import { IncidentHeader } from "@/components/cockpit/incident-header"
import { LiveCandidatePanel } from "@/components/cockpit/live-candidate-panel"
import { MessageComposer } from "@/components/cockpit/message-composer"
import { useDevinCase } from "@/hooks/use-devin-case"
import type { CaseEvent, Incident, Part } from "@/lib/live/types"

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
  const [draft, setDraft] = useState("")
  const [notes, setNotes] = useState<string[]>([])

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

  function sendNote(message: string) {
    const text = message.trim()
    if (!text) return
    setDraft("")
    setNotes((current) => [...current, text])
  }

  const incident = devin.snapshot?.incident ?? null
  const part = devin.snapshot?.part ?? null
  const connected = devin.status === "live" || devin.status === "stubbed"
  const sessions =
    connected && incident && part
      ? [
          {
            caseId: incident.case_id,
            partLabel: `${part.item_code} · ${part.item_name}`,
          },
        ]
      : []

  return (
    <CockpitShell
      sessions={sessions}
      rightSidebar={
        candidatesOpen ? (
          <LiveCandidatePanel
            candidates={devin.candidates}
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
            className="mx-auto w-full max-w-[50vw] gap-4 px-4 py-4"
            scrollClassName="chat-scrollbar overflow-x-hidden overflow-y-auto"
          >
            <SessionBanner
              status={devin.status}
              error={devin.error}
              sessionUrl={devin.session?.session_url ?? null}
            />
            {connected && incident && part ? (
              <IncidentRequest incident={incident} part={part} />
            ) : null}
            {devin.events.map((event) => (
              <EventTurn key={`${event.case_id}-${event.seq}`} event={event} />
            ))}
            {notes.map((note, index) => (
              <Message key={`note-${index}`} from="user">
                <MessageContent>
                  <p>{note}</p>
                </MessageContent>
              </Message>
            ))}
            {devin.status === "launching" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DotLoader className="size-4" />
                <span>Starting Devin…</span>
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="shrink-0 bg-background">
          <MessageComposer
            value={draft}
            status={devin.status === "launching" ? "submitted" : "ready"}
            onChange={setDraft}
            onSend={sendNote}
            onStop={() => undefined}
          />
        </div>
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
      . Events below are from the case log, not a local script.
    </p>
  )
}

function IncidentRequest({
  incident,
  part,
}: {
  incident: Incident
  part: Part
}) {
  return (
    <Message from="user">
      <MessageContent>
        <p className="leading-6">
          Resolve{" "}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-input px-1.5 py-[1px] align-baseline text-xs font-medium text-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-accent-foreground"
            />
            <span>
              @{incident.case_id} · {part.item_code}
            </span>
          </span>{" "}
          by finding Candidates, gathering Claims, and recommending a Decision.
        </p>
      </MessageContent>
    </Message>
  )
}

function EventTurn({ event }: { event: CaseEvent }) {
  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent>
        <p className="mb-1 font-mono text-xs text-muted-foreground">
          {event.stage} · {event.actor}
        </p>
        <MessageResponse>{event.message}</MessageResponse>
      </MessageContent>
    </Message>
  )
}

"use client"

import { Suspense, useEffect, useState } from "react"
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
import {
  AssistantTurn,
  CompletedRunSummary,
} from "@/components/cockpit/assistant-turn"
import { CallDetailDialog } from "@/components/cockpit/call-detail-dialog"
import { CandidatePanel } from "@/components/cockpit/candidate-panel"
import { CockpitShell } from "@/components/cockpit/cockpit-shell"
import {
  DecisionBar,
  type DecisionStatus,
} from "@/components/cockpit/decision-bar"
import { DotLoader } from "@/components/cockpit/dot-loader"
import { IncidentHeader } from "@/components/cockpit/incident-header"
import { IncidentRequestMessage } from "@/components/cockpit/incident-request-message"
import { MessageComposer } from "@/components/cockpit/message-composer"
import { useDeterministicRehearsal } from "@/hooks/use-deterministic-rehearsal"
import { FINAL_MESSAGE, SCRIPT, SEND_DELAY_MS } from "@/lib/case-001"

export function CockpitChat() {
  const rehearsal = useDeterministicRehearsal()
  const [approved, setApproved] = useState(false)
  const [candidatesOpen, setCandidatesOpen] = useState(true)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<string[]>([])
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const running = rehearsal.running
  const visible = rehearsal.revealedSteps

  useEffect(() => {
    if (pendingMessage === null) return

    const timeout = window.setTimeout(() => {
      setMessages((current) => [...current, pendingMessage])
      setPendingMessage(null)
    }, SEND_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [pendingMessage])

  const currentStep =
    rehearsal.currentStepIndex === null
      ? null
      : SCRIPT[rehearsal.currentStepIndex]
  const checksPassed = isStepVisible("tests", visible)
  const decisionExists = isStepVisible("strategy", visible)
  const decisionStatus: DecisionStatus = approved
    ? "approved"
    : !running && !checksPassed
      ? "on hold"
      : checksPassed
        ? "needs human review"
        : "evaluating"

  function replay() {
    rehearsal.replay()
    setApproved(false)
  }

  function sendMessage(message: string) {
    const text = message.trim()
    if (!text || running || pendingMessage !== null) return

    setDraft("")
    setPendingMessage(text)
  }

  const composerStatus = running
    ? "streaming"
    : pendingMessage !== null
      ? "submitted"
      : "ready"
  const conversationStepCount =
    rehearsal.completedSteps + (rehearsal.currentStepIndex === null ? 0 : 1)
  const complete =
    visible === SCRIPT.length && rehearsal.currentStepIndex === null

  return (
    <CockpitShell
      rightSidebar={
        candidatesOpen ? (
          <CandidatePanel
            visible={visible}
            onClose={() => setCandidatesOpen(false)}
          />
        ) : undefined
      }
    >
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <IncidentHeader
          visible={visible}
          approved={approved}
          running={running}
          onReplay={replay}
          showOpenCandidates={!candidatesOpen}
          onOpenCandidates={() => setCandidatesOpen(true)}
        />
        <Conversation className="min-h-0">
          <ConversationContent
            className="mx-auto w-full max-w-[50vw] gap-4 px-4 py-4"
            scrollClassName="chat-scrollbar overflow-x-hidden overflow-y-auto"
          >
            <IncidentRequestMessage />
            {complete ? (
              <>
                <CompletedRunSummary steps={SCRIPT} />
                <Message from="assistant" className="max-w-full">
                  <MessageContent>
                    <MessageResponse>{FINAL_MESSAGE}</MessageResponse>
                  </MessageContent>
                </Message>
              </>
            ) : (
              SCRIPT.slice(0, conversationStepCount).map((step, index) => {
                const current = index === rehearsal.currentStepIndex

                return (
                  <AssistantTurn
                    key={step.id}
                    step={step}
                    phase={
                      current && rehearsal.currentPhase
                        ? rehearsal.currentPhase
                        : "complete"
                    }
                    text={current ? rehearsal.currentText : undefined}
                  />
                )
              })
            )}
            {running ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DotLoader className="size-4" />
                <span>{currentStep?.stepName ?? "Launching"}</span>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <Message key={`${index}-${message}`} from="user">
                <MessageContent>
                  <p>{message}</p>
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="shrink-0 bg-background">
          {decisionExists ? (
            <DecisionBar
              checksPassed={checksPassed}
              status={decisionStatus}
              onApprove={() => setApproved(true)}
            />
          ) : null}
          <MessageComposer
            value={draft}
            status={composerStatus}
            onChange={setDraft}
            onSend={sendMessage}
            onStop={rehearsal.stop}
          />
        </div>
      </div>
      <Suspense fallback={null}>
        <CallDetailDialog />
      </Suspense>
    </CockpitShell>
  )
}

function isStepVisible(stepId: string, visible: number): boolean {
  const index = SCRIPT.findIndex((step) => step.id === stepId)
  return index >= 0 && visible > index
}

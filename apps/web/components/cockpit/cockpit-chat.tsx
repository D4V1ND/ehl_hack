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
import { FINAL_MESSAGE, SCRIPT, TICK_MS } from "@/lib/case-001"

export function CockpitChat() {
  const [visible, setVisible] = useState(0)
  const [approved, setApproved] = useState(false)
  const [candidatesOpen, setCandidatesOpen] = useState(true)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<string[]>([])
  const running = visible < SCRIPT.length

  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      setVisible((count) => Math.min(count + 1, SCRIPT.length))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running])

  const latestStep = SCRIPT[Math.min(visible, SCRIPT.length) - 1]
  const currentStep =
    visible === 0
      ? "Launching"
      : latestStep.kind === "decision"
        ? "Decision ready"
        : latestStep.stepName
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
    const skipTicks = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    setVisible(skipTicks ? SCRIPT.length : 0)
    setApproved(false)
  }

  function sendMessage(message: string) {
    const text = message.trim()
    if (!text) return

    setMessages((current) => [...current, text])
    setDraft("")
  }

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
            {running ? (
              SCRIPT.slice(0, visible).map((step, index) => (
                <AssistantTurn
                  key={step.id}
                  step={step}
                  latest={index === visible - 1}
                />
              ))
            ) : (
              <>
                <CompletedRunSummary steps={SCRIPT} />
                <Message from="assistant" className="max-w-full">
                  <MessageContent>
                    <MessageResponse>{FINAL_MESSAGE}</MessageResponse>
                  </MessageContent>
                </Message>
              </>
            )}
            {running ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DotLoader className="size-4" />
                <span>{currentStep}</span>
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
            onChange={setDraft}
            onSend={sendMessage}
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

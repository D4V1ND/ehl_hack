import { useCallback, useEffect, useState } from "react"

import {
  CALLS,
  getStepResponse,
  SCRIPT,
  STEP_SETTLE_DELAY_MS,
  STREAM_CHARS_PER_TICK,
  STREAM_TICK_MS,
  type CallingAgentRun,
} from "@/lib/case-001"
import { formatCallDuration } from "@/lib/case-001/agent-runs"
import { PLAN_POLL_MS } from "@/lib/live/config"
import {
  fetchPlan,
  indexPlan,
  startRun,
  stepFinished,
  stepStarted,
  type LivePlanStep,
  type PlanIndex,
} from "@/lib/live/plan"

const AGENT_NAMES = ["Mara", "Oskar", "Nia", "Felix", "Liv", "Theo"]
const AGENT_AVATAR_STYLES = [
  "bg-chart-1/30 text-chart-1",
  "bg-chart-2/30 text-chart-2",
  "bg-chart-3/30 text-chart-3",
  "bg-chart-4/30 text-chart-4",
  "bg-chart-5/30 text-chart-5",
]
const DIALING_MS = 2400
const TRANSCRIPT_REVEAL_MS = 30000

// Same contract as useDeterministicRehearsal, but the gate that advances each
// script row is the backend checklist (`GET /cases/{id}/plan`), not a timer.
// The narration text stays local; the state it narrates is the server's.
export function useLiveRehearsal(enabled: boolean) {
  const [plan, setPlan] = useState<PlanIndex | null>(null)
  const [stopped, setStopped] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [text, setText] = useState("")
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled || stopped) return
    let cancelled = false
    const poll = async () => {
      const next = await fetchPlan().catch(() => null)
      if (!cancelled && next) setPlan(indexPlan(next))
    }
    void poll()
    const interval = window.setInterval(() => void poll(), PLAN_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, stopped])

  useEffect(() => {
    if (!enabled || stopped) return
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [enabled, stopped])

  const step = cursor < SCRIPT.length ? SCRIPT[cursor] : undefined
  const finished = step !== undefined && scriptStepReached(step, plan)

  useEffect(() => {
    if (!enabled || stopped || !step || !finished) return

    const response = getStepResponse(step)
    if (text.length < response.length) {
      const timeout = window.setTimeout(() => {
        setText(
          response.slice(
            0,
            Math.min(text.length + STREAM_CHARS_PER_TICK, response.length)
          )
        )
      }, STREAM_TICK_MS)
      return () => window.clearTimeout(timeout)
    }

    const timeout = window.setTimeout(() => {
      setCursor((current) => current + 1)
      setText("")
    }, STEP_SETTLE_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [enabled, stopped, step, finished, text])

  const stop = useCallback(() => setStopped(true), [])

  const replay = useCallback(() => {
    setStopped(false)
    setCursor(0)
    setText("")
    setPlan(null)
    void startRun()
  }, [])

  const complete = cursor >= SCRIPT.length
  const currentStepIndex = complete ? null : cursor
  const currentPhase =
    currentStepIndex === null
      ? null
      : stopped
        ? ("stopped" as const)
        : !finished
          ? ("pending" as const)
          : text === getStepResponse(SCRIPT[cursor])
            ? ("complete" as const)
            : ("streaming" as const)

  return {
    completedSteps: cursor,
    currentPhase,
    currentStepIndex,
    currentText: text,
    agentRuns: resolveLiveAgentRuns(plan, now),
    revealedSteps: complete ? SCRIPT.length : cursor + (finished ? 1 : 0),
    running: enabled && !stopped && !complete,
    replay,
    stop,
  }
}

// The outreach kind narrates the moment the call *starts*; every other row
// narrates a result and waits for the backend to finish the step.
function scriptStepReached(
  step: (typeof SCRIPT)[number],
  plan: PlanIndex | null
): boolean {
  if (!plan || !step.planStepId) return false
  const row = plan[step.planStepId]
  return step.kind === "outreach" ? stepStarted(row) : stepFinished(row)
}

function resolveLiveAgentRuns(
  plan: PlanIndex | null,
  now: number
): readonly CallingAgentRun[] {
  return CALLS.map((call, index) => {
    const row = call.supplierRef
      ? plan?.[`outreach:${call.supplierRef}`]
      : undefined
    return liveAgentRun(call, row, index, now)
  })
}

function liveAgentRun(
  call: (typeof CALLS)[number],
  row: LivePlanStep | undefined,
  index: number,
  now: number
): CallingAgentRun {
  const startedAt = row?.started_at ? Date.parse(row.started_at) : null
  const completedAt =
    stepFinished(row) && row?.completed_at
      ? Date.parse(row.completed_at)
      : null
  const started = stepStarted(row) && startedAt !== null
  const elapsedMs = started
    ? Math.max(0, (completedAt ?? now) - startedAt)
    : 0
  const phase = !started
    ? ("queued" as const)
    : completedAt !== null
      ? ("complete" as const)
      : elapsedMs < DIALING_MS
        ? ("dialing" as const)
        : ("calling" as const)

  return {
    callId: call.id,
    candidateId: call.candidateId,
    name: AGENT_NAMES[index % AGENT_NAMES.length],
    avatarClassName: AGENT_AVATAR_STYLES[index % AGENT_AVATAR_STYLES.length],
    launchDelayMs: 0,
    dialingMs: DIALING_MS,
    durationMs: Math.max(elapsedMs, 1),
    phase,
    elapsedMs,
    startedAt,
    completedAt,
    durationLabel: formatCallDuration(elapsedMs),
    visibleTranscriptTurnCount: transcriptTurnCount(call, elapsedMs, phase),
  }
}

function transcriptTurnCount(
  call: (typeof CALLS)[number],
  elapsedMs: number,
  phase: "queued" | "dialing" | "calling" | "complete"
): number {
  if (phase === "queued" || phase === "dialing") return 0
  const turnCount = call.transcript.length
  if (phase === "complete") return turnCount

  const progress = Math.max(
    0,
    (elapsedMs - DIALING_MS) / TRANSCRIPT_REVEAL_MS
  )
  return Math.max(1, Math.min(turnCount, Math.ceil(progress * turnCount)))
}

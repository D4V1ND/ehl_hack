import { useCallback, useEffect, useState } from "react"

import {
  createCallingAgentPlan,
  getStepResponse,
  INITIAL_CALLING_AGENT_PLAN,
  latestCallingAgentEnd,
  resolveCallingAgentRuns,
  SCRIPT,
  STEP_SETTLE_DELAY_MS,
  STREAM_CHARS_PER_TICK,
  STREAM_TICK_MS,
} from "@/lib/case-001"

type PlaybackPhase = "waiting" | "text"
type PlaybackStatus = "streaming" | "stopped" | "complete"
type RehearsalTurnPhase = "pending" | "streaming" | "stopped" | "complete"

type PlaybackState = {
  status: PlaybackStatus
  phase: PlaybackPhase
  stepIndex: number
  text: string
}

const INITIAL_STATE: PlaybackState = {
  status: "streaming",
  phase: "waiting",
  stepIndex: 0,
  text: "",
}

// This hook is the timer-driven replacement seam for a live Devin Session.
// Keep its contract small so the Cockpit can later consume server events instead.
export function useDeterministicRehearsal(enabled = true) {
  const [playback, setPlayback] = useState<PlaybackState>(
    enabled ? INITIAL_STATE : { ...INITIAL_STATE, status: "stopped" }
  )
  const [agentPlan, setAgentPlan] = useState(INITIAL_CALLING_AGENT_PLAN)
  const [agentStartedAt, setAgentStartedAt] = useState<Record<string, number>>(
    {}
  )
  const [clock, setClock] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const timeout = window.setTimeout(() => {
      setAgentPlan(createCallingAgentPlan())
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [enabled])

  useEffect(() => {
    const step = SCRIPT[playback.stepIndex]
    if (
      playback.status !== "streaming" ||
      step?.kind !== "outreach" ||
      !step.callId ||
      agentStartedAt[step.callId] !== undefined
    ) {
      return
    }

    const callId = step.callId
    const timeout = window.setTimeout(() => {
      const startedAt = Date.now()
      setAgentStartedAt((current) => ({
        ...current,
        [callId]: startedAt,
      }))
      setClock(startedAt)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [agentStartedAt, playback.status, playback.stepIndex])

  useEffect(() => {
    if (
      playback.status !== "streaming" ||
      Object.keys(agentStartedAt).length === 0
    ) {
      return
    }

    const endAt = latestCallingAgentEnd(agentPlan, agentStartedAt)
    const updateClock = () => {
      const now = Date.now()
      setClock(now)
      return now >= endAt
    }

    if (updateClock()) return
    const interval = window.setInterval(() => {
      if (updateClock()) window.clearInterval(interval)
    }, 250)

    return () => window.clearInterval(interval)
  }, [agentPlan, agentStartedAt, playback.status])

  useEffect(() => {
    if (playback.status !== "streaming") return

    const step = SCRIPT[playback.stepIndex]
    if (!step) return

    if (playback.phase === "waiting") {
      const waitMs =
        step.id === "claims" &&
        agentPlan.every((agent) => agentStartedAt[agent.callId] !== undefined)
          ? Math.max(
              0,
              latestCallingAgentEnd(agentPlan, agentStartedAt) - Date.now()
            )
          : step.waitMs
      const timeout = window.setTimeout(() => {
        setPlayback((current) => {
          if (
            current.status !== "streaming" ||
            current.phase !== "waiting" ||
            current.stepIndex !== playback.stepIndex
          ) {
            return current
          }

          return { ...current, phase: "text", text: "" }
        })
      }, waitMs)

      return () => window.clearTimeout(timeout)
    }

    const response = getStepResponse(step)
    if (playback.text.length < response.length) {
      const timeout = window.setTimeout(() => {
        setPlayback((current) => {
          if (
            current.status !== "streaming" ||
            current.phase !== "text" ||
            current.stepIndex !== playback.stepIndex
          ) {
            return current
          }

          const nextLength = Math.min(
            current.text.length + STREAM_CHARS_PER_TICK,
            response.length
          )
          return { ...current, text: response.slice(0, nextLength) }
        })
      }, STREAM_TICK_MS)

      return () => window.clearTimeout(timeout)
    }

    const timeout = window.setTimeout(() => {
      setPlayback((current) => {
        if (
          current.status !== "streaming" ||
          current.phase !== "text" ||
          current.stepIndex !== playback.stepIndex
        ) {
          return current
        }

        const nextStepIndex = current.stepIndex + 1
        if (nextStepIndex === SCRIPT.length) {
          return {
            status: "complete",
            phase: "waiting",
            stepIndex: nextStepIndex,
            text: "",
          }
        }

        return {
          status: "streaming",
          phase: "waiting",
          stepIndex: nextStepIndex,
          text: "",
        }
      })
    }, STEP_SETTLE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [agentPlan, agentStartedAt, playback])

  const stop = useCallback(() => {
    setPlayback((current) => {
      if (current.status !== "streaming") return current
      return { ...current, status: "stopped" }
    })
  }, [])

  const replay = useCallback(() => {
    setAgentPlan(createCallingAgentPlan())
    setAgentStartedAt({})
    setClock(0)
    setPlayback(INITIAL_STATE)
  }, [])

  const currentStepIndex =
    playback.status === "streaming" ||
    (playback.status === "stopped" && playback.phase === "text")
      ? playback.stepIndex
      : null
  const currentPhase: RehearsalTurnPhase | null =
    currentStepIndex === null
      ? null
      : playback.status === "stopped"
        ? "stopped"
        : playback.phase === "waiting"
          ? "pending"
          : playback.text === getStepResponse(SCRIPT[playback.stepIndex])
            ? "complete"
            : "streaming"
  const revealedSteps =
    playback.status === "complete"
      ? SCRIPT.length
      : playback.stepIndex + (playback.phase === "text" ? 1 : 0)
  const agentRuns = resolveCallingAgentRuns(
    agentPlan,
    agentStartedAt,
    clock || Math.max(0, ...Object.values(agentStartedAt))
  )

  return {
    completedSteps: playback.stepIndex,
    currentPhase,
    currentStepIndex,
    currentText: playback.text,
    agentRuns,
    revealedSteps,
    running: playback.status === "streaming",
    replay,
    stop,
  }
}

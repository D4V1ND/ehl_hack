import { useCallback, useEffect, useState } from "react"

import {
  getStepResponse,
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
export function useDeterministicRehearsal() {
  const [playback, setPlayback] = useState<PlaybackState>(INITIAL_STATE)

  useEffect(() => {
    if (playback.status !== "streaming") return

    const step = SCRIPT[playback.stepIndex]
    if (!step) return

    if (playback.phase === "waiting") {
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
      }, step.waitMs)

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
  }, [playback])

  const stop = useCallback(() => {
    setPlayback((current) => {
      if (current.status !== "streaming") return current
      return { ...current, status: "stopped" }
    })
  }, [])

  const replay = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlayback({
        status: "complete",
        phase: "waiting",
        stepIndex: SCRIPT.length,
        text: "",
      })
      return
    }

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

  return {
    completedSteps: playback.stepIndex,
    currentPhase,
    currentStepIndex,
    currentText: playback.text,
    revealedSteps,
    running: playback.status === "streaming",
    replay,
    stop,
  }
}

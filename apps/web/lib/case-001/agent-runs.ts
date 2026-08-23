import { CALLS } from "@/lib/case-001/calls"

export type CallingAgentPhase = "queued" | "dialing" | "calling" | "complete"

export type CallingAgentPlan = {
  callId: string
  candidateId: string
  name: string
  avatarClassName: string
  launchDelayMs: number
  dialingMs: number
  durationMs: number
}

export type CallingAgentRun = CallingAgentPlan & {
  phase: CallingAgentPhase
  elapsedMs: number
  startedAt: number | null
  completedAt: number | null
  durationLabel: string
  visibleTranscriptTurnCount: number
}

const AGENT_NAMES = [
  "Mara",
  "Oskar",
  "Nia",
  "Felix",
  "Liv",
  "Theo",
  "Anika",
  "Jules",
]

const AGENT_AVATAR_STYLES = [
  "bg-chart-1/30 text-chart-1",
  "bg-chart-2/30 text-chart-2",
  "bg-chart-3/30 text-chart-3",
  "bg-chart-4/30 text-chart-4",
  "bg-chart-5/30 text-chart-5",
]

export const INITIAL_CALLING_AGENT_PLAN: readonly CallingAgentPlan[] =
  CALLS.map((call, index) => ({
    callId: call.id,
    candidateId: call.candidateId,
    name: AGENT_NAMES[index],
    avatarClassName: AGENT_AVATAR_STYLES[index],
    launchDelayMs: 400 + index * 180,
    dialingMs: 2400,
    durationMs: 18000 + index * 5000,
  }))

export function createCallingAgentPlan(): readonly CallingAgentPlan[] {
  const names = shuffled(AGENT_NAMES)

  return CALLS.map((call, index) => ({
    callId: call.id,
    candidateId: call.candidateId,
    name: names[index],
    avatarClassName:
      AGENT_AVATAR_STYLES[randomInteger(0, AGENT_AVATAR_STYLES.length - 1)],
    launchDelayMs: randomInteger(250, 1200),
    dialingMs: randomInteger(1800, 4200),
    durationMs: randomInteger(15000, 45000),
  }))
}

export function resolveCallingAgentRuns(
  plan: readonly CallingAgentPlan[],
  startedAtByCall: Readonly<Record<string, number>>,
  now: number
): readonly CallingAgentRun[] {
  return plan.map((agent) => {
    const requestedAt = startedAtByCall[agent.callId]
    if (requestedAt === undefined) return queuedRun(agent)

    const startedAt = requestedAt + agent.launchDelayMs
    const elapsedMs = Math.max(0, Math.min(now - startedAt, agent.durationMs))
    const completed = elapsedMs >= agent.durationMs
    const phase: CallingAgentPhase =
      now < startedAt
        ? "queued"
        : completed
          ? "complete"
          : elapsedMs < agent.dialingMs
            ? "dialing"
            : "calling"

    return {
      ...agent,
      phase,
      elapsedMs,
      startedAt,
      completedAt: completed ? startedAt + agent.durationMs : null,
      durationLabel: formatCallDuration(elapsedMs),
      visibleTranscriptTurnCount: transcriptTurnCount(agent, elapsedMs, phase),
    }
  })
}

export function latestCallingAgentEnd(
  plan: readonly CallingAgentPlan[],
  startedAtByCall: Readonly<Record<string, number>>
) {
  return Math.max(
    0,
    ...plan.flatMap((agent) => {
      const requestedAt = startedAtByCall[agent.callId]
      return requestedAt === undefined
        ? []
        : [requestedAt + agent.launchDelayMs + agent.durationMs]
    })
  )
}

export function formatCallDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${minutes}:${seconds}`
}

function queuedRun(agent: CallingAgentPlan): CallingAgentRun {
  return {
    ...agent,
    phase: "queued",
    elapsedMs: 0,
    startedAt: null,
    completedAt: null,
    durationLabel: "0:00",
    visibleTranscriptTurnCount: 0,
  }
}

function transcriptTurnCount(
  agent: CallingAgentPlan,
  elapsedMs: number,
  phase: CallingAgentPhase
) {
  if (phase === "queued" || phase === "dialing") return 0
  const call = CALLS.find((item) => item.id === agent.callId)
  const turnCount = call?.transcript.length ?? 0
  if (phase === "complete") return turnCount

  const speakingMs = Math.max(1, agent.durationMs - agent.dialingMs)
  const progress = Math.max(0, (elapsedMs - agent.dialingMs) / speakingMs)
  return Math.max(1, Math.min(turnCount, Math.ceil(progress * turnCount)))
}

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInteger(0, index)
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function randomInteger(minimum: number, maximum: number) {
  const range = maximum - minimum + 1
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return minimum + (values[0] % range)
}

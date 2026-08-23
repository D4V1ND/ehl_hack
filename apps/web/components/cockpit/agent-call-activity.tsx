"use client"

import { useRouter } from "next/navigation"

import { Bot } from "@/components/icons"
import { DotLoader } from "@/components/cockpit/dot-loader"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CALLS, type CallingAgentRun } from "@/lib/case-001"

export function AgentCallActivity({
  agentRuns,
}: {
  agentRuns: readonly CallingAgentRun[]
}) {
  const router = useRouter()
  const visibleRuns = [...agentRuns]
    .filter((agent) => agent.phase !== "queued")
    .sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0))

  function openCall(callId: string) {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("call", callId)
    router.replace(`${window.location.pathname}?${nextParams.toString()}`, {
      scroll: false,
    })
  }

  if (visibleRuns.length === 0) return null

  return (
    <div className="grid gap-1" aria-label="Calling agents">
      {visibleRuns.map((agent) => {
        const call = CALLS.find((item) => item.id === agent.callId)
        if (!call) return null
        const complete = agent.phase === "complete"

        return (
          <button
            key={agent.callId}
            type="button"
            className="agent-inline-call group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            data-complete={complete}
            onClick={() => openCall(agent.callId)}
            aria-label={`Open ${complete ? "completed" : "active"} call with ${call.supplier}`}
          >
            <Avatar size="sm" className="mt-0.5 after:border-0">
              <AvatarFallback className={agent.avatarClassName}>
                <Bot aria-hidden="true" className="size-3.5" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5 text-xs">
                <span className="truncate font-medium">{agent.name}</span>
                {!complete ? <DotLoader className="size-3.5" /> : null}
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  · {agent.durationLabel}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {complete
                  ? `Completed · Claim filed for ${call.supplier}`
                  : agent.phase === "dialing"
                    ? `Dialing ${call.supplier}...`
                    : `Calling ${call.supplier}...`}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

import {
  ActivityHeader,
  ActivityItem,
  SummaryValue,
  getCompletedAt,
} from "@/components/cockpit/call-activity"
import { CallClaim } from "@/components/cockpit/call-claim"
import { Badge } from "@/components/ui/badge"
import { INCIDENT, OUTREACH_TASKS, type RehearsalCall } from "@/lib/case-001"

export function CallHistory({ call }: { call: RehearsalCall }) {
  const task = OUTREACH_TASKS.find((candidate) => candidate.callId === call.id)
  const round = task?.round ?? call.claim.round
  const callStartedAt = call.runtimeStartedAt ?? task?.startedAt
  const callCompletedAt = getCompletedAt(callStartedAt, call.duration)
  const started = call.status !== "dialing"
  const completed =
    call.status === "completed" ||
    call.status === "no_answer" ||
    call.status === "stopped_for_human"
  const statusLabel =
    call.status === "dialing"
      ? "Dialing"
      : call.status === "calling"
        ? "Calling"
        : "Complete"

  return (
    <aside
      className="call-sidebar flex size-full min-h-0 flex-col"
      aria-labelledby="history-heading"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <h2 id="history-heading" className="text-sm font-medium">
          History
        </h2>
        <Badge variant="secondary">{statusLabel}</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <ol className="flex flex-col" aria-label="Call activity">
          <ActivityItem last={!started}>
            <ActivityHeader timestamp={callStartedAt}>
              Outreach Task prepared
            </ActivityHeader>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Phone · {call.maskedPhone}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-background/70 p-3">
              <SummaryValue label="Candidate" value={call.supplier} />
              <SummaryValue label="Part" value={INCIDENT.partId} mono />
              <SummaryValue label="Call ID" value={call.id} mono />
              <SummaryValue label="Round" value={String(round)} mono />
            </dl>
          </ActivityItem>
          {started ? (
            <ActivityItem last={!completed}>
              <ActivityHeader timestamp={callStartedAt}>
                Call started
              </ActivityHeader>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Round {round} · rehearsal · {call.duration}
              </p>
            </ActivityItem>
          ) : null}
          {completed ? (
            <>
              <ActivityItem>
                <ActivityHeader timestamp={callCompletedAt}>
                  Call completed
                </ActivityHeader>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Duration {call.duration}
                </p>
              </ActivityItem>
              <ActivityItem last>
                <CallClaim call={call} completedAt={callCompletedAt} />
              </ActivityItem>
            </>
          ) : null}
        </ol>
      </div>
    </aside>
  )
}

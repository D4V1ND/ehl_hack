import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function getCompletedAt(
  startedAt: string | undefined,
  duration: string
) {
  if (!startedAt) return undefined

  const [minutes = 0, seconds = 0] = duration.split(":").map(Number)
  const elapsedMilliseconds = (minutes * 60 + seconds) * 1000
  return new Date(Date.parse(startedAt) + elapsedMilliseconds).toISOString()
}

export function ActivityHeader({
  children,
  timestamp,
}: {
  children: ReactNode
  timestamp?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-medium">{children}</p>
      <ActivityTimestamp timestamp={timestamp} />
    </div>
  )
}

export function ActivityTimestamp({ timestamp }: { timestamp?: string }) {
  if (!timestamp) return null

  return (
    <time
      dateTime={timestamp}
      className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
    >
      {timestamp.slice(11, 19)} UTC
    </time>
  )
}

export function ActivityItem({
  children,
  last = false,
}: {
  children: ReactNode
  last?: boolean
}) {
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
      <div className="relative flex justify-center" aria-hidden>
        {last ? null : (
          <span className="absolute top-3 bottom-[-1.5rem] w-px bg-border" />
        )}
        <span className="relative mt-1 size-2.5 rounded-full bg-primary ring-4 ring-muted" />
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  )
}

export function SummaryValue({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 min-w-0 text-sm break-words",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function DetailRow({
  label,
  value,
  mono = false,
  destructive = false,
}: {
  label: string
  value: string
  mono?: boolean
  destructive?: boolean
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs break-words">
        {destructive ? (
          <Badge variant="destructive">{value}</Badge>
        ) : (
          <span className={mono ? "font-mono" : undefined}>{value}</span>
        )}
      </dd>
    </div>
  )
}

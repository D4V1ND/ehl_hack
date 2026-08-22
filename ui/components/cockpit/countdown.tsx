"use client"

import * as React from "react"

import { untilParts } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Time to line stop, ticking.
 *
 * One of only two moving things in the cockpit -- this and the event feed. The
 * urgency of the whole product is in this number, so it earns the motion.
 */
export function Countdown({ target, className }: { target: string; className?: string }) {
  const [now, setNow] = React.useState<number | null>(null)

  React.useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Render nothing time-dependent on the server: the clock differs between the
  // two and React would flag the mismatch.
  if (now === null) {
    return <span className={cn("tnum text-muted-soft", className)}>··· ·· ··</span>
  }

  const { past, days, hours, minutes } = untilParts(target, now)
  return (
    <span
      className={cn(
        "tnum",
        past ? "text-semantic-error" : days <= 14 ? "text-semantic-warning" : "text-ink",
        className,
      )}
      title={new Date(target).toISOString()}
    >
      {past ? "−" : ""}
      {days}d {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m
    </span>
  )
}

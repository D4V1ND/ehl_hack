"use client"

import * as React from "react"

import type { Event } from "@/lib/contracts"
import { clockTime } from "@/lib/format"
import { LEVEL_STYLE, stageMeta } from "@/lib/stages"
import { Kicker } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/**
 * The live event feed, pinned to the right of the case.
 *
 * This is the "it's alive" signal, and keeping it visible in every section is
 * why the case page scrolls rather than using tabs. Append-only, newest at the
 * bottom, auto-scrolled.
 */
export function EventDock({ events, replaying }: { events: Event[]; replaying: boolean }) {
  const endRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [events.length])

  return (
    <aside className="flex h-full flex-col border-l border-hairline bg-canvas-soft">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <Kicker>Event log</Kicker>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-ink">
          <span
            className={cn(
              "size-1.5 rounded-full",
              replaying ? "animate-pulse bg-semantic-success" : "bg-muted-soft",
            )}
          />
          {replaying ? "streaming" : `${events.length} events`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {events.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-soft">
            Nothing yet. Launch the case to start the log.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((event) => {
              const stage = stageMeta(event.stage)
              return (
                <li
                  key={`${event.seq}-${event.ts}`}
                  className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <div className="flex items-baseline gap-2">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", stage.dot)} />
                    <span className="tnum text-[11px] text-muted-soft">{clockTime(event.ts)}</span>
                    <span className="text-[11px] uppercase tracking-[0.6px] text-muted-soft">
                      {event.actor}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "ml-4 mt-0.5 text-[13px] leading-[1.45]",
                      LEVEL_STYLE[event.level ?? "info"],
                    )}
                  >
                    {event.message}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
        <div ref={endRef} />
      </div>
    </aside>
  )
}

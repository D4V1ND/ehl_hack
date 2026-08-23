import * as React from "react"

import { cn } from "@/lib/utils"

/** Small uppercase label. DESIGN.md `caption-uppercase`: 11px / 600 / 0.88px. */
export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.88px] text-muted-ink",
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A section of the case narrative. The page reads top to bottom in demo order. */
export function Section({
  id,
  step,
  kicker,
  title,
  aside,
  children,
}: {
  id: string
  step: number
  kicker: string
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-hairline py-10 first:border-t-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>
            <span className="tnum mr-2 text-muted-soft">{String(step).padStart(2, "0")}</span>
            {kicker}
          </Kicker>
          <h2 className="mt-1.5 text-[26px] font-normal leading-[1.25] tracking-[-0.325px] text-ink">
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** A single figure with a label. Numbers are mono and tabular, always. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "default" | "warning" | "danger" | "success"
}) {
  const toneClass = {
    default: "text-ink",
    warning: "text-semantic-warning",
    danger: "text-semantic-error",
    success: "text-semantic-success",
  }[tone]

  return (
    <div className="rounded-lg border border-hairline bg-surface-card px-4 py-3.5">
      <Kicker>{label}</Kicker>
      <div className={cn("tnum mt-1.5 text-[22px] leading-[1.2]", toneClass)}>{value}</div>
      {hint ? <div className="mt-1 text-[13px] leading-[1.4] text-muted-ink">{hint}</div> : null}
    </div>
  )
}

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("rounded-lg border border-hairline bg-surface-card", className)}>
      {children}
    </div>
  )
}

/** Mono chip for anything machine-readable: rule names, ids, part numbers. */
export function Mono({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <code
      className={cn(
        "rounded-xs border border-hairline bg-canvas-soft px-1.5 py-0.5 font-mono text-[12px] text-ink",
        className,
      )}
    >
      {children}
    </code>
  )
}

/**
 * What a section looks like before the slice that fills it has landed.
 *
 * Deliberately not a fake: showing invented candidates or an invented decision
 * would misrepresent another slice's output. It says what will appear here and
 * which endpoint will produce it.
 */
export function AwaitingSlice({
  owner,
  what,
  endpoint,
}: {
  owner: string
  what: string
  endpoint: string
}) {
  return (
    <Card className="border-dashed bg-canvas-soft px-5 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-pill border border-hairline-strong bg-surface-strong px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px] text-muted-ink">
        </span>
        <span className="text-[13px] text-muted-ink">{owner}</span>
      </div>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.5] text-body">{what}</p>
      <p className="mt-2 text-[13px] text-muted-ink">
        Renders as soon as <Mono>{endpoint}</Mono> returns data.
      </p>
    </Card>
  )
}

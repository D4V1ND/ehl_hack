"use client"

import { useEffect, useRef } from "react"
import { PhoneOffIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RehearsalCall } from "@/lib/case-001"

const BAR_COUNT = 12
const SAMPLE_COUNT = 40
const CYCLE_MS = 3600

function gaussian(position: number, center: number, width: number) {
  return Math.exp(-Math.pow((position - center) / width, 2))
}

function voiceScale(barIndex: number, position: number) {
  const envelope =
    0.08 +
    0.34 * gaussian(position, 0.13, 0.07) +
    0.92 * gaussian(position, 0.31, 0.045) +
    0.22 * gaussian(position, 0.51, 0.11) +
    0.76 * gaussian(position, 0.72, 0.075) +
    0.98 * gaussian(position, 0.91, 0.035)
  const phase = barIndex * 0.61
  const carrier =
    0.2 +
    0.58 *
      Math.abs(Math.sin(position * Math.PI * (8 + (barIndex % 3)) + phase)) +
    0.22 * Math.abs(Math.sin(position * Math.PI * 23 + phase * 1.7))
  const centerWeight =
    0.64 + 0.36 * Math.sin(((barIndex + 1) / (BAR_COUNT + 1)) * Math.PI)

  return Math.min(1, Math.max(0.1, 0.1 + envelope * carrier * centerWeight))
}

const KEYFRAMES = Array.from({ length: BAR_COUNT }, (_, barIndex) =>
  Array.from({ length: SAMPLE_COUNT + 1 }, (_, sampleIndex) => {
    const offset = sampleIndex / SAMPLE_COUNT
    return {
      offset,
      transform: `scaleY(${voiceScale(barIndex, offset).toFixed(3)})`,
    }
  })
)

const STATIC_SCALES = Array.from(
  { length: BAR_COUNT },
  (_, index) => 0.22 + 0.38 * Math.sin(((index + 1) / 13) * Math.PI)
)

export function CallStage({
  call,
  onEnd,
}: {
  call: RehearsalCall
  onEnd: () => void
}) {
  const active = call.status === "dialing" || call.status === "calling"
  const heading =
    call.status === "dialing"
      ? `${call.runtimeAgentName ?? "Agent"} is dialing`
      : call.status === "calling"
        ? `${call.runtimeAgentName ?? "Agent"} is calling`
        : "Rehearsal call complete"

  return (
    <section
      className="relative flex size-full min-h-0 flex-col items-center justify-center overflow-hidden bg-background px-6 py-16"
      aria-labelledby="call-stage-heading"
    >
      <div className="absolute top-4 flex flex-wrap items-center justify-center gap-2">
        <Badge variant="secondary">
          {active ? "Live rehearsal" : "Rehearsal"}
        </Badge>
        <Badge variant="outline">No call placed</Badge>
      </div>
      <div className="flex max-w-md flex-col items-center gap-7 text-center">
        <VoiceActivity active={call.status === "calling"} />
        <div className="flex flex-col gap-1.5">
          <h2 id="call-stage-heading" className="text-sm font-medium">
            {heading}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {call.duration} · {call.maskedPhone}
          </p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="destructive"
          size="icon-lg"
          className="size-12 rounded-full"
          onClick={onEnd}
        >
          <PhoneOffIcon />
          <span className="sr-only">Close call detail</span>
        </Button>
      </div>
    </section>
  )
}

function VoiceActivity({ active }: { active: boolean }) {
  const bars = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    if (
      !active ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    const animations = bars.current.flatMap((bar, index) =>
      bar
        ? [
            bar.animate(KEYFRAMES[index], {
              duration: CYCLE_MS,
              easing: "linear",
              iterations: Infinity,
            }),
          ]
        : []
    )
    return () => animations.forEach((animation) => animation.cancel())
  }, [active])

  return (
    <div className="flex h-32 items-center justify-center gap-1.5" aria-hidden>
      {STATIC_SCALES.map((scale, index) => (
        <span
          key={index}
          ref={(element) => {
            bars.current[index] = element
          }}
          className="h-24 w-2 origin-center rounded-full bg-primary will-change-transform"
          style={{ transform: `scaleY(${scale.toFixed(3)})` }}
        />
      ))}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  ChevronDownIcon,
  HistoryIcon,
  PhoneOffIcon,
  TranscriptIcon,
  XIcon,
} from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  CALLS,
  INCIDENT,
  OUTREACH_TASKS,
  type RehearsalCall,
} from "@/lib/case-001"
import { cn } from "@/lib/utils"

type MobilePane = "call" | "history" | "transcript"

const WIDE_CALL_LAYOUT = "(min-width: 64rem)"
const VOICE_BAR_COUNT = 12
const VOICE_SAMPLE_COUNT = 40
const VOICE_CYCLE_MS = 3600

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
    0.64 + 0.36 * Math.sin(((barIndex + 1) / (VOICE_BAR_COUNT + 1)) * Math.PI)

  return Math.min(1, Math.max(0.1, 0.1 + envelope * carrier * centerWeight))
}

const VOICE_KEYFRAMES = Array.from({ length: VOICE_BAR_COUNT }, (_, barIndex) =>
  Array.from({ length: VOICE_SAMPLE_COUNT + 1 }, (_, sampleIndex) => {
    const offset = sampleIndex / VOICE_SAMPLE_COUNT

    return {
      offset,
      transform: `scaleY(${voiceScale(barIndex, offset).toFixed(3)})`,
    }
  })
)

const STATIC_VOICE_SCALES = Array.from(
  { length: VOICE_BAR_COUNT },
  (_, index) => 0.22 + 0.38 * Math.sin(((index + 1) / 13) * Math.PI)
)

export function CallDetailDialog() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mockRequested = searchParams.get("mock") === "true"
  const callId = searchParams.get("call")
  const call =
    CALLS.find((candidate) => candidate.id === callId) ??
    (mockRequested ? CALLS[0] : undefined)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const [mobilePane, setMobilePane] = useState<MobilePane>("call")
  const [isWide, setIsWide] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(WIDE_CALL_LAYOUT)
    const update = () => setIsWide(media.matches)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  function closeDialog() {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("call")
    nextParams.delete("mock")
    const query = nextParams.toString()

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function toggleHistory() {
    if (isWide) {
      setHistoryOpen((open) => !open)
      return
    }

    setMobilePane((pane) => (pane === "history" ? "call" : "history"))
  }

  function toggleTranscript() {
    if (isWide) {
      setTranscriptOpen((open) => !open)
      return
    }

    setMobilePane((pane) => (pane === "transcript" ? "call" : "transcript"))
  }

  if (!call) return null

  const historyVisible = isWide ? historyOpen : mobilePane === "history"
  const transcriptVisible = isWide
    ? transcriptOpen
    : mobilePane === "transcript"

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-none w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none lg:h-[calc(100dvh-2rem)] lg:w-[calc(100vw-2rem)] lg:rounded-xl"
      >
        <header className="grid h-12 shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center border-b border-border px-2 sm:px-3">
          <div className="flex min-w-0 justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Toggle call history"
              aria-pressed={historyVisible}
              onClick={toggleHistory}
            >
              <HistoryIcon data-icon="inline-start" />
              <span className="hidden sm:inline">History</span>
            </Button>
          </div>

          <DialogTitle className="min-w-0 truncate px-2 text-center text-sm">
            {call.supplier}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Rehearsal call with connected history, animated voice state, and a
            transcript.
          </DialogDescription>

          <div className="flex min-w-0 items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Toggle transcript"
              aria-pressed={transcriptVisible}
              onClick={toggleTranscript}
            >
              <TranscriptIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Transcript</span>
            </Button>
            <DialogClose render={<Button variant="ghost" size="icon-lg" />}>
              <XIcon />
              <span className="sr-only">Close call dialog</span>
            </DialogClose>
          </div>
        </header>

        {isWide ? (
          <DesktopCallLayout
            call={call}
            historyOpen={historyOpen}
            transcriptOpen={transcriptOpen}
            onEnd={closeDialog}
          />
        ) : (
          <MobileCallLayout call={call} pane={mobilePane} onEnd={closeDialog} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DesktopCallLayout({
  call,
  historyOpen,
  transcriptOpen,
  onEnd,
}: {
  call: RehearsalCall
  historyOpen: boolean
  transcriptOpen: boolean
  onEnd: () => void
}) {
  const defaultPanelSize = historyOpen && transcriptOpen ? "33.333%" : "50%"

  return (
    <ResizablePanelGroup
      key={`${transcriptOpen}-${historyOpen}`}
      orientation="horizontal"
      className="min-h-0 flex-1"
    >
      {historyOpen ? (
        <>
          <ResizablePanel
            id="call-history"
            defaultSize={defaultPanelSize}
            minSize="19rem"
            maxSize="50%"
          >
            <HistoryPanel call={call} />
          </ResizablePanel>
          <ResizableHandle withHandle />
        </>
      ) : null}

      <ResizablePanel
        id="call-stage"
        defaultSize={historyOpen || transcriptOpen ? defaultPanelSize : "100%"}
        minSize="18rem"
      >
        <CallStage call={call} onEnd={onEnd} />
      </ResizablePanel>

      {transcriptOpen ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="call-transcript"
            defaultSize={defaultPanelSize}
            minSize="19rem"
            maxSize="50%"
          >
            <TranscriptPanel call={call} />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}

function MobileCallLayout({
  call,
  pane,
  onEnd,
}: {
  call: RehearsalCall
  pane: MobilePane
  onEnd: () => void
}) {
  if (pane === "transcript") return <TranscriptPanel call={call} />
  if (pane === "history") return <HistoryPanel call={call} />

  return <CallStage call={call} onEnd={onEnd} />
}

function TranscriptPanel({ call }: { call: RehearsalCall }) {
  const disclosure = call.transcript[0]?.text ?? ""
  const systemPrompt = `Outreach Task: call ${call.supplier} at ${call.maskedPhone} in rehearsal mode about ${INCIDENT.partId}. Begin with the mandatory disclosure: “${disclosure}” Then gather quantity, earliest readiness, unit price, free-versus-allocated stock, exact part confirmation, and certification status. Do not make commitments.`

  return (
    <section
      className="call-sidebar flex size-full min-h-0 flex-col"
      aria-labelledby="transcript-heading"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
        <h2 id="transcript-heading" className="text-sm font-medium">
          Transcript
        </h2>
      </div>

      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 p-4 sm:p-5">
              <MessageScrollerItem>
                <div className="flex flex-col gap-3 px-1">
                  <MessageHeader className="px-0">System</MessageHeader>
                  <p className="max-w-[70ch] text-sm leading-6 text-pretty text-muted-foreground">
                    {systemPrompt}
                  </p>
                </div>
              </MessageScrollerItem>

              {call.transcript.map((turn, index) => {
                const isAgent = turn.speaker === "Agent"

                return (
                  <MessageScrollerItem key={`${turn.speaker}-${index}`}>
                    <Message align={isAgent ? "start" : "end"}>
                      <MessageContent>
                        <MessageHeader
                          className={isAgent ? "px-0" : "justify-end px-0"}
                        >
                          {isAgent ? "Agent" : call.supplier}
                        </MessageHeader>
                        {isAgent ? (
                          <p className="max-w-[80%] text-sm leading-6 text-pretty">
                            {turn.text}
                          </p>
                        ) : (
                          <Bubble variant="secondary" align="end">
                            <BubbleContent>{turn.text}</BubbleContent>
                          </Bubble>
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </section>
  )
}

function CallStage({
  call,
  onEnd,
}: {
  call: RehearsalCall
  onEnd: () => void
}) {
  return (
    <section
      className="relative flex size-full min-h-0 flex-col items-center justify-center overflow-hidden bg-background px-6 py-16"
      aria-labelledby="call-stage-heading"
    >
      <div className="absolute top-4 flex flex-wrap items-center justify-center gap-2">
        <Badge variant="secondary">Rehearsal</Badge>
        <Badge variant="outline">No call placed</Badge>
      </div>

      <div className="flex max-w-md flex-col items-center gap-7 text-center">
        <VoiceActivity />
        <div className="flex flex-col gap-1.5">
          <h2 id="call-stage-heading" className="text-sm font-medium">
            Mock call playback
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
          <span className="sr-only">End mock call</span>
        </Button>
      </div>
    </section>
  )
}

function VoiceActivity() {
  const bars = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const animations = bars.current.flatMap((bar, index) => {
      if (!bar) return []

      return [
        bar.animate(VOICE_KEYFRAMES[index], {
          duration: VOICE_CYCLE_MS,
          easing: "linear",
          iterations: Infinity,
        }),
      ]
    })

    return () => animations.forEach((animation) => animation.cancel())
  }, [])

  return (
    <div
      className="flex h-32 items-center justify-center gap-1.5"
      aria-hidden="true"
    >
      {STATIC_VOICE_SCALES.map((scale, index) => (
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

function HistoryPanel({ call }: { call: RehearsalCall }) {
  const task = OUTREACH_TASKS.find((candidate) => candidate.callId === call.id)
  const stockAllocated = call.claim.stockStatus === "in_stock_allocated"
  const round = task?.round ?? call.claim.round
  const callStartedAt = task?.startedAt
  const callCompletedAt = getCompletedAt(callStartedAt, call.duration)

  return (
    <aside
      className="call-sidebar flex size-full min-h-0 flex-col"
      aria-labelledby="history-heading"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <h2 id="history-heading" className="text-sm font-medium">
          History
        </h2>
        <Badge variant="secondary">Complete</Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <ol className="flex flex-col" aria-label="Call activity">
          <ActivityItem>
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

          <ActivityItem>
            <ActivityHeader timestamp={callStartedAt}>
              Call started
            </ActivityHeader>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Round {round} · rehearsal
            </p>
          </ActivityItem>

          <ActivityItem>
            <ActivityHeader timestamp={callCompletedAt}>
              Call completed
            </ActivityHeader>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Duration {call.duration}
            </p>
          </ActivityItem>

          <ActivityItem last>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="group/claim -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Claim filed</span>
                    <Badge
                      variant={stockAllocated ? "destructive" : "secondary"}
                    >
                      {call.claim.confidence}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Supplier statement · not verified
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <ActivityTimestamp timestamp={callCompletedAt} />
                  <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[state=open]/claim:rotate-180 motion-reduce:transition-none" />
                </span>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-3 border-t border-border pt-1">
                  <dl className="divide-y divide-border">
                    <DetailRow
                      label="Quantity"
                      value={call.claim.quantityAvailable}
                      mono
                    />
                    <DetailRow
                      label="Earliest ready"
                      value={call.claim.earliestReady}
                      mono
                    />
                    <DetailRow
                      label="Price quoted"
                      value={call.claim.priceQuoted}
                      mono
                    />
                    <DetailRow
                      label="Unit price"
                      value={call.claim.unitPrice}
                      mono
                    />
                    <DetailRow
                      label="Certification valid"
                      value={call.claim.certificationCurrent}
                      mono
                    />
                    <DetailRow
                      label="Exact part confirmed"
                      value={call.claim.partNumberConfirmed}
                      mono
                    />
                    <DetailRow
                      label="stock_status"
                      value={call.claim.stockStatus}
                      mono
                      destructive={stockAllocated}
                    />
                    <DetailRow
                      label="Confidence"
                      value={call.claim.confidence}
                      mono
                    />
                  </dl>

                  <div className="border-t border-border py-4">
                    <h3 className="text-xs font-medium text-muted-foreground">
                      Evidence
                    </h3>
                    <div className="mt-3 flex flex-col gap-2">
                      {call.evidence.length > 0 ? (
                        call.evidence.map((quote, index) => (
                          <blockquote
                            key={`${call.id}-evidence-${index}`}
                            className="rounded-lg bg-background/70 p-3 text-sm leading-6"
                          >
                            “{quote}”
                          </blockquote>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No evidence recorded.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </ActivityItem>
        </ol>
      </div>
    </aside>
  )
}

function getCompletedAt(startedAt: string | undefined, duration: string) {
  if (!startedAt) return undefined

  const [minutes = 0, seconds = 0] = duration.split(":").map(Number)
  const elapsedMilliseconds = (minutes * 60 + seconds) * 1000

  return new Date(Date.parse(startedAt) + elapsedMilliseconds).toISOString()
}

function ActivityHeader({
  children,
  timestamp,
}: {
  children: React.ReactNode
  timestamp?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-medium">{children}</p>
      <ActivityTimestamp timestamp={timestamp} />
    </div>
  )
}

function ActivityTimestamp({ timestamp }: { timestamp?: string }) {
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

function ActivityItem({
  children,
  last = false,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
      <div className="relative flex justify-center" aria-hidden="true">
        {last ? null : (
          <span className="absolute top-3 bottom-[-1.5rem] w-px bg-border" />
        )}
        <span className="relative mt-1 size-2.5 rounded-full bg-primary ring-4 ring-muted" />
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  )
}

function SummaryValue({
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

function DetailRow({
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

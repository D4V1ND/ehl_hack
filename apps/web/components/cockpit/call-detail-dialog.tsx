"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  DesktopCallLayout,
  MobileCallLayout,
  type MobilePane,
} from "@/components/cockpit/call-layout"
import { HistoryIcon, TranscriptIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { CALLS } from "@/lib/case-001"

const WIDE_CALL_LAYOUT = "(min-width: 64rem)"

export function CallDetailDialog() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mockRequested = searchParams.get("mock") === "true"
  const call =
    CALLS.find((candidate) => candidate.id === searchParams.get("call")) ??
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
    if (isWide) setHistoryOpen((open) => !open)
    else setMobilePane((pane) => (pane === "history" ? "call" : "history"))
  }

  function toggleTranscript() {
    if (isWide) setTranscriptOpen((open) => !open)
    else {
      setMobilePane((pane) => (pane === "transcript" ? "call" : "transcript"))
    }
  }

  if (!call) return null

  const historyVisible = isWide ? historyOpen : mobilePane === "history"
  const transcriptVisible = isWide
    ? transcriptOpen
    : mobilePane === "transcript"

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
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

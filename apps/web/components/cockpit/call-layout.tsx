import { CallHistory } from "@/components/cockpit/call-history"
import { CallStage } from "@/components/cockpit/call-stage"
import { CallTranscript } from "@/components/cockpit/call-transcript"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { RehearsalCall } from "@/lib/case-001"

export type MobilePane = "call" | "history" | "transcript"

type CallLayoutProps = {
  call: RehearsalCall
  onEnd: () => void
}

export function DesktopCallLayout({
  call,
  historyOpen,
  transcriptOpen,
  onEnd,
}: CallLayoutProps & {
  historyOpen: boolean
  transcriptOpen: boolean
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
            <CallHistory call={call} />
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
            <CallTranscript call={call} />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}

export function MobileCallLayout({
  call,
  pane,
  onEnd,
}: CallLayoutProps & { pane: MobilePane }) {
  if (pane === "transcript") return <CallTranscript call={call} />
  if (pane === "history") return <CallHistory call={call} />
  return <CallStage call={call} onEnd={onEnd} />
}

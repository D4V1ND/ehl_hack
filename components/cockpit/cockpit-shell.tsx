"use client"

import {
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"

import { SessionSidebar } from "@/components/cockpit/session-sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const LEFT_SIDEBAR_MIN = 10
const LEFT_SIDEBAR_MAX = 20

export function CockpitShell({
  children,
  rightSidebar,
}: {
  children: ReactNode
  rightSidebar?: ReactNode
}) {
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(LEFT_SIDEBAR_MAX)

  function resizeLeftSidebar(clientX: number) {
    const viewportPercentage = (clientX / window.innerWidth) * 100
    setLeftSidebarWidth(
      Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, viewportPercentage))
    )
  }

  function startLeftResize(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeLeftSidebar(event.clientX)
  }

  function continueLeftResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      resizeLeftSidebar(event.clientX)
    }
  }

  function stopLeftResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function resizeLeftWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

    event.preventDefault()
    const direction = event.key === "ArrowRight" ? 1 : -1
    setLeftSidebarWidth((width) =>
      Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, width + direction))
    )
  }

  return (
    <SidebarProvider
      open
      onOpenChange={() => undefined}
      className="h-dvh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": `${leftSidebarWidth}vw` } as CSSProperties}
    >
      <SessionSidebar
        width={leftSidebarWidth}
        onResizeStart={startLeftResize}
        onResize={continueLeftResize}
        onResizeEnd={stopLeftResize}
        onResizeKeyDown={resizeLeftWithKeyboard}
      />
      <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden">
        <WorkspacePanels rightSidebar={rightSidebar}>
          {children}
        </WorkspacePanels>
      </SidebarInset>
    </SidebarProvider>
  )
}

function WorkspacePanels({
  children,
  rightSidebar,
}: {
  children: ReactNode
  rightSidebar?: ReactNode
}) {
  const [showsCandidatePanel, setShowsCandidatePanel] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 48rem)")
    const update = () => setShowsCandidatePanel(media.matches)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  if (!showsCandidatePanel) return children

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="conversation" minSize="30vw">
        {children}
      </ResizablePanel>
      {rightSidebar ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="candidates"
            defaultSize="30vw"
            minSize="20vw"
            maxSize="50vw"
          >
            {rightSidebar}
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}

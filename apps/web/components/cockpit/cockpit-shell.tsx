"use client"

import { useEffect, useState, type ReactNode } from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export function CockpitShell({
  children,
  rightSidebar,
}: {
  children: ReactNode
  rightSidebar?: ReactNode
}) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <WorkspacePanels rightSidebar={rightSidebar}>{children}</WorkspacePanels>
    </div>
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

"use client"

import {
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { LogoIcon } from "@/components/logo"
import { INCIDENTS } from "@/lib/case-001"

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
      Math.min(
        LEFT_SIDEBAR_MAX,
        Math.max(LEFT_SIDEBAR_MIN, viewportPercentage)
      )
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
      style={
        { "--sidebar-width": `${leftSidebarWidth}vw` } as CSSProperties
      }
    >
      <CockpitSidebar
        width={leftSidebarWidth}
        onResizeStart={startLeftResize}
        onResize={continueLeftResize}
        onResizeEnd={stopLeftResize}
        onResizeKeyDown={resizeLeftWithKeyboard}
      />
      <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden">
        <WorkspacePanels rightSidebar={rightSidebar}>{children}</WorkspacePanels>
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

function CockpitSidebar({
  width,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeKeyDown,
}: {
  width: number
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void
  onResize: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeEnd: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  const [activeSession, setActiveSession] =
    useState<(typeof INCIDENTS)[number]["caseId"]>(INCIDENTS[0].caseId)

  return (
    <Sidebar collapsible="offcanvas" className="h-dvh">
      <SidebarHeader className="h-11 items-start justify-center border-b border-border/70 px-4 py-0">
        <LogoIcon
          aria-label="SupplyOS"
          className="size-5 text-sidebar-foreground"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="flex-1 py-3">
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {INCIDENTS.map((incident) => (
                <SidebarMenuItem key={incident.caseId}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={incident.caseId === activeSession}
                    onClick={() => setActiveSession(incident.caseId)}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-xs">
                        {incident.caseId}
                      </span>
                      <span className="block truncate text-xs text-sidebar-foreground/60">
                        {incident.partLabel}
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail
        resizable
        aria-valuemin={LEFT_SIDEBAR_MIN}
        aria-valuemax={LEFT_SIDEBAR_MAX}
        aria-valuenow={Math.round(width)}
        onPointerDown={onResizeStart}
        onPointerMove={onResize}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        onKeyDown={onResizeKeyDown}
      />
    </Sidebar>
  )
}

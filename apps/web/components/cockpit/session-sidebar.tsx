"use client"

import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react"
import { LogoIcon } from "@/components/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type SidebarSession = {
  caseId: string
  partLabel: string
}

type SessionSidebarProps = {
  sessions: readonly SidebarSession[]
  width: number
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void
  onResize: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeEnd: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function SessionSidebar({
  sessions = [],
  width,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeKeyDown,
}: SessionSidebarProps) {
  const [activeSession, setActiveSession] = useState<string | null>(
    sessions[0]?.caseId ?? null
  )

  useEffect(() => {
    if (sessions.some((session) => session.caseId === activeSession)) return
    setActiveSession(sessions[0]?.caseId ?? null)
  }, [activeSession, sessions])

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
              {sessions.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">
                  No Devin session yet.
                </p>
              ) : (
                sessions.map((session) => (
                  <SidebarMenuItem key={session.caseId}>
                    <SidebarMenuButton
                      size="lg"
                      isActive={session.caseId === activeSession}
                      onClick={() => setActiveSession(session.caseId)}
                      className={cn(
                        "mb-px h-10 py-0.5! text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted data-active:bg-muted data-active:font-normal data-active:text-foreground"
                      )}
                    >
                      <span className="min-w-0 truncate text-xs">
                        {session.partLabel}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail
        resizable
        aria-valuemin={10}
        aria-valuemax={20}
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

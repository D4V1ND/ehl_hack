"use client"

import { useState, type KeyboardEvent, type PointerEvent } from "react"
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
import { INCIDENTS } from "@/lib/case-001"

type SessionSidebarProps = {
  width: number
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void
  onResize: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeEnd: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function SessionSidebar({
  width,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeKeyDown,
}: SessionSidebarProps) {
  const [activeSession, setActiveSession] = useState<
    (typeof INCIDENTS)[number]["caseId"]
  >(INCIDENTS[0].caseId)

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

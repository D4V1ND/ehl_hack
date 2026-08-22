"use client"

import type { CSSProperties, ReactNode } from "react"
import {
  ArrowUpRightIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "@/components/icons"

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

export function CockpitShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      className="h-dvh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
    >
      <CockpitSidebar />
      <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

function CockpitSidebar() {
  return (
    <Sidebar collapsible="offcanvas" className="h-dvh">
      <SidebarHeader className="h-11 justify-center px-4 py-0">
        <span className="text-sm font-medium">Stockout</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="py-3">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <PlusIcon aria-hidden="true" />
                  <span>New session</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <TriangleAlertIcon aria-hidden="true" />
                  <span>Open incidents</span>
                  <ArrowUpRightIcon
                    aria-hidden="true"
                    className="ml-auto opacity-0 transition-opacity group-hover/menu-button:opacity-100 group-focus-visible/menu-button:opacity-100"
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="flex-1 py-3">
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <p className="px-2 py-1 text-xs leading-relaxed text-sidebar-foreground/60">
              Session history will appear here after SQLite is connected.
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

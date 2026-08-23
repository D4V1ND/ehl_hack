"use client";

import { useMemo } from "react";

import { PlusIcon } from "@/components/icons";
import { LogoIcon } from "@/components/logo";
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
  useSidebar,
} from "@/components/ui/sidebar";
import type { CaseSummary } from "@/lib/live/types";
import { cn } from "@/lib/utils";

export function SessionSidebar({
  sessions,
  activeCaseId,
  launching,
  onSelectSession,
  onNewSession,
}: {
  sessions: readonly CaseSummary[];
  activeCaseId: string | null;
  launching: boolean;
  onSelectSession: (caseId: string) => void;
  onNewSession: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const recentSessions = useMemo(
    () =>
      [...sessions].sort((left, right) =>
        right.opened_at.localeCompare(left.opened_at),
      ),
    [sessions],
  );

  function selectSession(caseId: string) {
    onSelectSession(caseId);
    if (isMobile) setOpenMobile(false);
  }

  function startSession() {
    onNewSession();
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="offcanvas" className="h-dvh">
      <SidebarHeader className="h-11 flex-row items-center justify-between border-b border-border/70 px-3 py-0">
        <LogoIcon
          aria-label="SupplyOS"
          className="size-5 text-sidebar-foreground"
        />
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50"
          aria-label="Start new sourcing session"
          disabled={launching}
          onClick={startSession}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="flex-1 py-3">
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            {recentSessions.length > 0 ? (
              <SidebarMenu>
                {recentSessions.map((session) => (
                  <SidebarMenuItem key={session.case_id}>
                    <SidebarMenuButton
                      size="lg"
                      isActive={session.case_id === activeCaseId}
                      onClick={() => selectSession(session.case_id)}
                      className="mb-px h-auto min-h-12 items-start py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted data-active:bg-muted data-active:font-normal data-active:text-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40",
                          session.stage === "calling" && "bg-foreground",
                          session.stage === "decided" && "bg-chart-5",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-current">
                          {session.item_name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                          {session.case_id} · {session.stage}
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
                No sourcing sessions yet.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

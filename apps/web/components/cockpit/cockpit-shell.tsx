"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function CockpitShell({
  children,
  leftSidebar,
  rightSidebar,
}: {
  children: ReactNode;
  leftSidebar: ReactNode;
  rightSidebar?: ReactNode;
}) {
  return (
    <SidebarProvider
      defaultOpen
      className="h-dvh min-h-0 overflow-hidden"
      style={
        {
          "--sidebar-width": "clamp(13rem, 17vw, 18rem)",
        } as CSSProperties
      }
    >
      {leftSidebar}
      <SidebarInset className="h-dvh min-h-0 min-w-0 overflow-hidden">
        <WorkspacePanels rightSidebar={rightSidebar}>
          {children}
        </WorkspacePanels>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspacePanels({
  children,
  rightSidebar,
}: {
  children: ReactNode;
  rightSidebar?: ReactNode;
}) {
  const [showsCandidatePanel, setShowsCandidatePanel] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 48rem)");
    const update = () => setShowsCandidatePanel(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (!showsCandidatePanel) return children;

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
  );
}

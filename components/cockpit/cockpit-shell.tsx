import type { ReactNode } from "react"

export function CockpitShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      {children}
    </div>
  )
}

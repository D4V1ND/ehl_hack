"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CockpitNav = "dashboard" | "chat"

export function CockpitShell({
  active,
  trailing,
  children,
}: {
  active: CockpitNav
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium">Stockout</span>
        <nav className="flex items-center gap-1" aria-label="Cockpit">
          <NavLink href="/dashboard" active={active === "dashboard"}>
            Dashboard
          </NavLink>
          <NavLink href="/chat" active={active === "chat"}>
            Chat
          </NavLink>
        </nav>
        <Badge variant="outline">rehearsal</Badge>
        <span className="text-muted-foreground text-sm">Munich plant</span>
        {trailing ? (
          <div className="ml-auto flex min-w-0 items-center gap-2">{trailing}</div>
        ) : null}
      </header>
      {children}
    </div>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Button
      nativeButton={false}
      size="sm"
      variant={active ? "default" : "ghost"}
      className={cn(!active && "text-muted-foreground")}
      render={<Link href={href} aria-current={active ? "page" : undefined} />}
    >
      {children}
    </Button>
  )
}

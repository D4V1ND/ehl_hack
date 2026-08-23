"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { ArrowRightIcon } from "@/components/icons"
import { buttonVariants } from "@/components/ui/button"
import { openCase } from "@/lib/live/api"
import { PART_ID } from "@/lib/live/config"
import { cn } from "@/lib/utils"

export function OpenChatButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const opened = await openCase(PART_ID)
      router.push(`/chat?case=${encodeURIComponent(opened.case_id)}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start Devin")
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className={cn(
          buttonVariants({
            size: "lg",
            className:
              "group h-14 w-full justify-between rounded-xl bg-foreground px-5 text-background hover:bg-foreground/85 disabled:opacity-70",
          })
        )}
      >
        {busy ? "Starting Devin…" : "Open chat"}
        <ArrowRightIcon
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

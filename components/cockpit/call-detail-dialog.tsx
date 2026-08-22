"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CallDetailSummary } from "@/components/cockpit/call-detail-summary"
import { CallTranscript } from "@/components/cockpit/call-transcript"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CALLS } from "@/lib/case-001"

export function CallDetailDialog() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const call = CALLS.find(
    (candidate) => candidate.id === searchParams.get("call")
  )

  function closeDialog() {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("call")
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (!call) return null

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[min(76rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 gap-3 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Rehearsal</Badge>
            <Badge variant="outline">No call placed</Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-lg">
              Call details · {call.supplier}
            </DialogTitle>
            <DialogDescription>
              Structured Outreach Task and Claim beside the complete rehearsal
              transcript. Claims are not facts.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(19rem,0.85fr)_minmax(24rem,1.15fr)]">
          <CallDetailSummary call={call} />
          <CallTranscript call={call} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

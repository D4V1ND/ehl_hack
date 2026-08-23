"use client"

import { useState } from "react"

import { CheckIcon, ChevronRightIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CANDIDATES, LANDED_LINES, STRATEGIES } from "@/lib/case-001"
import { cn } from "@/lib/utils"

type DecisionBarProps = {
  recorded: boolean
  selectedCandidateId: string | null
  onSelectCandidate: (candidateId: string) => void
  onRecord: () => void
}

const SELECTABLE_CANDIDATES = CANDIDATES.filter((candidate) => {
  const landedLine = LANDED_LINES.find(
    (line) => line.candidateId === candidate.id
  )
  return candidate.compliance === "passed" && landedLine?.usable !== false
})

export function DecisionBar({
  recorded,
  selectedCandidateId,
  onSelectCandidate,
  onRecord,
}: DecisionBarProps) {
  const [open, setOpen] = useState(false)
  const selectedCandidate = CANDIDATES.find(
    (candidate) => candidate.id === selectedCandidateId
  )

  function recordDecision() {
    onRecord()
    setOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-[50vw] px-4 pt-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card
          size="sm"
          className="w-full gap-0 border border-border bg-secondary/70 py-0 ring-0"
        >
          <CollapsibleContent className="border-b border-border/70 px-3 py-3">
            <DecisionDetails
              recorded={recorded}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={onSelectCandidate}
              onRecord={recordDecision}
            />
          </CollapsibleContent>
          <CollapsibleTrigger
            className="group flex min-h-10 w-full min-w-0 items-center gap-3 px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle Decision details"
          >
            <span className="text-sm font-medium">Complete</span>
            <span className="ml-auto flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              {recorded ? (
                <>
                  <CheckIcon aria-hidden="true" className="size-3.5" />
                  <span className="truncate">
                    {selectedCandidate?.name ?? "Decision recorded"}
                  </span>
                </>
              ) : (
                <span>Take decision</span>
              )}
              <ChevronRightIcon className="size-4 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[panel-open]:rotate-90 motion-reduce:transition-none" />
            </span>
          </CollapsibleTrigger>
        </Card>
      </Collapsible>
    </div>
  )
}

function DecisionDetails({
  recorded,
  selectedCandidateId,
  onSelectCandidate,
  onRecord,
}: DecisionBarProps) {
  return (
    <div className="text-sm">
      <p className="font-medium">Choose a Candidate</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Compare Claims and Supplier Records before you record the Decision.
      </p>
      <div className="mt-3 grid gap-1.5">
        {STRATEGIES.map((strategy) => {
          const recommended = strategy.note.includes("Recommended")
          return (
            <div
              key={strategy.name}
              className={cn(
                "rounded-lg border px-2.5 py-2",
                recommended
                  ? "border-foreground/40 bg-secondary"
                  : "border-border/70"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {strategy.name}
                </span>
                {recommended ? <Badge>recommended</Badge> : null}
                <span className="shrink-0 font-mono text-xs">
                  {strategy.total}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {strategy.note}
              </p>
            </div>
          )
        })}
      </div>
      <div className="mt-3 grid gap-1.5" role="radiogroup">
        {SELECTABLE_CANDIDATES.map((candidate) => {
          const selected = selectedCandidateId === candidate.id
          const landedLine = LANDED_LINES.find(
            (line) => line.candidateId === candidate.id
          )

          return (
            <button
              key={candidate.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={recorded}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                selected ? "bg-secondary" : "hover:bg-muted/70"
              )}
              onClick={() => onSelectCandidate(candidate.id)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-muted-foreground/50"
                )}
              >
                {selected ? <CheckIcon className="size-3" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {candidate.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {candidate.claimUnit} · {landedLine?.arrivalDays ?? "unknown"}{" "}
                  days
                </span>
              </span>
              <Badge variant="secondary">ready</Badge>
            </button>
          )
        })}
      </div>
      <Button
        type="button"
        size="lg"
        className="mt-4 w-full rounded-xl bg-foreground text-background hover:bg-foreground/85"
        disabled={!selectedCandidateId || recorded}
        onClick={onRecord}
      >
        {recorded ? "Decision recorded" : "Record Decision"}
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Recording is final. It does not place an order.
      </p>
    </div>
  )
}

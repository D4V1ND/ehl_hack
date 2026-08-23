import { XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import type { LiveCandidate } from "@/lib/live/types"

export function LiveCandidatePanel({
  candidates,
  onClose,
}: {
  candidates: readonly LiveCandidate[]
  onClose: () => void
}) {
  return (
    <aside
      aria-label="Candidates"
      className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-sidebar text-foreground"
    >
      <header className="flex min-h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-medium">Candidates</h2>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Close Candidates sidebar"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </header>
      {candidates.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No Candidates yet. They appear when Devin writes them to the case.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {candidates.map((candidate) => (
            <li
              key={candidate.supplier_ref}
              className="border-b border-border/70 px-4 py-3"
            >
              <p className="text-sm font-medium">{candidate.supplier_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {candidate.country} ·{" "}
                {candidate.compliance.passed ? "passed policy" : "rejected"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {candidate.why_matched}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

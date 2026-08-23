import type { Candidate } from "@/components/cockpit/candidate-types"
import { Badge } from "@/components/ui/badge"

export function RejectedCandidate({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">compliance</span>
        <Badge variant="destructive">failed</Badge>
      </div>
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <p className="font-mono text-xs text-destructive">
          {candidate.failedRules.join(", ") || "rule not provided"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Shenzhen Bearing Co is rejected. No Outreach Task or Claim.
        </p>
      </div>
    </div>
  )
}

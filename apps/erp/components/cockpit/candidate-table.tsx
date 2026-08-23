import type { Candidate } from "@/lib/contracts"
import { percent } from "@/lib/format"
import { POLICY_RULE_LABEL } from "@/lib/stages"
import { Card, Kicker, Mono } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/**
 * Screening, with the rejections left in.
 *
 * A shortlist that silently drops the six suppliers policy refused cannot be
 * argued with in a procurement review, so every candidate stays on the page and
 * carries the rule that decided it.
 */
export function CandidateTable({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) {
    return (
      <Card className="border-dashed bg-canvas-soft px-5 py-6">
        <p className="text-[15px] text-muted-ink">No suppliers screened yet.</p>
      </Card>
    )
  }

  const passed = candidates.filter((candidate) => candidate.compliance.passed).length

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-hairline bg-canvas-soft text-left">
              {["Supplier", "Origin", "Policy", "Why", "Confidence"].map((heading) => (
                <th
                  key={heading}
                  className={cn(
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.88px] text-muted-ink",
                    heading === "Confidence" ? "text-right" : "",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const failed = candidate.compliance.failed_rules ?? []
              return (
                <tr key={candidate.supplier_ref} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{candidate.supplier_name}</div>
                    <Mono className="mt-1 inline-block">{candidate.supplier_ref}</Mono>
                  </td>
                  <td className="px-4 py-3 text-body">{candidate.country}</td>
                  <td className="px-4 py-3">
                    {candidate.compliance.passed ? (
                      <span className="rounded-pill border border-semantic-success/35 bg-semantic-success/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.7px] text-semantic-success">
                        Cleared
                      </span>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <span className="rounded-pill border border-semantic-error/35 bg-semantic-error/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.7px] text-semantic-error">
                          Rejected
                        </span>
                        {failed.map((rule) => (
                          <span key={rule} className="text-[12px] text-semantic-error">
                            {POLICY_RULE_LABEL[rule] ?? rule}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[420px] px-4 py-3 text-[13px] leading-[1.45] text-body">
                    {candidate.compliance.passed
                      ? candidate.why_matched
                      : failed
                          .map((rule) => candidate.compliance.explanations?.[rule] ?? rule)
                          .join(" ")}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-body">
                    {percent(candidate.confidence)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-hairline bg-canvas-soft px-4 py-2.5">
        <Kicker>
          {passed} of {candidates.length} cleared policy
        </Kicker>
      </div>
    </Card>
  )
}

import type { LiveCandidate, SupplierRecord } from "@/lib/live/types"

/** Rank for the sidebar: policy first, then preferred/incumbent, then cheaper and faster.

Missing price or lead sorts after a real number in the same policy group.
Money is compared as a decimal string, never as a float.
*/
export function rankCandidates(
  candidates: readonly LiveCandidate[],
  recordsById: ReadonlyMap<string, SupplierRecord>
): LiveCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftRecord = recordsById.get(left.supplier_ref)
    const rightRecord = recordsById.get(right.supplier_ref)

    const policy = Number(right.compliance.passed) - Number(left.compliance.passed)
    if (policy !== 0) return policy

    const preferred =
      Number(Boolean(rightRecord?.preferred)) - Number(Boolean(leftRecord?.preferred))
    if (preferred !== 0) return preferred

    const incumbent =
      Number(Boolean(rightRecord?.incumbent)) - Number(Boolean(leftRecord?.incumbent))
    if (incumbent !== 0) return incumbent

    const price = compareMoney(
      leftRecord?.contract_unit_price,
      rightRecord?.contract_unit_price
    )
    if (price !== 0) return price

    const lead = compareLead(
      leftRecord?.standard_lead_days,
      rightRecord?.standard_lead_days
    )
    if (lead !== 0) return lead

    return left.supplier_ref.localeCompare(right.supplier_ref)
  })
}

function compareMoney(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftMissing = left == null || left === ""
  const rightMissing = right == null || right === ""
  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  const [leftWhole = "0", leftFrac = ""] = left.split(".")
  const [rightWhole = "0", rightFrac = ""] = right.split(".")
  const scale = Math.max(leftFrac.length, rightFrac.length)
  const leftUnits = BigInt(leftWhole + leftFrac.padEnd(scale, "0"))
  const rightUnits = BigInt(rightWhole + rightFrac.padEnd(scale, "0"))
  if (leftUnits < rightUnits) return -1
  if (leftUnits > rightUnits) return 1
  return 0
}

function compareLead(
  left: number | null | undefined,
  right: number | null | undefined
): number {
  const leftMissing = left == null
  const rightMissing = right == null
  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1
  return left - right
}

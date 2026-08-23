/** Display-only formatters. Money stays a string; nothing here does arithmetic. */

export function formatEur(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  return `EUR ${value}`
}

export function formatEurPerPc(value: string | null | undefined): string {
  if (value == null || value === "") return "—"
  return `EUR ${value} / pc`
}

export function formatLeadDays(days: number | null | undefined): string {
  if (days == null) return "—"
  return `${days} days door-to-door`
}

export function formatQty(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-GB").format(value)
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return value.replace(/_/g, " ")
}

/** Last-resort mask. The API already sends `phone_masked`. */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "—"
  if (value.includes("*")) return value
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 4) return "*".repeat(8)
  return `+${digits.slice(0, 2)}${"*".repeat(digits.length - 6)}${digits.slice(-4)}`
}

export function offerTeaser(
  unitPrice: string | null | undefined,
  leadDays: number | null | undefined
): string {
  const price = unitPrice ? formatEur(unitPrice) : null
  const lead = leadDays != null ? `${leadDays}d` : null
  if (!price && !lead) return "—"
  return [price, lead].filter(Boolean).join(" · ")
}

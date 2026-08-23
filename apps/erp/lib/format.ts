/**
 * Formatting helpers.
 *
 * Money arrives as a string because a Decimal serialized as a JSON float is
 * exactly the drift the money rule exists to prevent. Nothing here does
 * arithmetic on it -- it formats and moves on.
 */

export function money(value: string | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined || value === "") return "—"
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: n < 10 ? 2 : 0,
    maximumFractionDigits: n < 10 ? 4 : 0,
  }).format(n)
}

export function qty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-GB").format(value)
}

export function day(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function clockTime(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Days, hours and minutes until `iso`. Negative once the deadline has passed. */
export function untilParts(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now
  const past = ms < 0
  const abs = Math.abs(ms)
  return {
    past,
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
  }
}

/**
 * A last-resort display mask.
 *
 * The API never sends an unmasked number -- `SupplierRecord` has no field for
 * one -- so this should never have anything to do. It exists so that if a raw
 * number ever does reach the browser, it is still not rendered.
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "—"
  if (value.includes("*")) return value
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 4) return "*".repeat(8)
  return `+${digits.slice(0, 2)}${"*".repeat(digits.length - 6)}${digits.slice(-4)}`
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${Math.round(value * 100)}%`
}

export function titleise(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

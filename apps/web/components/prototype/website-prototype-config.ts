export const VARIANTS = [
  { key: "A", label: "Soft focus" },
  { key: "B", label: "Editorial edge" },
  { key: "C", label: "Open horizon" },
  { key: "D", label: "Quiet control" },
  { key: "E", label: "Selected direction" },
] as const

export type VariantKey = (typeof VARIANTS)[number]["key"]

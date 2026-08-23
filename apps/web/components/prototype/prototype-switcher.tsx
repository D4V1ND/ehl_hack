"use client"

type PrototypeSwitcherProps = {
  currentIndex: number
  label: string
  total: number
  previousHref: string
  nextHref: string
}

export function PrototypeSwitcher({
  currentIndex,
  label,
  total,
  previousHref,
  nextHref,
}: PrototypeSwitcherProps) {
  if (process.env.NODE_ENV === "production") return null

  return (
    <aside
      aria-label="Prototype variant switcher"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/95 p-1 text-foreground shadow-2xl backdrop-blur-md"
    >
      <a
        href={previousHref}
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
        aria-label="Previous variant"
      >
        <span aria-hidden="true">←</span>
      </a>
      <span className="min-w-40 px-2 text-center text-xs font-medium">
        {currentIndex + 1}/{total} · {label}
      </span>
      <a
        href={nextHref}
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
        aria-label="Next variant"
      >
        <span aria-hidden="true">→</span>
      </a>
    </aside>
  )
}

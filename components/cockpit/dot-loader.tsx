const DELAYS_MS = [200, 100, 200, 100, 0, 100, 200, 100, 200]

export function DotLoader() {
  return (
    <span
      role="status"
      aria-label="Working"
      className="inline-grid size-6 shrink-0 grid-cols-3 grid-rows-3 place-items-center text-muted-foreground"
    >
      {DELAYS_MS.map((delay, index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-current motion-safe:animate-pulse"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  )
}

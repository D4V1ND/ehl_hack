const DELAYS_MS = [200, 100, 200, 100, 0, 100, 200, 100, 200]

export function DotLoader({
  className
}: {
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={`inline-grid size-3.5 shrink-0 grid-cols-3 grid-rows-3 place-items-center ${className || 'text-foreground'}`}
    >
      {DELAYS_MS.map((delay, index) => (
        <span
          key={index}
          className="size-[2.5px] rounded-full bg-current motion-safe:animate-pulse"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  )
}

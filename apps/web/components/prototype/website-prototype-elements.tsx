import { Logo } from "@/components/logo"

export function PrototypeLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Logo
      className={`absolute top-6 right-6 z-20 sm:top-8 sm:right-10 ${
        inverse ? "text-background" : "text-foreground"
      }`}
    />
  )
}

export function MockEmailField({
  placeholder,
  buttonLabel,
  inverse = false,
  stacked = false,
}: {
  placeholder: string
  buttonLabel: string
  inverse?: boolean
  stacked?: boolean
}) {
  return (
    <form
      className={
        stacked
          ? "flex w-full max-w-sm flex-col gap-2"
          : "flex w-full max-w-md items-center rounded-full border border-foreground/20 bg-background/70 p-1.5 shadow-lg backdrop-blur-xl"
      }
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="sr-only" htmlFor="beta-email">
        Work email
      </label>
      <input
        id="beta-email"
        type="email"
        autoComplete="email"
        placeholder={placeholder}
        className={
          stacked
            ? "h-13 w-full rounded-lg border border-foreground/20 bg-background/70 px-4 text-sm text-foreground outline-none placeholder:text-foreground/55 focus:border-foreground/50"
            : "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-foreground/55"
        }
      />
      <button
        type="submit"
        className={
          stacked
            ? "flex h-13 items-center justify-between rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85"
            : `flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-opacity hover:opacity-85 ${
                inverse
                  ? "bg-background text-foreground"
                  : "bg-foreground text-background"
              }`
        }
      >
        {buttonLabel}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

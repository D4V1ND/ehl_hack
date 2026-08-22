"use client"

function StockoutLogo() {
  return (
    <div
      aria-label="Stockout"
      className="absolute top-6 right-6 z-20 flex items-center gap-2 text-foreground sm:top-8 sm:right-10"
    >
      <span className="relative size-4 rounded-full border-[1.5px] border-current">
        <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      </span>
      <span className="text-sm font-semibold tracking-[-0.03em]">stockout</span>
    </div>
  )
}

function BetaAccessForm() {
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="sr-only" htmlFor="beta-email">
        Work email
      </label>
      <input
        id="beta-email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        className="h-13 w-full rounded-lg border border-foreground/20 bg-background/70 px-4 text-sm text-foreground outline-none placeholder:text-foreground/55 focus:border-foreground/50"
      />
      <button
        type="submit"
        className="flex h-13 items-center justify-between rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85"
      >
        Join the private beta
        <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

export default function Home() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 bg-cover bg-[position:center_44%] sm:bg-[position:center_38%] lg:bg-[position:center_34%]"
        style={{ backgroundImage: "url('/website/background-4.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/65 via-background/5 to-transparent" />
      <StockoutLogo />

      <section className="relative z-10 flex h-full items-end px-6 pt-28 pb-24 sm:px-12 sm:pb-18 lg:px-20">
        <div className="grid w-full items-end gap-9 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
          <div className="max-w-3xl">
            <h1 className="text-5xl leading-[0.93] font-medium tracking-[-0.065em] sm:text-7xl lg:text-[6rem]">
              <span className="block">The engineer</span>
              <span className="block">your supply chain</span>
              <span className="block">was missing.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">
              Agents call suppliers, check every Claim, and bring you the best
              Strategy.
            </p>
          </div>
          <BetaAccessForm />
        </div>
      </section>
    </main>
  )
}

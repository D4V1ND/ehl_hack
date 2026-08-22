"use client"

import { useEffect } from "react"

import { PrototypeSwitcher } from "@/components/prototype/prototype-switcher"

// Five beta-homepage variants, switchable with ?variant=, on /prototype/website.
const variants = [
  { key: "A", label: "Soft focus" },
  { key: "B", label: "Editorial edge" },
  { key: "C", label: "Open horizon" },
  { key: "D", label: "Quiet control" },
  { key: "E", label: "Selected direction" },
] as const

type VariantKey = (typeof variants)[number]["key"]

function isVariantKey(value: string | undefined): value is VariantKey {
  return variants.some((variant) => variant.key === value?.toUpperCase())
}

function StockoutLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div
      aria-label="Stockout"
      className={`absolute top-6 right-6 z-20 flex items-center gap-2 sm:top-8 sm:right-10 ${
        inverse ? "text-background" : "text-foreground"
      }`}
    >
      <span className="relative size-4 rounded-full border-[1.5px] border-current">
        <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      </span>
      <span className="text-sm font-semibold tracking-[-0.03em]">stockout</span>
    </div>
  )
}

function MockEmailField({
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

function VariantA() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-background">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-1.png')" }}
      />
      <div className="absolute inset-0 bg-background/15" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_145%)]" />
      <StockoutLogo inverse />

      <section className="relative z-10 flex h-full items-center justify-center px-6 pb-16 text-center">
        <div className="flex w-full max-w-4xl flex-col items-center">
          <h1 className="max-w-3xl text-5xl leading-[0.94] font-medium tracking-[-0.065em] text-balance sm:text-7xl lg:text-[6.5rem]">
            Sourcing, before the line stops.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-background/70 sm:text-lg">
            Stockout turns shortages into checked supplier options and one
            approval-ready Decision.
          </p>
          <div className="mt-9 flex w-full justify-center text-foreground">
            <MockEmailField
              placeholder="Work email"
              buttonLabel="Request beta access"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantB() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-1.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/20 to-background/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent" />
      <StockoutLogo />

      <section className="relative z-10 flex h-full items-end px-6 pt-28 pb-24 sm:px-12 sm:pb-18 lg:px-20">
        <div className="grid w-full items-end gap-9 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
          <div className="max-w-3xl">
            <h1 className="text-5xl leading-[0.93] font-medium tracking-[-0.065em] text-balance sm:text-7xl lg:text-[6rem]">
              Meet the engineer your supply chain was missing.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">
              Agents call suppliers, check every Claim, and bring you the best
              Strategy.
            </p>
          </div>
          <MockEmailField
            placeholder="you@company.com"
            buttonLabel="Join the private beta"
            stacked
          />
        </div>
      </section>
    </main>
  )
}

function VariantC() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-2.jpeg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-background/5" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-transparent to-background/45" />
      <StockoutLogo />

      <section className="relative z-10 flex h-full items-center px-6 pb-14 sm:px-12 lg:px-20">
        <div className="w-full max-w-2xl">
          <h1 className="text-5xl leading-[0.94] font-medium tracking-[-0.06em] text-balance sm:text-7xl lg:text-[6rem]">
            When stock runs out, Stockout starts.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/70 sm:text-lg">
            From Incident to approved Decision, every sourcing step stays
            visible.
          </p>
          <div className="mt-9">
            <MockEmailField
              placeholder="Your work email"
              buttonLabel="Get early access"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantD() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-background">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-2.jpeg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-l from-foreground/85 via-foreground/25 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/35 via-transparent to-transparent" />
      <StockoutLogo inverse />

      <section className="relative z-10 flex h-full items-center justify-end px-6 pb-16 sm:px-12 lg:px-20">
        <div className="flex w-full max-w-xl flex-col items-end text-right">
          <h1 className="text-6xl leading-[0.9] font-medium tracking-[-0.07em] text-balance sm:text-8xl lg:text-[7rem]">
            The shortage ends here.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-background/70 sm:text-lg">
            Auditable sourcing that moves at machine speed, with humans in
            control.
          </p>
          <div className="mt-9 flex w-full justify-end text-foreground">
            <MockEmailField
              placeholder="Email address"
              buttonLabel="Enter the beta"
              inverse
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantE() {
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
          <MockEmailField
            placeholder="you@company.com"
            buttonLabel="Join the private beta"
            stacked
          />
        </div>
      </section>
    </main>
  )
}

const variantComponents: Record<VariantKey, () => React.JSX.Element> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: VariantD,
  E: VariantE,
}

export function WebsitePrototype({
  initialVariant,
}: {
  initialVariant?: string
}) {
  const normalizedInitialVariant = initialVariant?.toUpperCase()
  const currentKey: VariantKey = isVariantKey(normalizedInitialVariant)
    ? normalizedInitialVariant
    : "A"
  const currentIndex = variants.findIndex(
    (variant) => variant.key === currentKey
  )
  const previousKey =
    variants[(currentIndex - 1 + variants.length) % variants.length].key
  const nextKey = variants[(currentIndex + 1) % variants.length].key

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isEditing =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        target?.isContentEditable

      if (isEditing) return
      if (event.key === "ArrowLeft") {
        window.location.assign(`/prototype/website?variant=${previousKey}`)
      }
      if (event.key === "ArrowRight") {
        window.location.assign(`/prototype/website?variant=${nextKey}`)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [nextKey, previousKey])

  const CurrentVariant = variantComponents[currentKey]
  const currentVariant = variants[currentIndex]

  return (
    <>
      <CurrentVariant />
      <PrototypeSwitcher
        currentIndex={currentIndex}
        label={`${currentVariant.key} (${currentVariant.label})`}
        total={variants.length}
        previousHref={`/prototype/website?variant=${previousKey}`}
        nextHref={`/prototype/website?variant=${nextKey}`}
      />
    </>
  )
}
